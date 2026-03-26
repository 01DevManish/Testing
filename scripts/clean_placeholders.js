const fs = require('fs');
const path = require('path');

const baseDir = 'd:\\EURUS LIFESTYLE\\eurus\\app';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      walk(p);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      let code = fs.readFileSync(p, 'utf8');
      // Regex to remove placeholder attributes
      const newCode = code.replace(/\s*placeholder="[^"]*"/g, '');
      if (code !== newCode) {
        fs.writeFileSync(p, newCode);
        console.log('Cleaned placeholders in', p);
      }
    }
  }
}

walk(baseDir);
console.log('Done cleaning placeholders in app/dashboard');
