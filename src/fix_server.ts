import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const dupIdx = content.indexOf('import express from "express";', 1000);

if (dupIdx !== -1) {
    const validStartContent = content.substring(0, dupIdx);
    const originalFileContent = content.substring(dupIdx);
    
    const targetEndText = "addLog(\"[DRIVE] Buscando o creando archivo 'a a material de studio mercado'...\");";
    const endIdx = originalFileContent.indexOf(targetEndText);
    
    if (endIdx !== -1) {
        let finalEndIdx = endIdx;
        while (finalEndIdx > 0 && originalFileContent[finalEndIdx-1] !== '\n') {
            finalEndIdx--;
        }

        const fixedContent = validStartContent + originalFileContent.substring(finalEndIdx);
        fs.writeFileSync('server.ts', fixedContent);
        console.log('Fixed server.ts successfully!');
    } else {
        console.log('Could not find targetEndText in the original portion');
    }
} else {
    console.log('Could not find duplicated index');
}
