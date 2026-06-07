import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/server.ts', 'utf-8');
const localContent = fs.readFileSync('server.ts', 'utf-8');

function extractRoute(content, str) {
  const startIdx = content.indexOf(str);
  if (startIdx === -1) return null;
  
  // Find the closing brace of the app.post by counting braces
  let braceCount = 0;
  let started = false;
  let endIdx = -1;
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      started = true;
    } else if (content[i] === '}') {
      braceCount--;
    }
    
    if (started && braceCount === 0) {
      endIdx = i + 2; // include closing ");" possibly
      break;
    }
  }
  
  return content.substring(startIdx, endIdx);
}

const reqs = ['app.post("/api/automation/run"'];
for (const r of reqs) {
  const repoRoute = extractRoute(repoContent, r);
  const localRoute = extractRoute(localContent, r);
  
  if (repoRoute && localRoute) {
    if (repoRoute === localRoute) {
      console.log(r, "is identical.");
    } else {
      console.log(r, "differs! repo:", repoRoute.length, "local:", localRoute.length);
      fs.writeFileSync('src/repo_route.ts', repoRoute);
      fs.writeFileSync('src/local_route.ts', localRoute);
    }
  } else {
    console.log(r, "missing in one.");
  }
}
