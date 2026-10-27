// Builds the fictional potroom hall procedurally (no external models), so it loads fast
// on phones. Units are metres. The hall runs along x; the potline is on the north side (-z),
// the crane and vehicle aisle is in the middle, and the pedestrian walkway and maintenance
// workshop are on the south side (+z).
import * as THREE from "./vendor/three.module.min.js?v=5";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js?v=5";
import { concrete, stripes, glowSprite, shaftTex, canvasTex } from "./textures.js?v=5";
import * as A from "./assets.js?v=5";

export const HALL = { minX: -40, maxX: 40, minZ: -15, maxZ: 15, height: 15 };
export const ZONES = {
  restricted: { minX: 2, maxX: 25.6, minZ: -7.6, maxZ: -4.6 },
  bay: { minX: -11, maxX: 0, minZ: -7.6, maxZ: -4.6 },
  aisle: { minX: -40, maxX: 40, minZ: -4.6, maxZ: 4.6 },
  crossings: [{ minX: -7.2, maxX: -4.8 }, { minX: 26.6, maxX: 29 }, { minX: -35.2, maxX: -32.8 }],
  walkway: { minZ: 6, maxZ: 12 },
  workshop: { minX: 12, maxX: 39.6, minZ: 8.4, maxZ: 14.6 },
  exitDoor: { x: -40, minZ: -11, maxZ: -8 },
  assembly: { x: -45, z: -9.5 },
  fire: { x: -16, z: -0.5, r: 5.5 },
  platform: { x0: 31, x1: 38.6, z0: 9.6, z1: 13.4, h: 2.4 },
};
// Fixed points that missions use (fittings that are always in the hall).
export const SPOTS = {
  board: { x: -36.2, z: 12.3 },
  ppeStation: { x: -35.5, z: 13.2 },
  ppeBench: { x: -30.8, z: 13.6 },
  callPoints: [{ x: -39.75, z: -6.4, ry: Math.PI / 2 }, { x: -28, z: 14.0, ry: Math.PI }, { x: -4, z: 14.0, ry: Math.PI }, { x: 39.75, z: 4, ry: -Math.PI / 2 }],
  extinguishers: [{ x: -24, z: 14.55, ry: Math.PI }, { x: -12, z: 14.55, ry: Math.PI }, { x: 8, z: 14.55, ry: Math.PI }, { x: 29.75, z: -7.4, ry: -Math.PI / 2 }],
  eyewash: [{ x: -16, z: 14.45, ry: Math.PI }, { x: 1.2, z: -5.2, ry: 0 }],
  fires: [{ x: -16, z: -0.5, y: 2.4, r: 5.5 }, { x: 22, z: 11.6, y: 1, r: 4.5 }, { x: -26, z: 9.2, y: .9, r: 4.5 }],
  controlDoor: { x: 28.6, z: -9.5 },
};
const CRANE_RANGE = [-30, 30];
const FORK_RANGE = [-28, 30];

export function buildWorld(scene, opts) {
  const kit = new A.Kit(scene, opts.shadows);
  const M = A.makeMaterials();
  const rich = opts.quality !== "low";
  const updaters = [];

  // image-based lighting gives metal its reflections
  if (opts.renderer) {
    const pm = new THREE.PMREMGenerator(opts.renderer);
    const env = pm.fromScene(new RoomEnvironment(opts.renderer), 0.04).texture;
    scene.environment = env; pm.dispose();
    Object.values(M).forEach((m) => { if (m.isMeshStandardMaterial) m.envMapIntensity = .55; });
  }
  scene.background = new THREE.Color(0x8fa6bb);   // daylight seen through the exit door
  scene.fog = new THREE.Fog(0x1c252e, 26, 92);

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xd6e2ee, 0x3a3631, .85));
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.6);
  sun.position.set(-20, 30, 18);
  if (opts.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 22, bottom: -22, near: 1, far: 90 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = .02;
  }
  scene.add(sun);
  for (const x of [-20, 0, 20]) { const l = new THREE.PointLight(0xff8a3d, 22, 18, 2); l.position.set(x, 2.5, -7); scene.add(l); }
  for (const x of [-24, 4, 30]) { const l = new THREE.PointLight(0xcfe3ff, 14, 16, 2); l.position.set(x, 6, 10); scene.add(l); }

  // ---------- floor and markings ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 32), new THREE.MeshStandardMaterial({ map: concrete([18, 6]), roughness: .9, metalness: 0, envMapIntensity: .3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-5, 0, 0); floor.receiveShadow = opts.shadows;
  scene.add(floor);
  const paint = (w, d, x, z, mat, y = .012) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = opts.shadows; scene.add(p); return p; };
  const flat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: 0, envMapIntensity: .3, ...o });
  const yellow = flat(0xe8b400, { roughness: .6 });
  const walkMat = flat(0x2f7a52, { roughness: .8 });
  paint(50, 6, -15, 9, walkMat);                             // pedestrian walkway (west)
  paint(30, 2, 25, 7, walkMat);                              // narrower path past the workshop
  paint(50, .18, -15, 12, yellow); paint(80, .18, 0, 6, yellow); paint(30, .18, 25, 8, yellow);
  paint(80, .18, 0, -4.6, yellow); paint(80, .18, 0, 4.6, yellow);     // crane / vehicle aisle
  paint(27.6, 6.2, 25.8, 11.5, flat(0x3c4a57, { roughness: .85 }), .008);   // workshop floor
  const bay = ZONES.bay;
  paint(bay.maxX - bay.minX, bay.maxZ - bay.minZ, (bay.minX + bay.maxX) / 2, (bay.minZ + bay.maxZ) / 2, flat(0xffffff, { map: stripes("#d9a100", "#1d1d1d", [6, 2]) }));
  const rz = ZONES.restricted;
  paint(rz.maxX - rz.minX, rz.maxZ - rz.minZ, (rz.minX + rz.maxX) / 2, (rz.minZ + rz.maxZ) / 2, flat(0xffffff, { map: stripes("#b3261e", "#f2f2f2", [12, 1.5]), transparent: true, opacity: .85 }));
  const zebra = flat(0xf2f2f2, { roughness: .6 });
  for (const c of ZONES.crossings) { const cx = (c.minX + c.maxX) / 2; for (let z = -4; z <= 4; z += 1.2) paint(2.4, .6, cx, z, zebra, .014); paint(2.6, .25, cx, 5.2, flat(0xffffff), .014); paint(2.6, .25, cx, -5.2, flat(0xffffff), .014); }
  // walking-direction arrows on the walkway
  const arrowTex = canvasTex(64, 64, (g) => { g.fillStyle = "#e6efe9"; g.beginPath(); g.moveTo(8, 22); g.lineTo(40, 22); g.lineTo(40, 10); g.lineTo(60, 32); g.lineTo(40, 54); g.lineTo(40, 42); g.lineTo(8, 42); g.fill(); });
  const arrowMat = flat(0xffffff, { map: arrowTex, transparent: true });
  for (let x = -34; x <= 6; x += 8) { paint(1.2, 1.2, x, 9, arrowMat, .015).rotation.z = 0; }

  // outdoor assembly pad beyond the west emergency exit
  paint(14, 14, -47, -9.5, flat(0x3b4046, { roughness: .95 }), .005);
  paint(6, 6, ZONES.assembly.x, ZONES.assembly.z, flat(0x1f8a4c, { roughness: .7 }), .015);
  const ringA = new THREE.Mesh(new THREE.RingGeometry(2.7, 3, 40), flat(0xffffff)); ringA.rotation.x = -Math.PI / 2; ringA.position.set(ZONES.assembly.x, .018, ZONES.assembly.z); scene.add(ringA);

  // ---------- walls, roof, columns ----------
  const H = HALL.height;
  kit.solid(80, H, .4, M.wall, 0, H / 2, HALL.minZ);
  kit.solid(80, H, .4, M.wall, 0, H / 2, HALL.maxZ);
  kit.solid(.4, H, 30, M.wall, HALL.maxX, H / 2, 0);
  kit.solid(.4, H, 4, M.wall, HALL.minX, H / 2, -13);
  kit.solid(.4, H, 23, M.wall, HALL.minX, H / 2, 3.5);
  kit.box(.4, H - 3, 3, M.wall, HALL.minX, 3 + (H - 3) / 2, -9.5);
  // wall cladding ribs and a painted dado band
  for (let x = -39; x <= 39; x += 1.5) { kit.box(.08, H, .06, M.steel, x, H / 2, HALL.minZ + .23); kit.box(.08, H, .06, M.steel, x, H / 2, HALL.maxZ - .23); }
  kit.box(80, 1.2, .05, M.navy, 0, .6, HALL.maxZ - .27);
  // outdoor fence so players stay on the pad
  kit.solid(14, 1.2, .1, M.steel, -47, .6, -16.5); kit.solid(14, 1.2, .1, M.steel, -47, .6, -2.5); kit.solid(.1, 1.2, 14, M.steel, -54, .6, -9.5);
  kit.solid(.1, 1.2, 1.2, M.steel, -40.2, .6, -15.9); kit.solid(.1, 1.2, 4, M.steel, -40.2, .6, -4.5);
  for (let x = -36; x <= 36; x += 8) { kit.box(5, 2, .1, M.glass, x, 11.5, HALL.maxZ - .3); kit.box(5, 2, .1, M.glass, x, 11.5, HALL.minZ + .3); }
  for (let x = -36; x <= 36; x += 8) { A.column(kit, M, x, HALL.minZ + .6, H); A.column(kit, M, x, HALL.maxZ - .6, H); }
  for (let x = -36; x <= 36; x += 8) { kit.box(.3, .8, 30, M.darkSteel, x, H - .6, 0); for (let z = -12; z <= 12; z += 4) kit.box(.12, .9, .12, M.darkSteel, x, H - 1.3, z); }
  for (let z = -12; z <= 12; z += 6) kit.box(80, .2, .2, M.darkSteel, 0, H - 1.05, z);
  kit.box(80.4, .3, 30.4, M.darkSteel, 0, H + .15, 0);
  for (const z of [-8, 0, 8]) A.lampRow(kit, M, -32, 32, 8, H - 1.6, z);
  // roof ventilators
  for (let x = -30; x <= 30; x += 12) { kit.cyl(1.1, 1.1, .6, M.steel, x, H - .2, -6, 0, 0, 0, 16); }

  // services: fume duct, compressed air and water lines, cable tray
  A.pipeRun(kit, M, -30, 27, 7.1, -13.6, .6, M.silver);
  A.pipeRun(kit, M, -39, 39, 5.2, 14.5, .12, M.teal);
  A.pipeRun(kit, M, -39, 39, 5.6, 14.5, .09, M.yellow);
  A.pipeRun(kit, M, -39, 11, 4.8, 14.5, .16, M.red);
  kit.box(70, .08, .5, M.grating, -4, 6.4, 14.3); for (let x = -38; x <= 30; x += 4) kit.box(.05, .6, .05, M.darkSteel, x, 6.7, 14.1);

  // ---------- potline (reduction cells) ----------
  for (let i = 0; i < 10; i++) A.potCell(kit, M, -27 + i * 5.6, -10.6);
  const heat = new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff7a2a, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(heat); s.scale.set(4.6, 1.2, 1); s.position.set(-27 + i * 5.6, 1.45, -8.1); scene.add(s); }

  // ---------- control room ----------
  kit.solid(8, 4, 9, M.steel, 34, 2, -9.5);
  kit.box(8.2, .3, 9.2, M.navy, 34, 4.15, -9.5);
  kit.box(.12, 1.2, 4.5, M.glass, 29.95, 2.5, -12);
  kit.box(.1, 2.6, 1.6, M.teal, 29.94, 1.3, -9.5);
  kit.box(.2, .1, 2, M.darkSteel, 29.9, 2.65, -9.5);
  addSign(scene, { bg: "#0b2d4a", fg: "#ffffff", en: "CONTROL ROOM", ar: "غرفة التحكم", icon: "" }, 29.85, 3.4, -9.5, -Math.PI / 2, 2.4);

  // ---------- restricted area barrier (chain posts) ----------
  const posts = [];
  for (let x = rz.minX; x <= rz.maxX + .01; x += 2.36) posts.push([x, rz.maxZ]);
  for (const [x, z] of posts) { kit.cyl(.06, .06, 1, M.white, x, .5, z); kit.cyl(.16, .18, .08, M.red, x, .04, z); }
  kit.box(rz.maxX - rz.minX, .05, .05, M.red, (rz.minX + rz.maxX) / 2, .85, rz.maxZ);
  kit.box(.05, .05, rz.maxZ - rz.minZ, M.red, rz.maxX, .85, (rz.minZ + rz.maxZ) / 2);
  kit.box(.05, .05, rz.maxZ - rz.minZ, M.red, rz.minX, .85, (rz.minZ + rz.maxZ) / 2);
  const rsign = { bg: "#ffffff", fg: "#b3261e", en: "RESTRICTED AREA AUTHORISED ONLY", ar: "منطقة محظورة إلا للمخوّلين", icon: "stop" };
  for (const x of [6, 15, 23]) addSignPost(scene, kit, M, rsign, x, rz.maxZ + .25, 0);

  // ---------- aisle furniture: bollards at crossings, barriers ----------
  for (const c of ZONES.crossings) for (const z of [5.3, -5.3]) { A.bollard(kit, M, c.minX - .3, z); A.bollard(kit, M, c.maxX + .3, z); }
  A.jerseyBarrier(kit, M, -38.8, 4.2, 0, 2);
  addSignPost(scene, kit, M, { bg: "#f2a900", fg: "#111111", en: "FORKLIFTS OPERATE IN THIS AISLE", ar: "رافعات شوكية تعمل في هذا الممر", icon: "forklift" }, -30, 5.5, 0);
  addSignPost(scene, kit, M, { bg: "#f2a900", fg: "#111111", en: "STOP LOOK BOTH WAYS", ar: "قف وانظر في الاتجاهين", icon: "warn" }, -4.2, 5.6, 0);

  // ---------- overhead crane ----------
  kit.box(80, .7, .5, M.darkSteel, 0, 11.6, -5.4);
  kit.box(80, .7, .5, M.darkSteel, 0, 11.6, 5.4);
  const crane = new THREE.Group();
  const gb = A.gbox, gc = A.gcyl;
  gb(crane, 1.2, 1.2, 11.4, M.amber, 0, 12.3, 0); gb(crane, 1.2, 1.2, 11.4, M.amber, 1.6, 12.3, 0);
  gb(crane, 3, .5, 1, M.amber, .8, 12.3, -5.4); gb(crane, 3, .5, 1, M.amber, .8, 12.3, 5.4);
  gb(crane, 2.6, .9, 2, M.darkSteel, .8, 11.4, 0);
  gc(crane, .04, .04, 6.4, M.rubber, .8, 7.9, 0);
  const hookMesh = new THREE.Mesh(new THREE.TorusGeometry(.25, .07, 8, 16, Math.PI * 1.4), M.yellow); hookMesh.position.set(.8, 4.6, 0); crane.add(hookMesh);
  gb(crane, .18, 1.6, .18, M.alu, .8, 3.7, 0);
  const block = gb(crane, 1.6, .7, 3, M.carbon, .8, 2.6, 0); block.castShadow = opts.shadows;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2 }));
  beacon.position.set(.8, 11.95, 1.1); crane.add(beacon);
  const danger = new THREE.Mesh(new THREE.PlaneGeometry(5, 6.4), new THREE.MeshBasicMaterial({ map: stripes("#f2a900", "#111111", [3, 4]), transparent: true, opacity: .55, depthWrite: false }));
  danger.rotation.x = -Math.PI / 2; danger.position.set(.8, .03, 0); crane.add(danger);
  scene.add(crane);
  const craneState = { x: -20, dir: 1, wait: 0, speed: 2, active: true, halfX: 2.5, halfZ: 3.2 };
  crane.position.x = craneState.x;
  addSignPost(scene, kit, M, { bg: "#f2a900", fg: "#111111", en: "OVERHEAD CRANE: NEVER UNDER LOAD", ar: "رافعة علوية: لا تقف تحت الحمل", icon: "load" }, -11.5, 5.4, 0);

  // ---------- forklift ----------
  const fork = A.forklift(M);
  scene.add(fork);
  const forkState = { active: false, x: -20, z: 2.6, dir: 1, speed: 3.2, wait: 0, turn: 0 };
  const forkCollider = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, bottom: 0, top: 3 };
  kit.colliders.push(forkCollider);
  function placeFork() {
    fork.position.set(forkState.x, 0, forkState.z);
    fork.rotation.y = forkState.dir > 0 ? 0 : Math.PI;
    const hx = 1.6, hz = .75;
    if (forkState.active) { forkCollider.minX = forkCollider.maxX = 999; }
    else Object.assign(forkCollider, { minX: forkState.x - hx, maxX: forkState.x + hx, minZ: forkState.z - hz, maxZ: forkState.z + hz });
  }
  function parkFork() { forkState.active = false; forkState.x = -34; forkState.z = 3.2; forkState.dir = 1; placeFork(); }
  parkFork();

  // ---------- tapping bay: crucible on a carrier, leaking hose ----------
  const carrier = new THREE.Group();
  gb(carrier, 3, .7, 2.1, M.navy, 0, .65, 0);
  gb(carrier, 3.1, .15, 2.2, M.hazard, 0, 1.05, 0);
  for (const [x, z] of [[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]]) gc(carrier, .42, .42, .3, M.rubber, x, .42, z, Math.PI / 2);
  const crucible = new THREE.Mesh(new THREE.CylinderGeometry(1, .85, 1.5, 24, 1, true), new THREE.MeshStandardMaterial({ map: M.darkSteel.map, metalness: .7, roughness: .4, side: THREE.DoubleSide })); crucible.position.y = 1.75; carrier.add(crucible);
  gc(carrier, 1.05, 1.05, .12, M.steel, 0, 2.48, 0, 0, 0, 24);
  const melt = new THREE.Mesh(new THREE.CircleGeometry(.95, 24), M.glow); melt.rotation.x = -Math.PI / 2; melt.position.y = 2.35; carrier.add(melt);
  carrier.position.set(-9.4, 0, -6.1); scene.add(carrier);
  const carrierCollider = { minX: -10.9, maxX: -7.9, minZ: -7.2, maxZ: -5, bottom: 0, top: 3 };
  kit.colliders.push(carrierCollider);
  const meltLight = new THREE.PointLight(0xff7a2a, 14, 9, 2); meltLight.position.set(0, 3.2, 0); carrier.add(meltLight);
  const meltGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff8a2a, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  meltGlow.scale.set(3.4, 2, 1); meltGlow.position.y = 2.6; carrier.add(meltGlow);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 28), M.water); puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.3, .9, 1); puddle.position.set(-3.2, .02, -5.9); scene.add(puddle);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.5, .08, -7.3), new THREE.Vector3(-1.4, .08, -6.8), new THREE.Vector3(-2.6, .08, -6.2), new THREE.Vector3(-3.3, .08, -5.9)]), 20, .07, 6), new THREE.MeshStandardMaterial({ color: 0x1f5f9e, roughness: .6 }));
  scene.add(hose);
  addSignPost(scene, kit, M, { bg: "#f2a900", fg: "#111111", en: "MOLTEN METAL: KEEP DRY", ar: "معدن منصهر: أبقِ المكان جافاً", icon: "warn" }, -1, -4.3, 0);

  // ---------- west end: entrance, PPE station, induction ----------
  kit.solid(3.4, 2.2, .6, M.navy, -35.5, 1.1, 14.3);
  kit.box(3.2, .06, .5, M.white, -35.5, 1.25, 13.95);
  kit.box(3.2, .06, .5, M.white, -35.5, .6, 13.95);
  for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.white); h.position.set(-36.9 + i * .65, 1.28, 13.9); scene.add(h); }
  for (let i = 0; i < 5; i++) kit.box(.4, .45, .05, M.hivis, -36.9 + i * .65, 1.9, 14.0);
  for (let i = 0; i < 6; i++) { kit.box(.5, 2, .5, i % 2 ? M.steel : M.navy, -39.4 + 0 * i, 1, 13.6 - i * .55); }
  kit.block(-39.7, -39.1, 10.6, 13.9);
  addSign(scene, { bg: "#0a5fa8", fg: "#ffffff", en: "PPE STATION", ar: "محطة معدات الوقاية", icon: "ppe" }, -35.5, 2.9, 13.98, Math.PI, 2.6);
  addSign(scene, { bg: "#0a5fa8", fg: "#ffffff", en: "PPE REQUIRED BEYOND THIS POINT", ar: "معدات الوقاية مطلوبة بعد هذه النقطة", icon: "ppe" }, -28.2, 3.2, 14.05, Math.PI, 2.4);

  // ---------- maintenance workshop (south-east) ----------
  const ws = ZONES.workshop;
  A.guardrail(kit, M, ws.minX, ws.minZ, 13.5, ws.minZ);
  A.guardrail(kit, M, 16, ws.minZ, ws.maxX, ws.minZ);
  A.guardrail(kit, M, ws.minX, ws.minZ, ws.minX, ws.maxZ);
  addSignPost(scene, kit, M, { bg: "#0b2d4a", fg: "#ffffff", en: "MAINTENANCE WORKSHOP", ar: "ورشة الصيانة", icon: "info" }, 16.6, 8.1, 0);
  A.workbench(kit, M, 18.5, 14.1, Math.PI);
  A.shelfRack(kit, M, 23, 14.1, Math.PI, 3);
  A.gasCage(kit, M, 26.4, 14.1, Math.PI);
  A.pallet(kit, M, 14.4, 13.6, 0, "boxes");
  const P = ZONES.platform;
  A.platform(kit, M, { x0: P.x0, x1: P.x1, z0: P.z0, z1: P.z1, h: P.h, stairZ0: P.z0, stairZ1: P.z0 + 1.2, gap: [35, 37.4] });
  // the gap in the rail is marked with hazard chain
  kit.box(2.4, .04, .04, M.hazard, 36.2, P.h + 1, P.z0);
  addSign(scene, { bg: "#f2a900", fg: "#111111", en: "FALL HAZARD: CLIP ON", ar: "خطر السقوط: ثبّت الحزام", icon: "harness" }, 33.4, P.h + 1.6, P.z0 - .02, Math.PI, 1.3);
  addSign(scene, { bg: "#0b2d4a", fg: "#ffffff", en: "CONVEYOR C-3", ar: "السير الناقل C-3", icon: "" }, 34.8, P.h + 2.2, P.z1 + .5, Math.PI, 1.6);

  // ---------- emergency exit and assembly point ----------
  kit.box(.1, .2, 3, M.greenLamp, HALL.minX + .25, 2.9, -9.5);
  addSign(scene, { bg: "#1f8a4c", fg: "#ffffff", en: "EMERGENCY EXIT", ar: "مخرج طوارئ", icon: "exit" }, HALL.minX + .3, 3.8, -9.5, Math.PI / 2, 2.4);
  for (const x of [-30, -12, 8]) addSign(scene, { bg: "#1f8a4c", fg: "#ffffff", en: "EXIT", ar: "خروج", icon: "exit" }, x, 3.4, 14.68, Math.PI, 1.6);
  addSign(scene, { bg: "#1f8a4c", fg: "#ffffff", en: "EXIT", ar: "خروج", icon: "exit" }, -24, 3.4, -4.5, 0, 1.4);
  addSignPost(scene, kit, M, { bg: "#1f8a4c", fg: "#ffffff", en: "ASSEMBLY POINT", ar: "نقطة التجمع", icon: "assembly" }, ZONES.assembly.x - 2.5, ZONES.assembly.z - 3.3, 0);

  // ---------- parked vehicle (catches fire in some missions) ----------
  const veh = new THREE.Group(); veh.position.set(ZONES.fire.x, 0, ZONES.fire.z);
  gb(veh, 3.2, 1.4, 1.8, M.amber, 0, .9, 0); gb(veh, 1.2, 1.2, 1.7, M.darkSteel, -.9, 2.1, 0);
  for (const [x, z] of [[-1, -.9], [1, -.9], [-1, .9], [1, .9]]) gc(veh, .38, .38, .25, M.rubber, x, .38, z, Math.PI / 2);
  scene.add(veh);
  kit.colliders.push({ minX: ZONES.fire.x - 1.7, maxX: ZONES.fire.x + 1.7, minZ: ZONES.fire.z - 1, maxZ: ZONES.fire.z + 1, bottom: 0, top: 3 });

  // ---------- fire (moves to whichever spot a mission picks) ----------
  const fireGroup = new THREE.Group(); scene.add(fireGroup);
  const flames = new THREE.Group(); flames.visible = false; fireGroup.add(flames);
  const flameMats = [0xff7a00, 0xffd04a, 0xff4a10].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flameMeshes = [];
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(.4 + Math.random() * .35, 1.8 + Math.random() * 1.4, 8), flameMats[i % 3]);
    f.position.set((Math.random() - .5) * 2.2, 0, (Math.random() - .5) * 1.4); f.userData.y = 0; flames.add(f); flameMeshes.push(f);
  }
  const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff6a10, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  fireGlow.scale.set(6, 5, 1); flames.add(fireGlow);
  const fireLight = new THREE.PointLight(0xff6a00, 0, 18, 2); fireLight.position.set(0, 1.5, 0); fireGroup.add(fireLight);
  const fire = { x: ZONES.fire.x, z: ZONES.fire.z, y: 2.4, r: ZONES.fire.r, on: false };
  const smoke = makeParticles(scene, 0x30353a, 160, 3);
  const steam = makeParticles(scene, 0xe8eef3, 80, 1.4);

  // ---------- markers ----------
  const marker = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.1, 40), new THREE.MeshBasicMaterial({ color: 0x00a8a8, transparent: true, opacity: .9 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; marker.add(ring);
  const beamM = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x00a8a8, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide })); beamM.position.y = 3; marker.add(beamM);
  scene.add(marker);

  // ---------- atmosphere: light shafts and drifting dust ----------
  if (rich) {
    const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex(), transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (let x = -36; x <= 36; x += 8) { const s = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 13), shaftMat); s.position.set(x + 1.5, 6, 10.5); s.rotation.set(-.55, 0, .12); scene.add(s); }
  }
  const dust = makeDust(scene, rich ? 500 : 180);

  kit.flush();

  // ---------- walkable surfaces ----------
  function floorAt(x, z) {
    let h = 0;
    for (const s of kit.surfaces) if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) h = Math.max(h, s.h(x, z));
    return h;
  }

  // ---------- per-frame animation ----------
  let t = 0;
  function update(dt) {
    t += dt;
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
    if (forkState.active) {
      if (forkState.wait > 0) forkState.wait -= dt;
      else {
        forkState.x += forkState.dir * forkState.speed * dt;
        if (forkState.x > FORK_RANGE[1]) { forkState.x = FORK_RANGE[1]; forkState.dir = -1; forkState.wait = 1.8; }
        if (forkState.x < FORK_RANGE[0]) { forkState.x = FORK_RANGE[0]; forkState.dir = 1; forkState.wait = 1.8; }
      }
      placeFork();
      fork.userData.beacon.material.emissiveIntensity = Math.sin(t * 9) > 0 ? 3 : .3;
    }
    ring.scale.setScalar(1 + Math.sin(t * 3) * .08);
    M.glow.emissiveIntensity = 2.2 + Math.sin(t * 7) * .3;
    heat.opacity = .38 + Math.sin(t * 2.3) * .07;
    if (flames.visible) {
      flameMeshes.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i) * .25; f.position.y = .9 + Math.sin(t * 6 + i * 2) * .12; });
      fireLight.intensity = 34 + Math.sin(t * 13) * 9;
      fireGlow.material.opacity = .7 + Math.sin(t * 11) * .15;
      smoke.emit(new THREE.Vector3(fire.x, fire.y + 1.6, fire.z), 2.4, dt);
    }
    smoke.update(dt, 1.2);
    steam.update(dt, 2.2);
    dust.update(dt, t);
    updaters.forEach((u) => u(dt, t));
  }

  return {
    colliders: kit.colliders, update, floorAt, materials: M,
    crane: {
      state: craneState,
      zone() { const cx = craneState.x + .8; return { minX: cx - craneState.halfX, maxX: cx + craneState.halfX, minZ: -craneState.halfZ, maxZ: craneState.halfZ }; },
      showDanger(on) { danger.visible = on; },
    },
    forklift: {
      state: forkState,
      start(speed) { forkState.active = true; forkState.speed = speed; forkState.x = 14; forkState.z = 2.6; forkState.dir = -1; placeFork(); },
      park: parkFork,
      zone(pad = 0) { return { minX: forkState.x - 1.4 - pad + (forkState.dir > 0 ? .4 : -.4), maxX: forkState.x + 1.4 + pad + (forkState.dir > 0 ? .4 : -.4), minZ: forkState.z - .75 - pad, maxZ: forkState.z + .75 + pad }; },
    },
    fire,
    carrier: { group: carrier, collider: carrierCollider },
    puddle, hose,
    setMarker(pos, visible) { marker.visible = !!(pos && visible); if (pos) marker.position.set(pos.x, pos.y || 0, pos.z); },
    setFire(on, spot = SPOTS.fires[0]) {
      Object.assign(fire, { x: spot.x, z: spot.z, y: spot.y, r: spot.r, on });
      fireGroup.position.set(spot.x, spot.y - .9, spot.z);
      flames.visible = on; if (!on) fireLight.intensity = 0;
    },
    fixLeak() { puddle.visible = false; },
    resetLeak() { puddle.visible = true; },
    steamBurst(x = -3.2, z = -5.9) { for (let i = 0; i < 4; i++) steam.emit(new THREE.Vector3(x + Math.random(), .3, z), 20, .1); },
    addUpdater(fn) { updaters.push(fn); return () => { const i = updaters.indexOf(fn); if (i >= 0) updaters.splice(i, 1); }; },
  };
}

function addSign(scene, spec, x, y, z, rotY, width) {
  const m = A.sign(spec, width);
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
  return m;
}
function addSignPost(scene, kit, M, spec, x, z, rotY) {
  kit.cyl(.05, .05, 1.8, M.silver, x, .9, z);
  kit.cyl(.2, .22, .06, M.darkSteel, x, .03, z);
  // two single-sided faces so the text reads correctly from both sides
  const g = new THREE.Group();
  const m = A.sign(spec, 1.4); m.position.y = 2.05; g.add(m);
  const back = m.clone(); back.rotation.y = Math.PI; g.add(back);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
}

// Pooled particle system for smoke and steam.
function makeParticles(scene, color, max, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3).fill(-999);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: glowSprite(), transparent: true, opacity: .7, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const life = new Float32Array(max), vel = new Float32Array(max * 3);
  let next = 0, acc = 0;
  return {
    emit(origin, rate, dt) {
      acc += rate * (dt > .09 ? 1 : dt * 10);
      while (acc >= 1) {
        acc -= 1; const i = next++ % max;
        pos[i * 3] = origin.x + (Math.random() - .5) * .8; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z + (Math.random() - .5) * .8;
        vel[i * 3] = (Math.random() - .5) * .8; vel[i * 3 + 1] = 1 + Math.random(); vel[i * 3 + 2] = (Math.random() - .5) * .8;
        life[i] = 1;
      }
    },
    update(dt, rise) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt * .3;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * rise * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] > 13.5) { vel[i * 3] *= 1.02; vel[i * 3 + 2] *= 1.02; pos[i * 3 + 1] = 13.5; }
        if (life[i] <= 0) pos[i * 3 + 1] = -999;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

function makeDust(scene, n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = -40 + Math.random() * 80; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = -14 + Math.random() * 28; }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1d6, size: 1.6, sizeAttenuation: false, transparent: true, opacity: .45, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  return {
    update(dt, t) {
      for (let i = 0; i < n; i++) {
        pos[i * 3 + 1] += Math.sin(t * .3 + i) * .002 + .004 * dt * 10;
        pos[i * 3] += Math.cos(t * .2 + i * .7) * .003;
        if (pos[i * 3 + 1] > 12) pos[i * 3 + 1] = 0;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
