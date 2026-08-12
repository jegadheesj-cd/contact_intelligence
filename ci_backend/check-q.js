require('dotenv').config();
const { Queue } = require('bullmq');
const q = new Queue('enrichment-queue', { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 } });
async function check() {
  console.log('Active:', await q.getActiveCount());
  console.log('Waiting:', await q.getWaitingCount());
  console.log('Failed:', await q.getFailedCount());
  console.log('Delayed:', await q.getDelayedCount());
  process.exit(0);
}
check();
