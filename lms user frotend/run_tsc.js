const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = 'd:\\Users\\sanul\\OneDrive\\Desktop\\2222222\\suraksha-lms123';
process.chdir(dir);

try {
    const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
    console.log(output);
} catch (e) {
    console.log(e.stdout);
    if (e.stderr) console.log(e.stderr);
}
