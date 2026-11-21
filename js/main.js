// Boot: capability checks, menus and settings. The 3D code is loaded only after WebGL is confirmed.
import { t, tx, setLang, getLang, applyI18n } from "./i18n.js?v=7";
import { $, showScreen, openModal, closeModal, icon } from "./ui.js?v=7";
import { store } from "./storage.js?v=7";
import { MISSION_TEXT, MISSION_ORDER, COMPETENCIES, RANKS, VIOLATIONS } from "./content.js?v=7";

const settings = store.getSettings();
if (!settings.quality) settings.quality = matchMedia("(pointer:coarse)").matches ? "medium" : "high";
setLang(settings.lang || "ar");

let game = null;
let booted = false;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (_) { return false; }
}

function showError(err) {
  console.error(err);
  showScreen("s-error");
  $("#hud").hidden = true;
}
addEventListener("error", (e) => { if (!booted) showError(e.error || e.message); });
addEventListener("unhandledrejection", (e) => { if (!booted) showError(e.reason); });

function save() { store.saveSettings(settings); }

function renderHome() {
  document.querySelectorAll("[data-diff]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.diff === settings.difficulty));
  $("#diff-desc").textContent = t(settings.difficulty + "D");
  const prog = store.getProgress();
  const done = MISSION_ORDER.filter((id) => prog[id] && prog[id].done).length;
  $("#best").textContent = done ? t("missionsSub", { done, total: MISSION_ORDER.length, stars: MISSION_ORDER.reduce((s, id) => s + ((prog[id] && prog[id].stars) || 0), 0) }) : "";
  $("#lang-toggle span").textContent = getLang() === "ar" ? "English" : "العربية";
  const r = readiness();
  $("#readiness-mini").textContent = r.played ? `${r.overall}%` : "";
}

// ---------------- safety readiness profile ----------------
function readiness() {
  const prog = store.getProgress();
  const comps = COMPETENCIES.map((c) => {
    const played = c.missions.filter((id) => prog[id] && prog[id].done);
    const v = played.length ? Math.round(played.reduce((s, id) => s + prog[id].best, 0) / played.length) : null;
    return { ...c, v };
  });
  const overall = Math.round(comps.reduce((s, c) => s + (c.v || 0), 0) / comps.length);
  const done = MISSION_ORDER.filter((id) => prog[id] && prog[id].done).length;
  const stars = MISSION_ORDER.reduce((s, id) => s + ((prog[id] && prog[id].stars) || 0), 0);
  const rank = RANKS.filter((r) => overall >= r.min).pop();
  return { comps, overall, done, stars, rank, played: comps.some((c) => c.v != null), prog };
}

function radarSvg(comps) {
  const cx = 160, cy = 150, R = 92, n = comps.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const ring = (k) => comps.map((_, i) => pt(i, R * k).map((v) => v.toFixed(1)).join(",")).join(" ");
  const poly = comps.map((c, i) => pt(i, R * Math.max(.04, (c.v || 0) / 100)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const labels = comps.map((c, i) => {
    const [x, y] = pt(i, R + 16), anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}">${tx(c)}</text>`;
  }).join("");
  return `<svg class="pf-radar" viewBox="-70 0 460 300" role="img" aria-label="${t("competencies")}">
    ${[.25, .5, .75, 1].map((k) => `<polygon points="${ring(k)}" fill="none" stroke="rgba(192,198,206,.22)" stroke-width="1"/>`).join("")}
    ${comps.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(192,198,206,.18)"/>`; }).join("")}
    <polygon points="${poly}" fill="rgba(0,194,194,.28)" stroke="#00c2c2" stroke-width="2.2" stroke-linejoin="round"/>
    ${comps.map((c, i) => { const [x, y] = pt(i, R * Math.max(.04, (c.v || 0) / 100)); return c.v != null ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#00c2c2"/>` : ""; }).join("")}
    ${labels}</svg>`;
}

function renderProfile() {
  const r = readiness(), st = store.getStats();
  const weak = r.comps.filter((c) => c.v != null).sort((a, b) => a.v - b.v)[0];
  const next = MISSION_ORDER.find((id) => !(r.prog[id] && r.prog[id].done));
  const kinds = Object.entries(st.kinds || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const allDone = r.done === MISSION_ORDER.length;
  $("#pf-body").innerHTML = `
    <div class="pf-top">
      ${radarSvg(r.comps)}
      <div class="pf-score">
        <span class="field">${t("readiness")}</span>
        <div class="big">${r.overall}<small>%</small></div>
        <span class="pf-rank">${tx(r.rank)}</span>
        <p class="note">${t("missionsSub", { done: r.done, total: MISSION_ORDER.length, stars: r.stars })}</p>
        ${weak && weak.v < 90 ? `<p class="note">${t("weakest")}: <b>${tx(weak)}</b></p>` : ""}
      </div>
    </div>
    <div class="pf-section"><h3>${t("competencies")}</h3><ul class="pf-bars">
      ${r.comps.map((c) => `<li class="${c.v == null ? "none" : c.v < 70 ? "weak" : ""}"><span>${tx(c)}</span><b>${c.v == null ? `<small class="muted">${t("notPlayed")}</small>` : c.v + "%"}</b><div class="bar"><i style="width:${c.v || 0}%"></i></div></li>`).join("")}
    </ul></div>
    <div class="pf-section"><div class="pf-stats">
      <div><span>${t("runs")}</span><b>${st.runs}</b></div>
      <div><span>${t("mistakesTotal")}</span><b>${st.mistakes}</b></div>
      <div><span>${t("timeTotal")}</span><b>${Math.round(st.seconds / 60)}′</b></div>
    </div></div>
    <div class="pf-section"><h3>${t("topMistakes")}</h3>
      ${kinds.length ? `<ul class="loglist">${kinds.map(([k, n]) => `<li><span>${tx(VIOLATIONS[k] && VIOLATIONS[k].t) || k}</span><b>×${n}</b></li>`).join("")}</ul>` : `<p class="note">${t("noRuleBreaks")}</p>`}
    </div>
    <div class="pf-actions">
      ${next ? `<button class="btn primary" id="pf-next">${icon("play")}<span>${t("playNext")}: ${tx(MISSION_TEXT[next].name)}</span></button>` : ""}
      <h3 style="margin:8px 0 0">${t("certTitle")}</h3>
      ${allDone ? `<label class="field" for="pf-name">${t("certName")}</label><input class="pf-name" id="pf-name" maxlength="60" placeholder="${t("certNameP")}" value="${escapeHtml(store.getName())}">
        <button class="btn secondary" id="pf-cert">${icon("shield")}<span>${t("certPrint")}</span></button>` : `<p class="note">${t("certLocked", { n: MISSION_ORDER.length })}</p>`}
    </div>`;
  const nb = $("#pf-next"); if (nb) nb.addEventListener("click", () => startMission(next));
  const cb = $("#pf-cert"); if (cb) cb.addEventListener("click", () => { store.setName($("#pf-name").value.trim()); printCert(r); });
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

function printCert(r) {
  const name = escapeHtml(store.getName() || "—");
  const date = new Date().toLocaleDateString(getLang() === "ar" ? "ar-OM" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  $("#cert").innerHTML = `<div class="cert" dir="${getLang() === "ar" ? "rtl" : "ltr"}"><div class="frame"></div><div class="inner">
    <svg width="64" height="64" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3l18 10.5v21L24 45 6 34.5v-21z" fill="#0b2d4a" stroke="#00a8a8" stroke-width="2.5"/><path d="M15 31l9-16 9 16z" fill="none" stroke="#c0c6ce" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 22v4.5M24 28.8v.2" stroke="#f2a900" stroke-width="2.6" stroke-linecap="round"/></svg>
    <h1>ALU-SAFE <span>AR</span></h1>
    <p style="font-size:16pt;font-weight:700;letter-spacing:.04em">${t("certTitle")}</p>
    <div class="who">${name}</div>
    <p>${t("certBody", { n: MISSION_ORDER.length })}</p>
    <div class="meta"><div>${t("certScore")}<b>${r.overall}%</b></div><div>${t("certStars")}<b>${r.stars} / ${MISSION_ORDER.length * 3}</b></div><div>${t("certDate")}<b>${date}</b></div></div>
    <p class="disc">${t("certDisc")}</p></div></div>`;
  setTimeout(() => window.print(), 60);
}

// Mission select: locked, unlocked and completed states, saved in this browser.
function renderMissions() {
  const prog = store.getProgress();
  const unlockAll = new URLSearchParams(location.search).has("unlock");
  const done = MISSION_ORDER.filter((id) => prog[id] && prog[id].done).length;
  const stars = MISSION_ORDER.reduce((s, id) => s + ((prog[id] && prog[id].stars) || 0), 0);
  $("#ms-sub").textContent = t("missionsSub", { done, total: MISSION_ORDER.length, stars });
  document.querySelectorAll("#ms-diff [data-diff]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.diff === settings.difficulty));
  $("#ms-grid").innerHTML = MISSION_ORDER.map((id, i) => {
    const p = prog[id], prev = MISSION_ORDER[i - 1];
    const open = unlockAll || i === 0 || (prog[prev] && prog[prev].done);
    const state = p && p.done ? "done" : open ? "open" : "locked";
    const m = MISSION_TEXT[id];
    return `<li><button class="ms-card ${state}" data-id="${id}" ${open ? "" : "disabled"} aria-label="${tx(m.name)}">
      <span class="ms-num">${i + 1}</span>
      <span class="ms-body"><b>${tx(m.name)}</b><small>${state === "locked" ? t("lockedHint") : tx(m.short)}</small></span>
      <span class="ms-state">${state === "locked" ? `${icon("lock")}<em>${t("locked")}</em>` : state === "done" ? `<span class="stars">${starsHtml(p.stars)}</span><em>${t("bestScore", { n: p.best })}</em>` : `${icon("play")}<em>${t("playMission")}</em>`}</span>
    </button></li>`;
  }).join("");
  $("#ms-grid").querySelectorAll(".ms-card:not([disabled])").forEach((b) => b.addEventListener("click", () => startMission(b.dataset.id)));
}

async function startMission(id) {
  const { unlockAudio, setMuted } = await import("./audio.js?v=7");
  unlockAudio(); setMuted(settings.muted);
  showScreen(null);
  game.startMission(id, settings.difficulty);
}

function wireHome() {
  document.querySelectorAll("#s-home [data-diff]").forEach((b) => b.addEventListener("click", () => { settings.difficulty = b.dataset.diff; save(); renderHome(); }));
  document.querySelectorAll("#ms-diff [data-diff]").forEach((b) => b.addEventListener("click", () => { settings.difficulty = b.dataset.diff; save(); renderMissions(); }));
  $("#lang-toggle").addEventListener("click", () => { settings.lang = getLang() === "ar" ? "en" : "ar"; setLang(settings.lang); save(); renderHome(); });
  $("#btn-play").addEventListener("click", () => { renderMissions(); showScreen("s-missions"); });
  $("#ms-back").addEventListener("click", () => { renderHome(); showScreen("s-home"); });
  $("#btn-howto").addEventListener("click", openHowTo);
  $("#btn-settings").addEventListener("click", openSettings);
  $("#btn-ar").addEventListener("click", openAR);
  $("#btn-profile").addEventListener("click", () => { renderProfile(); showScreen("s-profile"); });
  $("#pf-back").addEventListener("click", () => { renderHome(); showScreen("s-home"); });
}

function openHowTo() {
  openModal({
    title: t("howto"),
    body: `<ul class="howto">
      <li>${icon("shield")}<span>${t("howGoal")}</span></li>
      <li>${icon("warn")}<span>${t("howRules")}</span></li>
      <li>${icon("help")}<span>${t("howChoice")}</span></li>
      <li>${icon("restart")}<span>${t("howReplay")}</span></li>
      <li>${icon("sound")}<span>${t("howSense")}</span></li>
      <li>${icon("hand")}<span>${t("howTouch")}</span></li>
      <li>${icon("gear")}<span>${t("howDesk")}</span></li></ul>`,
    actions: [{ label: t("close"), primary: true, onClick: () => closeModal() }],
  });
}

function seg(name, values, current) {
  return `<div class="seg-ctl" role="group" aria-label="${t(name)}">${values.map((v) => `<button data-${name}="${v}" aria-pressed="${v === current}">${t(v)}</button>`).join("")}</div>`;
}

function openSettings() {
  const box = openModal({
    title: t("settings"),
    body: `
      <label class="field">${t("language")}</label>
      <div class="seg-ctl" role="group"><button data-language="ar" aria-pressed="${getLang() === "ar"}">العربية</button><button data-language="en" aria-pressed="${getLang() === "en"}">English</button></div>
      <label class="field">${t("difficulty")}</label>${seg("difficulty", ["easy", "normal", "hard"], settings.difficulty)}
      <label class="field">${t("quality")}</label>${seg("quality", ["low", "medium", "high"], settings.quality)}
      <p class="note">${t("qualityD")}</p>
      <label class="field">${t("replaySet")}</label>${toggle("replay")}
      <label class="field">${t("senseSet")}</label>${toggle("sense")}
      <label class="field">${t("cineSet")}</label>${toggle("cinematics")}
      <label class="field">${t("audio")}</label>
      <div class="seg-ctl" role="group"><button data-muted="0" aria-pressed="${!settings.muted}">${icon("sound")}</button><button data-muted="1" aria-pressed="${settings.muted}">${icon("mute")}</button></div>
      <button class="btn secondary small" id="btn-reset">${icon("restart")}<span>${t("resetProgress")}</span></button>`,
    actions: [{ label: t("done"), primary: true, onClick: () => closeModal() }],
    onClose: () => { renderHome(); },
  });
  box.querySelectorAll("[data-language]").forEach((b) => b.addEventListener("click", () => { settings.lang = b.dataset.language; setLang(settings.lang); save(); closeModal(); openSettings(); }));
  box.querySelectorAll("[data-difficulty]").forEach((b) => b.addEventListener("click", () => { settings.difficulty = b.dataset.difficulty; save(); mark(box, "difficulty", b); }));
  box.querySelectorAll("[data-quality]").forEach((b) => b.addEventListener("click", () => { settings.quality = b.dataset.quality; save(); mark(box, "quality", b); game && game.applyQuality(); }));
  box.querySelectorAll("[data-tg]").forEach((b) => b.addEventListener("click", () => { settings[b.dataset.tg] = b.dataset.v === "1"; save(); box.querySelectorAll(`[data-tg="${b.dataset.tg}"]`).forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  box.querySelector("#btn-reset").addEventListener("click", () => { if (confirm(t("resetQ"))) { store.resetProgress(); closeModal(); } });
  box.querySelectorAll("[data-muted]").forEach((b) => b.addEventListener("click", async () => { settings.muted = b.dataset.muted === "1"; save(); mark(box, "muted", b); const a = await import("./audio.js?v=7"); a.setMuted(settings.muted); }));
}
function toggle(key) {
  const on = settings[key] !== false;
  return `<div class="seg-ctl" role="group"><button data-tg="${key}" data-v="1" aria-pressed="${on}">${t("on")}</button><button data-tg="${key}" data-v="0" aria-pressed="${!on}">${t("off")}</button></div>`;
}
function mark(box, name, btn) { box.querySelectorAll(`[data-${name}]`).forEach((x) => x.setAttribute("aria-pressed", x === btn)); }

// AR menu. Real AR (WebXR immersive-ar with hit-test) is offered only when the browser reports
// support; otherwise the camera simulation is offered and clearly labelled as a simulation.
async function openAR() {
  openModal({ title: t("arMode"), body: `<p class="muted">${t("arChecking")}</p>` });
  let xrOK = false;
  try { xrOK = !!(navigator.xr && window.isSecureContext && await navigator.xr.isSessionSupported("immersive-ar")); } catch (_) { xrOK = false; }
  const framed = window.self !== window.top;
  openModal({
    tag: icon("cube") + " " + t("arMode"),
    title: t("arPick"),
    body: `<div class="ar-modes">
        <button class="ar-mode ${xrOK ? "" : "off"}" id="m-xr" ${xrOK ? "" : "disabled"}>${icon("cube")}<b>${t("arReal")}</b><small>${t("arRealD")}</small>${xrOK ? `<em class="ok">${t("arChecked")}</em>` : ""}</button>
        <button class="ar-mode" id="m-cam">${icon("eye")}<b>${t("arSim")}</b><small>${t("arSimD")}</small></button>
      </div>
      ${xrOK ? "" : `<p class="note">${t("arNoXR")}</p>`}
      ${framed ? `<p class="note">${t("arFrame")}</p>` : ""}
      <div class="learn"><b>${t("remember")}</b><p>${t("camSafety")}</p></div>`,
    actions: [{ label: t("close"), onClick: () => closeModal() }],
  });
  if (xrOK) $("#m-xr").addEventListener("click", startXR);
  $("#m-cam").addEventListener("click", openCamera);
}

async function startXR() {
  // requestSession must run inside the tap, so the module was preloaded when the menu opened
  const xr = await xrModule;
  closeModal();
  import("./audio.js?v=7").then((a) => { a.unlockAudio(); a.setMuted(settings.muted); });
  game.mode = "ar";
  showScreen(null);
  xr.startXR({ renderer: game.renderer, game, onExit: () => { game.mode = "menu"; game.resize(); renderHome(); showScreen("s-home"); } })
    .catch((err) => { console.error(err); game.mode = "menu"; game.resize(); showScreen("s-home"); openModal({ title: t("arNoT"), body: `<p>${t("arNo")}</p>`, actions: [{ label: t("close"), primary: true, onClick: () => closeModal() }] }); });
}

async function openCamera() {
  let ar;
  try { ar = await import("./ar.js?v=7"); } catch (err) { showError(err); return; }
  const canCam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext;
  const framed = window.self !== window.top;
  openModal({
    tag: icon("eye") + " " + t("arSim"),
    title: t("camT"),
    body: `<p>${t("camIntro")}</p>
      <div class="learn"><b>${t("remember")}</b><p>${t("camSafety")}</p></div>
      <p class="note">${t("camHonest")}</p>
      <p class="note">${t("camPerm")}</p>
      ${!canCam || framed ? `<p class="note">${t("camNoCam")}</p>` : ""}`,
    actions: [
      { label: t("camStart"), icon: "play", primary: true, onClick: () => {
        // sensor permission must be requested synchronously inside the tap (iOS)
        const sensorAsk = ar.requestSensors();
        closeModal();
        import("./audio.js?v=7").then((a) => { a.unlockAudio(); a.setMuted(settings.muted); });
        showScreen(null);
        game.mode = "ar";
        ar.startCameraMode({ sensorAsk, onExit: () => { game.mode = "menu"; renderHome(); showScreen("s-home"); } })
          .catch((err) => { console.error(err); game.mode = "menu"; showScreen("s-home"); });
      } },
      { label: t("close"), onClick: () => closeModal() },
    ],
  });
}

let xrModule = null;

function starsHtml(n) { return [1, 2, 3].map((i) => `<svg class="star ${i <= n ? "on" : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z"/></svg>`).join(""); }

async function boot() {
  showScreen("s-loading");
  if (!hasWebGL()) { showScreen("s-unsupported"); return; }
  try {
    const { Game } = await import("./game.js?v=7");
    game = new Game($("#view"), settings);
    if (new URLSearchParams(location.search).has("test")) window.__game = game; // automated tests only
    game.onExit = (where) => { if (where === "missions") { renderMissions(); showScreen("s-missions"); } else { renderHome(); showScreen("s-home"); } };
    game.onContextLost = () => showError(new Error("WebGL context lost"));
    xrModule = import("./xr.js?v=7");
    wireHome();
    renderHome();
    booted = true;
    showScreen("s-home");
  } catch (err) {
    showError(err);
  }
}

$("#btn-reload").addEventListener("click", () => location.reload());
applyI18n();
boot();
