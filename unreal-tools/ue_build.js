// Compile your project's C++ (editor + game share it). Run from the folder that holds StarterGame.uproject:
//   node ../unreal-tools/ue_build.js
// Prints the errors and the result. Close nothing; it never opens a window.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const up = fs.readdirSync(process.cwd()).find(f => f.endsWith('.uproject'));
const target = path.basename(up, '.uproject') + 'Editor';
const r = spawnSync('cmd', ['/c', 'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Build\\BatchFiles\\Build.bat', target, 'Win64', 'Development',
  `-Project=${path.join(process.cwd(), up)}`, '-WaitMutex', '-NoUBA'], { encoding: 'utf8', maxBuffer: 64 << 20 });
const lines = (r.stdout + r.stderr).split(/\r?\n/);
console.log(lines.filter(l => /error|warning C|Result:|Total execution/i.test(l)).slice(-40).join('\n'));
