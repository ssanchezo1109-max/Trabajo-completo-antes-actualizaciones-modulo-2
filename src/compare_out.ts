import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/src/App.tsx', 'utf-8');
const localContent = fs.readFileSync('src/App.tsx', 'utf-8');

function extractOutsideApp(content) {
  const index = content.indexOf(`export default function App() {`);
  return content.substring(0, index);
}

const repoOut = extractOutsideApp(repoContent);
const localOut = extractOutsideApp(localContent);

if (repoOut === localOut) {
  console.log("Outside App is identical.");
} else {
  console.log("Outside App differs!");
  fs.writeFileSync('src/repo_out.txt', repoOut);
  fs.writeFileSync('src/local_out.txt', localOut);
}
