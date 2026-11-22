import { Game } from "./engine.js";
const overlay = document.querySelector("#overlay");
overlay.innerHTML =
  '<div class="front cover"><div class="frontcontent"><div class="edition"><i></i> PORT AZURE, FLORIDA</div><h1>Sundown<br><em>Syndicate</em></h1><div class="edition">Opening city…</div></div></div>';
function mount() {
  try {
    window.portAzure = new Game();
  } catch (error) {
    console.error(error);
    overlay.innerHTML =
      '<div class="front cover"><div class="edition">SUNDOWN SYNDICATE</div><h2>City unavailable</h2><p>This game requires WebGL 2 in a desktop browser.</p><button class="menuBtn primary" onclick="location.reload()">Retry</button></div>';
    window.gameError = error.stack;
  }
}
if (document.readyState === "complete") mount();
else window.addEventListener("load", mount, { once: true });
