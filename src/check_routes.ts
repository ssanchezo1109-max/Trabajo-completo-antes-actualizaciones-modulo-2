import fs from 'fs';

const localContent = fs.readFileSync('server.ts', 'utf-8');
const routes = localContent.match(/app\.[a-z]+\(['`"][^'`"]+['`"]/g);
console.log("Routes in local:");
console.log(routes);
