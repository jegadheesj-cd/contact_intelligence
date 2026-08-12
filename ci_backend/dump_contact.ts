import mongoose from 'mongoose';
import { Contact } from './src/models/Contact';

mongoose.connect('mongodb://localhost:27017/contact_intelligence').then(async () => {
  const c = await Contact.findOne({ id: 'd53824a4-48b3-4ce2-af09-874b4990a821' }).lean();
  console.log(JSON.stringify(c?.rawText));
  console.log(JSON.stringify(c?.professionalProfile?.providerResponses));
  process.exit(0);
}).catch(console.error);
