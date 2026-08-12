require('dotenv').config();
const { Queue } = require('bullmq');
const q = new Queue('enrichment-queue', { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 } });
async function check() {
  const failed = await q.getFailed();
  if (failed.length > 0) {
    const lastFailed = failed[failed.length - 1];
    console.log('Last Failed Job ID:', lastFailed.id);
    console.log('Error:', lastFailed.failedReason);
    console.log('Stacktrace:', lastFailed.stacktrace);
    console.log('FinishedOn:', new Date(lastFailed.finishedOn).toISOString());
  }
  process.exit(0);
}
check();
