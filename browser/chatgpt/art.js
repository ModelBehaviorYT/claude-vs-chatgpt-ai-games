import { T } from "./mesh.js";
export function artTexture(name) {
  const image = document.getElementById("art-" + name);
  let tex = new T.Texture(image);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
