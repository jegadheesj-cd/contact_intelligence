import { DashboardService } from '../modules/dashboard/dashboard.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found');
      return;
    }
    const service = new DashboardService();
    console.log('Fetching widgets...');
    const widgets = await service.getDashboardWidgets(user.id);
    console.log('Widgets:', widgets);
    
    console.log('Fetching analytics...');
    const analytics = await service.getAnalyticsMetrics(user.id);
    console.log('Analytics:', analytics);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
