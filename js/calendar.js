// ── InOut · calendar.js ───────────────────────────────────────────────────────
// Renders the monthly calendar with calorie badges

const Calendar = (() => {

  let currentYear  = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1; // 1-based

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function prevMonth() {
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    render();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    render();
  }

  function render() {
    const container = document.getElementById('calendar-grid');
    const heading   = document.getElementById('cal-month-heading');
    if (!container) return;

    heading.textContent = `${MONTHS[currentMonth - 1]} ${currentYear}`;

    // Build grid
    const summary = Store.getMonthSummary(currentYear, currentMonth);
    const today   = Store.today();

    // First day-of-week for this month (0=Sun)
    const firstDow = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    let html = '';

    // Day-of-week headers
    DAYS.forEach(d => {
      html += `<div class="cal-header">${d}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < firstDow; i++) {
      html += `<div class="cal-cell empty"></div>`;
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const net     = summary[dateStr];
      const isToday = dateStr === today;
      const hasDot  = net !== undefined;

      let badge = '';
      let badgeClass = '';
      if (hasDot) {
        badgeClass = net <= 0 ? 'badge-deficit' : 'badge-surplus';
        const sign = net <= 0 ? '' : '+';
        badge = `<span class="cal-badge ${badgeClass}">${sign}${net}</span>`;
      }

      html += `
        <div class="cal-cell ${isToday ? 'today' : ''} ${hasDot ? 'has-data' : ''}"
             data-date="${dateStr}" onclick="App.openDayDetail('${dateStr}')">
          <span class="cal-day-num">${d}</span>
          ${badge}
        </div>`;
    }

    container.innerHTML = html;
  }

  return { render, prevMonth, nextMonth };
})();
