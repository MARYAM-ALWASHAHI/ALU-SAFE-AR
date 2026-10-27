// Real augmented reality with WebXR (immersive-ar). The phone detects real surfaces with the
// hit-test feature; the trainee places a virtual training area on the floor or a table, walks
// around the hazards in it and taps each one to decide what to do. Choice cards are shown with
// the dom-overlay feature. Only offered when navigator.xr reports immersive-ar support
// (today: Chrome on ARCore-capable Android phones).
import * as THREE from "./vendor/three.module.min.js?v=5";
import { AR_FIRE, AR_CRANE, AR_MOLTEN, AR_WALKWAY } from "./content.js?v=5";
import { t, tx, getLang } from "./i18n.js?v=5";
import { icon, openModal, closeModal, modalOpen, toast, flash } from "./ui.js?v=5";
import { sfx } from "./audio.js?v=5";

export async function startXR({ renderer, game, onExit }) {
  // DOM overlay: the HUD plus the shared modal, toast and flash elements
  const overlay = document.createElement("div");
  overlay.id = "xr-overlay";
  overlay.innerHTML = `
    <div class="xr-top">
      <button class="hud-btn" id="xr-exit" aria-label="${t("camExit")}">${icon("x")}</button>
      <div class="xr-pill"><span class="xr-tag">${t("arReal")}</span><b id="xr-count">0 / 4</b></div>
      <div class="xr-pill"><span>${t("score")}</span><b id="xr-score">0</b></div>
    </div>
    <p id="xr-hint"></p>`;
  document.body.appendChild(overlay);
  const moved = ["#modal", "#toast", "#flash"].map((s) => document.querySelector(s));
  moved.forEach((el) => overlay.appendChild(el));
  // taps on the overlay UI must not also count as taps in the AR scene
  overlay.addEventListener("beforexrselect", (e) => { if (e.target.closest("button, .dialog")) e.preventDefault(); });

  let session;
  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "local-floor", "light-estimation"],
      domOverlay: { root: overlay },
    });
  } catch (err) {
    cleanupDom();
    throw err;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 40);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(1, 3, 2); scene.add(sun);

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  await renderer.xr.setSession(session);

  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource({ space: viewerSpace });

  // reticle that sits on detected surfaces
  const reticle = new THREE.Mesh(new THREE.RingGeometry(.11, .14, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x19d3d3 }));
  reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);

  const area = buildArea();
  area.group.visible = false; scene.add(area.group);

  const state = { placed: false, done: 0, score: 0, busy: false };
  const hint = (s) => { overlay.querySelector("#xr-hint").textContent = s; };
  hint(t("xrScan"));

  const controller = renderer.xr.getController(0);
  scene.add(controller);
  const ray = new THREE.Raycaster(), tmp = new THREE.Matrix4();
  controller.addEventListener("select", () => {
    if (modalOpen() || state.busy) return;
    if (!state.placed) {
      if (!reticle.visible) return;
      area.group.position.setFromMatrixPosition(reticle.matrix);
      const cam = renderer.xr.getCamera();
      const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
      area.group.rotation.y = Math.atan2(cp.x - area.group.position.x, cp.z - area.group.position.z);
      area.group.visible = true; reticle.visible = false; state.placed = true;
      sfx.good(); hint(t("xrFind"));
      return;
    }
    tmp.identity().extractRotation(controller.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(tmp);
    const live = area.hazards.filter((h) => !h.resolved);
    const hit = ray.intersectObjects(live.map((h) => h.group), true)[0];
    if (!hit) return;
    const hz = live.find((h) => { let o = hit.object; while (o) { if (o === h.group) return true; o = o.parent; } return false; });
    if (hz) ask(hz);
  });

  function ask(hz) {
    const c = hz.content, keys = getLang() === "ar" ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"];
    hz.order = hz.order || shuffle(c.opts.map((_, i) => i)); hz.tried = hz.tried || [];
    const box = openModal({
      tag: `${icon("warn")} ${tx(c.name)}`, title: t("whatDo"),
      body: `<p>${tx(c.q)}</p><div class="opts">${hz.order.map((k, n) => `<button class="opt ${hz.tried.includes(k) ? "tried" : ""}" data-k="${k}" ${hz.tried.includes(k) ? "disabled" : ""}><span class="key">${keys[n]}</span><span>${tx(c.opts[k].t)}</span></button>`).join("")}</div>`,
    });
    box.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      const k = +b.dataset.k, o = c.opts[k];
      closeModal();
      hz.tries = (hz.tries || 0) + 1;
      if (o.ok) {
        sfx.good(); flash("good", 900); hz.resolve();
        hz.resolved = true; state.done++;
        state.score += hz.tries <= 1 ? 100 : hz.tries === 2 ? 50 : 20;
        updateHud();
        openModal({ tone: "good", tag: `${icon("check")} ${t("rightT")}`, title: tx(o.t), body: `<p>${tx(o.r)}</p><div class="learn"><b>${t("remember")}</b><p>${tx(c.learn)}</p></div>`,
          actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }], onClose: () => { if (state.done === area.hazards.length) finish(); } });
      } else {
        hz.tried.push(k); sfx.bad(); flash(o.fx === "steam" ? "steam" : o.fx === "smoke" ? "smoke" : "bad", 1200); hz.fail(o.fx);
        state.busy = true;
        setTimeout(() => { state.busy = false; openModal({ tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: tx(o.t), body: `<p>${tx(o.r)}</p>`,
          actions: [{ label: t("tryAgain"), primary: true, onClick: () => { closeModal(); hz.reset(); ask(hz); } }] }); }, 1300);
      }
    }));
  }

  function updateHud() {
    overlay.querySelector("#xr-count").textContent = `${state.done} / ${area.hazards.length}`;
    overlay.querySelector("#xr-score").textContent = state.score;
  }
  function finish() {
    openModal({ tone: "good", tag: `${icon("check")} ${t("camDoneT")}`, title: t("camDoneT"),
      body: `<div class="big-score"><b>${state.score}</b><span>/ ${area.hazards.length * 100}</span></div><p>${t("camDone")}</p><p class="note">${t("sample")}</p>`,
      actions: [{ label: t("camExit"), primary: true, onClick: () => { closeModal(); session.end(); } }] });
  }
  updateHud();
  overlay.querySelector("#xr-exit").addEventListener("click", () => session.end());

  let t0 = 0;
  renderer.setAnimationLoop((time, frame) => {
    const dt = Math.min(.05, (time - t0) / 1000 || 0); t0 = time;
    if (frame && !state.placed) {
      const hits = frame.getHitTestResults(hitSource);
      if (hits.length) {
        const pose = hits[0].getPose(renderer.xr.getReferenceSpace());
        reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix);
        hint(t("xrPlace"));
      } else { reticle.visible = false; hint(t("xrScan")); }
    }
    area.update(dt, time / 1000);
    renderer.render(scene, camera);
  });

  return new Promise((resolve) => {
    session.addEventListener("end", () => {
      hitSource.cancel && hitSource.cancel();
      renderer.xr.enabled = false;
      renderer.setAnimationLoop(() => game.frame());
      scene.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && [].concat(o.material).forEach((m) => m.dispose()); });
      if (modalOpen()) closeModal();
      cleanupDom();
      onExit && onExit();
      resolve();
    });
  });

  function cleanupDom() {
    moved.forEach((el) => document.body.appendChild(el));
    overlay.remove();
  }
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

// The training area placed on the real surface: a 2.4 m square with four hazards.
function buildArea() {
  const group = new THREE.Group();
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, metalness: .2, ...o });
  const box = (g, w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const cyl = (g, r1, r2, h, m, x, y, z, seg = 16) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); c.position.set(x, y, z); g.add(c); return c; };
  // floor outline
  const edge = std(0xe2b307);
  for (const [w, d, x, z] of [[2.4, .04, 0, -1.2], [2.4, .04, 0, 1.2], [.04, 2.4, -1.2, 0], [.04, 2.4, 1.2, 0]]) box(group, w, .005, d, edge, x, .003, z);
  const hazards = [];
  const updaters = [];

  // fire in a bin
  {
    const g = new THREE.Group(); g.position.set(-.8, 0, -.8); group.add(g);
    cyl(g, .18, .16, .45, std(0x6b7681, { metalness: .6 }), 0, .225, 0);
    const flames = new THREE.Group(); g.add(flames);
    const fm = [0xff7a00, 0xffd04a].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
    const cones = Array.from({ length: 6 }, (_, i) => { const c = new THREE.Mesh(new THREE.ConeGeometry(.08, .35, 8), fm[i % 2]); c.position.set((Math.random() - .5) * .2, .6, (Math.random() - .5) * .2); flames.add(c); return c; });
    const light = new THREE.PointLight(0xff7a00, 2, 2); light.position.y = .7; g.add(light);
    let grow = 1;
    updaters.push((dt, tm) => { cones.forEach((c, i) => { c.scale.y = (1 + Math.sin(tm * 9 + i) * .25) * grow; }); grow = Math.max(1, grow - dt * .3); });
    hazards.push({ group: g, content: AR_FIRE, resolve() { flames.visible = false; light.intensity = 0; }, fail() { grow = 2.2; }, reset() {} });
  }
  // molten metal with leaking water
  {
    const g = new THREE.Group(); g.position.set(.8, 0, -.8); group.add(g);
    const cr = cyl(g, .22, .18, .32, std(0x4a4f55, { metalness: .7, side: THREE.DoubleSide }), 0, .16, 0); cr.geometry = new THREE.CylinderGeometry(.22, .18, .32, 20, 1, true);
    const melt = new THREE.Mesh(new THREE.CircleGeometry(.2, 20), new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a00, emissiveIntensity: 2.4 })); melt.rotation.x = -Math.PI / 2; melt.position.y = .3; g.add(melt);
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(.25, 20), new THREE.MeshStandardMaterial({ color: 0x5f8db0, roughness: .05, metalness: .3, transparent: true, opacity: .8 })); puddle.rotation.x = -Math.PI / 2; puddle.position.set(.35, .004, .15); puddle.scale.set(1.4, .9, 1); g.add(puddle);
    const steam = new THREE.Group(); g.add(steam);
    const puffs = Array.from({ length: 8 }, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); steam.add(s); return s; });
    let burst = 0;
    updaters.push((dt) => { if (burst > 0) { burst -= dt; puffs.forEach((p, i) => { p.position.set(.3 + Math.cos(i) * (1.2 - burst) * .3, (1.2 - burst) * .6, .15 + Math.sin(i) * (1.2 - burst) * .3); p.material.opacity = Math.max(0, burst * .7); p.scale.setScalar(1 + (1.2 - burst) * 3); }); } });
    hazards.push({ group: g, content: AR_MOLTEN, resolve() { puddle.visible = false; }, fail() { burst = 1.2; }, reset() {} });
  }
  // blocked walkway
  {
    const g = new THREE.Group(); g.position.set(-.8, 0, .8); group.add(g);
    box(g, .6, .004, .9, std(0x2f7a52), 0, .002, 0);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.35, .02, -.4), new THREE.Vector3(.1, .02, -.1), new THREE.Vector3(-.15, .02, .15), new THREE.Vector3(.35, .02, .4)]), 30, .02, 6), std(0xd9b100));
    g.add(hose);
    hazards.push({ group: g, content: AR_WALKWAY, resolve() { hose.position.x = .5; }, fail() {}, reset() {} });
  }
  // suspended load
  {
    const g = new THREE.Group(); g.position.set(.8, 0, .8); group.add(g);
    const frame = std(0xd69a12, { metalness: .4 });
    box(g, .05, 1.2, .05, frame, -.35, .6, 0); box(g, .05, 1.2, .05, frame, .35, .6, 0); box(g, .8, .06, .08, frame, 0, 1.2, 0);
    const cable = box(g, .01, .4, .01, std(0x222222), 0, 1, 0);
    const load = box(g, .3, .18, .3, std(0x1f2226, { roughness: .95 }), 0, .72, 0);
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ color: 0xf2a900, transparent: true, opacity: .4 })); zone.rotation.x = -Math.PI / 2; zone.position.y = .003; g.add(zone);
    let drop = 0;
    updaters.push((dt, tm) => { if (drop > 0) { drop = Math.max(0, drop - dt); load.position.y = Math.max(.09, load.position.y - dt * 3); } load.rotation.y = Math.sin(tm) * .05; });
    hazards.push({ group: g, content: AR_CRANE, resolve() { load.position.y = .09; cable.scale.y = 2.9; cable.position.y = .6; }, fail() { drop = 1; }, reset() { load.position.y = .72; } });
  }
  return { group, hazards, update(dt, tm) { updaters.forEach((u) => u(dt, tm)); } };
}
