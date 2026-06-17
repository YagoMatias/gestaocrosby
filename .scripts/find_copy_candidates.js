const fs = require('fs');
const path = require('path');
const root = process.cwd();
const ignoreDirs = ['node_modules','.git','dist','planilhas','database','backend\\node_modules','public'];
const patterns = [/copia/i,/copy/i,/backup/i,/\.bak$/i,/\.old$/i,/\bOLD\b/i,/\bcopy\b/i, / - Copia/i, / - Copy/i];
function shouldIgnore(rel){ return ignoreDirs.some(i => rel.split(path.sep).includes(i)); }
function walk(dir){
  const entries = fs.readdirSync(dir,{withFileTypes:true});
  let res = [];
  for(const e of entries){
    const full = path.join(dir,e.name);
    const rel = path.relative(root,full);
    if (shouldIgnore(rel)) continue;
    if (patterns.some(rx=> rx.test(e.name))){
      res.push({path: full, name: e.name, isDir: e.isDirectory()});
    }
    if(e.isDirectory()){
      try{ res = res.concat(walk(full)); }catch(e){ }
    }
  }
  return res;
}
const found = walk(root);
fs.writeFileSync('.scripts/copy_candidates.json', JSON.stringify(found, null, 2));
console.log('found', found.length, 'candidates');
