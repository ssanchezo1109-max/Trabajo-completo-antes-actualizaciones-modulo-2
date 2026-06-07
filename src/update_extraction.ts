import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/src/App.tsx', 'utf-8');
const localContent = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the start of the final return block in both files
const searchStr = 'return (\n    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">';

const repoReturnIdx = repoContent.lastIndexOf(searchStr);
if (repoReturnIdx === -1) {
  console.log("Could not find return statement in repo!");
  process.exit(1);
}
const repoView = repoContent.substring(repoReturnIdx);

const localReturnIdx = localContent.lastIndexOf(searchStr);
if (localReturnIdx === -1) {
  console.log("Could not find return statement in local!");
  process.exit(1);
}

// Ensure we are replacing just the last block.
const newLocalContent = localContent.substring(0, localReturnIdx) + repoView;

fs.writeFileSync('src/App.tsx', newLocalContent);
console.log("Replaced extraction module view successfully!");
