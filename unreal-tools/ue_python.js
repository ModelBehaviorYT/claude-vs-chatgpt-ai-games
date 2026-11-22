// Run an Unreal editor Python script headless (build levels, place actors, make materials, save maps).
//   node ../unreal-tools/ue_python.js <script.py>
// Run from the folder that holds StarterGame.uproject. Uses UnrealEditor-Cmd -run=pythonscript (no window).
// Save what you change (unreal.EditorLoadingAndSavingUtils / EditorAssetLibrary / LevelEditorSubsystem.save_current_level).
// Prints the script's LogPython lines and any errors.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const up = fs.readdirSync(process.cwd()).find(f => f.endsWith('.uproject'));
const script = path.resolve(process.argv[2]);
const r = spawnSync('C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe',
  [path.join(process.cwd(), up), '-run=pythonscript', `-script=${script}`, '-unattended', '-nosplash', '-nullrhi', '-stdout', '-FullStdOutLogOutput'],
  { encoding: 'utf8', maxBuffer: 256 << 20 });
const lines = (r.stdout + r.stderr).split(/\r?\n/);
console.log(lines.filter(l => /LogPython|Error|Traceback|Exception/i.test(l)).slice(-80).join('\n'));
console.log('exit code', r.status);
