const fs = require('fs');
const file = 'd:/AI Projects/AHH WFM/app/apps/web/app/manpower/[business]/[master]/page.tsx';
const content = fs.readFileSync(file, 'utf8');

// Quick brace count
let braces = 0;
let parens = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') braces++;
  if (content[i] === '}') braces--;
  if (content[i] === '(') parens++;
  if (content[i] === ')') parens--;
}
console.log(`Braces balance: ${braces}, Parens balance: ${parens}`);

// Look at the lines around the end of the file
const lines = content.split('\n');
console.log("Last 30 lines:");
console.log(lines.slice(-30).join('\n'));
