import fs from 'fs';

const repoContent = fs.readFileSync('/tmp-repo/src/App.tsx', 'utf-8');
const localContent = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the last return ( in repo
const repoReturnIdx = repoContent.lastIndexOf('return (');
const repoView = repoContent.substring(repoReturnIdx);

// Find the last return ( in local
const localReturnIdx = localContent.lastIndexOf('return (');
const localView = localContent.substring(localReturnIdx);

if (repoView === localView) {
  console.log("Views are identical.");
} else {
  console.log("Views differ. Length repo:", repoView.length, "local:", localView.length);
}

// Compare functions
function extractFunction(content, funcName) {
  const match = content.match(new RegExp(`const ${funcName} = async \\(.*?\\) => \\{[\\s\\S]*?\\n  };`));
  return match ? match[0] : null;
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
