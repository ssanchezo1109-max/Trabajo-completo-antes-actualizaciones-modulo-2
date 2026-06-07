import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/src/App.tsx', 'utf-8');
const localContent = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the last return ( in repo
const repoReturnIdx = repoContent.lastIndexOf('return (\n    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">');
const repoView = repoContent.substring(repoReturnIdx);

// Find the last return ( in local
const localReturnIdx = localContent.lastIndexOf('return (\n    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">');
const localView = localContent.substring(localReturnIdx);

const newLocalContent = localContent.substring(0, localReturnIdx) + repoView;
fs.writeFileSync('src/App.tsx', newLocalContent);
console.log("Successfully replaced the view!");
