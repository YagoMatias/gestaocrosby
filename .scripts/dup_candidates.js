const fs = require('fs');
const path = require('path');
const dupFile = path.join('.scripts','duplicates.json');
if (!fs.existsSync(dupFile)) { console.error('duplicates.json missing'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(dupFile,'utf8'));
const dirs = new Set();
for (const g of data.groups) {
  for (const f of g.files) {
    const p = f.path;
    if (p.includes('node_modules - Copia')) dirs.add(path.resolve(p.split('node_modules - Copia')[0],'node_modules - Copia'));
    if (p.includes('\\.wwebjs_auth\\')) dirs.add(path.resolve(p.split('\\.wwebjs_auth\\')[0],'.wwebjs_auth'));
    if (p.match(/\\\.wwebjs_cache\\/)) dirs.add(path.resolve(p.split('\\.wwebjs_cache\\')[0],'.wwebjs_cache'));
  }
}
const arr = Array.from(dirs);
fs.writeFileSync('.scripts/dup_candidates.json', JSON.stringify(arr, null, 2));
console.log('candidates written to .scripts/dup_candidates.json');
console.log(arr.join('\n'));
