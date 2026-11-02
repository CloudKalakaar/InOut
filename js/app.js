// ── InOut · app.js ────────────────────────────────────────────────────────────
// Main application controller — routing, view rendering, event handling

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────────
  let activeView     = 'dashboard';
  let activeTab      = 'in'; // 'in' | 'out'
  let activeFoodMode = 'text'; // 'text' | 'photo'
  let pendingAI      = null;  // pending AI result before user confirms

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('[SW] Registered'))
        .catch(e => console.warn('[SW] Registration failed:', e));
    }

    // Bootstrap settings if first run
    const s = Store.getSettings();
    if (!s.name) {
      // Show settings on first launch
      setTimeout(() => navigateTo('settings'), 300);
    }

    renderBottomNav();
    navigateTo('dashboard');
    bindGlobalEvents();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navigateTo(view) {
    activeView = view;

    // Update bottom nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    // Render view
    const main = document.getElementById('main-content');
    switch (view) {
      case 'dashboard': main.innerHTML = renderDashboard(); postRenderDashboard(); break;
      case 'log-in':    main.innerHTML = renderLogIn();     postRenderLogIn();     break;
      case 'log-out':   main.innerHTML = renderLogOut();    postRenderLogOut();    break;
      case 'settings':  main.innerHTML = renderSettings();  postRenderSettings();  break;
    }
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  function renderDashboard() {
    const { in: inCal, out: outCal, net } = Store.getDayTotals();
    const settings = Store.getSettings();
    const goal     = settings.dailyGoal || Store.calcTDEE(settings) || 2000;
    const deficit  = outCal - inCal; // positive = burned more than ate (good)
    const netClass = net <= 0 ? 'net-good' : 'net-bad';

    // Goal progress
    const goalPct    = Math.min(100, Math.round((inCal / goal) * 100));
    const goalStatus = inCal <= goal ? 'on-track' : 'over';

    return `
      <div class="view dashboard-view">

        <!-- Header -->
        <div class="dash-header">
          <img src="./file_000000006c20820bbf1241cf786592e2.png" alt="InOut" class="dash-logo">
          <div class="dash-greeting">
            <span class="greeting-sub">Today's Balance</span>
            <span class="net-cal ${netClass}">${net > 0 ? '+' : ''}${net} <span class="net-unit">kcal</span></span>
          </div>
        </div>

        <!-- Stats row -->
        <div class="stats-row">
          <div class="stat-card stat-in">
            <span class="stat-icon">🍎</span>
            <span class="stat-label">IN</span>
            <span class="stat-val">${inCal.toLocaleString()}</span>
            <span class="stat-unit">kcal</span>
          </div>
          <div class="stat-divider">
            <div class="flame-icon">🔥</div>
          </div>
          <div class="stat-card stat-out">
            <span class="stat-icon">🏃</span>
            <span class="stat-label">OUT</span>
            <span class="stat-val">${outCal.toLocaleString()}</span>
            <span class="stat-unit">kcal</span>
          </div>
        </div>

        <!-- Goal progress bar -->
        <div class="goal-section">
          <div class="goal-row">
            <span class="goal-label">Daily Goal</span>
            <span class="goal-val ${goalStatus}">${inCal.toLocaleString()} / ${goal.toLocaleString()} kcal</span>
          </div>
          <div class="goal-bar-bg">
            <div class="goal-bar-fill ${goalStatus}" style="width:${goalPct}%"></div>
          </div>
          <div class="goal-sub">${goalStatus === 'on-track' ? `${(goal - inCal).toLocaleString()} kcal remaining` : `${(inCal - goal).toLocaleString()} kcal over goal`}</div>
        </div>

        <!-- Today's quick log -->
        ${renderTodayQuickLog()}

        <!-- Calendar -->
        <div class="section-title">
          <span>Monthly View</span>
          <div class="cal-nav">
            <button class="cal-nav-btn" onclick="Calendar.prevMonth()">‹</button>
            <span id="cal-month-heading"></span>
            <button class="cal-nav-btn" onclick="Calendar.nextMonth()">›</button>
          </div>
        </div>
        <div id="calendar-grid" class="calendar-grid"></div>

        <!-- FAB buttons -->
        <div class="fab-group">
          <button class="fab fab-out" onclick="App.navigateTo('log-out')" title="Log Exercise">
            <span>🏃</span><span class="fab-label">OUT</span>
          </button>
          <button class="fab fab-in" onclick="App.navigateTo('log-in')" title="Log Food">
            <span>🍎</span><span class="fab-label">IN</span>
          </button>
        </div>

        <!-- Day detail sheet (hidden) -->
        <div id="day-sheet" class="day-sheet hidden"></div>
        <div id="day-sheet-overlay" class="sheet-overlay hidden" onclick="App.closeDayDetail()"></div>
      </div>`;
  }

  function renderTodayQuickLog() {
    const day    = Store.getDayLog();
    const inList = day.in  || [];
    const outList = day.out || [];
    if (!inList.length && !outList.length) return '';

    let html = `<div class="today-log-section">`;

    if (inList.length) {
      html += `<div class="tlog-group">
        <span class="tlog-group-title">🍎 Food Today</span>`;
      inList.slice(-3).forEach(e => {
        html += `<div class="tlog-item">
          <span class="tlog-name">${escHtml(e.name || 'Food')}</span>
          <span class="tlog-cal tlog-in">${e.calories} kcal</span>
        </div>`;
      });
      if (inList.length > 3) html += `<div class="tlog-more">+${inList.length - 3} more</div>`;
      html += `</div>`;
    }

    if (outList.length) {
      html += `<div class="tlog-group">
        <span class="tlog-group-title">🏃 Exercise Today</span>`;
      outList.slice(-3).forEach(e => {
        html += `<div class="tlog-item">
          <span class="tlog-name">${escHtml(e.exercise || 'Exercise')}</span>
          <span class="tlog-cal tlog-out">-${e.calories} kcal</span>
        </div>`;
      });
      if (outList.length > 3) html += `<div class="tlog-more">+${outList.length - 3} more</div>`;
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  function postRenderDashboard() {
    Calendar.render();
  }

  // ── Day detail sheet ───────────────────────────────────────────────────────
  function openDayDetail(dateStr) {
    const day  = Store.getDayLog(dateStr);
    const tots = Store.getDayTotals(dateStr);
    const [y, m, d] = dateStr.split('-');
    const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long' });

    let html = `
      <div class="day-sheet-header">
        <span class="day-sheet-title">${label}</span>
        <button class="sheet-close" onclick="App.closeDayDetail()">✕</button>
      </div>
      <div class="day-sheet-totals">
        <span class="dst-in">🍎 ${tots.in} kcal IN</span>
        <span class="dst-sep">·</span>
        <span class="dst-out">🏃 ${tots.out} kcal OUT</span>
        <span class="dst-sep">·</span>
        <span class="dst-net ${tots.net <= 0 ? 'net-good' : 'net-bad'}">Net ${tots.net > 0 ? '+' : ''}${tots.net}</span>
      </div>`;

    const inList  = day.in  || [];
    const outList = day.out || [];

    if (inList.length) {
      html += `<div class="dsl-section"><div class="dsl-section-title">🍎 Food</div>`;
      inList.forEach(e => {
        html += `<div class="dsl-item">
          <span>${escHtml(e.name || 'Food')}</span>
          <span class="dsl-cal tlog-in">${e.calories} kcal</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (outList.length) {
      html += `<div class="dsl-section"><div class="dsl-section-title">🏃 Exercise</div>`;
      outList.forEach(e => {
        const dur = e.minutes ? ` · ${e.minutes} min` : '';
        html += `<div class="dsl-item">
          <span>${escHtml(e.exercise || 'Exercise')}${dur}</span>
          <span class="dsl-cal tlog-out">-${e.calories} kcal</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (!inList.length && !outList.length) {
      html += `<div class="dsl-empty">No entries for this day</div>`;
    }

    const sheet   = document.getElementById('day-sheet');
    const overlay = document.getElementById('day-sheet-overlay');
    sheet.innerHTML = html;
    sheet.classList.remove('hidden');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => sheet.classList.add('open'));
  }

  function closeDayDetail() {
    const sheet   = document.getElementById('day-sheet');
    const overlay = document.getElementById('day-sheet-overlay');
    if (!sheet) return;
    sheet.classList.remove('open');
    overlay.classList.add('hidden');
    setTimeout(() => sheet.classList.add('hidden'), 300);
  }

  // ── Log IN ─────────────────────────────────────────────────────────────────
  function renderLogIn() {
    const day = Store.getDayLog();
    const entries = (day.in || []).slice().reverse();

    return `
      <div class="view login-view">
        <div class="view-header">
          <button class="back-btn" onclick="App.navigateTo('dashboard')">‹</button>
          <h2 class="view-title">🍎 Log IN</h2>
        </div>

        <!-- Mode tabs -->
        <div class="mode-tabs">
          <button class="mode-tab ${activeFoodMode === 'text' ? 'active' : ''}" onclick="App.setFoodMode('text')">✍️ Type Food</button>
          <button class="mode-tab ${activeFoodMode === 'photo' ? 'active' : ''}" onclick="App.setFoodMode('photo')">📸 Photo</button>
        </div>

        <!-- Text mode -->
        <div id="food-text-mode" class="${activeFoodMode === 'text' ? '' : 'hidden'}">
          <div class="input-group">
            <textarea id="food-text-input" class="food-input" placeholder="e.g. 2 scrambled eggs, 2 slices toast with butter, orange juice 250ml" rows="3"></textarea>
          </div>
          <button class="primary-btn" onclick="App.analyzeText()">
            🔍 Estimate Calories
          </button>
        </div>

        <!-- Photo mode -->
        <div id="food-photo-mode" class="${activeFoodMode === 'photo' ? '' : 'hidden'}">
          <div class="photo-area" id="photo-area">
            <div class="photo-placeholder" id="photo-placeholder">
              <span class="photo-icon">📷</span>
              <span>Tap to take a photo or choose from gallery</span>
            </div>
            <img id="photo-preview" class="photo-preview hidden" alt="food photo"/>
          </div>
          <input type="file" id="photo-file-input" accept="image/*" capture="environment" style="display:none" onchange="App.handlePhotoSelect(event)">
          <button class="secondary-btn" onclick="document.getElementById('photo-file-input').click()">
            📷 Choose / Take Photo
          </button>
          <button class="primary-btn" id="analyze-photo-btn" onclick="App.analyzePhoto()" disabled>
            🔍 Analyze Photo
          </button>
        </div>

        <!-- AI result panel -->
        <div id="ai-result-panel" class="ai-result hidden"></div>

        <!-- Loading -->
        <div id="ai-loading" class="ai-loading hidden">
          <div class="spinner"></div>
          <span>Analyzing with AI...</span>
        </div>

        <!-- Today's food log -->
        <div class="log-section">
          <div class="section-title">Today's Food Log</div>
          ${entries.length === 0
            ? `<div class="empty-log">No food logged today</div>`
            : entries.map(e => `
              <div class="log-entry" data-id="${e.id}">
                <div class="log-entry-info">
                  <span class="log-entry-name">${escHtml(e.name || 'Food')}</span>
                  <span class="log-entry-time">${formatTime(e.time)}</span>
                </div>
                <div class="log-entry-right">
                  <span class="log-entry-cal in-cal">${e.calories} kcal</span>
                  <button class="delete-btn" onclick="App.deleteFoodEntry('${e.id}')">✕</button>
                </div>
              </div>`).join('')}
        </div>
      </div>`;
  }

  function postRenderLogIn() {
    // Photo area tap
    document.getElementById('photo-area')?.addEventListener('click', () => {
      document.getElementById('photo-file-input')?.click();
    });
  }

  function setFoodMode(mode) {
    activeFoodMode = mode;
    navigateTo('log-in');
  }

  async function analyzeText() {
    const text = document.getElementById('food-text-input')?.value?.trim();
    if (!text) { showToast('Please enter what you ate'); return; }

    showAILoading(true);
    try {
      const result = await AI.analyzeText(text);
      pendingAI = result;
      showAIResult(result);
    } catch (e) {
      showToast('AI error: ' + e.message, 'error');
    } finally {
      showAILoading(false);
    }
  }

  async function analyzePhoto() {
    const btn = document.getElementById('analyze-photo-btn');
    if (btn?.disabled) return;

    showAILoading(true);
    try {
      const preview = document.getElementById('photo-preview');
      // Extract base64 from the data URL
      const dataUrl  = preview.src;
      const [header, b64] = dataUrl.split(',');
      const mimeMatch = header.match(/data:(.*);base64/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const result = await AI.analyzePhoto(b64, mime);
      pendingAI = result;
      showAIResult(result);
    } catch (e) {
      showToast('AI error: ' + e.message, 'error');
    } finally {
      showAILoading(false);
    }
  }

  function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('photo-preview');
      const placeholder = document.getElementById('photo-placeholder');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
      document.getElementById('analyze-photo-btn').disabled = false;
    };
    reader.readAsDataURL(file);
  }

  function showAIResult(result) {
    const panel = document.getElementById('ai-result-panel');
    if (!panel) return;

    let html = `<div class="ai-result-inner">
      <div class="ai-result-title">🤖 AI Estimate</div>`;

    (result.items || []).forEach(item => {
      html += `<div class="ai-item">
        <span>${escHtml(item.name)}</span>
        <span class="ai-cal">${item.calories} kcal</span>
      </div>`;
    });

    html += `<div class="ai-total">Total: <strong>${result.total_calories} kcal</strong></div>`;

    if (result.notes) {
      html += `<div class="ai-notes">${escHtml(result.notes)}</div>`;
    }

    // Editable total field
    html += `
      <div class="ai-edit-row">
        <label>Adjust calories:</label>
        <input type="number" id="ai-cal-edit" class="cal-edit-input" value="${result.total_calories}" min="0" max="9999">
      </div>
      <div class="ai-edit-row">
        <label>Name / description:</label>
        <input type="text" id="ai-name-edit" class="cal-edit-input" value="${escHtml((result.items || []).map(i => i.name).join(', '))}">
      </div>
      <button class="primary-btn" onclick="App.confirmAIFood()">✅ Log This</button>
      <button class="text-btn" onclick="App.dismissAIResult()">Cancel</button>
    </div>`;

    panel.innerHTML  = html;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function confirmAIFood() {
    const calories = parseInt(document.getElementById('ai-cal-edit')?.value) || 0;
    const name     = document.getElementById('ai-name-edit')?.value || 'Food';
    const source   = activeFoodMode;

    Store.addFoodEntry({ name, calories, source });
    pendingAI = null;
    showToast(`✅ Logged ${calories} kcal`);
    navigateTo('log-in');
  }

  function dismissAIResult() {
    document.getElementById('ai-result-panel')?.classList.add('hidden');
    pendingAI = null;
  }

  function deleteFoodEntry(id) {
    Store.removeFoodEntry(id);
    navigateTo('log-in');
  }

  function showAILoading(show) {
    document.getElementById('ai-loading')?.classList.toggle('hidden', !show);
    document.getElementById('ai-result-panel')?.classList.add('hidden');
  }

  // ── Log OUT ────────────────────────────────────────────────────────────────
  function renderLogOut() {
    const settings  = Store.getSettings();
    const weightKg  = parseFloat(settings.weightKg) || 70;
    const exercises = Exercises.getAll();
    const day       = Store.getDayLog();
    const entries   = (day.out || []).slice().reverse();

    const exerciseTiles = exercises.map(ex => {
      const calPer30 = Exercises.calcCalories(ex.id, 30, weightKg);
      return `
        <div class="exercise-tile" onclick="App.selectExercise('${ex.id}')"
             style="--ex-color:${ex.color}">
          <span class="ex-icon">${ex.icon}</span>
          <span class="ex-name">${ex.name}</span>
          <span class="ex-rate">~${calPer30} kcal/30min</span>
        </div>`;
    }).join('');

    return `
      <div class="view logout-view">
        <div class="view-header">
          <button class="back-btn" onclick="App.navigateTo('dashboard')">‹</button>
          <h2 class="view-title">🏃 Log OUT</h2>
        </div>

        <!-- Exercise picker -->
        <div class="section-title">Choose Exercise</div>
        <div class="exercise-grid">${exerciseTiles}</div>

        <!-- Custom exercise -->
        <div class="section-title">Custom Workout</div>
        <div class="custom-exercise-form">
          <input type="text" id="custom-ex-name" class="form-input" placeholder="Exercise name">
          <input type="number" id="custom-ex-cal" class="form-input" placeholder="Calories burned" min="0" max="9999">
          <button class="primary-btn" onclick="App.logCustomExercise()">➕ Log Custom</button>
        </div>

        <!-- Today's exercise log -->
        <div class="log-section">
          <div class="section-title">Today's Exercise Log</div>
          ${entries.length === 0
            ? `<div class="empty-log">No exercise logged today</div>`
            : entries.map(e => `
              <div class="log-entry" data-id="${e.id}">
                <div class="log-entry-info">
                  <span class="log-entry-name">${escHtml(e.exercise || 'Exercise')}${e.minutes ? ` · ${e.minutes} min` : ''}</span>
                  <span class="log-entry-time">${formatTime(e.time)}</span>
                </div>
                <div class="log-entry-right">
                  <span class="log-entry-cal out-cal">-${e.calories} kcal</span>
                  <button class="delete-btn" onclick="App.deleteExerciseEntry('${e.id}')">✕</button>
                </div>
              </div>`).join('')}
        </div>
      </div>

      <!-- Exercise duration modal -->
      <div id="ex-modal-overlay" class="sheet-overlay hidden" onclick="App.closeExModal()"></div>
      <div id="ex-modal" class="ex-modal hidden">
        <div class="ex-modal-content">
          <div class="ex-modal-title" id="ex-modal-title">Log Exercise</div>
          <div class="ex-modal-cal" id="ex-modal-cal"></div>
          <div class="duration-row">
            <button class="dur-btn" onclick="App.changeDuration(-5)">−5</button>
            <div class="duration-display">
              <input type="number" id="ex-duration" class="duration-input" value="30" min="1" max="480" oninput="App.updateExCalPreview()">
              <span class="duration-unit">min</span>
            </div>
            <button class="dur-btn" onclick="App.changeDuration(5)">+5</button>
          </div>
          <div class="quick-durations">
            ${[10, 15, 20, 30, 45, 60].map(m =>
              `<button class="qdur-btn" onclick="App.setDuration(${m})">${m}m</button>`
            ).join('')}
          </div>
          <button class="primary-btn" onclick="App.confirmExercise()">✅ Log Exercise</button>
          <button class="text-btn" onclick="App.closeExModal()">Cancel</button>
        </div>
      </div>`;
  }

  function postRenderLogOut() {}

  let selectedExerciseId = null;

  function selectExercise(id) {
    selectedExerciseId = id;
    const ex = Exercises.getById(id);
    if (!ex) return;

    const settings = Store.getSettings();
    const weightKg = parseFloat(settings.weightKg) || 70;

    document.getElementById('ex-modal-title').textContent = `${ex.icon} ${ex.name}`;
    updateExCalPreview();

    document.getElementById('ex-modal').classList.remove('hidden');
    document.getElementById('ex-modal-overlay').classList.remove('hidden');
  }

  function closeExModal() {
    document.getElementById('ex-modal')?.classList.add('hidden');
    document.getElementById('ex-modal-overlay')?.classList.add('hidden');
    selectedExerciseId = null;
  }

  function updateExCalPreview() {
    if (!selectedExerciseId) return;
    const settings = Store.getSettings();
    const weightKg = parseFloat(settings.weightKg) || 70;
    const minutes  = parseInt(document.getElementById('ex-duration')?.value) || 30;
    const kcal     = Exercises.calcCalories(selectedExerciseId, minutes, weightKg);
    const el       = document.getElementById('ex-modal-cal');
    if (el) el.textContent = `≈ ${kcal} kcal burned`;
  }

  function changeDuration(delta) {
    const input = document.getElementById('ex-duration');
    if (!input) return;
    input.value = Math.max(1, Math.min(480, (parseInt(input.value) || 30) + delta));
    updateExCalPreview();
  }

  function setDuration(mins) {
    const input = document.getElementById('ex-duration');
    if (input) { input.value = mins; updateExCalPreview(); }
  }

  function confirmExercise() {
    if (!selectedExerciseId) return;
    const ex       = Exercises.getById(selectedExerciseId);
    const minutes  = parseInt(document.getElementById('ex-duration')?.value) || 30;
    const settings = Store.getSettings();
    const weightKg = parseFloat(settings.weightKg) || 70;
    const calories = Exercises.calcCalories(selectedExerciseId, minutes, weightKg);

    Store.addExerciseEntry({ exercise: ex.name, minutes, calories, custom: false });
    closeExModal();
    showToast(`✅ Logged ${calories} kcal burned`);
    navigateTo('log-out');
  }

  function logCustomExercise() {
    const name = document.getElementById('custom-ex-name')?.value?.trim();
    const cal  = parseInt(document.getElementById('custom-ex-cal')?.value);
    if (!name) { showToast('Please enter exercise name'); return; }
    if (!cal || cal <= 0) { showToast('Please enter calories burned'); return; }

    Store.addExerciseEntry({ exercise: name, calories: cal, custom: true });
    showToast(`✅ Logged ${cal} kcal burned`);
    navigateTo('log-out');
  }

  function deleteExerciseEntry(id) {
    Store.removeExerciseEntry(id);
    navigateTo('log-out');
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  function renderSettings() {
    const s    = Store.getSettings();
    const tdee = Store.calcTDEE(s);

    const activityOptions = [
      { val: 'sedentary',  label: 'Sedentary (desk job, no exercise)' },
      { val: 'light',      label: 'Light (1-2 days/week exercise)' },
      { val: 'moderate',   label: 'Moderate (3-5 days/week exercise)' },
      { val: 'active',     label: 'Active (6-7 days/week exercise)' },
      { val: 'veryActive', label: 'Very Active (athlete / physical job)' },
    ];

    return `
      <div class="view settings-view">
        <div class="view-header">
          <button class="back-btn" onclick="App.navigateTo('dashboard')">‹</button>
          <h2 class="view-title">⚙️ Settings</h2>
        </div>

        <div class="settings-card">
          <div class="settings-section-title">👤 Your Profile</div>

          <label class="form-label">Name</label>
          <input type="text" id="s-name" class="form-input" placeholder="Your name" value="${escHtml(s.name || '')}">

          <label class="form-label">Age</label>
          <input type="number" id="s-age" class="form-input" placeholder="Years" value="${s.age || ''}" min="10" max="100">

          <label class="form-label">Gender</label>
          <select id="s-gender" class="form-input">
            <option value="male"   ${s.gender === 'male'   ? 'selected' : ''}>Male</option>
            <option value="female" ${s.gender === 'female' ? 'selected' : ''}>Female</option>
            <option value="other"  ${s.gender === 'other'  ? 'selected' : ''}>Other / Prefer not to say</option>
          </select>

          <label class="form-label">Weight (kg)</label>
          <input type="number" id="s-weight" class="form-input" placeholder="kg" value="${s.weightKg || ''}" min="20" max="300" step="0.5">

          <label class="form-label">Height (cm)</label>
          <input type="number" id="s-height" class="form-input" placeholder="cm" value="${s.heightCm || ''}" min="50" max="250">

          <label class="form-label">Activity Level</label>
          <select id="s-activity" class="form-input">
            ${activityOptions.map(o =>
              `<option value="${o.val}" ${s.activityLevel === o.val ? 'selected' : ''}>${o.label}</option>`
            ).join('')}
          </select>

          <div class="tdee-box" id="tdee-display">
            <span class="tdee-label">Estimated Daily Goal (TDEE)</span>
            <span class="tdee-val">${tdee || '—'} kcal/day</span>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-section-title">🎯 Daily Calorie Goal</div>
          <label class="form-label">Override goal (leave 0 to use TDEE)</label>
          <input type="number" id="s-goal" class="form-input" placeholder="e.g. 2000" value="${s.dailyGoal || ''}" min="0" max="9999">
        </div>

        <div class="settings-card">
          <div class="settings-section-title">🤖 AI Calorie Assistant (xAI / Grok)</div>
          <label class="form-label">API Key</label>
          <input type="password" id="s-api-key" class="form-input" placeholder="Enter xAI or Groq API token" value="${escHtml(s.apiKey || '')}">
          <span style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">Stored securely in your browser's localStorage. Supports xAI tokens (<code>xai-...</code>) and Groq tokens (<code>gsk_...</code>).</span>
        </div>

        <button class="primary-btn" onclick="App.saveSettings()">💾 Save Settings</button>

        <div class="settings-card danger-zone">
          <div class="settings-section-title">⚠️ Data</div>
          <button class="danger-btn" onclick="App.clearData()">🗑 Clear All Logged Data</button>
        </div>

        <div class="settings-footer">
          <img src="./file_000000006c20820bbf1241cf786592e2.png" alt="InOut" class="settings-logo">
          <p>InOut v1.0 · Personal calorie tracker</p>
        </div>
      </div>`;
  }

  function postRenderSettings() {
    // Live TDEE recalc when any field changes
    ['s-age','s-gender','s-weight','s-height','s-activity'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateTDEEPreview);
    });
  }

  function updateTDEEPreview() {
    const s = gatherSettingsForm();
    const tdee = Store.calcTDEE(s);
    const el = document.getElementById('tdee-display');
    if (el) el.querySelector('.tdee-val').textContent = `${tdee} kcal/day`;
  }

  function gatherSettingsForm() {
    return {
      name:          document.getElementById('s-name')?.value?.trim() || '',
      age:           document.getElementById('s-age')?.value || '',
      gender:        document.getElementById('s-gender')?.value || 'other',
      weightKg:      parseFloat(document.getElementById('s-weight')?.value) || 70,
      heightCm:      parseFloat(document.getElementById('s-height')?.value) || 170,
      activityLevel: document.getElementById('s-activity')?.value || 'moderate',
      dailyGoal:     parseInt(document.getElementById('s-goal')?.value) || 0,
      apiKey:        document.getElementById('s-api-key')?.value?.trim() || ''
    };
  }

  function saveSettings() {
    const s    = gatherSettingsForm();
    // If no manual goal set, use TDEE
    if (!s.dailyGoal) s.dailyGoal = Store.calcTDEE(s);
    Store.saveSettings(s);
    showToast('✅ Settings saved!');
    navigateTo('dashboard');
  }

  function clearData() {
    if (!confirm('Clear all logged food and exercise data? This cannot be undone.')) return;
    Store.clearAll();
    showToast('All data cleared');
    navigateTo('dashboard');
  }

  // ── Bottom nav ─────────────────────────────────────────────────────────────
  function renderBottomNav() {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    nav.innerHTML = `
      <button class="nav-item" data-view="dashboard" onclick="App.navigateTo('dashboard')">
        <span class="nav-icon">📊</span><span class="nav-label">Dashboard</span>
      </button>
      <button class="nav-item" data-view="log-in" onclick="App.navigateTo('log-in')">
        <span class="nav-icon in-icon">🍎</span><span class="nav-label">IN</span>
      </button>
      <button class="nav-item" data-view="log-out" onclick="App.navigateTo('log-out')">
        <span class="nav-icon out-icon">🏃</span><span class="nav-label">OUT</span>
      </button>
      <button class="nav-item" data-view="settings" onclick="App.navigateTo('settings')">
        <span class="nav-icon">⚙️</span><span class="nav-label">Settings</span>
      </button>`;
  }

  // ── Utility ────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function showToast(msg, type = 'success') {
    let toast = document.getElementById('global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className   = `toast toast-${type} show`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function bindGlobalEvents() {
    // Allow pulling to refresh on PWA (iOS safari sometimes needs this)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && activeView === 'dashboard') navigateTo('dashboard');
    });
  }

  return {
    init,
    navigateTo,
    openDayDetail,
    closeDayDetail,
    setFoodMode,
    analyzeText,
    analyzePhoto,
    handlePhotoSelect,
    confirmAIFood,
    dismissAIResult,
    deleteFoodEntry,
    selectExercise,
    closeExModal,
    updateExCalPreview,
    changeDuration,
    setDuration,
    confirmExercise,
    logCustomExercise,
    deleteExerciseEntry,
    saveSettings,
    clearData
  };
})();

// Bootstrap
document.addEventListener('DOMContentLoaded', App.init);
