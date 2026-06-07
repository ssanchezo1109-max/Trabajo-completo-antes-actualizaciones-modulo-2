import fs from 'fs';

const repoContent = fs.readFileSync('tmp-repo/src/App.tsx', 'utf-8');
const localContent = fs.readFileSync('src/App.tsx', 'utf-8');

const getStates = (content) => content.split('\n').filter(l => l.includes('useState')).map(l => l.trim());

const repoStates = getStates(repoContent);
const localStates = getStates(localContent);

console.log("States in repo but not in local:");
for (const s of repoStates) {
  if (!localStates.includes(s)) {
    console.log(s);
  }
}
