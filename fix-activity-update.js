const fs = require('fs');
const lines = fs.readFileSync('api/index.js', 'utf8').split('\n');

// Add debug log after body destructuring (line index 2148)
lines.splice(2148, 0, "        console.log('UPDATE ACTIVITY body:', JSON.stringify(req.body), 'url:', url, 'activityId:', activityId);");

fs.writeFileSync('api/index.js', lines.join('\n'), 'utf8');
console.log('Done');
console.log('Line 2149:', lines[2148]);
