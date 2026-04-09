const fs = require('fs');
const lines = fs.readFileSync('api/index.js', 'utf8').split('\n');

// Find the catch block for update activity - look for 'Update activity error'
for (let i = 2300; i <= 2340; i++) {
  if (lines[i] && lines[i].includes('Update activity error')) {
    console.log('Found at line:', i + 1);
    // Add more detailed logging
    lines[i] = "        console.error('Update activity error:', error.message, error.stack);";
    // Also add log before the query
    break;
  }
}

// Also add log after ownership check
for (let i = 2200; i <= 2225; i++) {
  if (lines[i] && lines[i].includes('You can only update activities')) {
    lines.splice(i - 3, 0, "        console.log('Ownership check - president_id:', activityCheck.rows[0].president_id, 'decoded.userId:', decoded.userId);");
    console.log('Added ownership log at line:', i - 2);
    break;
  }
}

fs.writeFileSync('api/index.js', lines.join('\n'), 'utf8');
console.log('Done');
