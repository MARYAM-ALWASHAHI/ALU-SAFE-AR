// Game loop, missions, scoring and HUD.
import * as THREE from "./vendor/three.module.min.js";
import { buildWorld, ZONES } from "./world.js";
import { Player } from "./player.js";
import { MISSIONS, PPE_ITEMS, VIOLATIONS, DIFFICULTY, SCORING, CONTENT_META } from "./content.js";
import { t, tx, getLang } from "./i18n.js";
import { $, icon, ppeArt, openModal, closeModal, modalOpen, toast, flash, fmtTime } from "./ui.js";
import { sfx, startAlarm, stopAlarm } from "./audio.js";
import { store } from "./storage.js";

const QUALITY = {
  low: { ratio: 1, shadows: false },
  medium: { ratio: 1.5, shadows: false },
  high: { ratio: 2, shadows: true },
};

export class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 160);
    this.player = new Player(this.camera, canvas);
    this.player.onInteract = () => this.interact();
    this.player.onPause = () => this.togglePause();
    this.player.bindStick($("#stick"), $("#stick .knob"));
    $("#btn-interact").addEventListener("click", () => this.interact());
    $("#btn-pause").addEventListener("click", () => this.togglePause());
    this.clock = new THREE.Clock();
    this.mode = "menu";            // menu | play | done
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
    this.renderer.shadowMap.enabled = q.shadows;
    this.resize();
  }

  buildScene() {
    if (this.scene) this.scene.traverse((o) => { o.geometry && o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { m.map && m.map.dispose(); m.dispose(); }); });
    const q = QUALITY[this.settings.quality] || QUALITY.medium;
    this.applyQuality();
    this.scene = new THREE.Scene();
    this.world = buildWorld(this.scene, { shadows: q.shadows });
    this.world.setMarker(null, false);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 78 : 66;    // wider view in portrait
    this.camera.updateProjectionMatrix();
  }

  // ---------------- run lifecycle ----------------
  start(difficulty) {
    this.buildScene();
    MISSIONS.forEach((m) => { delete m._order; delete m._tried; });
    this._ppeSel = null;
    this.diff = difficulty;
    this.cfg = DIFFICULTY[difficulty];
    this.world.crane.state.speed = this.cfg.craneSpeed;
    this.world.crane.showDanger(this.cfg.showDanger);
    this.idx = 0;
    this.stage = "go";            // go | active | evac
    this.results = MISSIONS.map(() => ({ tries: 0, violations: 0, score: 0, done: false, timeout: false }));
    this.elapsed = 0;
    this.evacLeft = 0;
    this.violationCooldown = 0;
    this.fireOn = false;
    this.player.place(-37.5, 8.5, -Math.PI / 2);
    this.mode = "play";
    $("#hud").hidden = false;
    $("#sample-banner").hidden = CONTENT_META.approved;
    this.renderTracker();
    this.updateObjective();
    this.resume();
    if (matchMedia("(pointer:coarse)").matches && innerWidth < innerHeight && innerWidth < 600) toast(t("rotate"), 3800);
    else if (matchMedia("(pointer:fine)").matches) toast(t("lookTip"), 4200);
  }

  pause() { this.player.enabled = false; this.player.releaseInput(); }
  resume() { if (this.mode === "play") { this.player.enabled = true; this.clock.getDelta(); } }

  togglePause() {
    if (this.mode !== "play") return;
    if (modalOpen()) { if (this._pauseOpen) { closeModal(); } return; }
    this.pause();
    this._pauseOpen = true;
    const fsOK = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    openModal({
      title: t("paused"),
      body: `<p class="muted">${t("missionOf", { n: Math.min(this.idx + 1, MISSIONS.length), total: MISSIONS.length })} · ${tx(MISSIONS[Math.min(this.idx, MISSIONS.length - 1)].name)}</p>`,
      actions: [
        { label: t("resume"), icon: "play", primary: true, onClick: () => closeModal() },
        ...(fsOK ? [{ label: t("fullscreen"), icon: "expand", onClick: () => { toggleFullscreen(); closeModal(); } }] : []),
        { label: t("restart"), icon: "restart", onClick: () => { this._pauseOpen = false; closeModal(); this.cleanupRun(); this.start(this.diff); } },
        { label: t("menu"), icon: "home", onClick: () => { this._pauseOpen = false; closeModal(); this.exitToMenu(); } },
      ],
      onClose: () => { this._pauseOpen = false; this.resume(); },
    });
  }

  cleanupRun() { stopAlarm(); this.world.setFire(false); }

  exitToMenu() {
    this.cleanupRun();
    this.mode = "menu";
    this.pause();
    $("#hud").hidden = true;
    this.buildScene();
    this.onExit && this.onExit();
  }

  // ---------------- per-frame ----------------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.mode === "ar") return;   // camera mode renders on its own canvas
    if (this.mode === "menu" || this.mode === "done") {
      // slow fly-through behind the menu
      const tt = performance.now() / 1000 * 0.06;
      this.camera.position.set(-12 + Math.sin(tt) * 14, 5.5, 9 + Math.cos(tt * 1.3) * 2);
      this.camera.lookAt(6 + Math.sin(tt * .7) * 8, 2.2, -6);
      this.world.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const active = this.player.enabled;
    if (active) this.elapsed += dt;
    this.player.update(dt, this.world.colliders);
    this.world.update(active ? dt : dt * 0.15);
    if (active) this.tick(dt);
    if (this.shake > 0) {
      this.shake -= dt;
      const s = this.shake * 0.12;
      this.camera.position.x += (Math.random() - .5) * s; this.camera.position.y += (Math.random() - .5) * s;
    }
    this.renderer.render(this.scene, this.camera);
    this.updateCompass();
  }

  tick(dt) {
    const p = this.player, m = MISSIONS[this.idx];
    if (!m) return;
    this.violationCooldown -= dt;

    // global safety rules
    if (this.violationCooldown <= 0) {
      const cz = this.world.crane.zone();
      if (inRect(p.x, p.z, cz, 0.3)) return this.violation("crane");
      if (inRect(p.x, p.z, ZONES.restricted, 0)) return this.violation("restricted");
      if (this.fireOn && Math.hypot(p.x - ZONES.fire.x, p.z - ZONES.fire.z) < ZONES.fire.r) return this.violation("fire");
    }

    // crane warning when close to the load footprint
    const cz = this.world.crane.zone();
    const near = inRect(p.x, p.z, cz, 2.2);
    if (near && !this._craneWarned) { this._craneWarned = true; sfx.horn(); }
    if (!near) this._craneWarned = false;

    if (this.stage === "evac") {
      this.evacLeft -= dt;
      $("#timer-val").textContent = fmtTime(Math.max(0, this.evacLeft));
      $("#timer").classList.toggle("low", this.evacLeft < 20);
      if (this.evacLeft <= 0) return this.evacTimeout();
    }

    const dist = (pt) => Math.hypot(p.x - pt.x, p.z - pt.z);
    // reach-type targets
    if ((m.type === "reach" && this.stage === "active") || (m.type === "evac" && this.stage === "evac")) {
      if (dist(m.target) < m.target.r) return this.completeMission();
    }
    // start points
    const atStart = this.stage === "go" && dist(m.at) < m.at.r;
    if (atStart && (m.type === "reach")) return this.openBrief(m);
    const canInteract = atStart && (m.type === "choice" || m.type === "ppe");
    $("#btn-interact").hidden = !canInteract;
    $("#hint-e").hidden = !canInteract || !matchMedia("(pointer:fine)").matches;
  }

  interact() {
    if (this.mode !== "play" || !this.player.enabled || $("#btn-interact").hidden) return;
    const m = MISSIONS[this.idx];
    $("#btn-interact").hidden = true; $("#hint-e").hidden = true;
    sfx.click();
    if (m.type === "ppe") this.openPPE(m);
    else this.openChoice(m);
  }

  // ---------------- objective + HUD ----------------
  currentTarget() {
    const m = MISSIONS[this.idx];
    if (!m) return null;
    if ((m.type === "reach" && this.stage === "active") || this.stage === "evac") return m.target;
    return m.at;
  }

  updateObjective() {
    const m = MISSIONS[this.idx];
    if (!m) return;
    $("#obj-step").textContent = t("missionOf", { n: this.idx + 1, total: MISSIONS.length });
    let text = tx(m.objective);
    if (m.type === "reach" && this.stage === "active") text = tx(m.objective);
    if (this.stage === "evac") text = t("evacGo");
    $("#obj-text").textContent = text;
    $("#timer").hidden = this.stage !== "evac";
    this.world.setMarker(this.currentTarget(), this.cfg.showMarkers);
    this.renderTracker();
    $("#score-val").textContent = this.totalScore();
  }

  renderTracker() {
    $("#tracker").innerHTML = MISSIONS.map((m, i) => {
      const r = this.results ? this.results[i] : null;
      const cls = r && r.done ? "done" : i === this.idx ? "cur" : "";
      return `<span class="seg ${cls}" title="${tx(m.name)}"></span>`;
    }).join("");
  }

  updateCompass() {
    const c = $("#compass");
    if (this.mode !== "play" || !this.cfg || !this.cfg.showArrow) { c.hidden = true; return; }
    const tg = this.currentTarget();
    if (!tg) { c.hidden = true; return; }
    const p = this.player;
    const dx = tg.x - p.x, dz = tg.z - p.z;
    const d = Math.hypot(dx, dz);
    c.hidden = false;
    const targetYaw = Math.atan2(-dx, -dz);
    let rel = targetYaw - p.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    $("#compass .arrow").style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`;
    $("#compass-d").textContent = `${Math.round(d)} ${t("m")}`;
  }

  totalScore() { return this.results.reduce((s, r) => s + r.score, 0); }

  // ---------------- missions ----------------
  openBrief(m) {
    this.pause();
    sfx.click();
    openModal({
      tag: `${t("missionOf", { n: this.idx + 1, total: MISSIONS.length })}`,
      title: tx(m.name),
      body: `<p>${tx(m.brief)}</p>`,
      actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }],
      onClose: () => { this.stage = "active"; this.updateObjective(); this.resume(); },
    });
  }

  openChoice(m) {
    this.pause();
    const r = this.results[this.idx];
    m._order = m._order || shuffle(m.opts.map((_, i) => i));
    m._tried = m._tried || [];
    const keys = getLang() === "ar" ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"];
    const box = openModal({
      tag: `${icon("warn")} ${tx(m.name)}`,
      title: t("whatDo"),
      body: `<p>${tx(m.q)}</p><div class="opts">${m._order.map((k, n) =>
        `<button class="opt ${m._tried.includes(k) ? "tried" : ""}" data-k="${k}" ${m._tried.includes(k) ? "disabled" : ""}><span class="key">${keys[n]}</span><span>${tx(m.opts[k].t)}</span></button>`).join("")}</div>`,
    });
    box.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      const k = +b.dataset.k, o = m.opts[k];
      r.tries++;
      closeModal();
      this.playFx(o.fx, !!o.ok, m);
      setTimeout(() => this.showOutcome(m, o, k), o.ok ? 700 : 1500);
    }));
  }

  playFx(kind, ok, m) {
    if (ok) {
      sfx.good(); flash("good", 900);
      if (m.id === "house") this.world.clearWalkway();
      if (m.id === "molten") this.world.fixLeak();
      return;
    }
    sfx.bad();
    if (kind === "steam") { this.world.steamBurst(); flash("steam", 1600); this.shake = .6; }
    else if (kind === "trip") { flash("bad", 900); this.shake = .7; this.player.pitch = -0.6; }
    else if (kind === "smoke") { flash("smoke", 1600); }
    else flash("bad", 900);
  }

  showOutcome(m, o, k) {
    const r = this.results[this.idx];
    if (o.ok) {
      r.score = Math.max(SCORING.minimum, scoreFor(r.tries) - r.violations * SCORING.violationPenalty);
      openModal({
        tone: "good",
        tag: `${icon("check")} ${t("rightT")}`,
        title: tx(m.name),
        body: `<p>${tx(o.r)}</p><div class="learn"><b>${t("remember")}</b><p>${tx(m.learn)}</p></div>`,
        actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }],
        onClose: () => {
          if (m.type === "evac") this.beginEvac();
          else this.completeMission(true);
        },
      });
    } else {
      m._tried.push(k);
      openModal({
        tone: "bad",
        tag: `${icon("x")} ${t("wrongT")}`,
        title: tx(o.t),
        body: `<p>${tx(o.r)}</p>`,
        actions: [{ label: t("tryAgain"), primary: true, onClick: () => { closeModal(); this.openChoice(m); } }],
      });
    }
  }

  openPPE(m) {
    this.pause();
    const r = this.results[this.idx];
    const sel = this._ppeSel || (this._ppeSel = new Set());
    const box = openModal({
      wide: true,
      tag: `${icon("shield")} ${tx(m.name)}`,
      title: t("ppeT"),
      body: `<p>${t("ppeQ")}</p>
        <div class="ppe">${PPE_ITEMS.map((it) => `<button class="ppe-item ${sel.has(it.id) ? "on" : ""}" data-id="${it.id}" aria-pressed="${sel.has(it.id)}">${ppeArt(it.id)}<span>${tx(it)}</span><i>${icon("check")}</i></button>`).join("")}</div>
        <p class="note">${t("ppeSample")}</p>`,
      actions: [{ label: t("ppeCheck"), primary: true, onClick: () => check() }],
    });
    box.querySelectorAll(".ppe-item").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.id;
      sel.has(id) ? sel.delete(id) : sel.add(id);
      b.classList.toggle("on", sel.has(id)); b.setAttribute("aria-pressed", sel.has(id));
      sfx.click();
    }));
    const check = () => {
      r.tries++;
      const missing = PPE_ITEMS.filter((it) => it.need && !sel.has(it.id));
      const wrong = PPE_ITEMS.filter((it) => !it.need && sel.has(it.id));
      closeModal();
      if (!missing.length && !wrong.length) {
        sfx.good(); flash("good", 900);
        r.score = scoreFor(r.tries);
        openModal({
          tone: "good", tag: `${icon("check")} ${t("ppeOkT")}`, title: tx(m.name),
          body: `<p>${t("ppeOk")}</p><div class="learn"><b>${t("remember")}</b><p>${tx(m.learn)}</p></div>`,
          actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }],
          onClose: () => this.completeMission(true),
        });
      } else {
        sfx.bad(); flash("bad", 700);
        openModal({
          tone: "bad", tag: `${icon("x")} ${t("wrongT")}`, title: t("ppeT"),
          body: `${missing.length ? `<h3>${t("ppeMissing")}</h3><ul>${missing.map((it) => `<li>${tx(it)}</li>`).join("")}</ul>` : ""}
                 ${wrong.length ? `<h3>${t("ppeWrong")}</h3><ul>${wrong.map((it) => `<li><b>${tx(it)}</b>: ${tx(it.why)}</li>`).join("")}</ul>` : ""}`,
          actions: [{ label: t("tryAgain"), primary: true, onClick: () => { closeModal(); this.openPPE(m); } }],
        });
      }
    };
  }

  completeMission(alreadyScored) {
    const m = MISSIONS[this.idx], r = this.results[this.idx];
    if (!alreadyScored) {
      r.score = Math.max(SCORING.minimum, SCORING.perMission - r.violations * SCORING.violationPenalty);
      if (r.timeout) r.score = SCORING.minimum;
    }
    r.done = true;
    if (m.type === "reach" || m.type === "evac") {
      this.pause();
      sfx.good(); flash("good", 900);
      openModal({
        tone: "good",
        tag: `${icon("check")} ${t("objectiveDone")}`,
        title: tx(m.name),
        body: `<div class="learn"><b>${t("remember")}</b><p>${tx(m.learn)}</p></div>`,
        actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }],
        onClose: () => this.next(),
      });
    } else this.next();
  }

  next() {
    this.idx++;
    this.stage = "go";
    if (this.idx >= MISSIONS.length) return this.finish();
    const m = MISSIONS[this.idx];
    this.updateObjective();
    if (m.type === "evac") return this.triggerEmergency(m);
    this.resume();
  }

  triggerEmergency(m) {
    this.pause();
    this.fireOn = true;
    this.world.setFire(true);
    this.world.crane.state.active = false;
    startAlarm();
    flash("alarm", 2000);
    setTimeout(() => this.openChoice(m), 1200);
  }

  beginEvac() {
    const m = MISSIONS[this.idx], r = this.results[this.idx];
    r.choiceScore = scoreFor(r.tries);
    this.stage = "evac";
    this.evacLeft = this.cfg.evacSeconds;
    this.updateObjective();
    this.resume();
  }

  evacTimeout() {
    const r = this.results[this.idx];
    r.timeout = true;
    this.pause(); sfx.bad();
    openModal({
      tone: "bad", tag: `${icon("x")} ${t("timeUpT")}`, title: tx(MISSIONS[this.idx].name),
      body: `<p>${t("timeUp")}</p>`,
      actions: [{ label: t("cont"), primary: true, onClick: () => closeModal() }],
      onClose: () => { r.score = SCORING.minimum; r.done = true; this.finish(); },
    });
  }

  violation(kind) {
    const v = VIOLATIONS[kind], p = this.player, r = this.results[this.idx];
    r.violations++;
    this.violationCooldown = 1.5;
    this.pause(); sfx.bad(); if (kind === "crane") sfx.horn();
    flash("bad", 900); this.shake = .4;
    if (kind === "crane") this.world.crane.state.wait = Math.max(this.world.crane.state.wait, 2.5);
    openModal({
      tone: "bad",
      tag: `${icon("warn")} ${t("violation")}`,
      title: tx(v.t),
      body: `<p>${tx(v.r)}</p><p class="muted">−${SCORING.violationPenalty} ${t("score")}</p>`,
      actions: [{ label: t("stepBack"), primary: true, onClick: () => closeModal() }],
      onClose: () => { this.stepToSafety(kind); this.resume(); },
    });
    $("#score-val").textContent = this.totalScore();
  }

  stepToSafety(kind) {
    const p = this.player;
    if (kind === "crane") {
      const z = this.world.crane.zone();
      p.z = Math.abs(p.z - z.minZ) < Math.abs(p.z - z.maxZ) ? z.minZ - 0.9 : z.maxZ + 0.9;
      if (p.z < ZONES.restricted.maxZ && p.x > ZONES.restricted.minX && p.x < ZONES.restricted.maxX) p.z = z.maxZ + 0.9;
    } else if (kind === "restricted") {
      p.z = ZONES.restricted.maxZ + 0.9;
    } else if (kind === "fire") {
      const dx = p.x - ZONES.fire.x, dz = p.z - ZONES.fire.z, d = Math.hypot(dx, dz) || 1;
      p.x = ZONES.fire.x + dx / d * (ZONES.fire.r + 1.2); p.z = ZONES.fire.z + dz / d * (ZONES.fire.r + 1.2);
    }
    p.pitch = -0.05;
  }

  // ---------------- results ----------------
  finish() {
    const evac = this.results[MISSIONS.length - 1];
    if (!evac.timeout && evac.choiceScore != null) {
      evac.score = Math.max(SCORING.minimum, evac.choiceScore - evac.violations * SCORING.violationPenalty);
    }
    this.cleanupRun();
    this.mode = "done";
    this.pause();
    $("#hud").hidden = true;
    const total = this.totalScore();
    store.recordRun({ difficulty: this.diff, score: total });
    this.onFinish && this.onFinish({ total, results: this.results, elapsed: this.elapsed, diff: this.diff });
  }
}

function inRect(x, z, r, pad) { return x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad; }
function scoreFor(tries) { return tries <= 1 ? SCORING.perMission : tries === 2 ? SCORING.secondTry : SCORING.laterTry; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function toggleFullscreen() {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (_) {}
}
