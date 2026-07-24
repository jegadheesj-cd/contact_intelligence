const { Queue } = require('bullmq');
const queue = new Queue('enrichment-queue', { connection: { host: 'localhost', port: 6379 } });
async function run() {
  await queue.add('enrichment-job', {
    contactId: '98da4a96-83b1-44e8-8651-9c1287a49fd8',
    profileId: 'd312c4f7-f537-4871-9200-7a842fc3ec8d'
  });
  console.log('Job pushed');
}
run().then(() => process.exit(0));
