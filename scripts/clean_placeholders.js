const fs = require('fs');
const path = require('path');

const dirs = [
  'd:\\EURUS LIFESTYLE\\eurus\\app\\dashboard\\inventory',
  'd:\\EURUS LIFESTYLE\\eurus\\app\\dashboard\\advanced-dispatch\\components'
];

dirs.forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
  for (const f of files) {
    const p = path.join(dir, f);
    let code = fs.readFileSync(p, 'utf8');
    const newCode = code.replace(/\s*placeholder="[^"]*"/g, '');
    if (code !== newCode) {
      fs.writeFileSync(p, newCode);
      console.log('Cleaned placeholders in', f);
    }
  }
});
