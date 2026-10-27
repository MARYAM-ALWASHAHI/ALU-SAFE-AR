// Camera mode: virtual hazards around the trainee, drawn over the live rear camera.
// Works in iOS/iPadOS Safari (no WebXR needed): the view follows the device's orientation
// sensors and a simple step counter moves you closer. It does not detect floors or real
// objects, and the UI says so.
import * as THREE from "./vendor/three.module.min.js?v=5";
import { AR_FIRE, AR_CRANE, AR_MOLTEN, AR_WALKWAY } from "./content.js?v=5";
import { t, tx, getLang } from "./i18n.js?v=5";
import { icon, openModal, closeModal, modalOpen, toast, flash } from "./ui.js?v=5";
import { sfx } from "./audio.js?v=5";

const EYE = 1.4;                      // phone height above the floor, metres
const START_D = [3.6, 4.6, 4.2, 5];   // starting distances
const NEAR = 2.3, MIN_D = 1.6, STEP = 0.5;
const rad = (d) => d * Math.PI / 180;

// Ask for sensor permission. Must run first thing inside a tap on iOS.
export function requestSensors() {
  const asks = [];
  if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) asks.push(DeviceOrientationEvent.requestPermission().catch(() => "denied"));
  if (typeof DeviceMotionEvent !== "undefined" && DeviceMotionEvent.requestPermission) asks.push(DeviceMotionEvent.requestPermission().catch(() => "denied"));
  return Promise.all(asks);
}

export async function startCameraMode({ onExit, sensorAsk }) {
  await (sensorAsk || Promise.resolve());

  const root = document.createElement("div");
  root.id = "ar";
  root.innerHTML = `
    <video playsinline muted autoplay></video>
    <canvas aria-label="${t("camT")}"></canvas>
    <div class="ar-top">
      <button class="hud-btn" data-a="exit" aria-label="${t("camExit")}">${icon("x")}</button>
      <div class="ar-pill"><span>${t("camHazards")}</span><b data-a="count">0/4</b></div>
      <div class="ar-pill"><span>${t("score")}</span><b data-a="score">0</b></div>
    </div>
    <div class="ar-label">${t("camLabel")}</div>
    <div class="ar-arrow" data-a="arrow" hidden></div>
    <div class="ar-reticle"></div>
    <button class="ar-step" data-a="step">${icon("arrow")}<span>${t("camStep")}</span></button>`;
  document.body.appendChild(root);
  const $a = (k) => root.querySelector(`[data-a="${k}"]`);
  const video = root.querySelector("video");
  const canvas = root.querySelector("canvas");

  // ---------- camera ----------
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    await video.play().catch(() => {});
  } catch (_) { stream = null; }
  const camOK = !!stream;
  root.classList.toggle("no-cam", !camOK);

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
  camera.position.set(0, EYE, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(3, 8, 4); scene.add(sun);
  if (!camOK) {
    scene.background = new THREE.Color(0x24313d);
    const grid = new THREE.GridHelper(40, 40, 0x00a8a8, 0x3d4c5a); scene.add(grid);
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 44;   // roughly matches a phone's rear camera
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();

  // ---------- hazards ----------
  const set = [AR_FIRE, AR_MOLTEN, AR_WALKWAY, AR_CRANE];
  const angles = [0, 95, 185, 270].map((a) => a + (Math.random() * 20 - 10));
  const hazards = set.map((content, i) => {
    const model = buildModel(content.id);
    scene.add(model.group);
    return { content, model, angle: rad(angles[i]), d: START_D[i], tries: 0, tried: [], done: false, score: 0 };
  });
  let baseYaw = null;      // device heading when the game starts, so the first hazard is ahead
  function placeHazards() {
    for (const h of hazards) {
      const a = baseYaw + h.angle;
      h.model.group.position.set(-Math.sin(a) * h.d, 0, -Math.cos(a) * h.d);
      h.model.group.rotation.y = a;   // face the trainee
    }
  }

  // ---------- orientation ----------
  const ori = { a: 0, b: 90, g: 0, got: false };
  const onOri = (e) => { if (e.alpha == null) return; ori.a = e.alpha; ori.b = e.beta; ori.g = e.gamma; ori.got = true; };
  addEventListener("deviceorientation", onOri);
  const euler = new THREE.Euler(), q0 = new THREE.Quaternion(), zee = new THREE.Vector3(0, 0, 1);
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const screenAngle = () => (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  function applyOrientation() {
    euler.set(rad(ori.b), rad(ori.a), -rad(ori.g), "YXZ");
    camera.quaternion.setFromEuler(euler);
    camera.quaternion.multiply(q1);
    camera.quaternion.multiply(q0.setFromAxisAngle(zee, -rad(screenAngle())));
  }
  const fwd = new THREE.Vector3();
  const camYaw = () => { camera.getWorldDirection(fwd); return Math.atan2(-fwd.x, -fwd.z); };

  // drag-to-look fallback when there are no motion sensors
  const look = { yaw: 0, pitch: -0.25, id: null, x: 0, y: 0, moved: false };
  canvas.addEventListener("pointerdown", (e) => { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; look.moved = false; });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== look.id) return;
    const dx = e.clientX - look.x, dy = e.clientY - look.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) look.moved = true;
    if (mode === "touch" && look.moved) {
      look.yaw += dx * 0.005; look.pitch = Math.max(-1.3, Math.min(1.2, look.pitch + dy * 0.005));
      look.x = e.clientX; look.y = e.clientY;
    }
  });
  canvas.addEventListener("pointerup", (e) => { if (e.pointerId === look.id) { look.id = null; if (!look.moved) tap(e); } });

  // ---------- step counter ----------
  let lp = 9.8, armed = true, lastStep = 0, warned = false;
  const onMotion = (e) => {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
    lp = lp * 0.8 + Math.hypot(a.x, a.y, a.z) * 0.2;
    const now = performance.now();
    if (armed && lp > 11.2 && now - lastStep > 320) { armed = false; lastStep = now; step(true); }
    if (lp < 10.2) armed = true;
  };
  addEventListener("devicemotion", onMotion);

  // ---------- state ----------
  let mode = "touch", running = true, busy = false, ahead = null, score = 0;
  const clock = new THREE.Clock();
  setTimeout(() => {
    mode = ori.got ? "sensor" : "touch";
    if (mode === "sensor") { applyOrientation(); baseYaw = camYaw(); } else baseYaw = 0;
    placeHazards();
    if (!camOK) toast(t("camNoCam"), 5000);
    else if (mode === "touch") toast(t("camNoMotion"), 4000);
    else toast(t("camFind"), 3000);
  }, 700);
  updateHud();

  function updateHud() {
    $a("count").textContent = `${hazards.filter((h) => h.done).length}/${hazards.length}`;
    $a("score").textContent = score;
  }

  function step(fromSensor) {
    if (!running || modalOpen() || busy || baseYaw === null) return;
    if (!ahead) { if (!fromSensor) toast(t("camNone"), 1800); return; }
    if (fromSensor && !warned) { warned = true; toast(t("camWalk"), 2500); }
    const before = ahead.d;
    ahead.d = Math.max(MIN_D, ahead.d - STEP);
    placeHazards();
    if (before > NEAR && ahead.d <= NEAR) { sfx.click(); toast(t("camTap"), 2200); }
  }
  $a("step").addEventListener("click", () => step(false));
  $a("exit").addEventListener("click", () => stop());

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tap(e) {
    if (!running || busy || modalOpen() || baseYaw === null) return;
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(hazards.filter((h) => !h.done).map((h) => h.model.group), true);
    if (!hits.length) return;
    let o = hits[0].object; while (o && !o.userData.hz) o = o.parent;
    const h = hazards.find((x) => x.model.group === o);
    if (!h) return;
    if (h.d > NEAR) { toast(t("camCloser"), 1800); return; }
    openChoice(h);
  }

  function openChoice(h) {
    const c = h.content;
    h.order = h.order || shuffle(c.opts.map((_, i) => i));
    const keys = getLang() === "ar" ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"];
    const box = openModal({
      tag: `${icon("warn")} ${tx(c.name)}`,
      title: t("whatDo"),
      body: `<p>${tx(c.q)}</p><div class="opts">${h.order.map((k, n) =>
        `<button class="opt ${h.tried.includes(k) ? "tried" : ""}" data-k="${k}" ${h.tried.includes(k) ? "disabled" : ""}><span class="key">${keys[n]}</span><span>${tx(c.opts[k].t)}</span></button>`).join("")}</div>`,
      actions: [{ label: t("close"), onClick: () => closeModal() }],
    });
    box.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      const k = +b.dataset.k, o = c.opts[k];
      h.tries++;
      closeModal();
      busy = true;
      playFx(h, o);
      setTimeout(() => { busy = false; outcome(h, o, k); }, o.ok ? 900 : 1800);
    }));
  }

  function playFx(h, o) {
    if (o.ok) { sfx.good(); flash("good", 900); h.model.resolve(); return; }
    sfx.bad();
    h.model.fail(o.fx);
    if (o.fx === "steam") { flash("steam", 1600); shake(); }
    else if (o.fx === "smoke") flash("smoke", 1700);
    else if (o.fx === "trip") { flash("bad", 900); shake(); }
    else if (o.fx === "fall") { setTimeout(() => { flash("bad", 700); shake(); }, 550); }
    else flash("bad", 900);
  }
  function shake() { root.classList.remove("shake"); void root.offsetWidth; root.classList.add("shake"); }

  function outcome(h, o, k) {
    const c = h.content;
    if (o.ok) {
      h.done = true;
      h.score = h.tries <= 1 ? 100 : h.tries === 2 ? 50 : 20;
      score += h.score; updateHud();
      openModal({
        tone: "good", tag: `${icon("check")} ${t("rightT")}`, title: tx(c.name),
        body: `<p>${tx(o.r)}</p><div class="learn"><b>${t("remember")}</b><p>${tx(c.learn)}</p></div>`,
        actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }],
        onClose: () => { if (hazards.every((x) => x.done)) finish(); },
      });
    } else {
      h.tried.push(k);
      openModal({
        tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: tx(o.t),
        body: `<p>${tx(o.r)}</p>`,
        actions: [{ label: t("tryAgain"), primary: true, onClick: () => { closeModal(); h.model.reset(); openChoice(h); } }],
        onClose: () => h.model.reset(),
      });
    }
  }

  function finish() {
    openModal({
      tone: "good", tag: `${icon("shield")} ${t("camT")}`, title: t("camDoneT"),
      body: `<p>${t("camDone")}</p>
        <ol class="rows">${hazards.map((h) => `<li><div><b>${tx(h.content.name)}</b><small>${h.tries <= 1 ? t("firstTry") : t("tries", { n: h.tries })}</small></div><span class="pts">${h.score}</span></li>`).join("")}</ol>
        <p class="ar-total">${t("score")}: <b>${score}</b> / ${hazards.length * 100}</p>`,
      actions: [
        { label: t("camAgain"), primary: true, onClick: () => { closeModal(); restart(); } },
        { label: t("camExit"), onClick: () => { closeModal(); stop(); } },
      ],
    });
  }

  function restart() {
    score = 0;
    hazards.forEach((h, i) => { h.d = START_D[i]; h.tries = 0; h.tried = []; h.done = false; h.order = null; h.model.reset(true); });
    if (mode === "sensor") baseYaw = camYaw();
    placeHazards(); updateHud();
    toast(t("camFind"), 2500);
  }

  // ---------- loop ----------
  const arrow = $a("arrow");
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), now = performance.now() / 1000;
    if (mode === "sensor") applyOrientation();
    else camera.rotation.set(look.pitch, -look.yaw, 0, "YXZ");
    hazards.forEach((h) => h.model.update(dt, now, h.d <= NEAR && !h.done));
    // which hazard is straight ahead, and where to point when none is visible
    ahead = null;
    if (baseYaw !== null) {
      const y = camYaw();
      let best = null, bestRel = 0;
      for (const h of hazards) {
        if (h.done) continue;
        let rel = baseYaw + h.angle - y; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) < rad(22) && (!ahead || h.d < ahead.d)) ahead = h;
        if (!best || Math.abs(rel) < Math.abs(bestRel)) { best = h; bestRel = rel; }
      }
      const show = best && Math.abs(bestRel) > rad(35) && !modalOpen();
      arrow.hidden = !show;
      if (show) { const left = bestRel > 0; arrow.className = "ar-arrow " + (left ? "l" : "r"); arrow.innerHTML = icon("arrow"); }
    }
    renderer.render(scene, camera);
  });

  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
    removeEventListener("deviceorientation", onOri);
    removeEventListener("devicemotion", onMotion);
    removeEventListener("resize", resize);
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    scene.traverse((o) => { o.geometry && o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    renderer.dispose();
    root.remove();
    onExit && onExit();
  }
  return { stop };
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- hazard models (real-world size, metres) ----------
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, metalness: .25, ...extra });

function buildModel(id) {
  const group = new THREE.Group();
  group.userData.hz = id;
  // soft ground shadow and a ring that lights up when you are close enough to tap
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.9, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .005; group.add(shadow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 48), new THREE.MeshBasicMaterial({ color: 0xf2a900, transparent: true, opacity: 0, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .01; group.add(ring);
  const doneRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.14, 48), new THREE.MeshBasicMaterial({ color: 0x2bb673, transparent: true, opacity: .9, depthWrite: false }));
  doneRing.rotation.x = -Math.PI / 2; doneRing.position.y = .012; doneRing.visible = false; group.add(doneRing);
  const particles = makePuffs(group);
  const m = { group, ring, doneRing, particles, state: "idle", t: 0 };
  const parts = MODELS[id](group);
  Object.assign(m, parts);
  m.update = (dt, now, near) => {
    ring.material.opacity = near ? .55 + Math.sin(now * 5) * .35 : 0;
    m.t += dt;
    parts.tick && parts.tick(dt, now, m);
    particles.update(dt);
  };
  m.fail = (fx) => { m.state = "fail"; m.t = 0; parts.onFail && parts.onFail(fx, m); };
  m.resolve = () => { m.state = "done"; m.t = 0; doneRing.visible = true; parts.onResolve && parts.onResolve(m); };
  m.reset = (full) => { if (m.state === "done" && !full) return; m.state = "idle"; doneRing.visible = false; parts.onReset && parts.onReset(m); };
  return m;
}

const MODELS = {
  fire(g) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(.32, .27, .75, 20, 1, true), std(0x6b7680, { side: THREE.DoubleSide, metalness: .6 }));
    bin.position.y = .375; g.add(bin);
    const flames = new THREE.Group(); flames.position.y = .7; g.add(flames);
    const mats = [new THREE.MeshBasicMaterial({ color: 0xff6a00 }), new THREE.MeshBasicMaterial({ color: 0xffc23a })];
    const cones = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(.08 + Math.random() * .08, .45 + Math.random() * .35, 8), mats[i % 2]);
      c.position.set((Math.random() - .5) * .35, .2, (Math.random() - .5) * .35); flames.add(c); cones.push(c);
    }
    const light = new THREE.PointLight(0xff7a2a, 3, 4, 2); light.position.y = 1.1; g.add(light);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    beacon.position.set(.55, 1.4, 0); beacon.visible = false; g.add(beacon);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.4, 6), std(0x9aa3ab)); pole.position.set(.55, .7, 0); g.add(pole);
    let target = 1;
    return {
      tick(dt, now, m) {
        cones.forEach((c, i) => { c.scale.y = 1 + Math.sin(now * 9 + i) * .25; });
        const s = flames.scale.x + (target - flames.scale.x) * Math.min(1, dt * 2.5);
        flames.scale.setScalar(s); light.intensity = 3 * s;
        if (m.state !== "done") m.particles.emit(new THREE.Vector3(0, 1.1 * s, 0), m.state === "fail" ? 14 : 3, dt, .9);
        beacon.visible = m.state === "done" && Math.sin(now * 10) > 0;
      },
      onFail() { target = 2.3; },
      onResolve() { target = 0.001; },
      onReset() { target = 1; },
    };
  },
  molten(g) {
    const crucible = new THREE.Mesh(new THREE.CylinderGeometry(.5, .42, .8, 24, 1, true), std(0x4a4f55, { metalness: .7, side: THREE.DoubleSide }));
    crucible.position.set(.2, .4, -.2); g.add(crucible);
    const melt = new THREE.Mesh(new THREE.CircleGeometry(.47, 24), new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a00, emissiveIntensity: 2.2 }));
    melt.rotation.x = -Math.PI / 2; melt.position.set(.2, .78, -.2); g.add(melt);
    const glow = new THREE.PointLight(0xff7a2a, 2, 3, 2); glow.position.set(.2, 1.1, -.2); g.add(glow);
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(.45, 28), new THREE.MeshStandardMaterial({ color: 0x5f95c4, roughness: .05, metalness: .3, transparent: true, opacity: .8 }));
    puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.3, .8, 1); puddle.position.set(-.45, .015, .35); g.add(puddle);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.2, .04, -.4), new THREE.Vector3(-.9, .04, 0), new THREE.Vector3(-.5, .04, .3)]), 16, .035, 6), std(0x1f5f9e));
    g.add(hose);
    return {
      tick(dt, now, m) {
        melt.material.emissiveIntensity = 2 + Math.sin(now * 6) * .3;
        if (m.state === "fail" && m.t < 1.2) m.particles.emit(new THREE.Vector3(-.3, .3, .2), 40, dt, 1.6);
      },
      onResolve() { puddle.visible = false; },
      onReset(m) { if (m.state !== "done") puddle.visible = true; },
    };
  },
  house(g) {
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.2, .05, -.2), new THREE.Vector3(-.5, .05, .25), new THREE.Vector3(.1, .05, -.15), new THREE.Vector3(.7, .05, .2), new THREE.Vector3(1.2, .05, -.1)]), 40, .05, 8), std(0xd9b100));
    g.add(hose);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1, .025, .4), new THREE.Vector3(0, .025, .1), new THREE.Vector3(1, .025, .45)]), 30, .02, 6), std(0x111111));
    g.add(cable);
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(.8, .12, .6), std(0x9a7445, { metalness: 0 })); pallet.position.set(.35, .06, -.45); g.add(pallet);
    const stripes = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .08), new THREE.MeshBasicMaterial({ color: 0xe8b400 }));
    stripes.rotation.x = -Math.PI / 2; stripes.position.set(0, .008, .75); g.add(stripes);
    const stuff = [hose, cable, pallet];
    return {
      onResolve() { stuff.forEach((o) => { o.position.x += 1.6; }); },
      onReset(m) { if (m.state !== "done") stuff.forEach((o) => { o.position.x = o === pallet ? .35 : 0; }); },
    };
  },
  crane(g) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.8, 6), std(0x222222)); cable.position.y = 3.6; g.add(cable);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.25, .25, 3), std(0xf2a900, { metalness: .4 })); beam.position.y = 4.6; g.add(beam);
    const load = new THREE.Group(); g.add(load);
    const block = new THREE.Mesh(new THREE.BoxGeometry(.9, .45, .7), std(0x1f2226, { metalness: 0, roughness: .95 })); load.add(block);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(.08, .5, .08), std(0xb0b7bd, { metalness: .8 })); rod.position.y = .45; load.add(rod);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.1, .03, 8, 16, Math.PI * 1.4), std(0xd9b100, { metalness: .7 })); hook.position.y = .75; load.add(hook);
    const HANG = 2.4;
    load.position.y = HANG;
    const zone = new THREE.Mesh(new THREE.RingGeometry(.55, .62, 40), new THREE.MeshBasicMaterial({ color: 0xf2a900, transparent: true, opacity: .7 }));
    zone.rotation.x = -Math.PI / 2; zone.position.y = .02; g.add(zone);
    let mode = "hang";
    return {
      tick(dt, now) {
        if (mode === "hang") { load.position.y = HANG; load.rotation.z = Math.sin(now * 1.2) * .04; }
        if (mode === "drop") load.position.y = Math.max(.23, load.position.y - dt * 6);
        if (mode === "lower") load.position.y = Math.max(.23, load.position.y - dt * .9);
        cable.scale.y = Math.max(.2, (4.5 - load.position.y - .75) / 1.8); cable.position.y = (4.5 + load.position.y + .75) / 2;
      },
      onFail() { mode = "drop"; },
      onResolve() { mode = "lower"; },
      onReset(m) { if (m.state !== "done") mode = "hang"; },
    };
  },
};

// Small pooled particle cloud for smoke and steam.
function makePuffs(group) {
  const max = 70;
  const pos = new Float32Array(max * 3).fill(-99), vel = new Float32Array(max * 3), life = new Float32Array(max);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g2 = c.getContext("2d"); const r = g2.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g2.fillStyle = r; g2.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({ color: 0xb9c2ca, size: .5, map: new THREE.CanvasTexture(c), transparent: true, opacity: .75, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; group.add(pts);
  let next = 0, acc = 0;
  return {
    emit(origin, rate, dt, spread) {
      acc += rate * dt;
      while (acc >= 1) {
        acc -= 1; const i = next++ % max;
        pos[i * 3] = origin.x + (Math.random() - .5) * .3; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z + (Math.random() - .5) * .3;
        vel[i * 3] = (Math.random() - .5) * spread; vel[i * 3 + 1] = .6 + Math.random() * .8; vel[i * 3 + 2] = (Math.random() - .5) * spread;
        life[i] = 1;
      }
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt * .5;
        for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * dt;
        if (life[i] <= 0) pos[i * 3 + 1] = -99;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
