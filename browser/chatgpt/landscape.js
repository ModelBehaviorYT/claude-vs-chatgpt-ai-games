import {
  T,
  Builder,
  canvasTex,
  material,
  rng,
  TAU,
  mix,
  clamp,
  solid,
  double,
  unlit,
} from "./mesh.js";
const rand = rng(432);
export const shoreline = (z) =>
  151 + 8 * Math.sin(z * 0.014) + 3 * Math.cos(z * 0.038);
export function skySea(scene) {
  const uniforms = {
    uSun: { value: new T.Vector3(0.53, 0.66, 0.42).normalize() },
    uTime: { value: 0 },
    uDay: { value: 1 },
  };
  const common = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fb(vec2 p){return .52*noise(p)+.27*noise(p*2.03)+.13*noise(p*4.07)+.065*noise(p*8.17);}`;
  let sky = new T.Mesh(
    new T.SphereGeometry(3000, 30, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms,
      vertexShader: `varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:
        `varying vec3 vD;uniform vec3 uSun;uniform float uTime,uDay;` +
        common +
        `
void main(){vec3 d=normalize(vD);float h=max(0.,d.y),sun=dot(d,uSun);vec3 sky=mix(vec3(.87,.88,.78),vec3(.20,.64,.87),pow(h,.43));sky=mix(sky,vec3(.08,.46,.78),smoothstep(.24,.96,h)*.68);float dusk=(1.-smoothstep(.02,.45,abs(uSun.y)))*.82;sky=mix(sky,mix(vec3(1.,.49,.32),vec3(.5,.42,.66),sqrt(h)),dusk);vec3 nsky=mix(vec3(.13,.19,.27),vec3(.024,.055,.125),pow(h,.42));vec3 col=mix(nsky,sky,uDay);
vec2 uv=d.xz/max(.057,h+.045)*1.55+vec2(4.+uTime*.001,-3.);
float cloud=smoothstep(.50,.68,fb(uv)+.045*noise(uv*12.));float edges=smoothstep(.42,.72,fb(uv+vec2(.04,.08)));col=mix(col,mix(vec3(.18,.23,.31),mix(vec3(.84,.84,.81),vec3(1.,.985,.92),edges),uDay),cloud*smoothstep(-.015,.16,h)*.89);col+=vec3(1.,.76,.43)*pow(max(0.,sun),65.)*.3*uDay;col=mix(col,vec3(1.,.97,.79),smoothstep(.9993,.9997,sun));float moon=dot(d,-uSun);col=mix(col,vec3(.88,.94,1.),smoothstep(.9996,.99975,moon)*(1.-uDay));float stars=step(.9983,hash(floor(d.xz/(h+.12)*450.)))*smoothstep(.06,.4,h)*(1.-uDay);col+=stars*.68;gl_FragColor=vec4(col,1.);}`,
    }),
  );
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  scene.add(sky);
  let water = new T.Mesh(
    new T.PlaneGeometry(5700, 5700),
    new T.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec3 vP;void main(){vec4 p=modelMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:
        `varying vec3 vP;uniform float uDay,uTime;uniform vec3 uSun;` +
        common +
        `
void main(){vec2 p=vP.xz;float coast=151.+8.*sin(p.y*.014)+3.*cos(p.y*.038);float depth=(p.y < -352. || p.y > 359. || p.x < -345.) ? 75. : max(0.,p.x-coast);float rip=sin(p.x*2.5+p.y*.32+uTime*2.3+2.*sin(p.y*.9));float wave=fb(p*vec2(.18,.7)+uTime*.09);vec3 shallow=vec3(.19,.76,.73),deep=vec3(.035,.45,.59);vec3 col=mix(shallow,deep,smoothstep(0.,80.,depth));col+=(wave-.46)*.13;vec3 eye=normalize(cameraPosition-vP);float sparkle=pow(max(0.,dot(normalize(vec3(.13*sin(p.y*1.3+uTime)+.18*(wave-.5),1.,.12*rip)),normalize(eye+uSun))),85.);col+=vec3(1.,.91,.69)*sparkle*.82;float foam=smoothstep(.68,.95,sin(depth*1.25+wave*3.-uTime*.95))*exp(-depth*.18);col=mix(col,vec3(.84,.97,.9),foam*.8);col=mix(vec3(.035,.115,.18)+.022*wave,col,uDay);float dist=distance(cameraPosition,vP);col=mix(col,mix(vec3(.14,.19,.27),vec3(.78,.86,.84),uDay),smoothstep(120.,1550.,dist));gl_FragColor=vec4(col,1.);}`,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.31;
  scene.add(water);
  return { uniforms, sky, water };
}
export function bench(b, x, z, rot) {
  b.at(x, 0, z, rot, () => {
    for (let j = 0; j < 4; j++)
      b.box(0, 0.45, -0.26 + j * 0.15, 1.9, 0.09, 0.12, 0xa57948);
    for (let j = 0; j < 3; j++)
      b.box(0, 0.68 + j * 0.17, -0.32, 1.9, 0.12, 0.07, 0xb78c58);
    for (let s of [-0.69, 0.69]) {
      b.box(s, 0.25, 0, 0.08, 0.5, 0.51, 0x335354);
      b.box(s, 0.73, -0.32, 0.07, 0.6, 0.1, 0x335354);
    }
  });
}
export function parasol(b, x, y, z, r, c, chair = true) {
  b.cyl(x, y + 1.16, z, 0.036, 0.053, 2.32, 0xc8a576);
  let n = 12;
  for (let j = 0; j < n; j++) {
    let a = (j * TAU) / n,
      a2 = ((j + 1) * TAU) / n,
      am = (a + a2) * 0.5,
      cap = [x, y + 2.65, z],
      p1 = [x + r * Math.cos(a), y + 2.06, z + r * Math.sin(a)],
      p2 = [x + r * Math.cos(a2), y + 2.06, z + r * Math.sin(a2)],
      p3 = [x + r * Math.cos(am) * 0.99, y + 1.92, z + r * Math.sin(am) * 0.99];
    b.poly([cap, p1, p2], j % 2 ? 0xffedcd : c, double);
    b.poly([p1, p3, p2], j % 2 ? 0xffedcd : c, double);
  }
  b.oval(x, y + 2.65, z, 0.065, 0.085, 0.065, 0xfff3d1);
  if (chair) {
    for (let s of [-0.7, 0.7]) {
      b.box(x + s, y + 0.31, z + 0.7, 0.5, 0.1, 1.45, 0xf7dfb5);
      b.box(x + s, y + 0.53, z + 0.18, 0.51, 0.1, 0.76, c, 0, solid, -0.58);
      for (let a of [-0.2, 0.2])
        b.box(x + s + a, y + 0.16, z + 0.75, 0.045, 0.31, 1.3, 0x967e66);
    }
  }
}
export function cafeSet(b, x, z, c) {
  parasol(b, x, 0.35, z, 1.28, c, false);
  b.cyl(x, 0.87, z, 0.72, 0.72, 0.12, 0xf5dfbc, 18);
  b.cyl(x, 0.46, z, 0.06, 0.15, 0.82, 0x416369);
  for (let a of [0, Math.PI, Math.PI / 2]) {
    let xx = x + Math.sin(a) * 0.98,
      zz = z + Math.cos(a) * 0.98;
    b.at(xx, 0, zz, a, () => {
      b.box(0, 0.44, 0, 0.49, 0.09, 0.5, c);
      b.box(0, 0.71, 0.25, 0.51, 0.56, 0.08, c);
      for (let dx of [-0.19, 0.19])
        for (let dz of [-0.19, 0.19])
          b.box(dx, 0.23, dz, 0.045, 0.46, 0.045, 0x61645c);
    });
  }
}
export function lifeguard(b, at, x, z, id) {
  let c = [0xeda48c, 0x85c2b9, 0xe8c06e][id % 3];
  b.at(x, 0, z, -0.36, () => {
    for (let dx of [-1.48, 1.48])
      for (let dz of [-1.2, 1.2])
        b.box(dx, 1.35, dz, 0.19, 2.7, 0.19, 0xbaa07c);
    b.box(0, 2.4, 0.36, 4.2, 0.2, 4.05, 0xe0c9a7);
    b.box(0, 3.55, -0.12, 3.45, 2.13, 2.8, c);
    b.box(0, 3.85, 1.3, 2.95, 0.85, 0.07, 0x315d70);
    b.box(1.74, 3.87, -0.13, 0.08, 0.85, 2.2, 0x487584);
    b.box(0, 4.68, 0, 4.35, 0.23, 3.8, 0xffe4a5, 0, solid, -0.07);
    at.sign(b, 0, 3.01, 1.32, 2.5, 0.48, "OCEAN RESCUE", "#a24d3d", "#fff4d5");
    b.box(0, 3.07, 2.28, 4.1, 0.08, 0.08, 0xeee1bf);
    for (let j = 0; j < 6; j++)
      b.box(-1.8 + j * 0.72, 2.78, 2.28, 0.08, 0.66, 0.08, 0xeadeb8);
    for (let i = 0; i < 9; i++)
      b.box(2.02, i * 0.28 + 0.12, 4.39 - i * 0.43, 1.02, 0.14, 0.48, 0xcbb896);
    b.cyl(-1.6, 5.1, -1.23, 0.037, 0.04, 2.2, 0x96856b);
    b.poly(
      [
        [-1.6, 6.18, -1.23],
        [-0.58, 5.92, -1.23],
        [-1.6, 5.59, -1.23],
      ],
      0xf29555,
      double,
    );
  });
}
export function yacht(b, x, z, ang, s = 1) {
  b.at(x, -0.32, z, ang, () => {
    const pts = [
      [0, 1.08, -5.1],
      [-1.51, 0.84, -2.35],
      [-1.65, 0.8, 3.62],
      [-1.32, 0.87, 4.45],
      [1.32, 0.87, 4.45],
      [1.65, 0.8, 3.62],
      [1.51, 0.84, -2.35],
    ].map((a) => a.map((v) => v * s));
    let base = pts.map(([x, y, z]) => [x * 0.72, -0.1, z * 0.83]);
    b.poly(pts, 0xe7d7b8, double);
    for (let i = 0; i < pts.length; i++)
      b.poly(
        [
          pts[i],
          pts[(i + 1) % pts.length],
          base[(i + 1) % pts.length],
          base[i],
        ],
        i % 2 ? 0xe8e8dc : 0xd1dcda,
        double,
      );
    b.box(0, 1.08 * s, 0.6 * s, 2.58 * s, 0.55 * s, 4.48 * s, 0xf2edcf);
    b.box(0, 1.6 * s, 0.78 * s, 2.25 * s, 0.66 * s, 3 * s, 0x416d7e);
    b.box(0, 2.01 * s, 0.8 * s, 2.62 * s, 0.18 * s, 3.45 * s, 0xf4eede);
    b.cyl(0, 2.5 * s, 1.13 * s, 0.035 * s, 0.06 * s, 1 * s, 0xdbded4);
    for (let side of [-1, 1])
      for (let j = 0; j < 5; j++)
        b.cyl(
          side * 1.46 * s,
          1.14 * s,
          (-2 + j * 0.96) * s,
          0.025 * s,
          0.025 * s,
          0.6 * s,
          0xc7d2ce,
        );
  });
}
