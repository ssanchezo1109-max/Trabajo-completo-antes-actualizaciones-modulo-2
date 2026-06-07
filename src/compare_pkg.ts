import fs from 'fs';

const repoPkg = JSON.parse(fs.readFileSync('tmp-repo/package.json', 'utf-8'));
const localPkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

for (const dep in repoPkg.dependencies) {
  if (!localPkg.dependencies[dep]) {
    console.log("Missing dependency in local:", dep);
  }
}
