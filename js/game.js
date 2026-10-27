// Game engine: renderer, loop, first-person player, interaction, safety rules, HUD and the
// mission runner. Mission logic lives in missions.js and talks to the engine through `ctx`.
import * as THREE from "./vendor/three.module.min.js?v=5";
import { buildWorld, ZONES } from "./world.js?v=5";
import { disposeTextures } from "./textures.js?v=5";
import { Player } from "./player.js?v=5";
import { MISSIONS } from "./missions.js?v=5";
import { MISSION_TEXT, MISSION_ORDER, PPE_ITEMS, VIOLATIONS, DIFFICULTY, SCORING, CONTENT_META } from "./content.js?v=5";
import { t, tx, getLang } from "./i18n.js?v=5";
import { $, icon, ppeArt, openModal, closeModal, modalOpen, toast, flash, fmtTime, showScreen } from "./ui.js?v=5";
import { sfx, startAlarm, stopAlarm } from "./audio.js?v=5";
import { store } from "./storage.js?v=5";

const QUALITY = {
  low: { ratio: 1, shadows: false },
  medium: { ratio: 1.5, shadows: false },
  high: { ratio: 2, shadows: true },
};
const _v = new THREE.Vector3(), _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();

export class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 160);
    this.player = new Player(this.camera, canvas);
    this.player.onInteract = () => this.interact();
    this.player.onPause = () => this.togglePause();
    this.player.bindStick($("#stick"), $("#stick .knob"));
    $("#btn-interact").addEventListener("click", () => this.interact());
    $("#btn-pause").addEventListener("click", () => this.togglePause());
    const obj = $("#objective");
    const toggleObj = () => { if (obj.classList.contains("single")) return; const open = obj.classList.toggle("open"); obj.setAttribute("aria-expanded", String(open)); };
    obj.addEventListener("click", toggleObj);
    obj.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleObj(); } });
    this.bindTap();
    this.clock = new THREE.Clock();
    this.mode = "menu";            // menu | play | ar
    this.shake = 0;
    this.onExit = null;
    this.buildScene();
    addEventListener("resize", () => this.resize());
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.onContextLost && this.onContextLost(); });
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  applyQuality() {
    const q = QUALITY[this.settings.quality] || QUALITY.medium;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.ratio));
    const rebuild = this.renderer.shadowMap.enabled !== q.shadows && this.scene;
    this.renderer.shadowMap.enabled = q.shadows;
    this.resize();
    if (rebuild && this.mode === "menu") this.buildScene();
  }

  buildScene() {
    if (this.scene) {
      this.scene.traverse((o) => { o.geometry && o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
      this.scene.environment && this.scene.environment.dispose();
      disposeTextures();
    }
    const q = QUALITY[this.settings.quality] || QUALITY.medium;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.ratio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.scene = new THREE.Scene();
    this.world = buildWorld(this.scene, { shadows: q.shadows, renderer: this.renderer, quality: this.settings.quality });
    this.world.setMarker(null, false);
    this.scene.add(this.camera);
    // pick markers that float above interactive objects
    this.pickGeo = new THREE.OctahedronGeometry(.13, 0);
    this.pickMat = new THREE.MeshBasicMaterial({ color: 0x19d3d3, transparent: true, opacity: .9, depthTest: false });
    this.pickMatFocus = new THREE.MeshBasicMaterial({ color: 0xf2a900, depthTest: false });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 78 : 66;    // wider view in portrait
    this.camera.updateProjectionMatrix();
  }

  // ======================= mission lifecycle =======================
  startMission(id, difficulty) {
    this.cleanupRun();
    this.buildScene();
    const def = MISSIONS[id];
    this.diff = difficulty;
    this.cfg = DIFFICULTY[difficulty];
    this.missionId = id;
    this.text = MISSION_TEXT[id];
    this.world.crane.state.speed = this.cfg.craneSpeed;
    this.world.crane.showDanger(this.cfg.showDanger);
    this.items = [];
    this.focus = null;
    this.held = null;
    this.timerLeft = null; this.onTimer = null;
    this.elapsed = 0;
    this.violationCooldown = 0;
    this.ended = false;
    this.log = [];
    this.penalties = 0;
    this.objs = [];
    this.target = null;
    this.rules = { crane: true, restricted: true, fire: false, forklift: false, aisle: false, ...(def.rules || {}) };
    const sp = def.spawn;
    this.player.place(sp.x, sp.z, sp.yaw);
    this.player.speedScale = 1;
    this.lastSafe = { x: sp.x, z: sp.z };
    this.mode = "play";
    showScreen(null);
    $("#hud").hidden = false;
    $("#sample-banner").hidden = CONTENT_META.approved;
    $("#objective").classList.remove("open"); $("#objective").setAttribute("aria-expanded", "false");
    $("#meter").hidden = true; $("#timer").hidden = true; $("#carry").hidden = true;
    $("#obj-step").textContent = `${MISSION_ORDER.indexOf(id) + 1} · ${tx(this.text.name)}`;
    this.ctx = this.makeCtx();
    this.def = def;
    def.setup(this.ctx);
    this.renderObjectives();
    $("#score-val").textContent = this.score();
    // briefing
    this.pause();
    openModal({
      tag: `${icon("shield")} ${t("missionN", { n: MISSION_ORDER.indexOf(id) + 1 })}`,
      title: tx(this.text.name),
      body: `<p>${tx(this.text.brief)}</p>${this.objs.length ? `<ol class="brief-list">${this.objs.map((o) => `<li>${o.text()}</li>`).join("")}</ol>` : ""}`,
      actions: [{ label: t("begin"), icon: "play", primary: true, onClick: () => closeModal() }],
      onClose: () => {
        this.resume();
        if (matchMedia("(pointer:coarse)").matches && innerWidth < innerHeight && innerWidth < 600) toast(t("rotate"), 3800);
        else if (matchMedia("(pointer:fine)").matches) toast(t("lookTip"), 4200);
        def.start && def.start(this.ctx);
      },
    });
  }

  pause() { this.player.enabled = false; this.player.releaseInput(); }
  resume() { if (this.mode === "play" && !this.ended) { this.player.enabled = true; this.clock.getDelta(); } }

  togglePause() {
    if (this.mode !== "play") return;
    if (modalOpen()) { if (this._pauseOpen) closeModal(); return; }
    this.pause();
    this._pauseOpen = true;
    const fsOK = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    openModal({
      title: t("paused"),
      body: `<p class="muted">${tx(this.text.name)}</p>`,
      actions: [
        { label: t("resume"), icon: "play", primary: true, onClick: () => closeModal() },
        ...(fsOK ? [{ label: t("fullscreen"), icon: "expand", onClick: () => { toggleFullscreen(); closeModal(); } }] : []),
        { label: t("restartMission"), icon: "restart", onClick: () => { this._pauseOpen = false; closeModal(); this.startMission(this.missionId, this.diff); } },
        { label: t("missions"), icon: "grid", onClick: () => { this._pauseOpen = false; closeModal(); this.exitTo("missions"); } },
      ],
      onClose: () => { this._pauseOpen = false; this.resume(); },
    });
  }

  cleanupRun() {
    stopAlarm();
    document.body.classList.remove("visor");
    if (this.ctx) this.ctx._timers.forEach(clearTimeout);
    this.ended = true;
  }

  exitTo(where) {
    this.cleanupRun();
    this.mode = "menu";
    this.pause();
    $("#hud").hidden = true;
    $("#focus-tag").hidden = true;
    this.buildScene();
    this.onExit && this.onExit(where);
  }

  // ======================= per-frame =======================
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.08);
    if (this.mode === "ar") return;   // camera / AR modes render on their own
    if (this.mode === "menu") {
      const tt = performance.now() / 1000 * 0.05;
      this.camera.position.set(-6 + Math.sin(tt) * 22, 5.2 + Math.sin(tt * 1.7), 7 + Math.cos(tt * 1.3) * 3);
      this.camera.lookAt(4 + Math.sin(tt * .7) * 10, 2.2, -5);
      this.world.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const active = this.player.enabled;
    if (active) this.elapsed += dt;
    this.player.update(dt, this.world.colliders, this.world.floorAt);
    this.world.update(active ? dt : dt * 0.15);
    if (active && !this.ended) this.tick(dt);
    this.updatePickMarkers();
    if (this.shake > 0) {
      this.shake -= dt;
      const s = this.shake * 0.12;
      this.camera.position.x += (Math.random() - .5) * s; this.camera.position.y += (Math.random() - .5) * s;
    }
    this.renderer.render(this.scene, this.camera);
    this.updateCompass();
    this.updateFocusTag();
  }

  tick(dt) {
    const p = this.player;
    this.violationCooldown -= dt;
    // global safety rules
    const breach = this.ruleBreach(p.x, p.z, 0);
    if (breach && this.violationCooldown <= 0) return this.violation(breach);
    if (!this.ruleBreach(p.x, p.z, .8)) { this.lastSafe.x = p.x; this.lastSafe.z = p.z; }
    // early warnings: crane horn and forklift horn
    const near = this.rules.crane && inRect(p.x, p.z, this.world.crane.zone(), 2.2);
    if (near && !this._craneWarned) { this._craneWarned = true; sfx.horn(); }
    if (!near) this._craneWarned = false;
    if (this.rules.forklift && this.world.forklift.state.active) {
      const fz = inRect(p.x, p.z, this.world.forklift.zone(3), 0);
      if (fz && !this._forkWarned) { this._forkWarned = true; sfx.horn(); }
      if (!fz) this._forkWarned = false;
    }
    if (this.timerLeft != null) {
      this.timerLeft -= dt;
      $("#timer-val").textContent = fmtTime(Math.max(0, this.timerLeft));
      $("#timer").classList.toggle("low", this.timerLeft < 20);
      if (this.timerLeft <= 0) { this.timerLeft = null; const cb = this.onTimer; this.onTimer = null; cb && cb(); return; }
    }
    this.def.update && this.def.update(this.ctx, dt);
    this.updateFocus();
  }

  ruleBreach(x, z, pad) {
    const r = this.rules;
    if (this.player.feet > 1) return null;   // up on the maintenance platform
    if (r.crane && this.world.crane.state.active && inRect(x, z, this.world.crane.zone(), pad * .4 + .3)) return "crane";
    if (r.restricted && inRect(x, z, ZONES.restricted, pad)) return "restricted";
    if (r.fire && this.world.fire.on && Math.hypot(x - this.world.fire.x, z - this.world.fire.z) < this.world.fire.r + pad) return "fire";
    if (r.forklift && this.world.forklift.state.active && inRect(x, z, this.world.forklift.zone(.5), pad)) return "forklift";
    if (r.aisle && inRect(x, z, ZONES.aisle, pad - .3) && !ZONES.crossings.some((c) => x > c.minX - .4 && x < c.maxX + .4)) return "aisle";
    return null;
  }

  violation(kind, extra) {
    const v = VIOLATIONS[kind];
    this.violationCooldown = 1.5;
    this.pause(); sfx.bad();
    if (kind === "crane" || kind === "forklift" || kind === "noLook") sfx.horn();
    flash("bad", 900); this.shake = kind === "forklift" ? .8 : .4;
    if (kind === "crane") this.world.crane.state.wait = Math.max(this.world.crane.state.wait, 2.5);
    if (kind === "forklift" || kind === "noLook") this.world.forklift.state.wait = Math.max(this.world.forklift.state.wait, 3);
    this.addPenalty(SCORING.violation, v.t);
    openModal({
      tone: "bad",
      tag: `${icon("warn")} ${t("violation")}`,
      title: tx(v.t),
      body: `<p>${tx(v.r)}</p><p class="muted">−${SCORING.violation} ${t("score")}</p>`,
      actions: [{ label: t("stepBack"), primary: true, onClick: () => closeModal() }],
      onClose: () => { this.stepToSafety(kind, extra); this.resume(); },
    });
  }

  stepToSafety(kind, extra) {
    const p = this.player;
    if (extra && extra.to) { p.x = extra.to.x; p.z = extra.to.z; }
    else if (kind === "crane") {
      const z = this.world.crane.zone();
      p.z = Math.abs(p.z - z.minZ) < Math.abs(p.z - z.maxZ) ? z.minZ - 1 : z.maxZ + 1;
      if (p.z < ZONES.restricted.maxZ && p.x > ZONES.restricted.minX && p.x < ZONES.restricted.maxX) p.z = z.maxZ + 1;
    } else { p.x = this.lastSafe.x; p.z = this.lastSafe.z; }
    p.feet = this.world.floorAt(p.x, p.z);
    p.pitch = -0.05;
  }

  // ======================= interaction =======================
  addItem(spec) {
    const it = { range: 2.2, enabled: true, marker: true, ...spec };
    if (!it.pos) { it.obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(it.obj); it.pos = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2); }
    it.pick = new THREE.Mesh(this.pickGeo, this.pickMat); it.pick.renderOrder = 10;
    this.scene.add(it.pick);
    it.remove = () => { it.enabled = false; this.scene.remove(it.pick); const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); if (this.focus === it) this.setFocus(null); };
    this.items.push(it);
    return it;
  }

  updateFocus() {
    const p = this.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bestS = 1e9;
    for (const it of this.items) {
      if (!it.enabled) continue;
      const dx = it.pos.x - p.x, dz = it.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > it.range || Math.abs(it.pos.y - (p.feet + 1)) > 2.6) continue;
      const cos = d < .01 ? 1 : (dx * fx + dz * fz) / d;
      if (cos < .45 && d > 1.1) continue;
      const s = d + (1 - cos) * 3;
      if (s < bestS) { bestS = s; best = it; }
    }
    if (best !== this.focus) this.setFocus(best);
  }

  setFocus(it) {
    if (this.focus) this.focus.pick.material = this.pickMat;
    this.focus = it;
    const show = !!it && this.player.enabled;
    $("#btn-interact").hidden = !show;
    $("#hint-e").hidden = !show || !matchMedia("(pointer:fine)").matches;
    $("#focus-tag").hidden = !it;
    if (it) {
      it.pick.material = this.pickMatFocus;
      const label = typeof it.label === "function" ? it.label() : tx(it.label);
      $("#btn-interact span").textContent = it.verb ? tx(it.verb) : t("interact");
      $("#focus-tag").textContent = label;
      sfx.tick();
    }
  }

  updatePickMarkers() {
    const show = this.mode === "play" && this.cfg && this.cfg.showMarkers;
    const tt = performance.now() / 1000;
    const p = this.player;
    for (const it of this.items) {
      // the focused object shows its name tag instead; markers shrink as you get close
      it.pick.visible = !!(it.enabled && it.marker && show && it !== this.focus);
      it.pick.position.set(it.pos.x, it.pos.y + .35 + Math.sin(tt * 3 + it.pos.x) * .06, it.pos.z);
      it.pick.rotation.y = tt * 1.5;
      it.pick.scale.setScalar(Math.min(1.4, Math.max(.35, Math.hypot(it.pos.x - p.x, it.pos.z - p.z) * .18)));
    }
  }

  updateFocusTag() {
    const el = $("#focus-tag");
    const it = this.focus;
    if (!it || this.mode !== "play" || !this.player.enabled) { el.hidden = true; return; }
    _v.set(it.pos.x, it.pos.y + .65, it.pos.z).project(this.camera);
    if (_v.z > 1) { el.hidden = true; return; }
    el.hidden = false;
    const x = (_v.x * .5 + .5) * innerWidth, y = (-_v.y * .5 + .5) * innerHeight;
    el.style.transform = `translate(${Math.max(70, Math.min(innerWidth - 70, x))}px, ${Math.max(90, Math.min(innerHeight - 140, y))}px) translate(-50%, -100%)`;
  }

  interact(it = this.focus) {
    if (this.mode !== "play" || !this.player.enabled || !it || !it.enabled) return;
    sfx.click();
    this.setFocus(null);
    it.onUse(it);
  }

  // Tap or click directly on an object to use it (touch screens and unlocked mouse).
  bindTap() {
    let down = null;
    this.canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    this.canvas.addEventListener("pointerup", (e) => {
      if (!down || this.mode !== "play" || !this.player.enabled || document.pointerLockElement) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dur = performance.now() - down.t;
      down = null;
      if (moved > 10 || dur > 400) return;
      _ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      _ray.setFromCamera(_ndc, this.camera);
      const live = this.items.filter((it) => it.enabled);
      const hits = _ray.intersectObjects(live.flatMap((it) => [it.obj, it.pick]).filter(Boolean), true);
      if (!hits.length) return;
      const hit = live.find((it) => { let o = hits[0].object; while (o) { if (o === it.obj || o === it.pick) return true; o = o.parent; } return false; });
      if (hit && Math.hypot(hit.pos.x - this.player.x, hit.pos.z - this.player.z) < hit.range * 1.4) this.interact(hit);
      else if (hit) toast(t("tooFar"), 1600);
    });
  }

  hold(obj) {
    if (this.held) this.camera.remove(this.held);
    this.held = obj;
    $("#carry").hidden = !obj;
    if (obj) { obj.position.set(.32, -.42, -.75); obj.rotation.set(.2, -.4, 0); this.camera.add(obj); obj.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.depthTest = true; } }); }
  }

  // ======================= objectives + HUD =======================
  renderObjectives() {
    const cur = this.objs.find((o) => !o.done && !o.hidden);
    $("#obj-text").textContent = cur ? cur.text() : "";
    $("#tracker").innerHTML = this.objs.filter((o) => !o.hidden).map((o) => `<span class="seg ${o.done ? "done" : o === cur ? "cur" : ""}"></span>`).join("");
    $("#objective").classList.toggle("single", this.objs.filter((o) => !o.hidden && !o.optional).length <= 1);
    $("#obj-list").innerHTML = this.objs.filter((o) => !o.hidden && !o.optional).length > 1 ? this.objs.filter((o) => !o.hidden).map((o) => `<li class="${o.done ? "done" : o === cur ? "cur" : ""}">${icon(o.done ? "check" : "dot")}<span>${o.text()}</span></li>`).join("") : "";
    const tg = this.target || (cur && cur.at) || null;
    this.world.setMarker(tg, this.cfg.showMarkers);
  }

  updateCompass() {
    const c = $("#compass");
    if (this.mode !== "play" || !this.cfg || !this.cfg.showArrow) { c.hidden = true; return; }
    const cur = this.objs.find((o) => !o.done && !o.hidden);
    let tg = this.target || (cur && cur.at);
    if (typeof tg === "function") tg = tg();
    if (!tg) { c.hidden = true; return; }
    const p = this.player;
    const dx = tg.x - p.x, dz = tg.z - p.z;
    const d = Math.hypot(dx, dz);
    c.hidden = false;
    let rel = Math.atan2(-dx, -dz) - p.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    $("#compass .arrow").style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`;
    $("#compass-d").textContent = `${Math.round(d)} ${t("m")}`;
  }

  score() { return Math.max(0, SCORING.max - this.penalties); }
  addPenalty(n, reason) {
    this.penalties += n;
    this.log.push({ reason, pts: -n });
    $("#score-val").textContent = this.score();
  }

  // ======================= the context handed to missions =======================
  makeCtx() {
    const g = this;
    const ctx = {
      game: g, world: g.world, player: g.player, scene: g.scene, M: g.world.materials,
      cfg: g.cfg, diff: g.diff, text: g.text, state: {}, _timers: [],
      add(obj) { g.scene.add(obj); return obj; },
      item(spec) { return g.addItem(spec); },
      rules(r) { Object.assign(g.rules, r); },
      // objectives: [{id, text: {en,ar} | () => string, at: {x,z} | () => {x,z}, optional, hidden}]
      objectives(list) {
        g.objs = list.map((o) => ({ ...o, done: false, text: typeof o.text === "function" ? o.text : () => tx(o.text) }));
        g.renderObjectives();
      },
      done(id) { const o = g.objs.find((x) => x.id === id); if (o && !o.done) { o.done = true; sfx.good(); g.renderObjectives(); } },
      isDone(id) { const o = g.objs.find((x) => x.id === id); return !!(o && o.done); },
      show(id, on = true) { const o = g.objs.find((x) => x.id === id); if (o) { o.hidden = !on; g.renderObjectives(); } },
      refresh() { g.renderObjectives(); },
      target(pos) { g.target = pos; g.renderObjectives(); },
      timer(sec, onEnd) { g.timerLeft = sec; g.onTimer = onEnd; $("#timer").hidden = sec == null; },
      timeLeft() { return g.timerLeft; },
      meter(label, v) {
        const el = $("#meter"); el.hidden = v == null; if (v == null) return;
        el.querySelector("span").textContent = label; el.querySelector("i").style.width = `${Math.round(Math.min(1, v) * 100)}%`;
        el.classList.toggle("hot", v > .65);
      },
      carry(obj, label) { g.hold(obj); $("#carry span").textContent = label || ""; },
      penalty(n, reason) { g.addPenalty(n, reason); },
      near(pos, r) { return Math.hypot(g.player.x - pos.x, g.player.z - pos.z) < r; },
      later(ms, fn) { const id = setTimeout(() => { if (!g.ended) fn(); }, ms); ctx._timers.push(id); return id; },
      fx(kind) { g.playFx(kind); },
      toast(msg, ms) { toast(typeof msg === "string" ? msg : tx(msg), ms); },
      violation(kind, extra) { g.violation(kind, extra); },
      alarm(on) { on ? startAlarm() : stopAlarm(); },
      // Modal helpers. Each pauses the player and resolves when the dialog closes.
      info({ tone = "", tag = "", title, body, button }) {
        return new Promise((res) => {
          g.pause();
          openModal({ tone, tag, title: tx(title) || title, body: typeof body === "string" ? body : `<p>${tx(body)}</p>`,
            actions: [{ label: button || t("cont"), primary: true, onClick: () => closeModal() }],
            onClose: () => { g.resume(); res(); } });
        });
      },
      ask({ tag = "", title, body, buttons }) {
        return new Promise((res) => {
          g.pause();
          let value = null;
          openModal({ tag, title: tx(title) || title, body,
            actions: buttons.map((b) => ({ label: b.label, icon: b.icon, primary: b.primary, onClick: () => { value = b.value; closeModal(); } })),
            onClose: () => { g.resume(); res(value); } });
        });
      },
      // Multiple-choice decision. Wrong answers play their consequence, cost points and return
      // to the question with that answer struck out. Resolves with the number of tries.
      choose({ tag, title, q, opts, learn, penalty = SCORING.wrongChoice, fxBad = "bad" }) {
        return new Promise((res) => {
          const order = shuffle(opts.map((_, i) => i)), tried = [];
          const keys = getLang() === "ar" ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"];
          const ask = () => {
            g.pause();
            const box = openModal({
              tag: tag || `${icon("warn")} ${tx(g.text.name)}`, title: title ? tx(title) || title : t("whatDo"),
              body: `<p>${tx(q)}</p><div class="opts">${order.map((k, n) => `<button class="opt ${tried.includes(k) ? "tried" : ""}" data-k="${k}" ${tried.includes(k) ? "disabled" : ""}><span class="key">${keys[n]}</span><span>${tx(opts[k].t)}</span></button>`).join("")}</div>`,
            });
            box.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
              const k = +b.dataset.k, o = opts[k];
              closeModal();
              if (o.ok) {
                g.playFx("good");
                openModal({ tone: "good", tag: `${icon("check")} ${t("rightT")}`, title: tx(o.t), body: `<p>${tx(o.r)}</p>${learn ? `<div class="learn"><b>${t("remember")}</b><p>${tx(learn)}</p></div>` : ""}`,
                  actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }], onClose: () => { g.resume(); res(tried.length + 1); } });
              } else {
                tried.push(k);
                g.addPenalty(penalty, o.t);
                g.playFx(o.fx || fxBad);
                g.pause();
                setTimeout(() => openModal({ tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: tx(o.t), body: `<p>${tx(o.r)}</p><p class="muted">−${penalty} ${t("score")}</p>`,
                  actions: [{ label: t("tryAgain"), primary: true, onClick: () => { closeModal(); ask(); } }] }), o.fx === "steam" || o.fx === "smoke" ? 1300 : 600);
              }
            }));
          };
          ask();
        });
      },
      ppeSelect() { return g.ppeSelect(); },
      complete(extra) { g.completeMission(extra); },
      fail(title, body) { g.failMission(title, body); },
    };
    return ctx;
  }

  playFx(kind) {
    if (kind === "good") { sfx.good(); flash("good", 900); return; }
    sfx.bad();
    if (kind === "steam") { this.world.steamBurst(); flash("steam", 1600); this.shake = .7; }
    else if (kind === "trip") { flash("bad", 900); this.shake = .7; this.player.pitch = -0.6; }
    else if (kind === "smoke") { flash("smoke", 1600); }
    else if (kind === "struck") { flash("bad", 1100); this.shake = 1; sfx.horn(); }
    else flash("bad", 900);
  }

  // PPE selection dialog. Resolves once the right set is chosen; wrong sets cost points.
  ppeSelect() {
    return new Promise((res) => {
      const sel = new Set();
      const open = () => {
        this.pause();
        const box = openModal({
          wide: true, tag: `${icon("shield")} ${tx(this.text.name)}`, title: t("ppeT"),
          body: `<p>${t("ppeQ")}</p><div class="ppe">${PPE_ITEMS.map((it) => `<button class="ppe-item ${sel.has(it.id) ? "on" : ""}" data-id="${it.id}" aria-pressed="${sel.has(it.id)}">${ppeArt(it.id)}<span>${tx(it)}</span><i>${icon("check")}</i></button>`).join("")}</div><p class="note">${t("ppeSample")}</p>`,
          actions: [{ label: t("ppeCheck"), primary: true, onClick: () => check() }],
        });
        box.querySelectorAll(".ppe-item").forEach((b) => b.addEventListener("click", () => {
          const id = b.dataset.id;
          sel.has(id) ? sel.delete(id) : sel.add(id);
          b.classList.toggle("on", sel.has(id)); b.setAttribute("aria-pressed", sel.has(id));
          sfx.click();
        }));
      };
      const check = () => {
        const missing = PPE_ITEMS.filter((it) => it.need && !sel.has(it.id));
        const wrong = PPE_ITEMS.filter((it) => !it.need && sel.has(it.id));
        closeModal();
        if (!missing.length && !wrong.length) {
          this.playFx("good");
          openModal({ tone: "good", tag: `${icon("check")} ${t("ppeOkT")}`, title: t("ppeT"), body: `<p>${t("ppeOk")}</p>`,
            actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }], onClose: () => { this.resume(); res(); } });
        } else {
          this.playFx("bad");
          this.addPenalty(SCORING.wrongCheck, { en: "Incomplete or unsuitable PPE", ar: "معدات وقاية ناقصة أو غير مناسبة" });
          openModal({ tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: t("ppeT"),
            body: `${missing.length ? `<h3>${t("ppeMissing")}</h3><ul>${missing.map((it) => `<li>${tx(it)}</li>`).join("")}</ul>` : ""}
                   ${wrong.length ? `<h3>${t("ppeWrong")}</h3><ul>${wrong.map((it) => `<li><b>${tx(it)}</b>: ${tx(it.why)}</li>`).join("")}</ul>` : ""}<p class="muted">−${SCORING.wrongCheck} ${t("score")}</p>`,
            actions: [{ label: t("tryAgain"), primary: true, onClick: () => { closeModal(); open(); } }] });
        }
      };
      open();
    });
  }

  // ======================= end of mission =======================
  completeMission(extra = "") {
    if (this.ended) return;
    this.cleanupRun();
    this.pause();
    sfx.good(); flash("good", 900);
    const score = Math.max(SCORING.minimum, this.score());
    const stars = score >= SCORING.stars[0] ? 3 : score >= SCORING.stars[1] ? 2 : 1;
    const prev = store.getProgress()[this.missionId];
    store.recordMission(this.missionId, this.diff, score, stars);
    const idx = MISSION_ORDER.indexOf(this.missionId), next = MISSION_ORDER[idx + 1];
    const result = { id: this.missionId, score, stars, elapsed: this.elapsed, log: this.log, newBest: !prev || score > (prev.best || 0) };
    openModal({
      tone: "good", wide: true,
      tag: `${icon("check")} ${t("missionComplete")}`,
      title: tx(this.text.name),
      body: `<div class="res-mini"><div class="big-score"><b>${score}</b><span>/ 100</span></div><div class="stars">${starsHtml(stars)}</div>${result.newBest && prev ? `<p class="badge">${t("newBest")}</p>` : ""}</div>
        <div class="stats"><div><span>${t("totalTime")}</span><b>${fmtTime(this.elapsed)}</b></div><div><span>${t("mistakes")}</span><b>${this.log.length}</b></div></div>
        ${extra}
        ${this.log.length ? `<h3>${t("whatWentWrong")}</h3><ul class="loglist">${this.log.map((l) => `<li><span>${tx(l.reason)}</span><b>${l.pts}</b></li>`).join("")}</ul>` : `<p class="muted">${t("noMistakes")}</p>`}
        <div class="learn"><b>${t("remember")}</b><p>${tx(this.text.learn)}</p></div>`,
      actions: [
        ...(next ? [{ label: t("nextMission"), icon: "play", primary: true, onClick: () => { closeModal(); this.startMission(next, this.diff); } }] : [{ label: t("missions"), icon: "grid", primary: true, onClick: () => { closeModal(); this.exitTo("missions"); } }]),
        { label: t("replay"), icon: "restart", onClick: () => { closeModal(); this.startMission(this.missionId, this.diff); } },
        ...(next ? [{ label: t("missions"), icon: "grid", onClick: () => { closeModal(); this.exitTo("missions"); } }] : []),
      ],
    });
    this.onComplete && this.onComplete(result);
  }

  failMission(title, body) {
    if (this.ended) return;
    this.cleanupRun();
    this.pause();
    sfx.bad(); flash("bad", 1200);
    openModal({
      tone: "bad",
      tag: `${icon("x")} ${t("missionFailed")}`,
      title: tx(title) || title,
      body: `${typeof body === "string" ? body : `<p>${tx(body)}</p>`}<div class="learn"><b>${t("remember")}</b><p>${tx(this.text.learn)}</p></div>`,
      actions: [
        { label: t("retry"), icon: "restart", primary: true, onClick: () => { closeModal(); this.startMission(this.missionId, this.diff); } },
        { label: t("missions"), icon: "grid", onClick: () => { closeModal(); this.exitTo("missions"); } },
      ],
    });
  }
}

export function starsHtml(n) { return [1, 2, 3].map((i) => `<svg class="star ${i <= n ? "on" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z"/></svg>`).join(""); }
export function inRect(x, z, r, pad) { return x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad; }
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function toggleFullscreen() {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (_) {}
}
