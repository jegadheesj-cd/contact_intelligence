require('dotenv').config();
const { Queue } = require('bullmq');
const q = new Queue('enrichment-queue', { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 } });
async function check() {
  const failed = await q.getFailed();
  console.log(`Total failed: ${failed.length}`);
  failed.slice(-5).forEach(job => {
    console.log(`\nJob ID: ${job.id}`);
    console.log(`FinishedOn: ${new Date(job.finishedOn).toISOString()}`);
    console.log(`Error: ${job.failedReason}`);
  });
  process.exit(0);
}
check();
