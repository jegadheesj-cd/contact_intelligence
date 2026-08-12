const fs = require('fs');
let data = fs.readFileSync('check_output.json', 'utf16le');
fs.writeFileSync('check_out_utf8.json', data, 'utf8');
