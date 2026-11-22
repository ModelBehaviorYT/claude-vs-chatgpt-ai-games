# Film an Unreal game offscreen, frame-stepped at exactly 60 fps, 3840x2160 by default (4K, standing rule 2026-11-19; -ResW 1920 -ResH 1080 only for quick drafts), no window on the user's screen.
#   powershell -File ..\unreal-tools\ue_film.ps1 -Proj C:\path\to\YourProject -Out C:\...\clip.mp4 -Seconds 8 -Skip 3 -GameArgs "-Scene=driving"
# -Skip seconds of game time are dropped from the start (loading, fade-in). The game runs with -benchmark -fps=60 -dumpmovie,
# so every frame is 1/60 s of game time however slowly it renders. Frames are deleted after encoding.
param([string]$Proj, [string]$Out, [double]$Seconds = 8, [double]$Skip = 3, [string]$GameArgs = "", [int]$TimeoutSec = 3600, [int]$ResW = 3840, [int]$ResH = 2160)
$ErrorActionPreference = "Stop"
$up = (Get-ChildItem $Proj -Filter *.uproject | Select-Object -First 1).FullName
$ss = Join-Path $Proj "Saved\Screenshots"
Remove-Item $ss -Recurse -Force -ErrorAction SilentlyContinue
$need = [int][math]::Ceiling(($Seconds + $Skip) * 60) + 2
$argsLine = "`"$up`" -game -RenderOffScreen -ResX=$ResW -ResY=$ResH -ForceRes -windowed -nosound -unattended -benchmark -fps=60 -dumpmovie `"-ExecCmds=r.SetRes ${ResW}x${ResH}w`" -log=Film.log $GameArgs"
$p = Start-Process "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" -ArgumentList $argsLine -PassThru
$t0 = Get-Date
while ($true) {
  Start-Sleep 3
  $n = (Get-ChildItem "$ss\WindowsEditor" -Filter MovieFrame*.png -ErrorAction SilentlyContinue | Measure-Object).Count
  if ($n -ge $need) { break }
  if ($p.HasExited) { Write-Output "game exited early after $n frames"; break }
  if (((Get-Date) - $t0).TotalSeconds -gt $TimeoutSec) { Write-Output "timeout after $n frames"; break }
}
& taskkill /PID $p.Id /T /F | Out-Null
Start-Sleep 2
$start = [int]($Skip * 60); $frames = [int]($Seconds * 60)
& ffmpeg -v error -y -framerate 60 -start_number $start -i "$ss\WindowsEditor\MovieFrame%05d.png" -frames:v $frames -vf "scale=${ResW}:${ResH}:flags=lanczos" -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p $Out
Remove-Item $ss -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $Out) { Write-Output "saved $Out ($Seconds s)" } else { Write-Output "FAILED $Out" }
