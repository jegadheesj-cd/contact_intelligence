require('dotenv').config();
const { Queue } = require('bullmq');
const q = new Queue('enrichment-queue', { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 } });
async function test() {
  const job = await q.add('enrich-profile', { contactId: 'test', profileId: 'test' });
  console.log('Added job:', job.id);
  process.exit(0);
}
test();
