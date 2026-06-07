import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/src/App.tsx', 'utf-8');
const localContent = fs.readFileSync('src/App.tsx', 'utf-8');

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
