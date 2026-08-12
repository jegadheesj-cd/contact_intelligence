const fs = require('fs');
let data = fs.readFileSync('check_output_new.json', 'utf16le');
fs.writeFileSync('check_out_utf8_new.json', data, 'utf8');
