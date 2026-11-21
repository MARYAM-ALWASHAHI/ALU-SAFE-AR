// The eight missions. Each mission sets up its own objects, objectives and rules through `ctx`
// (see Game.makeCtx in game.js) and runs its own logic every frame in update().
// All wording comes from content.js so HSE can review it in one place.
import * as THREE from "./vendor/three.module.min.js?v=6";
import * as A from "./assets.js?v=6";
import { SPOTS, ZONES } from "./world.js?v=6";
import { MISSION_TEXT, HUNT_SPOTS, HAZARD_CATS, PPE_CHECK, SCORING } from "./content.js?v=6";
import { t, tx, getLang } from "./i18n.js?v=6";
import { icon, ppeArt, openModal, closeModal } from "./ui.js?v=6";
import { sfx } from "./audio.js?v=6";
import { walker, animateWalk } from "./npc.js?v=6";
import { glowSprite } from "./textures.js?v=6";

const T = MISSION_TEXT;
const L = (en, ar) => ({ en, ar });
const pick = (a) => a[Math.random() * a.length | 0];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ASSEMBLY = { x: ZONES.assembly.x, z: ZONES.assembly.z };

// Fittings every mission shows: call points, extinguishers, eyewash, induction board.
function fixtures(ctx, opts = {}) {
  const { M } = ctx;
  const place = (g, s) => { g.position.set(s.x, 0, s.z); g.rotation.y = s.ry || 0; ctx.add(g); return g; };
  const calls = SPOTS.callPoints.map((s) => ({ g: place(A.callPoint(M), s), s }));
  const exts = SPOTS.extinguishers.map((s) => ({ g: place(A.extinguisher(M), s), s }));
  const eyes = SPOTS.eyewash.map((s) => ({ g: place(A.eyewash(M), s), s }));
  const board = new THREE.Group();
  const b = A.board(getLang() === "ar" ? "تعريف السلامة" : "SAFETY INDUCTION", getLang() === "ar"
    ? ["ارتدِ معدات الوقاية الكاملة", "ابقَ في الممر الأخضر", "اعبر من خطوط العبور فقط", "لا تقف تحت حمل معلّق", "أبلغ عن كل خطر"]
    : ["Full PPE at all times", "Stay on the green walkway", "Cross at zebra crossings only", "Never under a suspended load", "Report every hazard"], 1.6);
  b.position.y = 1.7; board.add(b);
  A.gbox(board, 1.7, 1.3, .06, M.navy, 0, 1.7, -.04);
  for (const sx of [-.75, .75]) A.gcyl(board, .04, .04, 1.2, M.steel, sx, .6, -.04);
  place(board, { ...SPOTS.board, ry: Math.PI });
  // a few colleagues at work make the hall feel alive
  if (!opts.noCrowd) {
    const w1 = A.worker(M); w1.position.set(-20, 0, -6.2); w1.rotation.y = Math.PI; ctx.add(w1);
    const w2 = A.worker(M, { helmet: 0x1f8a4c }); w2.position.set(33.2, 0, -4.4); w2.rotation.y = -Math.PI / 2; ctx.add(w2);
  }
  // colleagues walking the walkways (not where hazards are laid out on the walkway)
  if (opts.walkers !== false && !opts.noCrowd) ctx.state.crowd = ctx.crowd(opts.routes);
  return { calls, exts, eyes, board };
}

function nearest(list, p) { let best = null, bd = 1e9; for (const s of list) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } } return best; }

// Moves an object smoothly to a position over `sec` seconds.
function tween(ctx, obj, to, sec, done) {
  const from = obj.position.clone(), t0 = performance.now();
  const off = ctx.world.addUpdater(() => {   // real time, so it also runs while the player is paused
    const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
    const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    obj.position.lerpVectors(from, to, e);
    if (to.ry != null) obj.rotation.y = to.ry;
    if (k >= 1) { off(); done && done(); }
  });
}

// ---------------------------------------------------------------------------------------
// Hazard spot models (hazard version and safe version) used by Hazard Hunter and the final.
// ---------------------------------------------------------------------------------------
function spotModel(ctx, spot, bad) {
  const { M } = ctx, g = new THREE.Group(), gb = A.gbox, gc = A.gcyl;
  g.position.set(spot.x, 0, spot.z);
  const col = (x0, x1, z0, z1, top = 2) => ctx.world.colliders.push({ minX: spot.x + x0, maxX: spot.x + x1, minZ: spot.z + z0, maxZ: spot.z + z1, bottom: 0, top });
  const flatMesh = (geo, mat, x, z, y = .02) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); return m; };
  switch (spot.id) {
    case "gas":
      if (bad) { const c = gc(g, .12, .12, 1.4, M.green, 0, .7, 0); c.rotation.z = .06; gc(g, .05, .05, .14, M.silver, .04, 1.45, 0); }
      else { gb(g, .8, .06, .45, M.darkSteel, 0, .1, 0); gb(g, .05, 1.3, .05, M.darkSteel, -.38, .7, -.18); gb(g, .05, 1.3, .05, M.darkSteel, .38, .7, -.18);
        for (const x of [-.18, .18]) { gc(g, .12, .12, 1.3, M.green, x, .8, 0); gc(g, .05, .05, .12, M.silver, x, 1.5, 0); }
        gb(g, .8, .03, .03, M.yellow, 0, 1.1, .13); for (const x of [-.32, .32]) gc(g, .1, .1, .06, M.rubber, x, .1, .2, 0, Math.PI / 2); }
      col(-.4, .4, -.3, .3); break;
    case "ext":
      if (bad) { for (let i = 0; i < 3; i++) gb(g, .7, .5, .55, M.wood, (i - 1) * .3, .25 + (i === 1 ? .5 : 0), -.9); col(-.6, .6, -1.2, -.6, 1); }
      else { const pm = new THREE.MeshStandardMaterial({ map: M.redWhite.map, roughness: .7 }); flatMesh(new THREE.PlaneGeometry(1, .9), pm, 0, -.6); }
      g.userData.pos = new THREE.Vector3(spot.x, 1, spot.z - .2); break;
    case "cable": {
      if (bad) {
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, .03, -2.8), new THREE.Vector3(.4, .03, -1), new THREE.Vector3(-.2, .03, .8), new THREE.Vector3(.3, .03, 2.8)]), 30, .03, 6), M.rubber); g.add(tube);
        for (const z of [-.2, .1]) gb(g, .08, .02, .05, M.copper, .1, .04, z);
        gb(g, .06, .04, .06, new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff4400, emissiveIntensity: .8 }), .12, .05, -.05);
      } else { gb(g, .6, .06, 5.8, M.yellow, 0, .03, 0); gb(g, .18, .061, 5.8, M.rubber, 0, .031, 0); }
      g.userData.pos = new THREE.Vector3(spot.x, .2, spot.z); break;
    }
    case "oil":
      if (bad) { const m = flatMesh(new THREE.CircleGeometry(.9, 24), M.oil, 0, 0, .015); m.scale.set(1.6, 1, 1); flatMesh(new THREE.CircleGeometry(.35, 16), M.oil, .9, .5, .016); }
      else { gb(g, .7, .8, .55, M.yellow, 0, .4, 1.2); const s = A.sign({ bg: "#f2c200", fg: "#111111", en: "SPILL KIT", ar: "حقيبة الانسكابات", icon: "warn" }, .62); s.position.set(0, .55, 1.48); s.rotation.y = 0; g.add(s); col(-.35, .35, .9, 1.5, 1); }
      g.userData.pos = new THREE.Vector3(spot.x, .3, spot.z + (bad ? 0 : 1.2)); break;
    case "stack": {
      const n = bad ? 4 : 1;
      const s = new THREE.Group(); g.add(s);
      for (let i = 0; i < n; i++) { gb(s, 1.2, .12, 1, M.wood, i * .04, .06 + i * .82, 0); gb(s, 1.1, .7, .9, M.wood, i * .05, .47 + i * .82, 0); }
      if (bad) s.rotation.z = .07;
      col(-.65, .75, -.55, .55); g.userData.pos = new THREE.Vector3(spot.x, 1, spot.z); break;
    }
    case "ladder": {
      const lad = new THREE.Group();
      for (const sx of [-.22, .22]) gb(lad, .05, 3, .06, M.alu, sx, 1.5, 0);
      for (let i = 0; i < 10; i++) if (!(bad && i === 4)) gb(lad, .44, .04, .04, M.alu, 0, .25 + i * .29, 0);
      if (bad) { gb(lad, .2, .04, .04, M.alu, -.12, .25 + 4 * .29, 0).rotation.z = .5; lad.position.set(0, 0, -.6); lad.rotation.x = -.32; }
      else { lad.rotation.z = Math.PI / 2; lad.position.set(1.5, .55, -.85); }
      g.add(lad); g.userData.pos = new THREE.Vector3(spot.x, 1.2, spot.z - .3); break;
    }
    case "grinder": {
      gb(g, .3, .2, .2, M.darkSteel, 0, 1.05, 0); gc(g, .1, .1, .5, M.teal, 0, 1.12, 0, 0, Math.PI / 2);
      for (const sx of [-.32, .32]) {
        const disc = gc(g, .14, .14, .04, M.steel, sx, 1.12, 0, 0, Math.PI / 2, 16);
        if (bad) g.userData.disc = disc;
        if (!bad) gc(g, .17, .17, .09, M.yellow, sx, 1.14, 0, 0, Math.PI / 2, 12);
      }
      if (bad) { const sp = new THREE.Points(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3(.32 + Math.random() * .3, 1 + Math.random() * .2, .1 + Math.random() * .3))), new THREE.PointsMaterial({ color: 0xffb040, size: .03 })); g.add(sp); g.userData.sparks = sp; }
      g.userData.pos = new THREE.Vector3(spot.x, 1.1, spot.z); break;
    }
    case "drum": {
      gc(g, .29, .29, .88, M.red, 0, .44, 0, 0, 0, 16);
      if (bad) { flatMesh(new THREE.CircleGeometry(.26, 16), M.oil, 0, 0, .885); const lid = gc(g, .3, .3, .03, M.red, .4, .02, .2); lid.rotation.z = .1;
        gb(g, 1.6, 1.6, .05, new THREE.MeshStandardMaterial({ color: 0x8c2d1a, roughness: .8 }), 1.4, .9, -.6).rotation.y = -.5;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x8fd0ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending })); glow.scale.set(.5, .5, 1); glow.position.set(1.1, .7, -.2); g.add(glow); g.userData.weld = glow; }
      else { gb(g, .9, .15, .9, M.yellow, 0, .075, 0); gc(g, .3, .3, .03, M.darkSteel, 0, .89, 0); }
      col(-.4, .4, -.4, .4, 1); g.userData.pos = new THREE.Vector3(spot.x, .9, spot.z); break;
    }
    case "hose":
      if (bad) { const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.5, .07, -2.9), new THREE.Vector3(-.5, .07, -1.2), new THREE.Vector3(.4, .07, .5), new THREE.Vector3(-.6, .07, 2.6), new THREE.Vector3(.2, .07, 3.4)]), 40, .08, 6), M.yellow); g.add(tube); }
      else { const reel = new THREE.Mesh(new THREE.TorusGeometry(.35, .1, 8, 20), M.yellow); reel.position.set(0, .6, 3.2); g.add(reel); gb(g, .08, .7, .08, M.darkSteel, 0, .35, 3.2); }
      g.userData.pos = new THREE.Vector3(spot.x, .3, spot.z + (bad ? 0 : 3.2)); break;
    case "hatch":
      if (bad) { flatMesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0x050505 }), 0, 0, .02); gb(g, 1.2, 1.2, .05, M.steel, 0, .6, -.65); }
      else { gb(g, 1.2, .03, 1.2, M.tread, 0, .015, 0); }
      g.userData.pos = new THREE.Vector3(spot.x, .2, spot.z); break;
  }
  ctx.add(g);
  return g;
}

function reportedCone(ctx, pos) {
  const { M } = ctx, g = new THREE.Group();
  A.gcyl(g, .03, .18, .55, M.red, 0, .3, 0, 0, 0, 12); A.gcyl(g, .1, .12, .08, M.white, 0, .35, 0, 0, 0, 12); A.gbox(g, .4, .03, .4, M.rubber, 0, .015, 0);
  g.position.set(pos.x + .7, 0, pos.z + .5); ctx.add(g);
}

// Classify a hazard spot. Resolves with { correct, wasHazard }.
function classify(ctx, spot, bad, { penaltyWrong = SCORING.wrongCheck } = {}) {
  return new Promise((res) => {
    const g = ctx.game;
    const others = shuffle(Object.keys(HAZARD_CATS).filter((k) => k !== "none" && k !== spot.cat));
    const opts = shuffle(bad ? [spot.cat, others[0], others[1]] : [others[0], others[1], others[2]]).concat("none");
    g.pause();
    const box = openModal({
      tag: `${icon("eye")} ${tx(spot.name)}`, title: tx(T.hunter.q),
      body: `<p>${tx(bad ? spot.bad : spot.good)}</p><div class="opts">${opts.map((k) => `<button class="opt" data-k="${k}"><span class="key">${icon(k === "none" ? "check" : "warn")}</span><span>${tx(HAZARD_CATS[k])}</span></button>`).join("")}</div>`,
    });
    box.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k;
      closeModal();
      let tone, title, pts = 0;
      if (bad && k === spot.cat) { tone = "good"; title = T.hunter.right; }
      else if (bad && k !== "none") { tone = "bad"; title = T.hunter.wrongCat; pts = SCORING.minor; }
      else if (bad) { tone = "bad"; title = T.hunter.missed; pts = penaltyWrong; }
      else if (k === "none") { tone = "good"; title = T.hunter.right; }
      else { tone = "bad"; title = T.hunter.falseAlarm; pts = SCORING.minor; }
      if (pts) g.addPenalty(pts, spot.name);
      g.playFx(tone === "good" ? "good" : "bad");
      openModal({
        tone, tag: tone === "good" ? `${icon("check")} ${tx(title)}` : `${icon("x")} ${tx(title)}`,
        title: tx(spot.name),
        body: `${bad ? `<p><b>${tx(HAZARD_CATS[spot.cat])}</b></p>` : `<p>${tx(spot.good)}</p>`}<div class="learn"><b>${t("remember")}</b><p>${tx(spot.learn)}</p></div>${pts ? `<p class="muted">−${pts} ${t("score")}</p>` : ""}`,
        actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }],
        onClose: () => { g.resume(); res({ correct: tone === "good", wasHazard: bad }); },
      });
    }));
  });
}

// Shared evacuation logic (Emergency Response and the final mission).
function startEvacuation(ctx, st) {
  const { world, cfg } = ctx, tt = T.emergency;
  st.evac = true;
  ctx.alarm(true);
  if (st.crowd) st.crowd.evacuate();
  world.crane.state.active = false;
  world.forklift.park();
  ctx.rules({ fire: true, aisle: false, forklift: false, crane: false });
  ctx.show("evac"); ctx.show("warden");
  ctx.toast(tt.alarmOn, 2600);
  ctx.timer(cfg.evacSeconds, () => ctx.fail(tt.timeT, tt.timeB));
}
function smokeExposure(ctx, st, dt) {
  const { world, player: p } = ctx;
  if (!world.fire.on) return;
  const d = Math.hypot(p.x - world.fire.x, p.z - world.fire.z), band = 6;
  st.smoke = st.smoke || 0;
  if (d < world.fire.r + band) st.smoke += dt * .32 * (1 - Math.max(0, d - world.fire.r) / band);
  else st.smoke = Math.max(0, st.smoke - dt * .04);
  ctx.meter(tx(T.emergency.smoke), st.smoke);
  if (st.smoke >= 1) ctx.fail(T.emergency.smokeT, T.emergency.smokeB);
}
function warden(ctx, st) {
  const { M } = ctx;
  const w = A.worker(M, { helmet: 0x1f8a4c }); w.position.set(-44, 0, -13.2); ctx.add(w);
  const vest = A.gbox(w, .5, .2, .28, M.green, 0, 1.45, 0);
  for (const [x, z] of [[-46.5, -8], [-43.5, -7.5], [-47, -11]]) { const c = A.worker(M); c.position.set(x, 0, z); c.rotation.y = Math.random() * 6; ctx.add(c); }
  st.wardenItem = ctx.item({ obj: w, label: tt("warden"), verb: L("Report", "أبلغ"), range: 2.6, enabled: false, onUse: async (it) => {
    it.remove();
    await ctx.choose({ title: T.emergency.obj.warden, q: T.emergency.wardenQ, opts: T.emergency.wardenOpts, fxBad: "bad" });
    ctx.done("warden");
    ctx.alarm(false);
    ctx.complete();
  } });
  function tt(k) { return T.emergency.obj[k]; }
  return vest;
}
function evacUpdate(ctx, st, dt) {
  smokeExposure(ctx, st, dt);
  if (st.evac && !ctx.isDone("evac") && ctx.near(ASSEMBLY, 3.2)) {
    ctx.done("evac"); ctx.timer(null); ctx.meter(null, null);
    st.wardenItem.enabled = true;
  }
}

// Sparks (hot work) and extinguisher spray share one pooled particle system.
function makeSparks(ctx) {
  const N = 420;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3).fill(-99), col = new Float32Array(N * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: .06, map: glowSprite(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; ctx.add(pts);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), kind = new Uint8Array(N);
  let next = 0, acc = 0;
  const spawn = (x, y, z, vx, vy, vz, l, k) => {
    const i = next++ % N;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; life[i] = l; kind[i] = k;
  };
  ctx.world.addUpdater((dt) => {
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (kind[i] === 0) vel[i * 3 + 1] -= 9.8 * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < .02 && kind[i] === 0) { pos[i * 3 + 1] = .02; vel[i * 3 + 1] *= -.3; vel[i * 3] *= .6; vel[i * 3 + 2] *= .6; }
      const k = Math.max(0, life[i]);
      if (kind[i] === 0) { col[i * 3] = Math.min(1, k * 2) * 2.4; col[i * 3 + 1] = (.25 + k * .9) * Math.min(1, k * 2); col[i * 3 + 2] = .08 * k; }
      else { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = .55 * Math.min(1, k * 2); }
      if (life[i] <= 0) pos[i * 3 + 1] = -99;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  });
  return {
    emit(p, dt) {
      acc += dt * 160;
      while (acc >= 1) { acc--; const a = (Math.random() - .5) * 2.2, sp = 3 + Math.random() * 4.5;
        spawn(p.x, p.y, p.z, Math.sin(a) * sp, 1 + Math.random() * 2.5, Math.cos(a) * sp * .9 + .4, .5 + Math.random() * .9, 0); }
    },
    spray(from, to, dt) {
      acc += dt * 120;
      const d = to.clone().sub(from); const L = d.length(); d.normalize();
      while (acc >= 1) { acc--; const sp = L * (1.4 + Math.random() * .4);
        spawn(from.x, from.y, from.z, d.x * sp + (Math.random() - .5) * 1.2, d.y * sp + (Math.random() - .5) * .8, d.z * sp + (Math.random() - .5) * 1.2, .7, 1); }
    },
  };
}

// A small smouldering spot: glow and a thin column of smoke.
function makeSmoulder(ctx, at) {
  const g = new THREE.Group(); g.position.set(at.x, 0, at.z); ctx.add(g);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(.22, 16), new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = .03; g.add(glow);
  const puffs = [];
  const tex = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c; })());
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x5a5e63, transparent: true, opacity: 0, depthWrite: false })); s.userData.t = i / 14; g.add(s); puffs.push(s); }
  let on = true;
  const off = ctx.world.addUpdater((dt, t) => {
    glow.material.opacity = on ? .6 + Math.sin(t * 9) * .3 : Math.max(0, glow.material.opacity - dt);
    for (const s of puffs) {
      s.userData.t = (s.userData.t + dt * .35) % 1; const k = s.userData.t;
      s.position.set(Math.sin(k * 6 + s.id) * .15 * k, .1 + k * 2.6, Math.cos(k * 5) * .1 * k);
      s.scale.setScalar(.25 + k * 1.1);
      s.material.opacity = on ? (1 - k) * .55 : Math.max(0, s.material.opacity - dt * .8);
    }
  });
  return { out() { on = false; setTimeout(off, 2500); } };
}

// =======================================================================================
export const MISSIONS = {
  // 1 -------------------------------------------------------------------------------------
  induction: {
    spawn: { x: -37.5, z: 8.5, yaw: -Math.PI / 2 },
    rules: { aisle: true },
    setup(ctx) {
      const tt = T.induction, fx = fixtures(ctx);
      ctx.objectives([
        { id: "board", text: tt.obj.board, at: SPOTS.board },
        { id: "exit", text: tt.obj.exit, at: { x: -39, z: -9.5 } },
        { id: "call", text: tt.obj.call, at: SPOTS.callPoints[0] },
        { id: "eyewash", text: tt.obj.eyewash, at: SPOTS.eyewash[0] },
        { id: "assembly", text: tt.obj.assembly, at: ASSEMBLY },
      ]);
      const learn = (id, title, body, tag) => async (it) => { await ctx.info({ tag: `${icon(tag)} ${tx(T.induction.name)}`, title, body }); ctx.done(id); if (id !== "call" && id !== "eyewash") it.remove(); };
      ctx.item({ obj: fx.board, label: tt.obj.board, verb: L("Read", "اقرأ"), range: 2.6, onUse: learn("board", tt.boardT, tt.boardB, "help") });
      const door = new THREE.Group(); A.gbox(door, .1, 2.6, .12, ctx.M.greenLamp, 0, 1.3, -1.45); A.gbox(door, .1, 2.6, .12, ctx.M.greenLamp, 0, 1.3, 1.45); A.gbox(door, .06, .08, 2.6, ctx.M.silver, .05, 1, 0);
      door.position.set(-39.7, 0, -9.5); ctx.add(door);
      ctx.item({ obj: door, pos: new THREE.Vector3(-39.4, 1.2, -9.5), label: tt.obj.exit, verb: L("Check", "افحص"), range: 3, onUse: learn("exit", tt.obj.exit, tt.exitB, "help") });
      fx.calls.forEach((c) => ctx.item({ obj: c.g, label: tt.obj.call, verb: L("Check", "افحص"), onUse: async (it) => { await learn("call", tt.obj.call, tt.callB, "warn")(it); ctx.game.items.filter((x) => x.label === tt.obj.call).forEach((x) => x.remove()); } }));
      fx.eyes.forEach((c) => ctx.item({ obj: c.g, label: tt.obj.eyewash, verb: L("Check", "افحص"), onUse: async (it) => { await learn("eyewash", tt.obj.eyewash, tt.eyewashB, "help")(it); ctx.game.items.filter((x) => x.label === tt.obj.eyewash).forEach((x) => x.remove()); } }));
    },
    update(ctx) {
      if (ctx.near(ASSEMBLY, 3)) {
        if (["board", "exit", "call", "eyewash"].every(ctx.isDone)) { ctx.done("assembly"); ctx.complete(); }
        else if (!ctx.state.warned) { ctx.state.warned = true; ctx.toast(L("Finish the checklist first.", "أكمل قائمة المهام أولاً."), 2600); }
      } else ctx.state.warned = false;
    },
  },

  // 2 -------------------------------------------------------------------------------------
  ppe: {
    spawn: { x: -37.5, z: 9.6, yaw: -Math.PI / 2 },
    rules: { aisle: true },
    setup(ctx) {
      const tt = T.ppe, { M } = ctx, st = ctx.state;
      fixtures(ctx);
      const kinds = ["helmet", "glasses", "gloves", "jacket", "boots"];
      const nBad = ctx.diff === "hard" ? 3 : 2;
      const bad = new Set(shuffle(kinds.slice()).slice(0, nBad));
      st.left = kinds.length;
      ctx.objectives([
        { id: "select", text: tt.obj.select, at: { x: -35.5, z: 12.6 } },
        { id: "inspect", text: () => tx(tt.obj.inspect).replace("{n}", st.left), at: SPOTS.ppeBench },
        { id: "go", text: tt.obj.go, at: { x: -26.5, z: 9 } },
      ]);
      // PPE station
      const station = new THREE.Group(); station.position.set(-35.5, 0, 13.9); ctx.add(station);
      A.gbox(station, .01, .01, .01, M.white, 0, 1.3, 0);
      ctx.item({ obj: station, pos: new THREE.Vector3(-35.5, 1.3, 13.8), range: 2.6, label: tt.obj.select, verb: L("Choose", "اختر"), onUse: async (it) => {
        it.remove(); await ctx.ppeSelect(); ctx.done("select"); benchItems.forEach((b) => (b.enabled = true));
      } });
      // inspection bench with real 3D items
      const bench = A.bench(M); bench.position.set(SPOTS.ppeBench.x, 0, SPOTS.ppeBench.z + .3); ctx.add(bench);
      ctx.world.colliders.push({ minX: SPOTS.ppeBench.x - 1.6, maxX: SPOTS.ppeBench.x + 1.6, minZ: SPOTS.ppeBench.z - .05, maxZ: SPOTS.ppeBench.z + .7, bottom: 0, top: 1 });
      const sgn = A.sign({ bg: "#0a5fa8", fg: "#ffffff", en: "INSPECT BEFORE USE", ar: "افحص قبل الاستخدام", icon: "eye" }, 1.4); sgn.position.set(SPOTS.ppeBench.x, 1.9, SPOTS.ppeBench.z + .9); sgn.rotation.y = Math.PI; ctx.add(sgn);
      const art = { helmet: "helmet", glasses: "glasses", gloves: "gloves", jacket: "fr", boots: "boots" };
      const benchItems = kinds.map((k, i) => {
        const o = A.ppeObject(M, k, bad.has(k)); o.position.set(SPOTS.ppeBench.x - 1.2 + i * .6, .93, SPOTS.ppeBench.z + .3); o.rotation.y = Math.PI; ctx.add(o);
        const c = PPE_CHECK[k], isBad = bad.has(k);
        return ctx.item({ obj: o, pos: new THREE.Vector3(o.position.x, 1.05, o.position.z), range: 2, enabled: false, label: c.name, verb: L("Inspect", "افحص"), onUse: async (it) => {
          const choice = await ctx.ask({ tag: `${icon("eye")} ${t("inspect")}`, title: c.name,
            body: `<div class="inspect"><div class="inspect-art">${ppeArt(art[k])}</div><p>${tx(isBad ? c.bad : c.ok)}</p></div>`,
            buttons: [{ label: tx(tt.use), value: "use", icon: "check" }, { label: tx(tt.tag), value: "tag", icon: "x" }] });
          it.remove(); st.left--; ctx.refresh();
          if (isBad && choice === "use") { ctx.penalty(SCORING.wrongCheck, c.name); ctx.fx("bad"); await ctx.info({ tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: c.name, body: `<p>${tx(c.badUse)}</p><p class="muted">−${SCORING.wrongCheck} ${t("score")}</p>` }); }
          else if (!isBad && choice === "tag") { ctx.penalty(SCORING.minor, c.name); await ctx.info({ tag: `${icon("help")} ${t("noteT")}`, title: c.name, body: `<p>${tx(PPE_CHECK.goodTag)}</p><p class="muted">−${SCORING.minor} ${t("score")}</p>` }); }
          else { ctx.fx("good"); ctx.toast(isBad ? L("Tagged out. Well spotted.", "تم سحبها ووسمها. ملاحظة ممتازة.") : L("Good to use.", "صالحة للاستخدام."), 1800); }
          if (choice === "tag") { const tag = A.gbox(o, .06, .1, .005, M.red, .12, .12, .1); tag.rotation.z = .3; o.position.z += .25; }
          else o.visible = false;
          if (st.left === 0) { ctx.done("inspect"); gate.lift(); }
        } });
      });
      // checkpoint gate with a boom barrier that lifts when you are ready
      const gx = -27.5, gate = new THREE.Group(); gate.position.set(gx, 0, 0); ctx.add(gate);
      for (const z of [5.8, 12.2]) A.gbox(gate, .25, 3, .25, M.navy, 0, 1.5, z);
      A.gbox(gate, .3, .4, 6.6, M.navy, 0, 3.1, 9);
      const gs = A.sign({ bg: "#0a5fa8", fg: "#ffffff", en: "PPE CHECKPOINT", ar: "نقطة فحص معدات الوقاية", icon: "ppe" }, 1.8); gs.position.set(-.2, 3.1, 9); gs.rotation.y = -Math.PI / 2; gate.add(gs);
      const arm = new THREE.Group(); arm.position.set(0, 1.05, 5.9); gate.add(arm);
      A.gbox(arm, .1, .1, 6.2, M.redWhite, 0, 0, 3.1);
      const block = { minX: gx - .2, maxX: gx + .2, minZ: 4.6, maxZ: 14.6, bottom: 0, top: 3 };
      ctx.world.colliders.push(block);
      gate.lift = () => { block.minX = block.maxX = 999; tween(ctx, arm, new THREE.Vector3(0, 1.05, 5.9), .1); arm.rotation.x = -1.3; sfx.good(); };
      st.gate = gate;
    },
    update(ctx) {
      if (ctx.isDone("inspect") && ctx.player.x > -27 && ctx.player.z > 4.6) { ctx.done("go"); ctx.complete(); }
    },
  },

  // 3 -------------------------------------------------------------------------------------
  hunter: {
    spawn: { x: -9, z: 9, yaw: -Math.PI / 2 },
    rules: { aisle: true },
    setup(ctx) {
      const tt = T.hunter, st = ctx.state;
      fixtures(ctx, { noCrowd: true });
      const n = ctx.cfg.hazards;
      const ids = shuffle(HUNT_SPOTS.map((s) => s.id));
      st.bad = new Set(ids.slice(0, n));
      st.left = n; st.found = [];
      ctx.objectives([{ id: "find", text: () => tx(tt.obj.find).replace("{n}", st.left) }]);
      for (const spot of HUNT_SPOTS) {
        const bad = st.bad.has(spot.id);
        const g = spotModel(ctx, spot, bad);
        if (g.userData.disc || g.userData.sparks || g.userData.weld) ctx.world.addUpdater((dt, tm) => {
          if (g.userData.disc) g.userData.disc.rotation.x += dt * 30;
          if (g.userData.sparks) g.userData.sparks.visible = Math.sin(tm * 25) > -.2;
          if (g.userData.weld) g.userData.weld.material.opacity = Math.random() > .3 ? .9 : .2;
        });
        ctx.item({ obj: g, pos: g.userData.pos || new THREE.Vector3(spot.x, .8, spot.z), range: 2.6, label: spot.name, verb: L("Inspect", "افحص"), onUse: async (it) => {
          it.remove();
          await classify(ctx, spot, bad);
          if (bad) { st.left--; st.found.push(spot); reportedCone(ctx, it.pos); ctx.refresh(); }
          if (st.left === 0) ctx.complete(`<p class="muted">${t("timeLeftWas", { s: Math.round(ctx.timeLeft() || 0) })}</p>`);
        } });
      }
    },
    start(ctx) {
      const st = ctx.state;
      ctx.timer(ctx.cfg.huntSeconds, () => {
        const missed = HUNT_SPOTS.filter((s) => st.bad.has(s.id) && !st.found.includes(s));
        ctx.fail(t("timeUpT"), `<p>${tx(T.hunter.timeUp)}</p><ul>${missed.map((s) => `<li><b>${tx(s.name)}</b>: ${tx(s.bad)}</li>`).join("")}</ul>`);
      });
    },
  },

  // 4 -------------------------------------------------------------------------------------
  machinery: {
    spawn: { x: -13, z: 9.4, yaw: -Math.PI / 2 },
    rules: { aisle: true, forklift: true },
    setup(ctx) {
      const tt = T.machinery, st = ctx.state, { M } = ctx;
      fixtures(ctx);
      ctx.world.forklift.start(ctx.cfg.forkSpeed);
      st.l = st.r = false;
      const mark = (b) => (b ? "✓" : "○");
      ctx.objectives([
        { id: "pick", text: tt.obj.pick, at: { x: -10.5, z: 11.6 } },
        { id: "stop", text: tt.obj.stop, at: { x: -6, z: 5.7 } },
        { id: "look", text: () => tx(tt.obj.look).replace("{l}", mark(st.l)).replace("{r}", mark(st.r)) },
        { id: "cross", text: tt.obj.cross, at: { x: -5.6, z: -6.2 } },
        { id: "back", text: tt.obj.back, at: { x: -6, z: 7.5 } },
      ]);
      const stand = new THREE.Group(); stand.position.set(-10.5, 0, 11.6); ctx.add(stand);
      A.gbox(stand, .8, .8, .5, M.steel, 0, .4, 0);
      const box = A.toolbox(M); box.position.y = .8; stand.add(box);
      ctx.world.colliders.push({ minX: -10.9, maxX: -10.1, minZ: 11.35, maxZ: 11.85, bottom: 0, top: 1 });
      ctx.item({ obj: stand, pos: new THREE.Vector3(-10.5, 1, 11.6), label: L("Toolbox", "صندوق العدة"), verb: L("Pick up", "خذه"), onUse: (it) => {
        it.remove(); stand.remove(box); ctx.carry(A.toolbox(M), tx(L("Toolbox", "صندوق العدة"))); ctx.player.speedScale = .85; ctx.done("pick");
      } });
      const crew = A.worker(M); crew.position.set(-5.4, 0, -7.1); ctx.add(crew);
      const crew2 = A.worker(M, { helmet: 0x0a5fa8 }); crew2.position.set(-4.2, 0, -7.3); crew2.rotation.y = -.6; ctx.add(crew2);
      st.crewItem = ctx.item({ obj: crew, label: L("Maintenance crew", "طاقم الصيانة"), verb: L("Hand over", "سلّم"), range: 2.4, enabled: false, onUse: async (it) => {
        it.remove(); ctx.carry(null); ctx.player.speedScale = 1;
        const tb = A.toolbox(M); tb.position.set(-4.8, 0, -6.6); ctx.add(tb);
        ctx.done("cross"); sfx.good();
        await ctx.info({ tone: "good", tag: `${icon("check")} ${tx(tt.name)}`, title: tt.handT, body: tt.handB });
        st.phase = "back"; st.l = st.r = false;
      } });
      st.phase = "pick";
    },
    update(ctx) {
      const st = ctx.state, p = ctx.player, inX = p.x > -7.4 && p.x < -4.6;
      const facing = -Math.sin(p.yaw);
      const trackLook = () => {
        let ch = false;
        if (facing < -.75 && !st.l) { st.l = true; ch = true; }
        if (facing > .75 && !st.r) { st.r = true; ch = true; }
        if (ch) { sfx.tick(); ctx.refresh(); }
      };
      if (st.phase === "pick" && ctx.isDone("pick")) st.phase = "stop";
      if (st.phase === "stop" && inX && p.z > 4.9 && p.z < 6.6) { ctx.done("stop"); st.phase = "look"; st.l = st.r = false; ctx.refresh(); }
      if (st.phase === "look") {
        trackLook();
        if (st.l && st.r) { ctx.done("look"); st.phase = "cross"; st.crewItem.enabled = true; }
        else if (p.z < 4.4) { st.l = st.r = false; ctx.violation("noLook", { to: { x: -6, z: 5.7 } }); }
      }
      if (st.phase === "back") {
        // stop and look again on the bay side before stepping back into the aisle
        if (inX && p.z < -4.8 && p.z > -6.6) trackLook();
        if (p.z > -4.4 && p.z < 4.6 && !(st.l && st.r) && !st.crossed) { st.l = st.r = false; ctx.violation("noLook", { to: { x: -6, z: -5.6 } }); }
        else if (p.z > -4.4) st.crossed = true;
        if (p.z > 6.2 && inX) { ctx.done("back"); ctx.complete(); }
      }
    },
  },

  // 5 -------------------------------------------------------------------------------------
  molten: {
    spawn: { x: -15.5, z: -5.4, yaw: -Math.PI / 2 },
    rules: {},
    setup(ctx) {
      const tt = T.molten, st = ctx.state, { M, world } = ctx;
      fixtures(ctx, { noCrowd: true });
      const VALVE = { x: -.2, z: -7.2 }, TOOL = { x: -6.6, z: -4.95 }, RACK = { x: -13.6, z: -6.6 }, WORKER = { x: -6.9, z: -7.1 }, SHIELD = { x: .9, z: -6.9 }, SIGNAL = { x: -12, z: -7.5 };
      ctx.objectives([
        { id: "valve", text: tt.obj.valve, at: VALVE },
        { id: "tool", text: () => tx(st.carrying ? tt.obj.toolCarry : tt.obj.tool), at: () => (st.carrying ? RACK : TOOL) },
        { id: "worker", text: tt.obj.worker, at: WORKER },
        { id: "shield", text: tt.obj.shield, at: SHIELD },
        { id: "signal", text: tt.obj.signal, at: SIGNAL },
      ]);
      // valve
      const valve = A.valveStand(M); valve.position.set(VALVE.x, 0, VALVE.z); ctx.add(valve);
      ctx.item({ obj: valve, label: tt.obj.valve, verb: L("Close valve", "أغلق الصمام"), onUse: (it) => {
        it.remove(); sfx.click();
        const wheel = valve.userData.wheel; let k = 0;
        const off = world.addUpdater((dt) => { k += dt; wheel.rotation.z += dt * 6; world.puddle.scale.multiplyScalar(1 - dt * .5); if (k > 3) { off(); world.fixLeak(); } });
        ctx.done("valve");
      } });
      // wet tool and drying rack
      const tool = A.skimTool(M, true); tool.position.set(TOOL.x, .03, TOOL.z); ctx.add(tool);
      const rack = A.dryingRack(M); rack.position.set(RACK.x, 0, RACK.z); ctx.add(rack);
      world.colliders.push({ minX: RACK.x - .8, maxX: RACK.x + .8, minZ: RACK.z - .3, maxZ: RACK.z + .2, bottom: 0, top: 2 });
      const rackItem = ctx.item({ obj: rack, pos: new THREE.Vector3(RACK.x, 1.2, RACK.z), label: tt.obj.toolCarry, verb: L("Place tool", "ضع الأداة"), enabled: false, onUse: (it) => {
        it.remove(); ctx.carry(null); st.carrying = false;
        const dry = A.skimTool(M, false); dry.position.set(RACK.x, 1.25, RACK.z + .05); dry.scale.setScalar(.6); ctx.add(dry);
        ctx.done("tool");
      } });
      ctx.item({ obj: tool, pos: new THREE.Vector3(TOOL.x + .5, .3, TOOL.z), label: tt.obj.tool, verb: L("Pick up", "خذها"), onUse: (it) => {
        it.remove(); tool.remove(tool.userData.puddle); tool.visible = false;
        const held = A.skimTool(M, false); held.scale.setScalar(.35); ctx.carry(held, tx(L("Wet tool", "أداة مبللة")));
        st.carrying = true; rackItem.enabled = true; ctx.refresh();
      } });
      // worker in the line of fire
      const w = A.worker(M); w.position.set(WORKER.x, 0, WORKER.z); ctx.add(w);
      ctx.item({ obj: w, label: tt.obj.worker, verb: L("Talk", "تحدّث"), range: 2.6, onUse: async (it) => {
        it.remove();
        await ctx.choose({ title: tt.obj.worker, q: tt.workerQ, opts: tt.workerOpts, penalty: SCORING.wrongChoice });
        tween(ctx, w, new THREE.Vector3(-15, 0, -4.9), 3.5);
        ctx.done("worker");
      } });
      // face shield
      const hook = A.shieldHook(M); hook.position.set(SHIELD.x, 0, SHIELD.z); hook.rotation.y = -Math.PI / 2; ctx.add(hook);
      ctx.item({ obj: hook, label: tt.obj.shield, verb: L("Put on", "ارتدِ"), onUse: (it) => {
        it.remove(); hook.userData.visor.visible = false; document.body.classList.add("visor"); ctx.done("shield");
      } });
      // ready signal panel (always available: signalling too early has consequences)
      const sig = A.panel(M, "station"); sig.position.set(SIGNAL.x, 0, SIGNAL.z); ctx.add(sig);
      const lbl = A.sign({ bg: "#0b2d4a", fg: "#ffffff", en: "CRUCIBLE READY SIGNAL", ar: "إشارة جاهزية البوتقة", icon: "" }, .9); lbl.position.set(0, 2, .12); sig.add(lbl);
      ctx.item({ obj: sig, pos: new THREE.Vector3(SIGNAL.x, 1.3, SIGNAL.z), label: tt.obj.signal, verb: L("Signal", "أعطِ الإشارة"), onUse: (it) => {
        const missing = ["valve", "tool", "worker", "shield"].filter((id) => !ctx.isDone(id));
        it.remove(); ctx.game.pause();
        const car = world.carrier.group;
        sig.userData.lamp.material = M.greenLamp;
        if (missing.length) {
          tween(ctx, car, new THREE.Vector3(-7.6, 0, -6.1), 1.4, () => {
            world.steamBurst(-3.2, -5.9); world.steamBurst(TOOL.x, TOOL.z); ctx.fx("steam");
            ctx.later(1400, () => ctx.fail(tt.earlyT, `<p>${tx(tt.earlyB)}</p><ul>${missing.map((id) => `<li>${tx(tt.obj[id])}</li>`).join("")}</ul>`));
          });
        } else {
          ctx.done("signal");
          world.carrier.collider.minX = world.carrier.collider.maxX = 999;
          tween(ctx, car, new THREE.Vector3(-9.4, 0, -2.4), 3, () => ctx.complete(`<p>${tx(tt.doneB)}</p>`));
        }
      } });
    },
  },

  // 6 -------------------------------------------------------------------------------------
  highrisk: {
    spawn: { x: 10.5, z: 7.2, yaw: -Math.PI / 2 },
    rules: {},
    setup(ctx) {
      const tt = T.highrisk, st = ctx.state, { M, world } = ctx, P = ZONES.platform;
      fixtures(ctx);
      st.iso = new Set(); st.locked = new Set(); st.clipped = false;
      const PERMIT = { x: 14.6, z: 12.6 }, TEST = { x: 27.4, z: 12.6 }, ANCHOR = { x: 32.3, z: 12.95 }, WORK = { x: 37.9, z: 11.1 };
      const isoX = Math.random() < .5 ? [24.6, 25.8] : [25.8, 24.6];   // C-2 and C-3 swap places
      ctx.objectives([
        { id: "permit", text: tt.obj.permit, at: PERMIT },
        { id: "isolate", text: tt.obj.isolate, at: { x: 25.2, z: 11 } },
        { id: "lock", text: tt.obj.lock, at: { x: 25.2, z: 11 } },
        { id: "test", text: tt.obj.test, at: TEST },
        { id: "clip", text: tt.obj.clip, at: ANCHOR },
        { id: "clear", text: tt.obj.clear, at: WORK },
      ]);
      // permit
      const pb = A.permitBox(M); pb.position.set(PERMIT.x, 0, PERMIT.z); pb.rotation.y = Math.PI; ctx.add(pb);
      ctx.item({ obj: pb, label: tt.obj.permit, verb: L("Collect", "استلم"), onUse: (it) => {
        it.remove(); pb.userData.paper.visible = false; ctx.done("permit");
        const paper = A.gbox(new THREE.Group(), .22, .3, .01, M.white, 0, 0, 0).parent; ctx.carry(paper, tx(L("Work permit", "تصريح العمل")));
      } });
      // conveyor on the platform, running with a jam alarm
      const conv = A.conveyor(M, 5.6); conv.position.set(35.2, P.h, 12.2); ctx.add(conv);
      world.colliders.push({ minX: 32.4, maxX: 38, minZ: 11.75, maxZ: 12.65, bottom: P.h, top: P.h + 1.3 });
      const jam = A.gbox(conv, .5, .35, .5, M.carbon, 2.4, 1.1, -.05); jam.rotation.set(.3, .5, .2);
      const beacon = A.gcyl(conv, .08, .08, .16, new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8800, emissiveIntensity: 2 }), -2.7, 1.5, .45);
      st.running = () => !st.iso.has("C-3");
      world.addUpdater((dt, tm) => { if (st.running()) { conv.userData.beltTex.offset.x -= dt * .6; beacon.material.emissiveIntensity = Math.sin(tm * 8) > 0 ? 3 : .2; } else beacon.material.emissiveIntensity = .1; });
      // isolators
      ["C-2", "C-3"].forEach((name, i) => {
        const p = A.panel(M, "isolator"); p.position.set(isoX[i], 0, 11.8); p.rotation.y = Math.PI; ctx.add(p);
        const s = A.sign({ bg: "#ffffff", fg: "#111111", en: `ISOLATOR ${name}`, ar: `مفتاح العزل ${name}`, icon: "lock" }, .7); s.position.set(0, 1.95, .12); p.add(s);
        ctx.item({ obj: p, pos: new THREE.Vector3(isoX[i], 1.3, 11.65), label: L(`Isolator ${name}`, `مفتاح العزل ${name}`), verb: L("Use", "استخدم"), range: 1.9, onUse: async (it) => {
          if (!ctx.isDone("permit")) { ctx.penalty(SCORING.minor, tt.noPermitT); await ctx.info({ tone: "bad", tag: `${icon("warn")} ${tx(tt.name)}`, title: tt.noPermitT, body: `<p>${tx(tt.noPermitB)}</p><p class="muted">−${SCORING.minor} ${t("score")}</p>` }); return; }
          if (!st.iso.has(name)) {
            st.iso.add(name); p.userData.handle.rotation.z = Math.PI / 2; p.userData.lamp.material = M.redLamp; sfx.click();
            ctx.done("isolate"); ctx.toast(L(`${name} switched off.`, `تم فصل ${name}.`), 1800);
          } else if (!st.locked.has(name)) {
            const v = await ctx.ask({ title: L(`Isolator ${name}`, `مفتاح العزل ${name}`), body: `<p>${t("isoOff")}</p>`,
              buttons: [{ label: tx(tt.obj.lock), value: "lock", icon: "lock", primary: true }, { label: t("switchOn"), value: "on", icon: "restart" }, { label: t("close"), value: null }] });
            if (v === "lock") { st.locked.add(name); const lk = A.padlockTag(M); lk.position.set(.1, 1.22, .2); p.add(lk); p.userData.lock = lk; ctx.done("lock"); sfx.good(); }
            if (v === "on") { st.iso.delete(name); p.userData.handle.rotation.z = 0; p.userData.lamp.material = M.greenLamp; }
          } else {
            const v = await ctx.ask({ title: L(`Isolator ${name}`, `مفتاح العزل ${name}`), body: `<p>${t("isoLocked")}</p>`,
              buttons: [{ label: t("close"), value: null, primary: true }, { label: t("removeLock"), value: "undo", icon: "restart" }] });
            if (v === "undo") { st.locked.delete(name); st.iso.delete(name); p.remove(p.userData.lock); p.userData.handle.rotation.z = 0; p.userData.lamp.material = M.greenLamp; }
          }
        } });
      });
      // local control station (test start)
      const ts = A.panel(M, "station"); ts.position.set(TEST.x, 0, TEST.z); ts.rotation.y = Math.PI; ctx.add(ts);
      const tl = A.sign({ bg: "#0b2d4a", fg: "#ffffff", en: "C-3 LOCAL START", ar: "تشغيل محلي C-3", icon: "" }, .7); tl.position.set(0, 1.95, .12); ts.add(tl);
      ctx.item({ obj: ts, pos: new THREE.Vector3(TEST.x, 1.3, TEST.z - .1), label: tt.obj.test, verb: L("Press start", "اضغط تشغيل"), onUse: async () => {
        if (!st.running()) { ctx.done("test"); ctx.fx("good"); await ctx.info({ tone: "good", tag: `${icon("check")} ${tx(tt.name)}`, title: tt.testOkT, body: tt.testOkB }); }
        else { ctx.penalty(SCORING.wrongCheck, tt.wrongIsoT); ctx.fx("bad"); await ctx.info({ tone: "bad", tag: `${icon("x")} ${tx(tt.name)}`, title: tt.wrongIsoT, body: `<p>${tx(tt.wrongIsoB)}</p><p class="muted">−${SCORING.wrongCheck} ${t("score")}</p>` }); }
      } });
      // anchor point and work point on the platform
      const anc = A.anchorPost(M); anc.position.set(ANCHOR.x, P.h, ANCHOR.z); ctx.add(anc);
      world.colliders.push({ minX: ANCHOR.x - .1, maxX: ANCHOR.x + .1, minZ: ANCHOR.z - .1, maxZ: ANCHOR.z + .1, bottom: P.h, top: P.h + 2 });
      ctx.item({ obj: anc, pos: new THREE.Vector3(ANCHOR.x, P.h + 1.4, ANCHOR.z), label: tt.obj.clip, verb: L("Clip on", "ثبّت الحزام"), range: 1.8, onUse: () => {
        st.clipped = true; ctx.done("clip"); sfx.good(); ctx.toast(L("Harness clipped on.", "تم تثبيت الحزام."), 1800);
        st.lanyard.visible = true;
      } });
      st.lanyard = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1, 6), M.yellow); st.lanyard.visible = false; ctx.add(st.lanyard);
      const wp = new THREE.Group(); wp.position.set(WORK.x, P.h, WORK.z); ctx.add(wp);
      ctx.item({ obj: jam, pos: new THREE.Vector3(37.4, P.h + 1.1, 11.7), label: tt.obj.clear, verb: L("Clear jam", "أزل العائق"), range: 1.9, onUse: (it) => {
        if (st.running() && !st.iso.has("C-3")) { ctx.fx("struck"); return ctx.fail(tt.entangleT, tt.entangleB); }
        if (!st.locked.has("C-3")) { ctx.fx("struck"); return ctx.fail(tt.unlockedT, tt.unlockedB); }
        it.remove();
        if (!ctx.isDone("test")) ctx.penalty(SCORING.wrongChoice, tt.skipTest);
        jam.visible = false; ctx.done("clear");
        ctx.later(600, () => ctx.complete(`<p>${tx(tt.doneB)}</p>`));
      } });
    },
    update(ctx) {
      const st = ctx.state, p = ctx.player, P = ZONES.platform;
      if (p.feet < 1 && st.clipped) { st.clipped = false; st.lanyard.visible = false; ctx.game.objs.find((o) => o.id === "clip").done = false; ctx.refresh(); }
      if (st.clipped) { // lanyard from the anchor ring to the trainee's back
        const a = new THREE.Vector3(32.3, P.h + 1.62, 12.95), b = new THREE.Vector3(p.x, p.feet + 1.1, p.z);
        st.lanyard.position.copy(a).add(b).multiplyScalar(.5); st.lanyard.scale.y = a.distanceTo(b);
        st.lanyard.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      }
      if (p.feet > 2 && p.x > 33.4 && !st.clipped) ctx.violation("fall", { to: { x: 32, z: 12.1 } });
    },
  },

  // 7 -------------------------------------------------------------------------------------
  emergency: {
    spawn: { x: 20.5, z: 10.4, yaw: Math.PI / 2 },
    rules: { forklift: false },
    setup(ctx) {
      const tt = T.emergency, st = ctx.state, { world } = ctx;
      const fx = fixtures(ctx);
      const starts = [{ x: 20.5, z: 10.4, yaw: Math.PI / 2 }, { x: 28.6, z: -7.6, yaw: Math.PI / 2 }, { x: -2, z: 9, yaw: -Math.PI / 2 }];
      const s = pick(starts); ctx.player.place(s.x, s.z, s.yaw); ctx.game.lastSafe = { x: s.x, z: s.z };
      const fires = SPOTS.fires.filter((f) => Math.hypot(f.x - s.x, f.z - s.z) > 14);
      const fire = pick(fires);
      world.setFire(true, fire);
      ctx.rules({ fire: true });
      ctx.objectives([
        { id: "alarm", text: tt.obj.alarm, at: () => nearest(SPOTS.callPoints, ctx.player) },
        { id: "evac", text: tt.obj.evac, at: ASSEMBLY, hidden: true },
        { id: "warden", text: tt.obj.warden, at: { x: -44, z: -13 }, hidden: true },
      ]);
      fx.calls.forEach((c) => ctx.item({ obj: c.g, label: tt.obj.alarm, verb: L("Raise alarm", "أطلق الإنذار"), onUse: () => {
        ctx.game.items.filter((x) => x.label === tt.obj.alarm).forEach((x) => x.remove());
        fireItem.remove();
        c.g.userData.glass.visible = false;
        if (ctx.game.elapsed > 45) ctx.penalty(SCORING.minor, tt.slowAlarm);
        ctx.done("alarm");
        startEvacuation(ctx, st);
      } }));
      const fireObj = new THREE.Group(); fireObj.position.set(fire.x, 0, fire.z); ctx.add(fireObj);
      const fireItem = ctx.item({ obj: fireObj, pos: new THREE.Vector3(fire.x, 1.5, fire.z), label: tt.smoke, verb: L("Decide", "قرّر"), range: fire.r + 4, marker: false, onUse: async (it) => {
        it.remove(); await ctx.choose({ q: tt.fireQ, opts: tt.fireOpts, fxBad: "smoke" });
      } });
      warden(ctx, st);
    },
    update(ctx, dt) { evacUpdate(ctx, ctx.state, dt); },
  },

  // 7 -------------------------------------------------------------------------------------
  // Under Pressure: a supervisor pushes for unsafe hot work. The trainee answers under a timer,
  // uses stop-work authority, then does the job the safe way. A fire watch catches a smoulder.
  pressure: {
    spawn: { x: 4, z: 7.3, yaw: -Math.PI / 2 },
    rules: { aisle: true },
    setup(ctx) {
      const tt = T.pressure, st = ctx.state, { M, world, player } = ctx, gb = A.gbox, gc = A.gcyl;
      const fx = fixtures(ctx, { routes: ["west", "mid"] });
      const JOB = { x: 21, z: 8.4 }, DRUM = { x: 22.7, z: 9.25 }, CAB = { x: 11, z: 9.6 }, SUP = { x: 24.4, z: 7.0 }, WATCH0 = { x: 30.5, z: 7.0 }, WATCH1 = { x: 19.4, z: 6.8 };
      const SMOULDER = { x: 21.9, z: 9.1 }, EXTSPOT = { x: 20.1, z: 7.55 };
      ctx.fxSpot({ x: DRUM.x, z: DRUM.z, y: 1.1, r: 1.2 });
      ctx.objectives([
        { id: "talk", text: tt.obj.talk, at: SUP },
        { id: "permit", text: tt.obj.permit, at: { x: 14.8, z: 7.7 }, hidden: true },
        { id: "drum", text: tt.obj.drum, at: () => (st.carry === "drum" ? CAB : DRUM), hidden: true },
        { id: "ext", text: tt.obj.ext, at: () => (st.carry === "ext" ? EXTSPOT : SPOTS.extinguishers[2]), hidden: true },
        { id: "watch", text: tt.obj.watch, at: WATCH0, hidden: true },
        { id: "grind", text: tt.obj.grind, at: JOB, hidden: true },
        { id: "smoulder", text: tt.obj.smoulder, at: SMOULDER, hidden: true },
        { id: "report", text: tt.obj.report, at: SUP, hidden: true },
      ]);
      // supervisor with a clipboard
      const sup = walker(M, { helmet: 0xf4f6f8 }); sup.position.set(SUP.x, 0, SUP.z); sup.rotation.y = -Math.PI / 2; ctx.add(sup);
      gb(sup.userData.limbs.armR, .24, .32, .02, M.white, 0, -.45, .14);
      sup.userData.limbs.armR.rotation.x = -.7;
      world.colliders.push({ minX: SUP.x - .35, maxX: SUP.x + .35, minZ: SUP.z - .35, maxZ: SUP.z + .35, bottom: 0, top: 1.9 });
      // fire-watch colleague
      const fw = walker(M, { helmet: 0xd9531e }); fw.position.set(WATCH0.x, 0, WATCH0.z); fw.rotation.y = -Math.PI / 2; ctx.add(fw);
      const fwCol = { minX: WATCH0.x - .3, maxX: WATCH0.x + .3, minZ: WATCH0.z - .3, maxZ: WATCH0.z + .3, bottom: 0, top: 1.9 }; world.colliders.push(fwCol);
      // the job: a cracked bracket on the workshop rail
      const job = new THREE.Group(); job.position.set(JOB.x, 0, JOB.z); ctx.add(job);
      const plate = gb(job, .34, .26, .03, M.amber, 0, .82, -.06);
      const crack = gb(job, .03, .27, .035, M.carbon, .04, .82, -.065); crack.rotation.z = .5;
      const broken = gb(job, .16, .12, .03, M.amber, .2, .62, -.06); broken.rotation.z = -.9;
      // open solvent drum behind the rail
      const drumModel = () => { const g = new THREE.Group(); gc(g, .29, .29, .88, M.red, 0, .44, 0, 0, 0, 18); gc(g, .3, .3, .03, M.darkSteel, 0, .2, 0, 0, 0, 18); gc(g, .3, .3, .03, M.darkSteel, 0, .66, 0, 0, 0, 18);
        const top = new THREE.Mesh(new THREE.CircleGeometry(.26, 18), M.oil); top.rotation.x = -Math.PI / 2; top.position.y = .885; g.add(top);
        const lid = gc(g, .29, .29, .03, M.red, .34, .02, .1, 0, 0, 18); lid.rotation.z = .1;
        const lbl = A.sign({ bg: "#f2a900", fg: "#111111", en: "SOLVENT", ar: "مذيبات", icon: "fire" }, .42); lbl.position.set(0, .5, .3); g.add(lbl); return g; };
      const drum = drumModel(); drum.position.set(DRUM.x, 0, DRUM.z); ctx.add(drum);
      const drumCol = { minX: DRUM.x - .32, maxX: DRUM.x + .32, minZ: DRUM.z - .32, maxZ: DRUM.z + .32, bottom: 0, top: 1 }; world.colliders.push(drumCol);
      // flammables cabinet
      const cab = new THREE.Group(); cab.position.set(CAB.x, 0, CAB.z); cab.rotation.y = -Math.PI / 2; ctx.add(cab);
      gb(cab, 1.2, 1.7, .62, M.yellow, 0, .85, 0); gb(cab, .02, 1.5, .02, M.carbon, 0, .9, .32); gb(cab, .04, .3, .04, M.darkSteel, -.08, .95, .33); gb(cab, .04, .3, .04, M.darkSteel, .08, .95, .33);
      const cs = A.sign({ bg: "#b3261e", fg: "#ffffff", en: "FLAMMABLE", ar: "قابل للاشتعال", icon: "fire" }, .9); cs.position.set(0, 1.35, .32); cab.add(cs);
      world.colliders.push({ minX: CAB.x - .35, maxX: CAB.x + .35, minZ: CAB.z - .62, maxZ: CAB.z + .62, bottom: 0, top: 1.8 });
      // hot-work permit box at the workshop gate
      const pbox = A.permitBox(M); pbox.position.set(14.8, 0, 8.25); ctx.add(pbox);
      const pSign = A.sign({ bg: "#0a5fa8", fg: "#ffffff", en: "HOT WORK PERMITS", ar: "تصاريح الأعمال الساخنة", icon: "" }, .9); pSign.position.set(0, 1.75, .07); pbox.add(pSign);
      // spot where the extinguisher goes
      const extRing = new THREE.Mesh(new THREE.RingGeometry(.3, .38, 32), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: .8 }));
      extRing.rotation.x = -Math.PI / 2; extRing.position.set(EXTSPOT.x, .02, EXTSPOT.z); extRing.visible = false; ctx.add(extRing);

      const enable = (...items) => items.forEach((i) => { i.enabled = true; });
      st.carry = null;

      // ---- 1. the conversation ----
      const supItem = ctx.item({ obj: sup, pos: new THREE.Vector3(SUP.x, 1.9, SUP.z), range: 2.8, label: tt.who, verb: L("Talk", "تحدّث"), onUse: async (it) => {
        it.enabled = false;
        if (!ctx.isDone("talk")) {
          const sec = ctx.cfg.talkSeconds;
          await ctx.dialogue({ who: tt.who, line: tt.r1, opts: tt.r1opts, seconds: sec, silence: tt.silence, silenceT: tt.silenceT });
          await ctx.dialogue({ who: tt.who, line: tt.r2, opts: tt.r2opts, seconds: sec, silence: tt.silence, silenceT: tt.silenceT });
          await ctx.say(tt.who, tt.r3);
          await ctx.order({ title: tt.orderT, q: tt.orderQ, steps: tt.steps, learn: tt.orderLearn });
          await ctx.say(tt.who, tt.okLine);
          ctx.done("talk");
          ["permit", "drum", "ext", "watch", "grind"].forEach((id) => ctx.show(id));
          enable(permitItem, drumItem, extItem, watchItem, jobItem);
        } else if (ctx.isDone("smoulder") || st.smoulderDone) {
          await ctx.say(tt.who, tt.thanks);
          ctx.done("report");
          ctx.complete();
        } else it.enabled = true;
      } });

      // ---- 2. permit ----
      const permitItem = ctx.item({ obj: pbox, pos: new THREE.Vector3(14.8, 1.4, 8.2), label: tt.permitName, verb: L("Collect", "استلم"), enabled: false, onUse: (it) => {
        it.remove(); pbox.userData.paper.visible = false; ctx.done("permit"); sfx.good();
        ctx.toast(L("Hot-work permit collected and signed.", "استلمت تصريح الأعمال الساخنة الموقّع."), 2400);
      } });

      // ---- 3. move the solvent drum ----
      const drumItem = ctx.item({ obj: drum, range: 2.4, label: tt.drumName, verb: L("Pick up", "احمل"), enabled: false, onUse: (it) => {
        if (st.carry) { ctx.toast(L("Your hands are full.", "يداك مشغولتان."), 1800); it.enabled = true; return; }
        it.remove(); drum.visible = false; drumCol.minX = drumCol.maxX = 999;
        const small = drumModel(); small.scale.setScalar(.38);
        st.carry = "drum"; ctx.carry(small, tx(tt.drumName)); ctx.refresh(); cabItem.enabled = true;
      } });
      const cabItem = ctx.item({ obj: cab, pos: new THREE.Vector3(CAB.x, 1.5, CAB.z), range: 2.4, label: tt.cabinet, verb: L("Store", "خزّن"), enabled: false, onUse: (it) => {
        if (st.carry !== "drum") { it.enabled = true; return; }
        it.remove(); st.carry = null; ctx.carry(null); ctx.done("drum");
        const d = drumModel(); d.scale.setScalar(.7); d.position.set(CAB.x + .45, 0, CAB.z + .55); ctx.add(d);
        ctx.toast(L("Lid on, drum stored in the flammables cabinet.", "أُغلق البرميل وخُزّن في خزانة المواد القابلة للاشتعال."), 2600);
      } });

      // ---- 4. bring an extinguisher ----
      const wallExt = fx.exts[2].g;
      const extItem = ctx.item({ obj: wallExt, label: tt.extName, verb: L("Take", "خذ"), enabled: false, onUse: (it) => {
        if (st.carry) { ctx.toast(L("Your hands are full.", "يداك مشغولتان."), 1800); it.enabled = true; return; }
        it.remove(); wallExt.visible = false;
        const e = A.extinguisher(M); e.scale.setScalar(.7); e.children.forEach((c) => { if (c.isMesh && c.geometry.type === "PlaneGeometry") c.visible = false; });
        st.carry = "ext"; ctx.carry(e, tx(tt.extName)); ctx.refresh(); extRing.visible = true; placeItem.enabled = true;
      } });
      const placeHolder = new THREE.Group(); placeHolder.position.set(EXTSPOT.x, 0, EXTSPOT.z); ctx.add(placeHolder);
      const placeItem = ctx.item({ obj: placeHolder, pos: new THREE.Vector3(EXTSPOT.x, .5, EXTSPOT.z), label: tt.placeExt, verb: L("Place", "ضع"), range: 2.2, enabled: false, onUse: (it) => {
        if (st.carry !== "ext") { it.enabled = true; return; }
        it.remove(); st.carry = null; ctx.carry(null); extRing.visible = false;
        st.ext = A.extinguisher(M); st.ext.position.set(EXTSPOT.x, -.4, EXTSPOT.z); st.ext.children.forEach((c) => { if (c.isMesh && (c.geometry.type === "PlaneGeometry" || (c.geometry.type === "BoxGeometry" && c.position.y > .9 && c.position.y < 1))) c.visible = false; });
        ctx.add(st.ext); ctx.done("ext");
      } });

      // ---- 5. fire watch ----
      const watchItem = ctx.item({ obj: fw, pos: new THREE.Vector3(WATCH0.x, 1.9, WATCH0.z), range: 2.8, label: tt.whoWatch, verb: L("Ask", "اطلب"), enabled: false, onUse: async (it) => {
        it.remove();
        await ctx.say(tt.whoWatch, tt.watchLine);
        ctx.done("watch");
        fwCol.minX = fwCol.maxX = 999;
        // walk over to the job
        let ph = 0;
        const off = world.addUpdater((dt) => {
          const dx = WATCH1.x - fw.position.x, dz = WATCH1.z - fw.position.z, d = Math.hypot(dx, dz);
          if (d < .1) { fw.rotation.y = 0; animateWalk(fw, 0, 0); Object.assign(fwCol, { minX: WATCH1.x - .3, maxX: WATCH1.x + .3, minZ: WATCH1.z - .3, maxZ: WATCH1.z + .3 }); off(); return; }
          const pd = Math.hypot(player.x - fw.position.x, player.z - fw.position.z);
          if (pd < 1.2) { animateWalk(fw, ph, 0); return; }
          const step = Math.min(d, 1.4 * dt); fw.position.x += dx / d * step; fw.position.z += dz / d * step;
          fw.rotation.y = Math.atan2(dx, dz); ph += dt * 8; animateWalk(fw, ph, 1);
        });
      } });

      // ---- 6. the hot work ----
      const sparks = makeSparks(ctx);
      const jobItem = ctx.item({ obj: job, pos: new THREE.Vector3(JOB.x, 1.05, JOB.z - .1), range: 2.2, label: tt.bracket, verb: L("Grind", "اقطع"), enabled: false, onUse: async (it) => {
        const missing = ["permit", "drum", "ext", "watch"].filter((id) => !ctx.isDone(id));
        if (st.carry) { ctx.toast(L("Put down what you are carrying first.", "ضع ما تحمله أولاً."), 2000); it.enabled = true; return; }
        if (!ctx.isDone("drum")) {
          ctx.fx("fireBurst"); ctx.penalty(SCORING.wrongChoice, tt.drumFireT);
          await new Promise((r) => setTimeout(r, 1500));
          await ctx.info({ tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: tt.drumFireT, body: `<p>${tx(tt.drumFireB)}</p><p class="muted">−${SCORING.wrongChoice} ${t("score")}</p>` });
          it.enabled = true; return;
        }
        if (missing.length) {
          ctx.penalty(SCORING.wrongCheck, tt.notYetT); ctx.fx("bad");
          await ctx.info({ tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: tt.notYetT, body: `<p>${tx(tt.notYetB)}</p><ul>${missing.map((id) => `<li>${tx(tt.obj[id])}</li>`).join("")}</ul><p class="muted">−${SCORING.wrongCheck} ${t("score")}</p>` });
          it.enabled = true; return;
        }
        it.remove();
        // grinding: sparks spray into the workshop for a few seconds
        const grinder = new THREE.Group(); gc(grinder, .045, .05, .3, M.teal, 0, 0, 0, Math.PI / 2); gb(grinder, .07, .08, .1, M.darkSteel, 0, .03, -.17); gc(grinder, .085, .085, .015, M.silver, .05, -.03, -.2, 0, Math.PI / 2, 20);
        gb(grinder, .02, .18, .02, M.rubber, -.02, .1, -.05); grinder.scale.setScalar(.8);
        ctx.carry(grinder, tx(tt.grinding)); player.speedScale = 0;
        sfx.grind(3); ctx.toast(tt.grinding, 3000);
        const pos = new THREE.Vector3(JOB.x, .86, JOB.z - .02);
        const stop = world.addUpdater((dt) => sparks.emit(pos, dt));
        await new Promise((r) => ctx.later(3000, r));
        stop(); ctx.carry(null); player.speedScale = 1;
        plate.visible = crack.visible = broken.visible = false;
        gb(job, .34, .05, .03, M.silver, 0, .9, -.06);
        ctx.done("grind");
        ctx.toast(tt.afterGrind, 3200);
        // the smoulder the fire watch catches
        ctx.later(6000, async () => {
          st.smoulder = makeSmoulder(ctx, SMOULDER);
          ctx.show("smoulder");
          await ctx.say(tt.whoWatch, tt.smoke);
          smoulderItem.enabled = true;
          ctx.timer(ctx.diff === "hard" ? 15 : 25, () => {
            if (st.smoulderDone) return;
            st.smoulder.out(); smoulderItem.remove(); st.smoulderDone = true;
            ctx.penalty(SCORING.wrongCheck, tt.smoulderLate);
            ctx.info({ tone: "bad", tag: `${icon("warn")} ${tx(tt.name)}`, title: tt.obj.smoulder, body: `<p>${tx(tt.smoulderLate)}</p><p class="muted">−${SCORING.wrongCheck} ${t("score")}</p>` });
            ctx.done("smoulder"); ctx.show("report"); supItem.enabled = true;
          });
        });
      } });
      const smoulderHolder = new THREE.Group(); smoulderHolder.position.set(SMOULDER.x, 0, SMOULDER.z); ctx.add(smoulderHolder);
      const smoulderItem = ctx.item({ obj: smoulderHolder, pos: new THREE.Vector3(SMOULDER.x, .6, SMOULDER.z - .6), range: 2.8, label: tt.obj.smoulder, verb: L("Extinguish", "أطفئ"), enabled: false, onUse: async (it) => {
        it.remove(); ctx.timer(null);
        // pick up the extinguisher and spray
        if (st.ext) st.ext.visible = false;
        const e = A.extinguisher(M); e.scale.setScalar(.7); e.children.forEach((c) => { if (c.isMesh && c.geometry.type === "PlaneGeometry") c.visible = false; });
        ctx.carry(e, tx(tt.extName)); sfx.spray();
        const from = new THREE.Vector3(player.x, 1.1, player.z), to = new THREE.Vector3(SMOULDER.x, .2, SMOULDER.z);
        const stop = world.addUpdater((dt) => sparks.spray(from, to, dt));
        await new Promise((r) => ctx.later(1600, r));
        stop(); st.smoulder.out(); ctx.carry(null); if (st.ext) st.ext.visible = true;
        st.smoulderDone = true; ctx.done("smoulder");
        await ctx.say(tt.whoWatch, tt.smoulderOut);
        ctx.show("report"); supItem.enabled = true;
      } });
    },
  },

  // 9 -------------------------------------------------------------------------------------
  final: {
    spawn: { x: -37.5, z: 8.5, yaw: -Math.PI / 2 },
    rules: { aisle: true, forklift: true },
    setup(ctx) {
      const tt = T.final, st = ctx.state, { M, world } = ctx;
      fixtures(ctx, { walkers: false });
      world.forklift.start(ctx.cfg.forkSpeed);
      const pool = HUNT_SPOTS.filter((s) => ["gas", "cable", "oil", "stack", "hose", "hatch", "ext"].includes(s.id));
      st.haz = shuffle(pool.slice()).slice(0, 3); st.reported = 0;
      ctx.objectives([
        { id: "ppe", text: tt.obj.ppe, at: { x: -35.5, z: 12.6 } },
        { id: "permit", text: tt.obj.permit, at: SPOTS.ppeBench },
        { id: "deliver", text: tt.obj.deliver, at: SPOTS.controlDoor },
        { id: "hazards", optional: true, text: () => tx(tt.obj.hazards).replace("{n}", st.reported).replace("{total}", st.haz.length) },
        { id: "evac", text: T.emergency.obj.evac, at: ASSEMBLY, hidden: true },
        { id: "warden", text: T.emergency.obj.warden, at: { x: -44, z: -13 }, hidden: true },
      ]);
      const station = new THREE.Group(); station.position.set(-35.5, 0, 13.9); ctx.add(station);
      ctx.item({ obj: station, pos: new THREE.Vector3(-35.5, 1.3, 13.8), range: 2.6, label: tt.obj.ppe, verb: L("Choose", "اختر"), onUse: async (it) => { it.remove(); await ctx.ppeSelect(); ctx.done("ppe"); permitItem.enabled = true; } });
      const bench = A.bench(M); bench.position.set(SPOTS.ppeBench.x, 0, SPOTS.ppeBench.z + .3); ctx.add(bench);
      const paper = A.gbox(bench, .3, .01, .22, M.white, 0, .94, 0);
      const permitItem = ctx.item({ obj: bench, pos: new THREE.Vector3(SPOTS.ppeBench.x, 1, SPOTS.ppeBench.z), label: tt.obj.permit, verb: L("Collect", "استلم"), enabled: false, onUse: (it) => {
        it.remove(); paper.visible = false; ctx.done("permit");
        ctx.carry(A.gbox(new THREE.Group(), .22, .3, .01, M.white, 0, 0, 0).parent, tx(L("Work permit", "تصريح العمل")));
        doorItem.enabled = true;
      } });
      const door = new THREE.Group(); door.position.set(29.6, 0, -9.5); ctx.add(door);
      const op = A.worker(M, { helmet: 0x0a5fa8 }); op.position.set(-1, 0, 1.4); op.rotation.y = -Math.PI / 2; door.add(op);
      const doorItem = ctx.item({ obj: door, pos: new THREE.Vector3(29.4, 1.3, -9.5), label: tt.obj.deliver, verb: L("Hand in", "سلّم"), range: 2.6, enabled: false, onUse: async (it) => {
        it.remove(); ctx.carry(null); ctx.done("deliver");
        await ctx.info({ tone: "good", tag: `${icon("check")} ${tx(tt.name)}`, title: tt.deliveredT, body: L("The control room has your permit.", "استلمت غرفة التحكم تصريحك.") });
        ctx.later(2500, () => {
          const f = pick([SPOTS.fires[0], SPOTS.fires[2]]);
          world.setFire(true, f); ctx.fx("smoke");
          startEvacuation(ctx, st);
        });
      } });
      for (const spot of st.haz) {
        const g = spotModel(ctx, spot, true);
        ctx.item({ obj: g, pos: g.userData.pos || new THREE.Vector3(spot.x, .8, spot.z), range: 2.6, label: spot.name, verb: L("Inspect", "افحص"), onUse: async (it) => {
          it.remove(); await classify(ctx, spot, true); st.reported++; reportedCone(ctx, it.pos); ctx.refresh();
        } });
      }
      warden(ctx, st);
    },
    update(ctx, dt) {
      const st = ctx.state;
      evacUpdate(ctx, st, dt);
      if (st.evac && !st.counted) {
        st.counted = true;
        const missed = st.haz.length - st.reported;
        if (missed) ctx.penalty(SCORING.minor * missed, { en: T.final.missedHaz.en.replace("{n}", missed), ar: T.final.missedHaz.ar.replace("{n}", missed) });
        ctx.game.items.filter((x) => st.haz.some((h) => h.name === x.label)).forEach((x) => x.remove());
      }
    },
  },
};
