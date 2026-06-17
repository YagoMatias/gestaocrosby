const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();
const ignore = ['node_modules', '.git', 'dist', 'planilhas', 'backend\\node_modules'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of list) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(root, full);
    if (ignore.some(i => rel.split(path.sep).includes(i))) continue;
    if (ent.isDirectory()) {
      results = results.concat(walk(full));
    } else if (ent.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function hashFile(file) {
  const data = fs.readFileSync(file);
  return crypto.createHash('sha1').update(data).digest('hex');
}

const files = walk(root);
const map = new Map();
for (const f of files) {
  try {
    const h = hashFile(f);
    const stat = fs.statSync(f);
    if (!map.has(h)) map.set(h, []);
    map.get(h).push({ path: f, size: stat.size });
  } catch (e) {
    console.error('ERR', f, e.message);
  }
}

const groups = [];
for (const [h, arr] of map.entries()) {
  if (arr.length > 1) groups.push({ hash: h, files: arr });
}

const out = { count: groups.length, groups };
fs.writeFileSync('.scripts/duplicates.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
