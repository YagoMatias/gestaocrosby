const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = process.cwd();
function walkDirs(dir) {
  const res = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'tests' || e.name === '__tests__') res.push(full);
      try { res.push(...walkDirs(full)); } catch (err) {}
    }
  }
  return res;
}
const dirs = walkDirs(root);
const out = [];
for (const d of dirs) {
  let fileCount = 0;
  try { fileCount = fs.readdirSync(d, { withFileTypes: true }).reduce((acc, ent) => acc + (ent.isFile()?1:0), 0);
    // also count nested files
    const allFiles = require('glob').sync('**/*', { cwd: d, nodir: true, dot: true });
    fileCount = allFiles.length;
  } catch (e) {}
  let tracked = false;
  try {
    const outGit = execSync(`git ls-files "${d.replace(/"/g,'\"')}/**"`, { encoding: 'utf8' });
    tracked = outGit.trim().length > 0;
  } catch (e) { tracked = false; }
  out.push({ path: d, files: fileCount, tracked });
}
console.log(JSON.stringify(out, null, 2));
