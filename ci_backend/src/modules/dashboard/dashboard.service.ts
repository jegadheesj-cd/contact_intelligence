import prisma from '../../config/db';
import { ocrQueue, faceRecognitionQueue, enrichmentQueue, aiSummaryQueue } from '../../queue/queue';

export class DashboardService {
  public async getDashboardWidgets(userId: string) {
    // 1. Total Contacts
    const totalContacts = await prisma.contact.count({
      where: { userId },
    });

    // 2. Recent Uploads (Business Cards)
    const recentUploads = await prisma.businessCard.findMany({
      where: {
        uploadedFile: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { uploadedFile: true },
    });

    // 3. OCR Status Breakdown
    const ocrStats = await prisma.businessCard.groupBy({
      by: ['ocrStatus'],
      where: {
        uploadedFile: { userId },
      },
      _count: true,
    });

    // 4. Face Recognition Breakdown
    const faceStats = await prisma.faceRecognition.groupBy({
      by: ['status'],
      where: {
        uploadedFile: { userId },
      },
      _count: true,
    });

    // 5. Most Common Companies
    const commonCompanies = await prisma.contact.groupBy({
      by: ['company'],
      where: {
        userId,
        company: { not: null },
      },
      _count: { company: true },
      orderBy: {
        _count: {
          company: 'desc',
        },
      },
      take: 5,
    });

    // 6. Most Common Industries
    const commonIndustries = await prisma.contact.groupBy({
      by: ['industry'],
      where: {
        userId,
        industry: { not: null },
      },
      _count: { industry: true },
      orderBy: {
        _count: {
          industry: 'desc',
        },
      },
      take: 5,
    });

    // 7. Most Common Skills (In-memory aggregate)
    const contactsWithSkills = await prisma.contact.findMany({
      where: {
        userId,
        skills: { isEmpty: false },
      },
      select: { skills: true },
    });

    const skillCounts: Record<string, number> = {};
    for (const c of contactsWithSkills) {
      for (const skill of c.skills) {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      }
    }
    const commonSkills = Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 8. Recently Enriched Contacts
    const recentlyEnriched = await prisma.contact.findMany({
      where: {
        userId,
        professionalProfile: {
          enrichmentStatus: 'COMPLETED',
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { professionalProfile: true },
    });

    // 9. Verification rate and AI Insights coverage
    const totalProfiles = await prisma.professionalProfile.count({
      where: { contact: { userId } }
    });
    const verifiedProfiles = await prisma.professionalProfile.count({
      where: { contact: { userId }, verificationStatus: 'Verified' }
    });
    const verificationRate = totalProfiles > 0 ? Math.round((verifiedProfiles / totalProfiles) * 100) : 0;

    const contactsWithSummary = await prisma.contact.count({
      where: { userId, aiSummary: { isNot: null } }
    });
    const aiSummaryCoverage = totalContacts > 0 ? Math.round((contactsWithSummary / totalContacts) * 100) : 0;

    return {
      totalContacts,
      recentUploads,
      ocrStats: ocrStats.map((s) => ({ status: s.ocrStatus, count: s._count })),
      faceStats: faceStats.map((s) => ({ status: s.status, count: s._count })),
      commonCompanies: commonCompanies.map((c) => ({ company: c.company, count: c._count.company })),
      commonIndustries: commonIndustries.map((i) => ({ industry: i.industry, count: i._count.industry })),
      commonSkills,
      recentlyEnriched,
      verificationRate,
      aiSummaryCoverage,
    };
  }

  public async getAnalyticsMetrics(userId: string) {
    // 1. OCR Success Rate & Failed Job Counts
    const ocrJobs = await prisma.businessCard.findMany({
      where: { uploadedFile: { userId } },
      select: { ocrStatus: true, createdAt: true, updatedAt: true },
    });

    const ocrCompleted = ocrJobs.filter((j) => j.ocrStatus === 'COMPLETED');
    const ocrFailed = ocrJobs.filter((j) => j.ocrStatus === 'FAILED');
    const ocrSuccessRate = ocrJobs.length > 0 ? (ocrCompleted.length / (ocrCompleted.length + ocrFailed.length || 1)) * 100 : 100;

    // Average OCR processing time (in ms)
    let totalOcrTime = 0;
    for (const job of ocrCompleted) {
      totalOcrTime += job.updatedAt.getTime() - job.createdAt.getTime();
    }
    const avgOcrTime = ocrCompleted.length > 0 ? Math.round(totalOcrTime / ocrCompleted.length) : 0;

    // 2. Face Recognition Accuracy & Performance
    const faceJobs = await prisma.faceRecognition.findMany({
      where: { uploadedFile: { userId } },
      select: { status: true, recognizedResult: true, createdAt: true, updatedAt: true },
    });

    const faceCompleted = faceJobs.filter((j) => j.status === 'COMPLETED');
    const faceFailed = faceJobs.filter((j) => j.status === 'FAILED');
    
    // Average Face Recognition processing time (in ms)
    let totalFaceTime = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const job of faceCompleted) {
      totalFaceTime += job.updatedAt.getTime() - job.createdAt.getTime();
      const res = job.recognizedResult as any;
      if (res && res.similarityScore !== undefined) {
        totalConfidence += res.similarityScore;
        confidenceCount++;
      }
    }

    const avgFaceTime = faceCompleted.length > 0 ? Math.round(totalFaceTime / faceCompleted.length) : 0;
    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.0;

    // 3. Queue Status (Waiting, Active, Completed, Failed counts)
    const getQueueStatus = async (q: any) => {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          q.getWaitingCount(),
          q.getActiveCount(),
          q.getCompletedCount(),
          q.getFailedCount(),
        ]);
        return { waiting, active, completed, failed };
      } catch (err) {
        return { waiting: 0, active: 0, completed: 0, failed: 0 };
      }
    };

    const queueStatuses = {
      ocrQueue: await getQueueStatus(ocrQueue),
      faceRecognitionQueue: await getQueueStatus(faceRecognitionQueue),
      enrichmentQueue: await getQueueStatus(enrichmentQueue),
      aiSummaryQueue: await getQueueStatus(aiSummaryQueue),
    };

    return {
      ocrSuccessRate,
      failedOcrCount: ocrFailed.length,
      averageOcrTimeMs: avgOcrTime,
      recognitionAccuracy: avgConfidence,
      failedRecognitionCount: faceFailed.length,
      averageRecognitionTimeMs: avgFaceTime,
      queueStatuses,
    };
  }
}
