require('dotenv').config();
const { Queue } = require('bullmq');
const q = new Queue('enrichment-queue', { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 } });
async function check() {
  const completed = await q.getCompleted();
  console.log(`Total completed: ${completed.length}`);
  completed.slice(-5).forEach(job => {
    console.log(`\nJob ID: ${job.id}`);
    console.log(`FinishedOn: ${new Date(job.finishedOn).toISOString()}`);
    console.log(`Data: ${JSON.stringify(job.data)}`);
  });
  process.exit(0);
}
check();
