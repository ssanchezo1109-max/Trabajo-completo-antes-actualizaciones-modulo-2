import fs from 'fs';

let repoContent = '';
try {
  repoContent = fs.readFileSync('tmp-repo/src/App.tsx', 'utf-8');
} catch (e) {
  repoContent = fs.readFileSync('/app/applet/tmp-repo/src/App.tsx', 'utf-8');
}
const localContent = fs.readFileSync('src/App.tsx', 'utf-8');

console.log("repo length:", repoContent.length);

const repoReturnIdx = repoContent.lastIndexOf('return (\n    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">');
const repoView = repoContent.substring(repoReturnIdx);

const localReturnIdx = localContent.lastIndexOf('return (\n    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">');
const localView = localContent.substring(localReturnIdx);

if (repoView === localView) {
  console.log("Views are identical.");
} else {
  console.log("Views differ. Length repo:", repoView.length, "local:", localView.length);
}
