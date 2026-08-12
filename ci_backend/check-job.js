require('dotenv').config();
const { Queue } = require('bullmq');
const q = new Queue('enrichment-queue', { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 } });
async function check() {
  const job = await q.getJob('96');
  if (job) {
    console.log('State:', await job.getState());
    console.log('Error:', job.failedReason);
  } else {
    console.log('Job 96 not found');
  }
  process.exit(0);
}
check();
