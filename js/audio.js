// Short synthesised cues (no audio files). Starts only after a user gesture.
let ctx = null;
let alarmTimer = null;
export let muted = false;

export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch (_) { ctx = null; }
}

export function setMuted(m) { muted = m; if (m) stopAlarm(); }

function tone(freq, dur, type = "sine", vol = 0.12, when = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}

export const sfx = {
  good() { tone(660, .18, "triangle"); tone(880, .25, "triangle", .12, .12); },
  bad() { tone(220, .35, "sawtooth", .08); tone(170, .4, "sawtooth", .08, .15); },
  horn() { tone(330, .6, "square", .07); tone(392, .6, "square", .05); },
  click() { tone(520, .06, "triangle", .06); },
};

export function startAlarm() {
  stopAlarm();
  if (!ctx || muted) return;
  let hi = false;
  alarmTimer = setInterval(() => { hi = !hi; tone(hi ? 880 : 660, .45, "square", .05); }, 500);
}
export function stopAlarm() { if (alarmTimer) clearInterval(alarmTimer); alarmTimer = null; }
