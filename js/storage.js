// Storage layer. The demo keeps only non-sensitive preferences and an anonymous best score
// in this browser. To add accounts later, replace LocalStore with a class that talks to an
// authenticated API (same method names), and keep trainee data on the server only.

const KEY = "alusafe-ar:v1";

class LocalStore {
  _read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; }
  }
  _write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* private mode: ignore */ }
  }
  getSettings() {
    const s = this._read().settings || {};
    return { lang: s.lang || null, difficulty: s.difficulty || "easy", quality: s.quality || null, muted: !!s.muted };
  }
  saveSettings(settings) { const d = this._read(); d.settings = settings; this._write(d); }
  getBest(difficulty) { return (this._read().best || {})[difficulty] ?? null; }
  // Mission progress: { [missionId]: { done, best, stars, byDiff: { easy: score, … } } }
  getProgress() { return this._read().progress || {}; }
  recordMission(id, difficulty, score, stars) {
    const d = this._read(); d.progress = d.progress || {};
    const p = d.progress[id] || { done: false, best: 0, stars: 0, byDiff: {} };
    p.done = true; p.best = Math.max(p.best, score); p.stars = Math.max(p.stars, stars);
    p.byDiff[difficulty] = Math.max(p.byDiff[difficulty] || 0, score);
    d.progress[id] = p; this._write(d);
  }
  resetProgress() { const d = this._read(); delete d.progress; this._write(d); }
  // Called once per finished run. A server version would also record the attempt.
  recordRun({ difficulty, score }) {
    const d = this._read(); d.best = d.best || {};
    if (d.best[difficulty] == null || score > d.best[difficulty]) d.best[difficulty] = score;
    this._write(d);
  }
}

export const store = new LocalStore();
