// ── InOut · store.js ─────────────────────────────────────────────────────────
// localStorage abstraction – all data lives here
// Keys: inout_log  (daily entries), inout_settings (user profile)

const Store = (() => {
  const LOG_KEY      = 'inout_log';
  const SETTINGS_KEY = 'inout_settings';
  const MAX_MONTHS   = 6; // keep 6 months of history

  // ── helpers ────────────────────────────────────────────────────────────────
  function today() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── log CRUD ───────────────────────────────────────────────────────────────
  function getLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; }
    catch { return {}; }
  }

  function saveLog(log) {
    // Prune entries older than MAX_MONTHS
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - MAX_MONTHS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const date of Object.keys(log)) {
      if (date < cutoffStr) delete log[date];
    }
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }

  function getDayLog(date = today()) {
    const log = getLog();
    if (!log[date]) log[date] = { in: [], out: [] };
    return log[date];
  }

  function addFoodEntry(entry, date = today()) {
    const log = getLog();
    if (!log[date]) log[date] = { in: [], out: [] };
    log[date].in.push({ id: uid(), time: new Date().toISOString(), ...entry });
    saveLog(log);
  }

  function addExerciseEntry(entry, date = today()) {
    const log = getLog();
    if (!log[date]) log[date] = { in: [], out: [] };
    log[date].out.push({ id: uid(), time: new Date().toISOString(), ...entry });
    saveLog(log);
  }

  function removeFoodEntry(id, date = today()) {
    const log = getLog();
    if (log[date]) {
      log[date].in = (log[date].in || []).filter(e => e.id !== id);
      saveLog(log);
    }
  }

  function removeExerciseEntry(id, date = today()) {
    const log = getLog();
    if (log[date]) {
      log[date].out = (log[date].out || []).filter(e => e.id !== id);
      saveLog(log);
    }
  }

  // ── day totals ─────────────────────────────────────────────────────────────
  function getDayTotals(date = today()) {
    const day = getDayLog(date);
    const inCal  = (day.in  || []).reduce((s, e) => s + (e.calories || 0), 0);
    const outCal = (day.out || []).reduce((s, e) => s + (e.calories || 0), 0);
    return { in: Math.round(inCal), out: Math.round(outCal), net: Math.round(inCal - outCal) };
  }

  // Returns map of date→net for calendar rendering
  function getMonthSummary(year, month) {
    const log = getLog();
    const result = {};
    for (const [date, day] of Object.entries(log)) {
      const [y, m] = date.split('-').map(Number);
      if (y === year && m === month) {
        const inCal  = (day.in  || []).reduce((s, e) => s + (e.calories || 0), 0);
        const outCal = (day.out || []).reduce((s, e) => s + (e.calories || 0), 0);
        result[date] = Math.round(inCal - outCal);
      }
    }
    return result;
  }

  // ── settings ───────────────────────────────────────────────────────────────
  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || defaultSettings();
    } catch { return defaultSettings(); }
  }

  function defaultSettings() {
    return {
      name: '',
      age: '',
      gender: 'other',
      weightKg: 70,
      heightCm: 170,
      activityLevel: 'moderate',
      dailyGoal: 2000, // kcal net target (will be overridden by TDEE calc)
      apiKey: ''       // AI API key (xAI / Grok or Groq) stored only in localStorage
    };
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  // Calculate TDEE using Mifflin-St Jeor + activity multiplier
  function calcTDEE(s) {
    const w = parseFloat(s.weightKg) || 70;
    const h = parseFloat(s.heightCm) || 170;
    const a = parseInt(s.age) || 25;
    let bmr;
    if (s.gender === 'male')        bmr = 10 * w + 6.25 * h - 5 * a + 5;
    else if (s.gender === 'female') bmr = 10 * w + 6.25 * h - 5 * a - 161;
    else                            bmr = 10 * w + 6.25 * h - 5 * a - 78;  // avg

    const factors = {
      sedentary:  1.2,
      light:      1.375,
      moderate:   1.55,
      active:     1.725,
      veryActive: 1.9
    };
    return Math.round(bmr * (factors[s.activityLevel] || 1.55));
  }

  // ── clear all ──────────────────────────────────────────────────────────────
  function clearAll() {
    localStorage.removeItem(LOG_KEY);
  }

  return {
    today,
    getLog,
    getDayLog,
    getDayTotals,
    getMonthSummary,
    addFoodEntry,
    addExerciseEntry,
    removeFoodEntry,
    removeExerciseEntry,
    getSettings,
    saveSettings,
    calcTDEE,
    clearAll
  };
})();
