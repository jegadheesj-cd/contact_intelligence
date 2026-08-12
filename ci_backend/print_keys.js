const data = require('./result.json');
if (Array.isArray(data) && data.length > 0) {
  console.log(Object.keys(data[0]));
} else {
  console.log("Not an array or empty");
}
