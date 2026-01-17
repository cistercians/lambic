const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const entries = fs.readdirSync(testsDir);

const testFiles = entries
  .filter(file => file.endsWith('.test.js'))
  .sort();

if (testFiles.length === 0) {
  console.log('No test files found.');
  process.exit(0);
}

for (const file of testFiles) {
  const filePath = path.join(testsDir, file);
  require(filePath);
}

console.log(`Executed ${testFiles.length} test file(s).`);
