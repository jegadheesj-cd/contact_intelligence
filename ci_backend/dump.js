const fs = require('fs');
const data = require('./result.json');
fs.writeFileSync('result.txt', JSON.stringify(data[0], null, 2), 'utf8');
