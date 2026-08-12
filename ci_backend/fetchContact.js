const mongoose = require('./node_modules/mongoose');
mongoose.connect('mongodb://localhost:27017/contact_intelligence').then(async () => {
  const Contact = mongoose.model('Contact', new mongoose.Schema({}, { strict: false }));
  const c = await Contact.findOne({ id: 'd53824a4-48b3-4ce2-af09-874b4990a821' });
  console.log(JSON.stringify(c, null, 2));
  process.exit(0);
}).catch(console.error);
