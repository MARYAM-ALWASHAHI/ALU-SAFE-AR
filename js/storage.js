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
    return { lang: s.lang || null, difficulty: s.difficulty || "easy", quality: s.quality || null, muted: !!s.muted,
      replay: s.replay !== false, sense: s.sense !== false, cinematics: s.cinematics !== false };
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
  resetProgress() { const d = this._read(); delete d.progress; delete d.stats; this._write(d); }
  // Anonymous training statistics for the readiness profile: runs, mistakes and rule breaks by kind.
  recordStats(id, { kinds = {}, mistakes = 0, seconds = 0 }) {
    const d = this._read(); d.stats = d.stats || { runs: 0, mistakes: 0, seconds: 0, kinds: {} };
    const st = d.stats;
    st.runs++; st.mistakes += mistakes; st.seconds += seconds;
    for (const k in kinds) st.kinds[k] = (st.kinds[k] || 0) + kinds[k];
    this._write(d);
  }
  getStats() { return this._read().stats || { runs: 0, mistakes: 0, seconds: 0, kinds: {} }; }
  // Name printed on the certificate. Stays in this browser only.
  getName() { return this._read().name || ""; }
  setName(n) { const d = this._read(); d.name = String(n).slice(0, 60); this._write(d); }
  // Called once per finished run. A server version would also record the attempt.
  recordRun({ difficulty, score }) {
    const d = this._read(); d.best = d.best || {};
    if (d.best[difficulty] == null || score > d.best[difficulty]) d.best[difficulty] = score;
    this._write(d);
  }
}

export const store = new LocalStore();
