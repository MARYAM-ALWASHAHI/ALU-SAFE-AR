// Colleagues who walk the walkways, so the hall feels like a working plant. They stay on the
// green walkway, give way to the trainee, and walk out of the nearest exit when the alarm sounds.
import * as THREE from "./vendor/three.module.min.js?v=7";
import { gbox, gcyl } from "./assets.js?v=7";

// Worker with hinged arms and legs for a walk cycle.
export function walker(M, { helmet = 0xffffff, vest = null } = {}) {
  const g = new THREE.Group();
  const limb = (w, h, d, mat, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); gbox(p, w, h, d, mat, 0, -h / 2, 0); g.add(p); return p; };
  const legL = limb(.16, .85, .2, M.coverall, -.11, .86), legR = limb(.16, .85, .2, M.coverall, .11, .86);
  gbox(legL, .18, .1, .3, M.rubber, 0, -.82, .05); gbox(legR, .18, .1, .3, M.rubber, 0, -.82, .05);
  gbox(g, .46, .62, .26, vest || M.hivis, 0, 1.16, 0);
  gbox(g, .48, .05, .27, M.silver, 0, 1.05, 0);
  const armL = limb(.12, .6, .14, M.coverall, -.3, 1.44), armR = limb(.12, .6, .14, M.coverall, .3, 1.44);
  gcyl(g, .12, .12, .26, M.skin, 0, 1.63, 0, 0, 0, 10);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: helmet, roughness: .4 }));
  hat.position.y = 1.73; g.add(hat);
  gcyl(g, .2, .2, .02, hat.material, 0, 1.735, .02);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

export function animateWalk(w, phase, amt) {
  const L = w.userData.limbs, s = Math.sin(phase) * .55 * amt;
  L.legL.rotation.x = s; L.legR.rotation.x = -s; L.armL.rotation.x = -s * .8; L.armR.rotation.x = s * .8;
}

// Routes are lists of {x, z}; walkers go back and forth with short pauses.
const ROUTES = {
  west: [{ x: -27, z: 10.6 }, { x: -8, z: 10.6 }, { x: 4, z: 10.4 }],
  mid: [{ x: 3, z: 7.4 }, { x: -12, z: 7.4 }, { x: -22, z: 7.6 }],
  east: [{ x: 12, z: 7.1 }, { x: 24, z: 7.1 }, { x: 36, z: 7.1 }],
};
const EXITS = [{ x: -30, z: 14.4 }, { x: -12, z: 14.4 }, { x: 8, z: 14.4 }];

export function crowd(ctx, routes = ["west", "mid", "east"]) {
  const { M, world, player } = ctx;
  const helmets = [0xffffff, 0x1f8a4c, 0xffffff, 0x2a6fd6];
  const list = routes.map((name, i) => {
    const route = ROUTES[name];
    const w = walker(M, { helmet: helmets[i % helmets.length] });
    const start = (i * 1.7) % (route.length - 1);
    const a = route[start | 0];
    w.position.set(a.x, 0, a.z);
    ctx.add(w);
    const col = { minX: 999, maxX: 999, minZ: 999, maxZ: 999, bottom: 0, top: 1.9 };
    world.colliders.push(col);
    return { w, route, i: (start | 0) + 1, dir: 1, wait: Math.random() * 2, phase: Math.random() * 6, col, mode: "walk", speed: 1.05 + Math.random() * .25 };
  });
  const off = world.addUpdater((dt) => {
    if (dt <= 0) return;
    for (const n of list) {
      if (n.mode === "gone") continue;
      const p = n.w.position;
      let target = n.mode === "evac" ? n.exitPath[0] : n.route[n.i];
      let moving = false;
      const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
      // give way: stop if the trainee is just ahead
      const px = player.x - p.x, pz = player.z - p.z, pd = Math.hypot(px, pz);
      const ahead = pd < 1.7 && (px * dx + pz * dz) > 0;
      if (n.wait > 0 && n.mode === "walk") n.wait -= dt;
      else if (d < .15) {
        if (n.mode === "evac" && n.exitPath.length > 1) { n.exitPath.shift(); continue; }
        if (n.mode === "evac") { n.mode = "gone"; n.w.visible = false; n.col.minX = n.col.maxX = 999; continue; }
        if (n.i === n.route.length - 1 || n.i === 0) { n.dir *= -1; n.wait = 1.5 + Math.random() * 2.5; }
        n.i += n.dir;
      } else if (!ahead) {
        const step = Math.min(d, n.speed * (n.mode === "evac" ? 1.5 : 1) * dt);
        p.x += dx / d * step; p.z += dz / d * step;
        const want = Math.atan2(dx, dz);
        let diff = want - n.w.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        n.w.rotation.y += diff * Math.min(1, dt * 6);
        moving = true;
      }
      n.phase += dt * (moving ? 7 * (n.mode === "evac" ? 1.4 : 1) : 0);
      animateWalk(n.w, n.phase, moving ? 1 : 0);
      Object.assign(n.col, { minX: p.x - .3, maxX: p.x + .3, minZ: p.z - .3, maxZ: p.z + .3 });
    }
  });
  return {
    list,
    // alarm: everyone heads for the nearest south exit and leaves the building
    evacuate() {
      for (const n of list) {
        if (n.mode !== "walk") continue;
        n.mode = "evac"; n.wait = 0;
        let best = EXITS[0], bd = 1e9;
        const fx = Math.min(n.w.position.x, 9.5);
        for (const e of EXITS) { const d = Math.hypot(e.x - fx, e.z - n.w.position.z); if (d < bd) { bd = d; best = e; } }
        // walkers east of the workshop come back along the path before turning to the wall
        n.exitPath = n.w.position.x > 10 ? [{ x: 9.5, z: n.w.position.z }, best] : [best];
      }
    },
    remove() { off(); },
  };
}
