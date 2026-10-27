// Procedural industrial assets. Static pieces go through a Kit, which merges every part that
// shares a material into one mesh (few draw calls, so phones stay smooth). Moving or
// interactive pieces are returned as separate groups so they can be animated and picked.
import * as THREE from "./vendor/three.module.min.js?v=4";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js?v=4";
import { painted, brushed, treadPlate, grating, stripes, signTex, boardTex } from "./textures.js?v=4";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

export class Kit {
  constructor(scene, shadows) {
    this.scene = scene; this.shadows = shadows;
    this.buckets = new Map(); this.colliders = []; this.surfaces = [];
    this.base = new THREE.Matrix4(); this.stack = [];
  }
  // Local frame for an asset: origin at (x, y, z) on the floor, turned by ry.
  push(x, y, z, ry = 0) {
    this.stack.push(this.base.clone());
    this.base.multiply(new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1)));
  }
  pop() { this.base = this.stack.pop(); }
  add(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1)).premultiply(this.base);
    geo.applyMatrix4(_m);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(geo);
  }
  box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) { this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz); }
  cyl(r1, r2, h, mat, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12) { this.add(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z, rx, ry, rz); }
  // Solid box that also blocks the player (height-aware).
  solid(w, h, d, mat, x, y, z) { this.box(w, h, d, mat, x, y, z); this.block(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y - h / 2, y + h / 2); }
  block(x0, x1, z0, z1, y0 = 0, y1 = 99) {
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => _v.set(x, y0, z).applyMatrix4(this.base).clone());
    const yb = new THREE.Vector3(0, y1, 0).applyMatrix4(this.base).y;
    this.colliders.push({ minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)), minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z)), bottom: pts[0].y, top: yb });
  }
  // Walkable surface (platform deck or stair ramp) in world coordinates.
  surface(s) { this.surfaces.push(s); }
  flush() {
    for (const [mat, geos] of this.buckets) {
      const g = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = mesh.receiveShadow = this.shadows;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
    this.buckets.clear();
  }
}

// ---------------- materials ----------------
export function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: .7, metalness: .2, ...o });
  return {
    steel: std({ map: painted("#55616c"), metalness: .55, roughness: .55 }),
    darkSteel: std({ map: painted("#2f363d"), metalness: .6, roughness: .5 }),
    navy: std({ map: painted("#163a5a"), metalness: .45, roughness: .5 }),
    teal: std({ map: painted("#0f8f90"), metalness: .3, roughness: .45 }),
    amber: std({ map: painted("#d69a12"), metalness: .35, roughness: .5 }),
    yellow: std({ map: painted("#e2b307"), metalness: .25, roughness: .55 }),
    red: std({ map: painted("#b3261e"), metalness: .25, roughness: .5 }),
    green: std({ map: painted("#1f7a4a"), metalness: .2, roughness: .6 }),
    white: std({ color: 0xeef0f2, roughness: .5, metalness: .05 }),
    silver: std({ map: brushed("#c3c9cf"), metalness: .85, roughness: .32 }),
    alu: std({ map: brushed("#d9dde1"), metalness: .9, roughness: .28 }),
    copper: std({ color: 0xb87333, metalness: .9, roughness: .35 }),
    rubber: std({ color: 0x15171a, roughness: .9, metalness: 0 }),
    carbon: std({ color: 0x1c1e21, roughness: .95, metalness: .05 }),
    wall: std({ map: painted("#3f4a55"), roughness: .85, metalness: .25 }),
    tread: std({ map: treadPlate(), metalness: .7, roughness: .45 }),
    grating: std({ map: grating(), metalness: .6, roughness: .5, transparent: false }),
    hazard: std({ map: stripes("#e2b307", "#1a1a1a"), roughness: .6 }),
    redWhite: std({ map: stripes("#b3261e", "#f2f2f2"), roughness: .6 }),
    concreteBlock: std({ color: 0x9a9d9f, roughness: .95, metalness: 0 }),
    wood: std({ color: 0x9a7445, roughness: .85, metalness: 0 }),
    glass: std({ color: 0x9fc3e0, emissive: 0x6d93b3, emissiveIntensity: .7, roughness: .15, metalness: .1 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff5a00, emissiveIntensity: 2.4 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 2 }),
    redLamp: new THREE.MeshStandardMaterial({ color: 0xff3b2f, emissive: 0xff2010, emissiveIntensity: 1.6 }),
    greenLamp: new THREE.MeshStandardMaterial({ color: 0x38d27a, emissive: 0x18b050, emissiveIntensity: 1.4 }),
    hivis: std({ color: 0xf4c20d, emissive: 0x3a2c00, roughness: .7 }),
    coverall: std({ color: 0x1d3f63, roughness: .85 }),
    skin: std({ color: 0xa5754f, roughness: .8 }),
    water: new THREE.MeshStandardMaterial({ color: 0x5f8db0, roughness: .04, metalness: .4, transparent: true, opacity: .78 }),
    oil: new THREE.MeshStandardMaterial({ color: 0x121010, roughness: .05, metalness: .5, transparent: true, opacity: .9 }),
  };
}

export function sign(spec, w = 1.4) {
  const mat = new THREE.MeshStandardMaterial({ map: signTex(spec), roughness: .55, emissive: 0xffffff, emissiveMap: signTex(spec), emissiveIntensity: .12 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), mat);
}
export function board(title, lines, w = 1.6) {
  const tex = boardTex(title, lines);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w * .75), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .12, roughness: .6 }));
}

// ---------------- static assets (merged) ----------------

// Reduction cell (pot) with superstructure, anode rods, fume duct and busbars.
export function potCell(kit, M, x, z) {
  kit.push(x, 0, z);
  kit.solid(4.6, 1.3, 6, M.darkSteel, 0, .65, 0);
  for (let i = -2; i <= 2; i++) kit.box(.12, 1.25, .1, M.steel, i * .95, .65, 3.02);          // cradle ribs
  for (let i = -2; i <= 2; i++) kit.box(.12, 1.25, .1, M.steel, i * .95, .65, -3.02);
  kit.box(4.2, .9, 4.6, M.silver, 0, 1.75, 0);                                                    // hood panels
  for (let i = 0; i < 4; i++) kit.box(1, .85, .04, M.alu, -1.5 + i * 1, 1.75, 2.32);
  kit.box(4.3, .08, .25, M.glow, 0, 1.33, 2.45);
  for (const sx of [-1.7, 1.7]) kit.box(.3, 2.2, .3, M.steel, sx, 3.3, 0);                        // superstructure
  kit.box(4.4, .4, .6, M.steel, 0, 4.4, 0);
  kit.box(4.2, .22, .5, M.copper, 0, 3.95, 0);                                                    // anode beam
  for (let i = 0; i < 8; i++) kit.box(.09, 1.6, .09, M.alu, -1.75 + i * .5, 3.05, (i % 2 ? .18 : -.18));
  kit.cyl(.35, .35, 2.4, M.steel, 0, 5.8, -1.4);                                                  // fume duct riser
  kit.cyl(.35, .35, 1.4, M.steel, 0, 7, -2.1, Math.PI / 2);
  kit.box(4.6, .5, .8, M.copper, 0, .35, -4.5);                                                   // busbar
  kit.pop();
}

// Building column as an I-beam with a painted guard at the base.
export function column(kit, M, x, z, h) {
  kit.push(x, 0, z);
  kit.box(.6, h, .08, M.navy, 0, h / 2, -.26); kit.box(.6, h, .08, M.navy, 0, h / 2, .26); kit.box(.08, h, .44, M.navy, 0, h / 2, 0);
  kit.box(.8, .04, .8, M.steel, 0, .02, 0);
  kit.box(.68, 1.2, .62, M.hazard, 0, .6, 0);
  kit.block(-.35, .35, -.35, .35);
  kit.pop();
}

// Horizontal pipe run along x with brackets.
export function pipeRun(kit, M, x0, x1, y, z, r, mat) {
  const len = x1 - x0;
  kit.cyl(r, r, len, mat, (x0 + x1) / 2, y, z, 0, 0, Math.PI / 2, 10);
  for (let x = x0 + 1; x < x1; x += 4) { kit.box(.06, .5, .06, M.darkSteel, x, y + r + .25, z); kit.box(.08, .08, r * 2 + .1, M.darkSteel, x, y, z); }
  for (let x = x0 + 3; x < x1; x += 8) kit.box(.12, r * 2 + .04, r * 2 + .04, M.darkSteel, x, y, z);   // flanges
}

// Steel guardrail (top rail, mid rail, posts, kick plate). Blocks the player along its length.
export function guardrail(kit, M, x0, z0, x1, z1, opts = {}) {
  const y = opts.y || 0, mat = opts.mat || M.yellow;
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0);
  kit.push((x0 + x1) / 2, y, (z0 + z1) / 2, ang);
  kit.box(len, .05, .05, mat, 0, 1.1, 0); kit.box(len, .04, .04, mat, 0, .55, 0); kit.box(len, .15, .02, mat, 0, .08, 0);
  const n = Math.max(1, Math.round(len / 1.5));
  for (let i = 0; i <= n; i++) kit.box(.06, 1.1, .06, mat, -len / 2 + i * len / n, .55, 0);
  if (!opts.noBlock) kit.block(-len / 2, len / 2, -.08, .08, 0, 1.15);
  kit.pop();
}

// Raised platform with tread-plate deck, legs, handrails and a stair.
// stair: { side: "west", width } — the stair rises from the west edge towards +x.
export function platform(kit, M, { x0, x1, z0, z1, h, stairZ0, stairZ1, gap }) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  kit.box(w, .12, d, M.tread, cx, h - .06, cz);
  kit.box(w, .25, .1, M.yellow, cx, h - .2, z0); kit.box(w, .25, .1, M.yellow, cx, h - .2, z1);
  for (const lx of [x0 + .1, cx, x1 - .1]) for (const lz of [z0 + .1, z1 - .1]) kit.box(.16, h - .12, .16, M.steel, lx, (h - .12) / 2, lz);
  kit.block(x0, x1, z0, z1, 0, h);
  kit.surface({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, h: () => h });
  // rails (north side has an optional gap for the maintenance work point)
  const r = { y: h, mat: M.yellow };
  if (gap) { guardrail(kit, M, x0, z0, gap[0], z0, r); guardrail(kit, M, gap[1], z0, x1, z0, r); kit.colliders.push({ minX: gap[0], maxX: gap[1], minZ: z0 - .15, maxZ: z0 + .05, bottom: h, top: h + 1.2 }); }
  else guardrail(kit, M, x0, z0, x1, z0, r);
  guardrail(kit, M, x0, z1, x1, z1, r);
  guardrail(kit, M, x1, z0, x1, z1, r);
  guardrail(kit, M, x0, stairZ1, x0, z1, r);
  if (stairZ0 > z0 + .1) guardrail(kit, M, x0, z0, x0, stairZ0, r);
  // stair: straight run rising towards the deck from the west
  const run = h / .7, sx0 = x0 - run, steps = Math.round(h / .2), sw = stairZ1 - stairZ0, scz = (stairZ0 + stairZ1) / 2;
  for (let i = 0; i < steps; i++) { const t = (i + 1) / steps; kit.box(run / steps + .02, .05, sw, M.tread, sx0 + run * (i + .5) / steps, h * t - .03, scz); }
  const slope = Math.atan2(h, run), slen = Math.hypot(h, run);
  for (const sz of [stairZ0, stairZ1]) {
    kit.box(slen, .22, .06, M.steel, sx0 + run / 2, h / 2 - .1, sz, 0, 0, slope);
    kit.box(slen, .05, .05, M.yellow, sx0 + run / 2, h / 2 + 1, sz, 0, 0, slope);
    kit.colliders.push({ minX: sx0, maxX: x0, minZ: sz - .08, maxZ: sz + .08, bottom: 0, top: 99 });
  }
  kit.surface({ minX: sx0, maxX: x0, minZ: stairZ0, maxZ: stairZ1, h: (px) => Math.max(0, Math.min(h, (px - sx0) / run * h)) });
}

export function jerseyBarrier(kit, M, x, z, ry = 0, len = 2) {
  kit.push(x, 0, z, ry);
  kit.box(len, .35, .6, M.concreteBlock, 0, .175, 0); kit.box(len, .5, .3, M.concreteBlock, 0, .6, 0);
  kit.box(len, .2, .32, M.redWhite, 0, .75, 0);
  kit.block(-len / 2, len / 2, -.3, .3, 0, .9);
  kit.pop();
}

export function bollard(kit, M, x, z) {
  kit.cyl(.11, .11, 1, M.yellow, x, .5, z); kit.cyl(.115, .115, .12, M.rubber, x, .7, z);
  kit.block(x - .12, x + .12, z - .12, z + .12, 0, 1);
}

export function pallet(kit, M, x, z, ry = 0, load) {
  kit.push(x, 0, z, ry);
  for (const pz of [-.45, 0, .45]) kit.box(1.2, .1, .12, M.wood, 0, .05, pz);
  for (let i = 0; i < 5; i++) kit.box(.12, .03, 1.05, M.wood, -.5 + i * .25, .12, 0);
  if (load === "boxes") { kit.box(1.1, .5, .9, M.wood, 0, .38, 0); kit.box(1, .4, .8, M.wood, 0, .83, 0); }
  if (load === "blocks") for (let i = 0; i < 2; i++) kit.box(1.1, .45, .9, M.carbon, 0, .36 + i * .46, 0);
  kit.block(-.6, .6, -.5, .5, 0, load ? 1.2 : .2);
  kit.pop();
}

export function drum(kit, M, x, z, mat) {
  kit.cyl(.29, .29, .88, mat || M.navy, x, .44, z, 0, 0, 0, 16);
  kit.cyl(.3, .3, .03, M.darkSteel, x, .3, z, 0, 0, 0, 16); kit.cyl(.3, .3, .03, M.darkSteel, x, .6, z, 0, 0, 0, 16);
  kit.block(x - .3, x + .3, z - .3, z + .3, 0, .9);
}

export function shelfRack(kit, M, x, z, ry = 0, w = 3) {
  kit.push(x, 0, z, ry);
  for (const sx of [-w / 2, w / 2]) for (const sz of [-.4, .4]) kit.box(.08, 2.6, .08, M.navy, sx, 1.3, sz);
  for (const y of [.15, .9, 1.65, 2.4]) { kit.box(w, .05, .85, M.steel, 0, y, 0); kit.box(w, .1, .05, M.amber, 0, y + .05, .42); }
  for (let i = 0; i < 6; i++) kit.box(.45, .32, .5, i % 2 ? M.teal : M.steel, -w / 2 + .35 + i * (w - .7) / 5, 1.1 + (i % 3) * .75, 0);
  kit.block(-w / 2, w / 2, -.45, .45);
  kit.pop();
}

export function workbench(kit, M, x, z, ry = 0, w = 2.4) {
  kit.push(x, 0, z, ry);
  kit.box(w, .06, .8, M.wood, 0, .92, 0);
  kit.box(w - .1, .5, .7, M.steel, 0, .55, 0);
  for (let i = 0; i < 3; i++) kit.box((w - .2) / 3 - .05, .12, .02, M.darkSteel, -w / 2 + .1 + (i + .5) * (w - .2) / 3, .75, .36);
  kit.box(w, 1, .04, M.navy, 0, 1.45, -.38);    // tool board
  for (let i = 0; i < 7; i++) kit.box(.04, .3, .03, M.silver, -w / 2 + .3 + i * .3, 1.5, -.35);
  kit.block(-w / 2, w / 2, -.4, .4, 0, 1);
  kit.pop();
}

export function gasCage(kit, M, x, z, ry = 0) {
  kit.push(x, 0, z, ry);
  kit.box(1.8, .05, .8, M.steel, 0, .03, 0);
  for (const sx of [-.9, .9]) kit.box(.05, 1.8, .8, M.grating, sx, .9, 0);
  kit.box(1.8, 1.8, .04, M.grating, 0, .9, -.4);
  for (let i = 0; i < 4; i++) { kit.cyl(.12, .12, 1.4, i % 2 ? M.green : M.red, -.6 + i * .4, .72, 0, 0, 0, 0, 12); kit.cyl(.05, .05, .12, M.silver, -.6 + i * .4, 1.48, 0); }
  kit.box(1.7, .04, .04, M.yellow, 0, 1.05, .18);                          // restraint chain bar
  kit.block(-.9, .9, -.4, .4);
  kit.pop();
}

export function lampRow(kit, M, x0, x1, step, y, z) { for (let x = x0; x <= x1; x += step) { kit.box(1.4, .12, .45, M.lamp, x, y, z); kit.box(1.5, .1, .55, M.darkSteel, x, y + .1, z); } }

// ---------------- dynamic and interactive assets (groups) ----------------
const gbox = (g, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
const gcyl = (g, r1, r2, h, mat, x, y, z, rx = 0, rz = 0, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };
export { gbox, gcyl };

export function forklift(M) {
  const g = new THREE.Group();
  gbox(g, 1.9, .7, 1.2, M.amber, 0, .65, 0);
  gbox(g, .7, .55, 1.15, M.darkSteel, -.75, 1.25, 0);                      // counterweight
  for (const sz of [-.55, .55]) { gbox(g, .06, 1.6, .06, M.darkSteel, -.1, 1.8, sz); gbox(g, .06, 1.6, .06, M.darkSteel, .6, 1.8, sz); }
  gbox(g, .8, .06, 1.2, M.darkSteel, .25, 2.6, 0);                          // overhead guard
  gbox(g, .5, .08, .5, M.rubber, -.1, 1.05, 0);                             // seat
  for (const sz of [-.3, .3]) gbox(g, .08, 2.2, .08, M.darkSteel, 1.05, 1.15, sz);   // mast
  for (const sz of [-.3, .3]) gbox(g, 1.1, .06, .12, M.steel, 1.6, .12, sz);         // forks
  for (const [x, z] of [[-.6, -.62], [-.6, .62], [.6, -.62], [.6, .62]]) gcyl(g, .3, .3, .22, M.rubber, x, .3, z, Math.PI / 2);
  const beacon = gcyl(g, .08, .08, .14, new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2 }), -.3, 2.7, 0);
  // driver
  const d = worker(M, { seated: true }); d.position.set(-.15, .7, 0); d.rotation.y = -Math.PI / 2; g.add(d);
  // blue pedestrian warning spot projected ahead of the truck
  const spot = new THREE.Mesh(new THREE.CircleGeometry(.35, 20), new THREE.MeshBasicMaterial({ color: 0x2f7dff, transparent: true, opacity: .8 }));
  spot.rotation.x = -Math.PI / 2; spot.position.set(3.4, .02, 0); g.add(spot);
  g.userData.beacon = beacon;
  return g;
}

// Simple low-poly worker in coveralls, hi-vis vest and hard hat.
export function worker(M, { seated = false, helmet = 0xffffff } = {}) {
  const g = new THREE.Group();
  if (!seated) { gbox(g, .16, .85, .2, M.coverall, -.11, .43, 0); gbox(g, .16, .85, .2, M.coverall, .11, .43, 0); gbox(g, .18, .1, .3, M.rubber, -.11, .05, .05); gbox(g, .18, .1, .3, M.rubber, .11, .05, .05); }
  else { gbox(g, .16, .2, .5, M.coverall, -.11, .1, .2); gbox(g, .16, .2, .5, M.coverall, .11, .1, .2); }
  const y0 = seated ? .2 : .85;
  gbox(g, .46, .62, .26, M.hivis, 0, y0 + .31, 0);
  gbox(g, .48, .05, .27, M.silver, 0, y0 + .2, 0);                           // reflective band
  for (const sx of [-.3, .3]) gbox(g, .12, .6, .14, M.coverall, sx, y0 + .3, seated ? .12 : 0);
  gcyl(g, .12, .12, .26, M.skin, 0, y0 + .78, 0, 0, 0, 10);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: helmet, roughness: .4 }));
  hat.position.y = y0 + .88; g.add(hat);
  gcyl(g, .2, .2, .02, hat.material, 0, y0 + .885, .02);
  return g;
}

export function extinguisher(M) {
  const g = new THREE.Group();
  gbox(g, .4, .05, .2, M.darkSteel, 0, .95, -.08);
  gcyl(g, .1, .1, .55, M.red, 0, .65, 0);
  gcyl(g, .04, .05, .1, M.darkSteel, 0, .97, 0);
  gbox(g, .14, .03, .04, M.darkSteel, .04, 1.03, 0);
  gcyl(g, .015, .015, .4, M.rubber, .1, .75, .05, 0, .2, 6);
  const s = sign({ bg: "#b3261e", fg: "#ffffff", en: "FIRE EXTINGUISHER", ar: "طفاية حريق", icon: "fire" }, .6); s.position.set(0, 1.45, -.06); g.add(s);
  return g;
}

export function callPoint(M) {
  const g = new THREE.Group();
  gbox(g, .26, .26, .08, M.red, 0, 1.4, 0);
  const glass = gbox(g, .17, .17, .02, M.white, 0, 1.4, .045);
  const s = sign({ bg: "#b3261e", fg: "#ffffff", en: "FIRE ALARM CALL POINT", ar: "نقطة إنذار الحريق", icon: "fire" }, .7); s.position.set(0, 1.85, .01); g.add(s);
  g.userData.glass = glass;
  return g;
}

export function eyewash(M) {
  const g = new THREE.Group();
  gcyl(g, .05, .05, 1, M.green, 0, .5, 0);
  gcyl(g, .22, .14, .12, M.green, 0, 1.05, 0);
  gcyl(g, .03, .03, .25, M.silver, .18, 1.0, 0, 0, Math.PI / 2);
  gbox(g, .3, .3, .02, M.white, 0, .2, 0);
  const s = sign({ bg: "#1f7a4a", fg: "#ffffff", en: "EMERGENCY EYEWASH", ar: "غسيل العيون للطوارئ", icon: "eye" }, .8); s.position.set(0, 1.75, -.12); g.add(s);
  return g;
}

export function toolbox(M) {
  const g = new THREE.Group();
  gbox(g, .5, .22, .22, M.red, 0, .11, 0);
  gbox(g, .3, .04, .04, M.darkSteel, 0, .27, 0);
  gbox(g, .04, .06, .04, M.darkSteel, -.13, .24, 0); gbox(g, .04, .06, .04, M.darkSteel, .13, .24, 0);
  return g;
}

export function valveStand(M) {
  const g = new THREE.Group();
  gcyl(g, .06, .06, 1.1, M.teal, 0, .55, 0);
  gcyl(g, .09, .09, .18, M.darkSteel, 0, 1.1, 0);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(.17, .025, 8, 20), M.red); wheel.position.set(0, 1.25, 0); wheel.rotation.x = Math.PI / 2; g.add(wheel);
  gbox(g, .34, .02, .02, M.red, 0, 1.25, 0);
  g.userData.wheel = wheel;
  return g;
}

export function panel(M, kind) {
  const g = new THREE.Group();
  gbox(g, .6, .8, .22, kind === "isolator" ? M.steel : M.navy, 0, 1.3, 0);
  const handle = gbox(g, .08, .26, .08, M.red, 0, 1.3, .15);
  gbox(g, .22, .22, .02, M.yellow, 0, 1.3, .115);
  const lamp = gbox(g, .07, .07, .03, kind === "isolator" ? M.greenLamp : M.greenLamp, .2, 1.6, .12);
  if (kind === "station") { const red = gbox(g, .1, .1, .05, M.redLamp, -.15, 1.05, .12); g.userData.stop = red; }
  gcyl(g, .04, .04, .9, M.darkSteel, 0, .45, 0);
  g.userData.handle = handle; g.userData.lamp = lamp;
  return g;
}

export function padlockTag(M) {
  const g = new THREE.Group();
  gbox(g, .08, .09, .04, M.red, 0, 0, 0);
  const sh = new THREE.Mesh(new THREE.TorusGeometry(.03, .008, 6, 12, Math.PI), M.silver); sh.position.y = .045; g.add(sh);
  gbox(g, .1, .15, .005, M.white, .03, -.13, .01);
  return g;
}

export function dryingRack(M) {
  const g = new THREE.Group();
  for (const sx of [-.7, .7]) gbox(g, .06, 1.4, .06, M.steel, sx, .7, 0);
  for (const y of [.6, 1.2]) gbox(g, 1.5, .05, .05, M.steel, 0, y, 0);
  gbox(g, 1.5, .5, .04, M.glow, 0, .35, -.25).material = new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff4400, emissiveIntensity: .7 });
  const s = sign({ bg: "#f2a900", fg: "#111111", en: "TOOL DRYING RACK", ar: "رف تجفيف الأدوات", icon: "warn" }, .9); s.position.set(0, 1.75, 0); g.add(s);
  return g;
}

export function skimTool(M, wet) {
  const g = new THREE.Group();
  gcyl(g, .025, .025, 2.2, M.steel, 0, .05, 0, 0, Math.PI / 2, 6);
  gbox(g, .05, .3, .3, M.darkSteel, 1.1, .1, 0);
  if (wet) { const p = new THREE.Mesh(new THREE.CircleGeometry(.5, 20), M.water); p.rotation.x = -Math.PI / 2; p.position.set(.6, -.03, 0); p.scale.set(1.4, .7, 1); g.add(p); g.userData.puddle = p; }
  return g;
}

export function shieldHook(M) {
  const g = new THREE.Group();
  gcyl(g, .04, .04, 1.6, M.steel, 0, .8, 0);
  gbox(g, .5, .5, .05, M.navy, 0, 1.4, 0);
  const visor = gbox(g, .3, .25, .03, new THREE.MeshStandardMaterial({ color: 0xc8a032, metalness: .9, roughness: .15 }), 0, 1.4, .05);
  g.userData.visor = visor;
  return g;
}

export function permitBox(M) {
  const g = new THREE.Group();
  gcyl(g, .04, .04, 1.2, M.steel, 0, .6, 0);
  gbox(g, .5, .4, .12, M.teal, 0, 1.3, 0);
  const paper = gbox(g, .3, .22, .01, M.white, 0, 1.32, .065);
  g.userData.paper = paper;
  return g;
}

export function anchorPost(M) {
  const g = new THREE.Group();
  gcyl(g, .06, .06, 1.6, M.yellow, 0, .8, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.08, .018, 8, 16), M.silver); ring.position.set(0, 1.62, 0); g.add(ring);
  const s = sign({ bg: "#0b5fa8", fg: "#ffffff", en: "ANCHOR POINT", ar: "نقطة تثبيت الحزام", icon: "harness" }, .7); s.position.set(0, 1.95, 0); g.add(s);
  return g;
}

// Conveyor whose belt texture scrolls while it runs.
export function conveyor(M, len) {
  const g = new THREE.Group();
  for (const sz of [-.4, .4]) gbox(g, len, .25, .06, M.steel, 0, .8, sz);
  for (let i = 0; i <= len; i += 1.5) for (const sz of [-.4, .4]) gbox(g, .08, .8, .08, M.steel, -len / 2 + i, .4, sz);
  const beltTex = stripes("#202326", "#2b2f33").clone(); beltTex.needsUpdate = true; beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping; beltTex.repeat.set(len * 2, 1);
  const belt = gbox(g, len, .04, .74, new THREE.MeshStandardMaterial({ map: beltTex, roughness: .9 }), 0, .9, 0);
  for (let i = 0; i < len; i += 1) gcyl(g, .08, .08, .76, M.silver, -len / 2 + .5 + i, .83, 0, Math.PI / 2);
  const guard = gbox(g, 1.2, .6, .9, M.yellow, len / 2 - .6, 1.15, 0);
  g.userData.beltTex = beltTex; g.userData.guard = guard;
  return g;
}

export function bench(M) {
  const g = new THREE.Group();
  gbox(g, 3, .06, .7, M.steel, 0, .9, 0);
  for (const sx of [-1.4, 1.4]) for (const sz of [-.3, .3]) gbox(g, .06, .9, .06, M.darkSteel, sx, .45, sz);
  return g;
}

// PPE items as 3D objects for the inspection bench.
export function ppeObject(M, kind, defect) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .9 });
  if (kind === "helmet") {
    const h = new THREE.Mesh(new THREE.SphereGeometry(.16, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.white); g.add(h);
    gcyl(g, .21, .21, .015, M.white, 0, 0, .02);
    if (defect) { const c = gbox(g, .012, .1, .12, dark, .05, .1, .05); c.rotation.z = .5; }
  } else if (kind === "glasses") {
    gbox(g, .16, .05, .01, new THREE.MeshStandardMaterial({ color: 0x9ad0ff, transparent: true, opacity: .6, roughness: .1 }), 0, .04, 0);
    gbox(g, .17, .015, .01, M.navy, 0, .07, 0);
    for (const sx of [-.085, .085]) gbox(g, .01, .01, .14, M.navy, sx, .06, -.07);
    if (defect) gbox(g, .002, .05, .012, dark, .03, .04, .001);
  } else if (kind === "gloves") {
    const glove = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: .95 });
    gbox(g, .12, .03, .18, glove, -.08, .015, 0); gbox(g, .12, .03, .18, glove, .08, .015, 0);
    for (let i = 0; i < 4; i++) gbox(g, .025, .025, .07, glove, -.12 + i * .028, .015, -.12);
    if (defect) { const hole = new THREE.Mesh(new THREE.CircleGeometry(.025, 10), dark); hole.rotation.x = -Math.PI / 2; hole.position.set(.08, .032, .02); g.add(hole); }
  } else if (kind === "jacket") {
    const fr = new THREE.MeshStandardMaterial({ color: 0x1d3f63, roughness: .9 });
    gbox(g, .45, .03, .55, fr, 0, .015, 0); gbox(g, .47, .031, .05, M.silver, 0, .016, .1);
    if (defect) { const burn = new THREE.Mesh(new THREE.CircleGeometry(.06, 12), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 })); burn.rotation.x = -Math.PI / 2; burn.position.set(-.1, .033, -.12); g.add(burn); }
  } else if (kind === "boots") {
    const leather = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: .7 });
    for (const sx of [-.09, .09]) { gbox(g, .1, .12, .26, leather, sx, .075, 0); gbox(g, .1, .18, .1, leather, sx, .17, .08); const sole = gbox(g, .105, .03, .27, M.rubber, sx, .015, 0); if (defect && sx > 0) { sole.rotation.x = .28; sole.position.set(sx, .005, -.05); } }
  } else if (kind === "ears") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(.09, .01, 6, 16, Math.PI), M.navy); band.position.y = .02; band.rotation.x = -Math.PI / 2; g.add(band);
    for (const sx of [-.09, .09]) gcyl(g, .045, .045, .04, M.yellow, sx, .02, 0);
  }
  return g;
}
