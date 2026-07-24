import { DashboardService } from '../modules/dashboard/dashboard.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users`);
    
    for (const user of users) {
      console.log(`\nTesting user ${user.id} (${user.email})...`);
      const service = new DashboardService();
      try {
        await service.getDashboardWidgets(user.id);
        console.log('Widgets OK');
      } catch (e) {
        console.error('Widgets Error:', e);
      }
      
      try {
        await service.getAnalyticsMetrics(user.id);
        console.log('Analytics OK');
      } catch (e) {
        console.error('Analytics Error:', e);
      }
    }
  } catch (error) {
    console.error('Global Error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
