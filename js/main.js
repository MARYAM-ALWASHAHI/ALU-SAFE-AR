// Boot: capability checks, menus and settings. The 3D code is loaded only after WebGL is confirmed.
import { t, tx, setLang, getLang, applyI18n } from "./i18n.js";
import { $, showScreen, openModal, closeModal, icon } from "./ui.js";
import { store } from "./storage.js";
import { MISSION_TEXT, MISSION_ORDER } from "./content.js";

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
  const { unlockAudio, setMuted } = await import("./audio.js");
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
}

function openHowTo() {
  openModal({
    title: t("howto"),
    body: `<ul class="howto">
      <li>${icon("shield")}<span>${t("howGoal")}</span></li>
      <li>${icon("warn")}<span>${t("howRules")}</span></li>
      <li>${icon("help")}<span>${t("howChoice")}</span></li>
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
      <label class="field">${t("audio")}</label>
      <div class="seg-ctl" role="group"><button data-muted="0" aria-pressed="${!settings.muted}">${icon("sound")}</button><button data-muted="1" aria-pressed="${settings.muted}">${icon("mute")}</button></div>
      <button class="btn secondary small" id="btn-reset">${icon("restart")}<span>${t("resetProgress")}</span></button>`,
    actions: [{ label: t("done"), primary: true, onClick: () => closeModal() }],
    onClose: () => { renderHome(); },
  });
  box.querySelectorAll("[data-language]").forEach((b) => b.addEventListener("click", () => { settings.lang = b.dataset.language; setLang(settings.lang); save(); closeModal(); openSettings(); }));
  box.querySelectorAll("[data-difficulty]").forEach((b) => b.addEventListener("click", () => { settings.difficulty = b.dataset.difficulty; save(); mark(box, "difficulty", b); }));
  box.querySelectorAll("[data-quality]").forEach((b) => b.addEventListener("click", () => { settings.quality = b.dataset.quality; save(); mark(box, "quality", b); game && game.applyQuality(); }));
  box.querySelector("#btn-reset").addEventListener("click", () => { if (confirm(t("resetQ"))) { store.resetProgress(); closeModal(); } });
  box.querySelectorAll("[data-muted]").forEach((b) => b.addEventListener("click", async () => { settings.muted = b.dataset.muted === "1"; save(); mark(box, "muted", b); const a = await import("./audio.js"); a.setMuted(settings.muted); }));
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
  import("./audio.js").then((a) => { a.unlockAudio(); a.setMuted(settings.muted); });
  game.mode = "ar";
  showScreen(null);
  xr.startXR({ renderer: game.renderer, game, onExit: () => { game.mode = "menu"; game.resize(); renderHome(); showScreen("s-home"); } })
    .catch((err) => { console.error(err); game.mode = "menu"; game.resize(); showScreen("s-home"); openModal({ title: t("arNoT"), body: `<p>${t("arNo")}</p>`, actions: [{ label: t("close"), primary: true, onClick: () => closeModal() }] }); });
}

async function openCamera() {
  let ar;
  try { ar = await import("./ar.js"); } catch (err) { showError(err); return; }
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
        import("./audio.js").then((a) => { a.unlockAudio(); a.setMuted(settings.muted); });
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
    const { Game } = await import("./game.js");
    game = new Game($("#view"), settings);
    if (new URLSearchParams(location.search).has("test")) window.__game = game; // automated tests only
    game.onExit = (where) => { if (where === "missions") { renderMissions(); showScreen("s-missions"); } else { renderHome(); showScreen("s-home"); } };
    game.onContextLost = () => showError(new Error("WebGL context lost"));
    xrModule = import("./xr.js");
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
