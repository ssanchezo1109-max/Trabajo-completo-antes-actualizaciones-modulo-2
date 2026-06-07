import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Line 3030
content = content.replace(/disabled=\{!isRunning\}/g, '');
content = content.replace(
  /\!isRunning\s+\?\s+'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'\s+:\s+'bg-amber-600 hover:bg-amber-500 text-white border-amber-500\/35 hover:shadow-\[0_0_15px_rgba\(245,158,11,0\.3\)\] cursor-pointer'/g,
  `'bg-amber-600 hover:bg-amber-500 text-white border-amber-500/35 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer'`
);

fs.writeFileSync('src/App.tsx', content);
console.log('Stop button unlocked');
