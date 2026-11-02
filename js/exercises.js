// ── InOut · exercises.js ──────────────────────────────────────────────────────
// Pre-loaded exercise library with MET-based calorie calculation

const Exercises = (() => {

  // MET (Metabolic Equivalent of Task) values – industry standard
  const LIBRARY = [
    { id: 'walking',       name: 'Walking',         icon: '🚶',  met: 3.5,  color: '#4CAF50' },
    { id: 'running',       name: 'Running',          icon: '🏃',  met: 9.8,  color: '#FF5722' },
    { id: 'cycling',       name: 'Cycling',          icon: '🚴',  met: 7.5,  color: '#2196F3' },
    { id: 'swimming',      name: 'Swimming',         icon: '🏊',  met: 8.0,  color: '#00BCD4' },
    { id: 'jumprope',      name: 'Jump Rope',        icon: '🪢',  met: 11.8, color: '#9C27B0' },
    { id: 'hiit',          name: 'HIIT',             icon: '🔥',  met: 10.5, color: '#F44336' },
    { id: 'yoga',          name: 'Yoga',             icon: '🧘',  met: 2.5,  color: '#8BC34A' },
    { id: 'weights',       name: 'Weight Training',  icon: '🏋️', met: 5.0,  color: '#607D8B' },
    { id: 'elliptical',    name: 'Elliptical',       icon: '⭕',  met: 6.5,  color: '#FF9800' },
    { id: 'dancing',       name: 'Dancing',          icon: '💃',  met: 4.8,  color: '#E91E63' },
    { id: 'hiking',        name: 'Hiking',           icon: '🥾',  met: 6.0,  color: '#795548' },
    { id: 'rowing',        name: 'Rowing',           icon: '🚣',  met: 8.5,  color: '#3F51B5' },
    { id: 'pilates',       name: 'Pilates',          icon: '🤸',  met: 3.0,  color: '#FF4081' },
    { id: 'basketball',    name: 'Basketball',       icon: '🏀',  met: 6.5,  color: '#FF6D00' },
    { id: 'football',      name: 'Football',         icon: '⚽',  met: 7.0,  color: '#1B5E20' },
    { id: 'tennis',        name: 'Tennis',           icon: '🎾',  met: 7.3,  color: '#827717' },
    { id: 'climbing',      name: 'Rock Climbing',    icon: '🧗',  met: 8.0,  color: '#4E342E' },
    { id: 'boxing',        name: 'Boxing',           icon: '🥊',  met: 9.0,  color: '#B71C1C' },
    { id: 'cycling_stat',  name: 'Stationary Bike',  icon: '🚵',  met: 6.8,  color: '#0D47A1' },
    { id: 'stretching',    name: 'Stretching',       icon: '🤾',  met: 2.3,  color: '#00897B' },
  ];

  /**
   * Calculate calories burned
   * Formula: Calories = MET × weight(kg) × time(hours)
   *
   * @param {string} exerciseId
   * @param {number} minutes
   * @param {number} weightKg
   * @returns {number} calories burned (rounded)
   */
  function calcCalories(exerciseId, minutes, weightKg = 70) {
    const ex = LIBRARY.find(e => e.id === exerciseId);
    if (!ex) return 0;
    return Math.round(ex.met * weightKg * (minutes / 60));
  }

  function getAll() { return LIBRARY; }

  function getById(id) { return LIBRARY.find(e => e.id === id) || null; }

  return { LIBRARY, calcCalories, getAll, getById };
})();
