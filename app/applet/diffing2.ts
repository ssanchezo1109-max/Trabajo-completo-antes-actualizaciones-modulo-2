import fs from 'fs';

const repoContent = fs.readFileSync('/app/tmp-repo/src/App.tsx', 'utf-8');
const localContent = fs.readFileSync('/app/applet/src/App.tsx', 'utf-8');

// Find the last return ( in repo
const repoReturnIdx = repoContent.lastIndexOf('return (\n    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">');
const repoView = repoContent.substring(repoReturnIdx);

// Find the last return ( in local
const localReturnIdx = localContent.lastIndexOf('return (\n    <div className="h-screen w-full flex overflow-hidden bg-[#08090b] text-[#e2e8f0]">');
const localView = localContent.substring(localReturnIdx);

if (repoView === localView) {
  console.log("Views are identical.");
} else {
  console.log("Views differ. Length repo:", repoView.length, "local:", localView.length);
}

// Compare functions
function extractFunction(content, funcName) {
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const index = content.indexOf(`const ${funcName} = async`);
  if (index === -1) return null;
  const endIndex = content.indexOf(`\n  };`, index) + 5;
  return content.substring(index, endIndex);
}

const funcsToCompare = ['runAutomation', 'runSequentialAutomation', 'runSimulation', 'handleYahooLogin'];
for (const f of funcsToCompare) {
  const repoF = extractFunction(repoContent, f);
  const localF = extractFunction(localContent, f);
  if (repoF === localF) {
     console.log(`Function ${f} is identical.`);
  } else {
     console.log(`Function ${f} differs. repo: ${repoF?.length || 0}, local: ${localF?.length || 0}`);
  }
}
