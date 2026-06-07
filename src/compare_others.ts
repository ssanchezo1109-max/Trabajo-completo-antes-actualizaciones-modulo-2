import fs from 'fs';

function compare(file) {
  try {
    const repoC = fs.readFileSync('tmp-repo/' + file, 'utf-8');
    const localC = fs.readFileSync(file, 'utf-8');
    if (repoC === localC) console.log(file, "is identical");
    else console.log(file, "differs! repo:", repoC.length, "local:", localC.length);
  } catch(e) {
    console.log(file, "missing in repo or local");
  }
}

compare('server.ts');
compare('src/auth.ts');
compare('src/index.css');
compare('src/main.tsx');
