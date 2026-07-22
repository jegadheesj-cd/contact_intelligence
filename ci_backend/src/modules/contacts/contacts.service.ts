import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import { enrichmentQueue, aiSummaryQueue } from '../../queue/queue';
import { ContactSource, Prisma } from '@prisma/client';
import { calculateDecisionMakerScore } from '../profile-enrichment/enrichment.service';
import logger from '../../config/logger';

export class ContactsService {
  public async findDuplicateContact(userId: string, data: any): Promise<any | null> {
    const email = data.email?.toLowerCase().trim();
    const phoneDigits = data.phone?.replace(/\D/g, '') || data.mobile?.replace(/\D/g, '') || data.office?.replace(/\D/g, '');
    const linkedin = data.linkedin_url?.toLowerCase().trim() || data.linkedinUrl?.toLowerCase().trim();
    const name = data.name;
    const company = data.company;

    // Get all contacts of this user
    const contacts = await prisma.contact.findMany({
      where: { userId },
      include: {
        professionalProfile: true,
      },
    });

    for (const c of contacts) {
      // 1. Email check
      if (email && c.email && c.email.toLowerCase().trim() === email) {
        return c;
      }
      // 2. Phone check
      if (phoneDigits && phoneDigits.length >= 7) {
        const cPhoneDigits = c.phone?.replace(/\D/g, '');
        if (cPhoneDigits && cPhoneDigits === phoneDigits) {
          return c;
        }
      }
      // 3. LinkedIn check
      if (linkedin) {
        const cLinkedin = (c as any).professionalProfile?.linkedInUrl?.toLowerCase().trim() || (c as any).professionalProfile?.mergedProfile?.profileUrl?.toLowerCase().trim();
        if (cLinkedin && cLinkedin === linkedin) {
          return c;
        }
      }
      // 4. Name + Company check
      if (name && company && c.company) {
        const nameSim = this.calculateSimilarity(name, c.name);
        const companySim = this.calculateSimilarity(company, c.company);
        if (nameSim >= 0.8 && companySim >= 0.8) {
          return c;
        }
      }
    }

    return null;
  }

  public async mergeFieldsIntoContact(userId: string, contactId: string, fields: any) {
    const contact = await this.getContactById(userId, contactId);

    const chooseBestField = (val1: string | null, val2: string | null) => {
      if (!val1) return val2;
      if (!val2) return val1;
      return val1.length >= val2.length ? val1 : val2;
    };

    const mergedData: any = {
      name: chooseBestField(contact.name, fields.name) || contact.name,
      company: chooseBestField(contact.company, fields.company),
      designation: chooseBestField(contact.designation, fields.designation),
      email: chooseBestField(contact.email, fields.email),
      phone: chooseBestField(contact.phone, fields.phone),
      website: chooseBestField(contact.website, fields.website),
      address: chooseBestField(contact.address, fields.address),
      industry: chooseBestField(contact.industry, fields.industry),
    };

    if (fields.skills && Array.isArray(fields.skills)) {
      mergedData.skills = Array.from(new Set([...(contact.skills || []), ...fields.skills]));
    }
    if (fields.interests && Array.isArray(fields.interests)) {
      mergedData.interests = Array.from(new Set([...(contact.interests || []), ...fields.interests]));
    }

    // Re-evaluate decision score
    if (mergedData.designation) {
      mergedData.decisionMakerScore = calculateDecisionMakerScore(mergedData.designation);
    }

    return await prisma.contact.update({
      where: { id: contactId },
      data: mergedData,
      include: {
        tags: true,
        notes: true,
        professionalProfile: true,
        aiSummary: true,
      },
    });
  }

  public async createContact(userId: string, data: any) {
    // 1. Check if duplicate exists
    const duplicate = await this.findDuplicateContact(userId, data);
    if (duplicate) {
      logger.info(`[Contacts Service] Duplicate contact found (${duplicate.id}). Merging details...`);
      // Merge new fields into duplicate
      const merged = await this.mergeFieldsIntoContact(userId, duplicate.id, data);
      
      // If there are tags, add them
      if (data.tags && Array.isArray(data.tags)) {
        await this.addTags(userId, duplicate.id, data.tags);
      }
      // If there are notes, add them
      if (data.notes) {
        await this.addNote(userId, duplicate.id, data.notes);
      }
      // If there is linkedInUrl, update it
      if (data.linkedInUrl && !(duplicate as any).professionalProfile?.mergedProfile?.profileUrl) {
        await prisma.professionalProfile.upsert({
          where: { contactId: duplicate.id },
          create: {
            contactId: duplicate.id,
          },
          update: {
          },
        });
      }
      return this.getContactById(userId, duplicate.id);
    }

    const { tags, notes, linkedInUrl, salesNavigatorId, ...contactData } = data;
    const score = calculateDecisionMakerScore(contactData.designation || '');

    // Create contact with relational tags, note and linkedin placeholder
    const contact = await prisma.contact.create({
      data: {
        ...contactData,
        decisionMakerScore: score,
        user: { connect: { id: userId } },
        tags: {
          connectOrCreate: (tags || []).map((tagName: string) => ({
            where: { name_userId: { name: tagName.trim(), userId } },
            create: { name: tagName.trim(), userId },
          })),
        },
        // Optional initial note
        ...(notes ? {
          notes: {
            create: {
              content: notes,
              userId,
            },
          },
        } : {}),
        // Optional Professional Profile
        professionalProfile: {
          create: {},
        },
        // Optional AI Summary Placeholder
        aiSummary: {
          create: {
            summaryText: 'Summary generation pending...',
          },
        },
      },
      include: {
        tags: true,
        notes: true,
        professionalProfile: true,
        aiSummary: true,
      },
    });

    // Note: Enrichment and AI Summary are now explicitly triggered via the Business Intelligence Phase.
    // They are no longer automatically queued on contact creation.

    return contact;
  }

  public async getContactById(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
      include: {
        tags: true,
        notes: true,
        professionalProfile: true,
        aiSummary: true,
        businessCards: true,
        nfcData: true,
        faceRecognitions: true,
      },
    });

    if (!contact) {
      throw new AppError('Contact not found or access denied', 404);
    }

    return contact;
  }

  public async updateContact(userId: string, contactId: string, data: any) {
    // Check contact exists
    await this.getContactById(userId, contactId);

    const { tags, ...updateData } = data;
    
    if (updateData.designation !== undefined) {
      updateData.decisionMakerScore = calculateDecisionMakerScore(updateData.designation || '');
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...updateData,
        ...(tags ? {
          tags: {
            // Clear previous tags and establish new ones
            set: [],
            connectOrCreate: tags.map((tagName: string) => ({
              where: { name_userId: { name: tagName.trim(), userId } },
              create: { name: tagName.trim(), userId },
            })),
          },
        } : {}),
      },
      include: {
        tags: true,
        notes: true,
        professionalProfile: true,
        aiSummary: true,
      },
    });

    return contact;
  }

  public async deleteContact(userId: string, contactId: string) {
    // Check contact exists
    await this.getContactById(userId, contactId);

    await prisma.contact.delete({
      where: { id: contactId },
    });

    return true;
  }

  public async listContacts(userId: string, query: any) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const { search, sortBy = 'createdAt', sortOrder = 'desc', name, company, industry, skills, tags, source, email, phone } = query;

    const where: Prisma.ContactWhereInput = {
      userId,
    };

    // Advanced PostgreSQL Full Text Search
    if (search) {
      const terms = search.split(/\s+/).filter(Boolean).map((t: string) => `${t.trim()}:*`).join(' & ');
      
      where.OR = [
        { name: { search: terms } },
        { company: { search: terms } },
        { designation: { search: terms } },
        { email: { search: terms } },
        { phone: { search: terms } },
        { website: { search: terms } },
        { address: { search: terms } },
        { industry: { search: terms } },
        { skills: { hasSome: [search] } },
        { aiSummary: { summaryText: { search: terms } } },
        { tags: { some: { name: { search: terms } } } },
        { notes: { some: { content: { search: terms } } } },
      ];
    }

    // Explicit field filters
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (company) where.company = { contains: company, mode: 'insensitive' };
    if (industry) where.industry = { contains: industry, mode: 'insensitive' };
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (phone) where.phone = { contains: phone, mode: 'insensitive' };
    if (source) where.source = source as ContactSource;

    // Filters on Tag list
    if (tags) {
      const tagList = tags.split(',').map((t: string) => t.trim());
      where.tags = {
        some: {
          name: { in: tagList, mode: 'insensitive' },
        },
      };
    }

    // Filters on Skills array
    if (skills) {
      const skillList = skills.split(',').map((s: string) => s.trim());
      where.skills = {
        hasSome: skillList,
      };
    }

    // Verify sort field is a valid contact property
    const validSortFields = ['name', 'company', 'industry', 'decisionMakerScore', 'createdAt', 'updatedAt'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [orderByField]: sortOrder,
        },
        include: {
          tags: true,
          notes: true,
          professionalProfile: true,
          aiSummary: true,
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Duplicate Contact Detection Logic
  public calculateSimilarity(str1: string, str2: string): number {
    const s1 = (str1 || '').toLowerCase().trim();
    const s2 = (str2 || '').toLowerCase().trim();
    if (!s1 || !s2) return 0.0;
    if (s1 === s2) return 1.0;

    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    
    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator
        );
      }
    }
    const dist = track[s2.length][s1.length];
    const maxLen = Math.max(s1.length, s2.length);
    return 1.0 - (dist / maxLen);
  }

  public async detectDuplicates(userId: string, contactId: string) {
    const contact = await this.getContactById(userId, contactId);

    // Get all other contacts
    const others = await prisma.contact.findMany({
      where: {
        userId,
        id: { not: contactId },
      },
      include: {
        tags: true,
      },
    });

    const duplicates = [];

    for (const other of others) {
      let score = 0;
      const reasons = [];

      // 1. Email exact match (highest signal - unique identifier)
      if (contact.email && other.email && contact.email.toLowerCase().trim() === other.email.toLowerCase().trim()) {
        score += 65;
        reasons.push('Exact email match');
      }

      // 2. Phone exact match (digits only comparison, handles formatting differences)
      if (contact.phone && other.phone) {
        const contactDigits = contact.phone.replace(/\D/g, '');
        const otherDigits = other.phone.replace(/\D/g, '');
        // Match last 10 digits to handle country code variations
        if (contactDigits.length >= 7 && otherDigits.length >= 7) {
          const contactSuffix = contactDigits.slice(-10);
          const otherSuffix = otherDigits.slice(-10);
          if (contactSuffix === otherSuffix) {
            score += 55;
            reasons.push('Exact phone match');
          }
        }
      }

      // 3. LinkedIn URL exact match (very strong unique identifier)
      const contactLinkedIn = (contact as any).professionalProfile?.mergedProfile?.profileUrl?.toLowerCase().trim();
      const otherLinkedIn = (other as any).professionalProfile?.mergedProfile?.profileUrl?.toLowerCase().trim();
      if (contactLinkedIn && otherLinkedIn && contactLinkedIn === otherLinkedIn) {
        score += 70;
        reasons.push('Exact LinkedIn URL match');
      }

      // 4. Name similarity (weighted)
      const nameSim = this.calculateSimilarity(contact.name, other.name);
      if (nameSim >= 0.9) {
        score += 40;
        reasons.push(`Very high name similarity (${Math.round(nameSim * 100)}%)`);
      } else if (nameSim > 0.8) {
        score += 28;
        reasons.push(`High name similarity (${Math.round(nameSim * 100)}%)`);
      } else if (nameSim > 0.65) {
        score += 12;
        reasons.push(`Moderate name similarity (${Math.round(nameSim * 100)}%)`);
      }

      // 5. Company similarity (supporting signal)
      if (contact.company && other.company) {
        const companySim = this.calculateSimilarity(contact.company, other.company);
        if (companySim >= 0.85) {
          score += 18;
          reasons.push('Similar company name');
        } else if (companySim >= 0.70) {
          score += 8;
          reasons.push('Partial company name match');
        }
      }

      // 6. Website exact match (supporting signal)
      if (contact.website && other.website && contact.website.toLowerCase().trim() === other.website.toLowerCase().trim()) {
        score += 12;
        reasons.push('Exact website match');
      }

      // Cap at 100
      const finalScore = Math.min(score, 100);

      if (finalScore >= 40) {
        let recommendation = 'Manual review recommended';
        if (finalScore >= 85) {
          recommendation = 'Strongly recommended to merge (highly probable duplicate)';
        } else if (finalScore >= 65) {
          recommendation = 'Recommended to merge (likely duplicate)';
        }

        duplicates.push({
          duplicateContact: other,
          duplicateScore: finalScore,
          reasons,
          mergeRecommendation: recommendation,
        });
      }
    }

    return duplicates.sort((a, b) => b.duplicateScore - a.duplicateScore);
  }

  // Smart Contact Merge
  public async mergeContacts(userId: string, targetId: string, sourceId: string) {
    const target = await this.getContactById(userId, targetId);
    const source = await this.getContactById(userId, sourceId);

    // Merge basic info fields (taking non-null, longest/most complete strings)
    const chooseBestField = (val1: string | null, val2: string | null) => {
      if (!val1) return val2;
      if (!val2) return val1;
      return val1.length >= val2.length ? val1 : val2;
    };

    const mergedData = {
      name: chooseBestField(target.name, source.name) || target.name,
      company: chooseBestField(target.company, source.company),
      designation: chooseBestField(target.designation, source.designation),
      email: chooseBestField(target.email, source.email),
      phone: chooseBestField(target.phone, source.phone),
      website: chooseBestField(target.website, source.website),
      address: chooseBestField(target.address, source.address),
      industry: chooseBestField(target.industry, source.industry),
      decisionMakerScore: Math.max(target.decisionMakerScore, source.decisionMakerScore),
      skills: Array.from(new Set([...target.skills, ...source.skills])),
      interests: Array.from(new Set([...target.interests, ...source.interests])),
      hobbies: Array.from(new Set([...target.hobbies, ...source.hobbies])),
    };

    // Perform database updates
    await prisma.$transaction(async (tx) => {
      // 1. Update target contact with merged fields
      await tx.contact.update({
        where: { id: targetId },
        data: mergedData,
      });

      // 2. Transfer Notes from source to target
      await tx.note.updateMany({
        where: { contactId: sourceId },
        data: { contactId: targetId },
      });

      // 3. Transfer Business Cards from source to target
      await tx.businessCard.updateMany({
        where: { contactId: sourceId },
        data: { contactId: targetId },
      });

      // 4. Transfer Face Recognitions from source to target
      await tx.faceRecognition.updateMany({
        where: { contactId: sourceId },
        data: { contactId: targetId },
      });

      // 5. Transfer NFC Data from source to target
      await tx.nFCData.updateMany({
        where: { contactId: sourceId },
        data: { contactId: targetId },
      });

      // 6. Transfer Uploaded Files from source to target
      await tx.uploadedFile.updateMany({
        where: { contactId: sourceId },
        data: { contactId: targetId },
      });

      // 7. Merge Tags
      const sourceTags = await tx.tag.findMany({
        where: { contacts: { some: { id: sourceId } } },
      });
      if (sourceTags.length > 0) {
        await tx.contact.update({
          where: { id: targetId },
          data: {
            tags: {
              connect: sourceTags.map((t) => ({ id: t.id })),
            },
          },
        });
      }

      // 8. Delete source contact
      await tx.contact.delete({
        where: { id: sourceId },
      });

      // 9. Write audit log for merge event
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CONTACT_MERGED',
          entity: 'Contact',
          entityId: targetId,
          details: {
            mergedFromContactId: sourceId,
            sourceName: source.name,
            targetName: target.name,
          },
        },
      });
    });

    return await this.getContactById(userId, targetId);
  }

  // Get Activity History Timeline
  public async getContactTimeline(userId: string, contactId: string) {
    await this.getContactById(userId, contactId);

    // Fetch related audit logs
    return await prisma.auditLog.findMany({
      where: {
        entity: 'Contact',
        entityId: contactId,
        userId: userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // Export Contacts
  public async exportContacts(userId: string, query: any) {
    const { contacts } = await this.listContacts(userId, { ...query, page: 1, limit: 100000 });
    return contacts;
  }

  // Helper inside contacts module to add manual notes
  public async addNote(userId: string, contactId: string, content: string) {
    await this.getContactById(userId, contactId);

    const note = await prisma.note.create({
      data: {
        content,
        contactId,
        userId,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'NOTE_ADDED',
        entity: 'Contact',
        entityId: contactId,
        details: { noteId: note.id },
      },
    }).catch(() => {});

    return note;
  }

  // Notes CRUD helpers
  public async listNotes(userId: string, contactId: string) {
    await this.getContactById(userId, contactId);
    return await prisma.note.findMany({
      where: { contactId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async updateNote(userId: string, noteId: string, content: string) {
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });
    if (!note) {
      throw new AppError('Note not found or access denied', 404);
    }
    return await prisma.note.update({
      where: { id: noteId },
      data: { content },
    });
  }

  public async deleteNote(userId: string, noteId: string) {
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });
    if (!note) {
      throw new AppError('Note not found or access denied', 404);
    }
    await prisma.note.delete({ where: { id: noteId } });
    return true;
  }

  // Tags helpers
  public async addTags(userId: string, contactId: string, tagsList: string[]) {
    await this.getContactById(userId, contactId);
    return await prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          connectOrCreate: tagsList.map((tagName) => ({
            where: { name_userId: { name: tagName.trim(), userId } },
            create: { name: tagName.trim(), userId },
          })),
        },
      },
      include: { tags: true },
    });
  }

  public async removeTags(userId: string, contactId: string, tagsList: string[]) {
    await this.getContactById(userId, contactId);
    return await prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          disconnect: tagsList.map((tagName) => ({
            name_userId: { name: tagName.trim(), userId },
          })),
        },
      },
      include: { tags: true },
    });
  }

  public async listTags(userId: string) {
    return await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }
}
