// Builds the fictional potroom hall procedurally (no external models), so it loads fast
// on phones. Units are metres. The hall runs along x; the potline is on the north side (-z).
import * as THREE from "./vendor/three.module.min.js";

export const HALL = { minX: -40, maxX: 40, minZ: -15, maxZ: 15, height: 15 };
export const ZONES = {
  restricted: { minX: 2, maxX: 25.6, minZ: -7.6, maxZ: -4.6 },
  bay: { minX: -11, maxX: 0, minZ: -7.6, maxZ: -4.6 },
  walkway: { minZ: 6, maxZ: 12 },
  exitDoor: { x: -40, minZ: -11, maxZ: -8 },
  assembly: { x: -45, z: -9.5 },
  fire: { x: -16, z: -0.5, r: 5.5 },
};
const CRANE_RANGE = [-30, 30];

const C = {
  navy: 0x0b2d4a, teal: 0x00a8a8, silver: 0xc0c6ce, amber: 0xf2a900,
  steel: 0x5d6873, darkSteel: 0x2c333a, concrete: 0x8a8d8f, green: 0x1f8a4c, red: 0xc0392b,
};

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}

function concreteTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#83878a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const v = 110 + Math.random() * 50 | 0;
      g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * .35})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = "rgba(40,40,40,.35)"; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  }, [20, 8]);
}

function stripeTex(a, b) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let i = -h; i < w + h; i += 48) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 24, 0); g.lineTo(i + 24 - h, h); g.lineTo(i - h, h); g.fill(); }
  }, [1, 1]);
}

// Bilingual sign as a texture: an ISO-style pictogram block plus English and Arabic text.
function signTex({ bg, fg, en, ar, icon }) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.strokeStyle = fg; g.lineWidth = 10; g.lineCap = "round"; g.lineJoin = "round";
    const cx = 110, cy = 128;
    if (icon === "warn") { g.beginPath(); g.moveTo(cx, cy - 70); g.lineTo(cx + 78, cy + 60); g.lineTo(cx - 78, cy + 60); g.closePath(); g.stroke(); g.fillRect(cx - 6, cy - 25, 12, 50); g.fillRect(cx - 6, cy + 35, 12, 12); }
    if (icon === "stop") { g.beginPath(); g.arc(cx, cy, 70, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx - 48, cy + 48); g.lineTo(cx + 48, cy - 48); g.stroke(); }
    if (icon === "exit") { g.beginPath(); g.arc(cx - 20, cy - 52, 13, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx - 24, cy - 30); g.lineTo(cx - 32, cy + 10); g.lineTo(cx - 60, cy + 55); g.moveTo(cx - 32, cy + 10); g.lineTo(cx, cy + 30); g.lineTo(cx + 5, cy + 60); g.moveTo(cx - 26, cy - 22); g.lineTo(cx + 10, cy - 10); g.moveTo(cx - 26, cy - 22); g.lineTo(cx - 60, cy - 6); g.stroke(); g.beginPath(); g.moveTo(cx + 30, cy); g.lineTo(cx + 80, cy); g.moveTo(cx + 60, cy - 20); g.lineTo(cx + 80, cy); g.lineTo(cx + 60, cy + 20); g.stroke(); }
    if (icon === "ppe") { g.beginPath(); g.arc(cx, cy + 10, 60, Math.PI, 0); g.closePath(); g.fill(); g.fillRect(cx - 80, cy + 8, 160, 14); }
    if (icon === "load") { g.beginPath(); g.moveTo(cx, cy - 75); g.lineTo(cx, cy - 20); g.stroke(); g.beginPath(); g.arc(cx, cy - 10, 12, Math.PI, 0); g.stroke(); g.fillRect(cx - 45, cy, 90, 50); g.beginPath(); g.moveTo(cx, cy + 58); g.lineTo(cx, cy + 75); g.stroke(); }
    if (icon === "assembly") { for (const [x, y] of [[-40, -30], [40, -30], [-40, 40], [40, 40]]) { g.beginPath(); g.arc(cx + x * .8, cy + y * .8 - 12, 10, 0, 7); g.fill(); g.fillRect(cx + x * .8 - 9, cy + y * .8, 18, 26); } g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx, cy + 6); g.stroke(); }
    g.fillStyle = fg; g.textBaseline = "middle";
    g.direction = "ltr"; g.textAlign = "left";
    g.font = "700 34px Arial, sans-serif"; wrapText(g, en, 210, 82, 280, 38);
    g.direction = "rtl"; g.textAlign = "right";
    g.font = "700 32px Arial, Tahoma, sans-serif"; g.fillText(ar, 490, 196);
  });
}
function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(" "); let line = ""; let yy = y;
  for (const w of words) { const test = line ? line + " " + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = test; }
  g.fillText(line, x, yy);
}

export function buildWorld(scene, opts) {
  const colliders = [];
  const updaters = [];
  const box = (w, h, d, mat, x, y, z, collide) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = opts.shadows;
    scene.add(m);
    if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: .2, ...extra });

  scene.background = new THREE.Color(0x8fa6bb);   // daylight seen through the exit door
  scene.fog = new THREE.Fog(0x1a232c, 28, 95);

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x3a3631, 1.25));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.3);
  sun.position.set(-20, 30, 18);
  if (opts.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 20, bottom: -20, near: 1, far: 90 });
    sun.shadow.bias = -0.0005;
  }
  scene.add(sun);

  // ---------- floor and markings ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 32), new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: .92 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-5, 0, 0); floor.receiveShadow = opts.shadows;
  scene.add(floor);

  const paint = (w, d, x, z, mat, y = .012) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = opts.shadows; scene.add(p); return p; };
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b400, roughness: .6 });
  paint(80, 6, 0, 9, new THREE.MeshStandardMaterial({ color: 0x2f7a52, roughness: .8 }));            // pedestrian walkway
  paint(80, .18, 0, 6, yellow); paint(80, .18, 0, 12, yellow);
  paint(80, .18, 0, -4.6, yellow); paint(80, .18, 0, 4.6, yellow);                                  // crane / vehicle aisle
  const bay = ZONES.bay;
  paint(bay.maxX - bay.minX, bay.maxZ - bay.minZ, (bay.minX + bay.maxX) / 2, (bay.minZ + bay.maxZ) / 2,
    new THREE.MeshStandardMaterial({ map: stripeTex("#d9a100", "#1d1d1d"), roughness: .7 }));
  const rz = ZONES.restricted;
  const rTex = stripeTex("#b3261e", "#f2f2f2"); rTex.repeat.set(12, 1.5);
  paint(rz.maxX - rz.minX, rz.maxZ - rz.minZ, (rz.minX + rz.maxX) / 2, (rz.minZ + rz.maxZ) / 2,
    new THREE.MeshStandardMaterial({ map: rTex, roughness: .7, transparent: true, opacity: .85 }));
  // walkway crossing marks at the crane mission, the corridor to the control room and the west end
  const zebra = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .6 });
  for (const cx of [-6, 27.8, -34]) for (let z = -4; z <= 4; z += 1.2) paint(2.4, .6, cx, z, zebra, .014);

  // outdoor assembly pad beyond the west emergency exit
  paint(14, 14, -47, -9.5, new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: .95 }), .005);
  const ap = paint(6, 6, ZONES.assembly.x, ZONES.assembly.z, new THREE.MeshStandardMaterial({ color: C.green, roughness: .7 }), .015);

  // ---------- walls (west wall has a doorway for the emergency exit, and an entrance) ----------
  const wallMat = std(0x46515c, { roughness: .9, metalness: .1 });
  const H = HALL.height;
  box(80, H, .4, wallMat, 0, H / 2, HALL.minZ, true);
  box(80, H, .4, wallMat, 0, H / 2, HALL.maxZ, true);
  box(.4, H, 40, wallMat, HALL.maxX, H / 2, 0, true);
  // west wall split around the exit door z∈[-11,-8]
  box(.4, H, 4, wallMat, HALL.minX, H / 2, -13, true);
  box(.4, H, 23, wallMat, HALL.minX, H / 2, 3.5, true);
  box(.4, H - 3, 3, wallMat, HALL.minX, 3 + (H - 3) / 2, -9.5, false);
  // outdoor fence so players stay on the pad
  const fence = std(0x6b7681);
  box(14, 1.2, .1, fence, -47, .6, -16.5, true); box(14, 1.2, .1, fence, -47, .6, -2.5, true); box(.1, 1.2, 14, fence, -54, .6, -9.5, true);
  box(.1, 1.2, 1.2, fence, -40.2, .6, -15.9, true); box(.1, 1.2, 4, fence, -40.2, .6, -4.5, true);

  // clerestory windows (emissive strips)
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc3e0, emissive: 0x6d93b3, emissiveIntensity: .9, roughness: .3 });
  for (let x = -36; x <= 36; x += 8) { box(5, 2, .1, glass, x, 11.5, HALL.maxZ - .25); box(5, 2, .1, glass, x, 11.5, HALL.minZ + .25); }

  // columns
  const colMat = std(C.navy, { metalness: .5, roughness: .5 });
  for (let x = -36; x <= 36; x += 8) { box(.7, H, .7, colMat, x, H / 2, HALL.minZ + .6, true); box(.7, H, .7, colMat, x, H / 2, HALL.maxZ - .6, true); }
  // roof trusses
  const truss = std(0x3d4650, { metalness: .6 });
  for (let x = -36; x <= 36; x += 8) box(.3, .6, 30, truss, x, H - .5, 0, false);
  box(80.4, .3, 30.4, std(0x1b232b, { roughness: 1 }), 0, H + .15, 0, false);   // roof
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 1.6 });
  for (let x = -32; x <= 32; x += 8) for (const z of [-8, 0, 8]) box(1.4, .15, .5, lampMat, x, H - 1, z, false);

  // ---------- potline (reduction cells) ----------
  const potShell = std(0x3b4148, { metalness: .6, roughness: .55 });
  const hood = std(C.silver, { metalness: .55, roughness: .35 });
  const beam = std(0x7c8792, { metalness: .6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 2.2 });
  const bus = std(0xa0a7ad, { metalness: .8, roughness: .3 });
  const potW = 4.6, potD = 6, potZ = -10.6;
  for (let i = 0; i < 10; i++) {
    const x = -27 + i * 5.6;
    box(potW, 1.3, potD, potShell, x, .65, potZ, true);
    box(potW - .4, 1.4, potD - 1.2, hood, x, 2, potZ, false);
    box(potW - .3, .08, .25, glow, x, 1.33, potZ + potD / 2 - .55, false);
    box(.35, 1.6, .35, beam, x - 1.6, 3.4, potZ, false); box(.35, 1.6, .35, beam, x + 1.6, 3.4, potZ, false);
    box(potW - .2, .45, .5, beam, x, 4.3, potZ, false);
    box(potW, .5, .8, bus, x, .4, HALL.minZ + 1.6, false);
  }
  // warm light over the cells
  for (const x of [-20, 0, 20]) { const l = new THREE.PointLight(0xff8a3d, 18, 18, 2); l.position.set(x, 2.5, -7); scene.add(l); }

  // ---------- control room ----------
  box(8, 4, 9, std(0x5a6672), 34, 2, -9.5, true);
  box(8.2, .3, 9.2, std(C.navy), 34, 4.15, -9.5, false);
  box(.12, 1.2, 4.5, glass, 29.95, 2.5, -12, false);
  box(.1, 2.6, 1.6, std(C.teal, { roughness: .5 }), 29.94, 1.3, -9.5, false);
  addSign(scene, { bg: "#0b2d4a", fg: "#ffffff", en: "CONTROL ROOM", ar: "غرفة التحكم", icon: "" }, 29.85, 3.4, -9.5, Math.PI / 2 * -1, 2.4);

  // ---------- restricted area barrier (chain posts) ----------
  const postMat = std(0xd8d8d8); const chainMat = std(C.red);
  const posts = [];
  for (let x = rz.minX; x <= rz.maxX + .01; x += 2.36) posts.push([x, rz.maxZ]);
  posts.push([rz.maxX, rz.minZ + 1.5]);
  for (const [x, z] of posts) box(.12, 1, .12, postMat, x, .5, z, false);
  box(rz.maxX - rz.minX, .05, .05, chainMat, (rz.minX + rz.maxX) / 2, .85, rz.maxZ, false);
  box(.05, .05, rz.maxZ - rz.minZ, chainMat, rz.maxX, .85, (rz.minZ + rz.maxZ) / 2, false);
  box(.05, .05, rz.maxZ - rz.minZ, chainMat, rz.minX, .85, (rz.minZ + rz.maxZ) / 2, false);
  const rsign = { bg: "#ffffff", fg: "#b3261e", en: "RESTRICTED AREA AUTHORISED ONLY", ar: "منطقة محظورة إلا للمخوّلين", icon: "stop" };
  for (const x of [6, 15, 23]) addSignPost(scene, rsign, x, rz.maxZ + .25, 0, opts);

  // ---------- overhead crane ----------
  const craneMat = std(C.amber, { metalness: .4, roughness: .5 });
  box(80, .7, .5, std(0x3d4650, { metalness: .6 }), 0, 11.6, -5.4, false);
  box(80, .7, .5, std(0x3d4650, { metalness: .6 }), 0, 11.6, 5.4, false);
  const crane = new THREE.Group();
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 11.4), craneMat); bridge.position.y = 12.3; crane.add(bridge);
  const bridge2 = bridge.clone(); bridge2.position.x = 1.6; crane.add(bridge2);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.6, .9, 2), std(0x343c44, { metalness: .6 })); trolley.position.set(.8, 11.4, 0); crane.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 6.4, 6), std(0x222222)); cable.position.set(.8, 7.9, 0); crane.add(cable);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.25, .07, 8, 16, Math.PI * 1.4), std(0xd9b100, { metalness: .7 })); hook.position.set(.8, 4.6, 0); crane.add(hook);
  // load: an anode assembly (carbon block on a rod)
  const rod = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.6, .18), std(0xb0b7bd, { metalness: .8 })); rod.position.set(.8, 3.7, 0); crane.add(rod);
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, .7, 3), std(0x1f2226, { roughness: .95 })); block.position.set(.8, 2.6, 0); crane.add(block);
  block.castShadow = opts.shadows;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2 }));
  beacon.position.set(.8, 11.95, 1.1); crane.add(beacon);
  const dangerMat = new THREE.MeshBasicMaterial({ map: stripeTex("#f2a900", "#111111"), transparent: true, opacity: .55, depthWrite: false });
  const danger = new THREE.Mesh(new THREE.PlaneGeometry(5, 6.4), dangerMat); danger.rotation.x = -Math.PI / 2; danger.position.set(.8, .03, 0);
  crane.add(danger);
  scene.add(crane);
  const craneState = { x: -20, dir: 1, wait: 0, speed: 2, active: true, halfX: 2.5, halfZ: 3.2 };
  crane.position.x = craneState.x;
  addSignPost(scene, { bg: "#f2a900", fg: "#111111", en: "OVERHEAD CRANE: NEVER UNDER LOAD", ar: "رافعة علوية: لا تقف تحت الحمل", icon: "load" }, -11.5, 5.4, 0, opts);

  // ---------- tapping bay: crucible on a carrier, leaking hose ----------
  const carrier = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3, .7, 2.1), std(0x2b4f6e, { metalness: .4 })); chassis.position.y = .65; carrier.add(chassis);
  for (const [x, z] of [[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 16), std(0x111111)); wh.rotation.x = Math.PI / 2; wh.position.set(x, .42, z); carrier.add(wh); }
  const crucible = new THREE.Mesh(new THREE.CylinderGeometry(1, .85, 1.5, 24, 1, true), std(0x4a4f55, { metalness: .7, roughness: .4, side: THREE.DoubleSide })); crucible.position.y = 1.75; carrier.add(crucible);
  const melt = new THREE.Mesh(new THREE.CircleGeometry(.95, 24), new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a00, emissiveIntensity: 2.4 })); melt.rotation.x = -Math.PI / 2; melt.position.y = 2.35; carrier.add(melt);
  carrier.position.set(-9.4, 0, -6.1); scene.add(carrier);
  colliders.push({ minX: -10.9, maxX: -7.9, minZ: -7.2, maxZ: -5 });
  const meltLight = new THREE.PointLight(0xff7a2a, 10, 9, 2); meltLight.position.set(-9.4, 3.2, -6.1); scene.add(meltLight);
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x6d9ec4, roughness: .05, metalness: .3, transparent: true, opacity: .75 });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 28), puddleMat); puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.3, .9, 1); puddle.position.set(-3.2, .02, -5.9); scene.add(puddle);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.5, .08, -7.4), new THREE.Vector3(-1.4, .08, -6.8), new THREE.Vector3(-2.6, .08, -6.2), new THREE.Vector3(-3.3, .08, -5.9)]), 20, .07, 6), std(0x1f5f9e));
  scene.add(hose);
  addSignPost(scene, { bg: "#f2a900", fg: "#111111", en: "MOLTEN METAL: KEEP DRY", ar: "معدن منصهر: أبقِ المكان جافاً", icon: "warn" }, -1, -4.3, 0, opts);

  // ---------- blocked walkway (mission 2) ----------
  const house = new THREE.Group();
  const hose2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-20.5, .07, 5.2), new THREE.Vector3(-21.5, .07, 7.5), new THREE.Vector3(-20.6, .07, 9.4), new THREE.Vector3(-21.8, .07, 11.6), new THREE.Vector3(-21, .07, 13.5)]), 40, .08, 6), std(0xd9b100));
  house.add(hose2);
  const cab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-19.8, .04, 6.1), new THREE.Vector3(-20.4, .04, 8.6), new THREE.Vector3(-19.7, .04, 11.4)]), 30, .035, 6), std(0x111111));
  house.add(cab);
  const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.2, .15, 1), std(0x9a7445)); pallet.position.set(-21.2, .08, 10.3); house.add(pallet);
  scene.add(house);
  const houseCollider = { minX: -22.2, maxX: -19.6, minZ: 6, maxZ: 12 };
  colliders.push(houseCollider);

  // ---------- PPE station ----------
  box(3.4, 2.2, .6, std(0x1f4f7a), -35.5, 1.1, 13.9, true);
  const shelf = std(0xd0d6dc);
  box(3.2, .06, .5, shelf, -35.5, 1.25, 13.55, false);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffffff, { roughness: .4 }));
  for (let i = 0; i < 4; i++) { const h = hat.clone(); h.position.set(-36.7 + i * .6, 1.28, 13.5); scene.add(h); }
  addSign(scene, { bg: "#0a5fa8", fg: "#ffffff", en: "PPE STATION", ar: "محطة معدات الوقاية", icon: "ppe" }, -35.5, 2.9, 13.55, 0, 2.6);

  // ---------- emergency exit and assembly point ----------
  const exitDoorMat = new THREE.MeshStandardMaterial({ color: 0x1f8a4c, emissive: 0x0d5a2e, emissiveIntensity: .5 });
  box(.1, .2, 3, exitDoorMat, HALL.minX + .25, 2.9, -9.5, false);
  addSign(scene, { bg: "#1f8a4c", fg: "#ffffff", en: "EMERGENCY EXIT", ar: "مخرج طوارئ", icon: "exit" }, HALL.minX + .3, 3.8, -9.5, Math.PI / 2, 2.4);
  for (const [x, z, r] of [[-30, 14.7, Math.PI], [-12, 14.7, Math.PI], [8, 14.7, Math.PI]]) addSign(scene, { bg: "#1f8a4c", fg: "#ffffff", en: "EXIT", ar: "خروج", icon: "exit" }, x, 3.4, z, r, 1.6);
  addSignPost(scene, { bg: "#1f8a4c", fg: "#ffffff", en: "ASSEMBLY POINT", ar: "نقطة التجمع", icon: "assembly" }, ZONES.assembly.x - 2.5, ZONES.assembly.z - 3.3, 0, opts);

  // ---------- fire vehicle (used in the emergency mission) ----------
  const fireGroup = new THREE.Group(); fireGroup.position.set(ZONES.fire.x, 0, ZONES.fire.z);
  const veh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 1.8), std(0xd38b00)); veh.position.y = .9; fireGroup.add(veh);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.7), std(0x2b2f33)); cabin.position.set(-.9, 2.1, 0); fireGroup.add(cabin);
  scene.add(fireGroup);
  colliders.push({ minX: ZONES.fire.x - 1.7, maxX: ZONES.fire.x + 1.7, minZ: ZONES.fire.z - 1, maxZ: ZONES.fire.z + 1 });
  const flames = new THREE.Group(); flames.visible = false; fireGroup.add(flames);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: .9 });
  const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffd04a, transparent: true, opacity: .9 });
  const flameMeshes = [];
  for (let i = 0; i < 11; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(.45 + Math.random() * .35, 2 + Math.random() * 1.4, 8), i % 2 ? flameMat : flameMat2);
    f.position.set(.3 + (Math.random() - .5) * 2.4, 2.4, (Math.random() - .5) * 1.4); flames.add(f); flameMeshes.push(f);
  }
  const fireLight = new THREE.PointLight(0xff6a00, 0, 16, 2); fireLight.position.set(0, 3, 0); fireGroup.add(fireLight);
  const smoke = makeParticles(scene, 0x3c4146, 90, 2.2);

  // ---------- markers ----------
  const markerMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: .9 });
  const beamMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: .18, depthWrite: false });
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.1, 40), markerMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; marker.add(ring);
  const beamM = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 6, 24, 1, true), beamMat); beamM.position.y = 3; marker.add(beamM);
  scene.add(marker);

  const steam = makeParticles(scene, 0xe8eef3, 80, 1.4);

  // ---------- per-frame animation ----------
  let t = 0;
  function update(dt) {
    t += dt;
    // crane shuttles along the aisle, pausing at each end
    if (craneState.active) {
      if (craneState.wait > 0) craneState.wait -= dt;
      else {
        craneState.x += craneState.dir * craneState.speed * dt;
        if (craneState.x > CRANE_RANGE[1]) { craneState.x = CRANE_RANGE[1]; craneState.dir = -1; craneState.wait = 2.5; }
        if (craneState.x < CRANE_RANGE[0]) { craneState.x = CRANE_RANGE[0]; craneState.dir = 1; craneState.wait = 2.5; }
      }
      crane.position.x = craneState.x;
    }
    block.rotation.y = Math.sin(t * .8) * .03;
    beacon.material.emissiveIntensity = craneState.active && craneState.wait <= 0 ? (Math.sin(t * 10) > 0 ? 3 : .3) : .3;
    marker.children[0].scale.setScalar(1 + Math.sin(t * 3) * .08);
    melt.material.emissiveIntensity = 2.2 + Math.sin(t * 7) * .3;
    if (flames.visible) {
      flameMeshes.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i) * .25; f.position.y = 2.4 + Math.sin(t * 6 + i * 2) * .12; });
      fireLight.intensity = 30 + Math.sin(t * 13) * 8;
      smoke.emit(new THREE.Vector3(ZONES.fire.x, 2.8, ZONES.fire.z), 2, dt);
    }
    smoke.update(dt, 1.2);
    steam.update(dt, 2.2);
    updaters.forEach((u) => u(dt, t));
  }

  return {
    colliders, update,
    crane: {
      state: craneState,
      // floor footprint under the load (world space)
      zone() { const cx = craneState.x + .8; return { minX: cx - craneState.halfX, maxX: cx + craneState.halfX, minZ: -craneState.halfZ, maxZ: craneState.halfZ }; },
      showDanger(on) { danger.visible = on; },
    },
    setMarker(pos, visible) { marker.visible = !!(pos && visible); if (pos) marker.position.set(pos.x, 0, pos.z); },
    setFire(on) { flames.visible = on; if (!on) fireLight.intensity = 0; },
    clearWalkway() { house.position.set(1.6, 0, 2.6); houseCollider.minX = houseCollider.maxX = 999; },
    fixLeak() { puddle.visible = false; },
    steamBurst() { for (let i = 0; i < 4; i++) steam.emit(new THREE.Vector3(-3.2 + Math.random(), .3, -5.9), 20, .1); },
  };
}

function addSign(scene, spec, x, y, z, rotY, width) {
  const mat = new THREE.MeshStandardMaterial({ map: signTex(spec), roughness: .6, emissive: 0xffffff, emissiveIntensity: .15, emissiveMap: null });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 2), mat);
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
  return m;
}
function addSignPost(scene, spec, x, z, rotY, opts) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: .6 }));
  pole.position.y = .9; g.add(pole);
  // two single-sided faces so the text reads correctly from both sides
  const mat = new THREE.MeshStandardMaterial({ map: signTex(spec), roughness: .6 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .7), mat); m.position.y = 2.05; g.add(m);
  const back = m.clone(); back.rotation.y = Math.PI; g.add(back);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
}

// Tiny pooled particle system for smoke and steam.
function makeParticles(scene, color, max, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3).fill(-999);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sprite = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const mat = new THREE.PointsMaterial({ color, size, map: sprite, transparent: true, opacity: .7, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const life = new Float32Array(max), vel = new Float32Array(max * 3);
  let next = 0, acc = 0;
  return {
    emit(origin, rate, dt) {
      acc += rate * (dt > .09 ? 1 : dt * 10);
      while (acc >= 1) {
        acc -= 1; const i = next++ % max;
        pos[i * 3] = origin.x + (Math.random() - .5) * .8; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z + (Math.random() - .5) * .8;
        vel[i * 3] = (Math.random() - .5) * .6; vel[i * 3 + 1] = 1 + Math.random(); vel[i * 3 + 2] = (Math.random() - .5) * .6;
        life[i] = 1;
      }
    },
    update(dt, rise) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt * .35;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * rise * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (life[i] <= 0) pos[i * 3 + 1] = -999;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
