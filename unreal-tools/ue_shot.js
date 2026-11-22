// Screenshot your Unreal game without opening a window on the user's screen (renders offscreen).
//   node ../unreal-tools/ue_shot.js <out.png> [waitSec=60] [extra game args...]
// Run it from your project folder (the one with StarterGame.uproject). It launches the packaged-free -game build
// offscreen at 1280x720 with your extra args (for example -AutoShot=8 -AutoPlay=1 or a map like /Game/Maps/City),
// waits for a NEW png in Saved/Screenshots, copies it to <out.png>, prints the last warnings/errors from the game log,
// and closes the game. Without -AutoShot it adds -ExecCmds="HighResShot 1280x720" (a shot of the very first frame).
const { spawn, execSync } = require('child_process'), fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'shot.png');
const wait = +(process.argv[3] || 60);
const extra = process.argv.slice(4);
const proj = process.cwd();
const up = fs.readdirSync(proj).find(f => f.endsWith('.uproject'));
if (!up) { console.log('run this from the folder that holds your .uproject'); process.exit(1); }
const ssDir = path.join(proj, 'Saved', 'Screenshots');
const list = () => { const r = []; const walk = d => { try { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (f.endsWith('.png')) r.push([p, s.mtimeMs]); } } catch {} }; walk(ssDir); return r; };
const before = new Set(list().map(x => x[0] + x[1]));
const args = [path.join(proj, up), '-game', '-RenderOffScreen', '-ResX=1280', '-ResY=720', '-windowed', '-nosound', '-unattended', '-log=GameShot.log', ...extra];
if (!extra.some(a => /^-AutoShot/i.test(a))) args.push('-ExecCmds=HighResShot 1280x720');
const t0 = Date.now();
const p = spawn('C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe', args, { stdio: 'ignore' });
const kill = () => { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} };
const timer = setInterval(() => {
  const fresh = list().filter(x => !before.has(x[0] + x[1]) && x[1] > t0).sort((a, b) => b[1] - a[1]);
  const done = fresh.length && Date.now() - fresh[0][1] > 1500;
  if (done || Date.now() - t0 > wait * 1000) {
    clearInterval(timer); kill();
    if (done) { fs.copyFileSync(fresh[0][0], out); console.log('saved ' + out); } else console.log(`screenshot failed: no new png after ${wait}s`);
    try {
      const log = fs.readFileSync(path.join(proj, 'Saved', 'Logs', 'GameShot.log'), 'utf8').split(/\r?\n/);
      const bad = log.filter(l => /Error|Fatal|Warning: .*(fail|missing|None)/i.test(l)).slice(-12);
      if (bad.length) console.log('log:\n' + bad.join('\n'));
    } catch {}
    process.exit(0);
  }
}, 1000);
p.on('exit', c => { if (Date.now() - t0 < wait * 1000) { /* crashed or quit early; the timer reports */ } });
