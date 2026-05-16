/* ==========================================================================
   NEAT MDQ - MONITORING SYSTEM CORE ENGINE
   Production-Hardened Protocol | Zero-Trust | CSP-Compliant
   ========================================================================== */

const getSafeStorage = (key, defaultValue) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    const parsed = JSON.parse(data);
    return (typeof parsed === typeof defaultValue) ? parsed : defaultValue;
  } catch (e) {
    console.error(`[System Error] Corrupción en ${key}. Usando respaldo seguro.`);
    return defaultValue;
  }
};

let userConfig = getSafeStorage('userConfig', {
  weight: 75,
  dailyGoal: 3500,
  targetDate: '2026-10-26',
  stridePerKm: 1315
});
let entries = getSafeStorage('stepData', []);
let chartInstance = null;
let chartRange = 7;

document.addEventListener('DOMContentLoaded', () => {
  // ----- TEMA (CSP-COMPLIANT + LOCALSTORAGE) -----
  const savedTheme = localStorage.getItem('appTheme');
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
    if (!savedTheme) localStorage.setItem('appTheme', 'dark');
  }

  const datePicker = document.getElementById('steps-date');
  if (datePicker) datePicker.value = new Date().toISOString().split('T')[0];
  initSystem();
});

const MILESTONES = [
  { id: 'boston', km: 42, name: 'Boston', desc: 'Maratón de Boston', icon: 'fa-running' },
  { id: 'costa', km: 400, name: 'Costa a Costa', desc: 'MDQ ↔ Bs.As.', icon: 'fa-water' },
  { id: 'andes', km: 1400, name: 'Andes', desc: 'Cruce de los Andes', icon: 'fa-mountain' },
  { id: 'ruta40', km: 5200, name: 'Ruta 40', desc: 'La mítica Ruta 40', icon: 'fa-road' },
  { id: 'america', km: 15000, name: 'Panamericana', desc: 'Ushuaia a Alaska', icon: 'fa-map-marked-alt' }
];

window.deleteEntry = function(dateToDelete) {
  if (confirm(`¿Confirmas la eliminación de los datos del ${dateToDelete.split('-').reverse().join('/')}?`)) {
    entries = entries.filter(e => e.date !== dateToDelete);
    localStorage.setItem('stepData', JSON.stringify(entries));
    updateUI();
    showNotification('Registro eliminado correctamente', 'success');
  }
};

window.editEntry = function(dateToEdit) {
  const entry = entries.find(e => e.date === dateToEdit);
  if (!entry) return;
  
  document.getElementById('edit-date-original').value = dateToEdit;
  document.getElementById('edit-date').value = dateToEdit;
  document.getElementById('edit-steps').value = entry.steps;
  
  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('edit-steps').focus();
  }
};

function showNotification(message, type = 'success') {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = type === 'error' ? 'error' : 'success';
  notification.textContent = message;
  notification.style.transform = 'translateX(0)';
  
  container.appendChild(notification);

  setTimeout(() => {
    notification.style.transform = 'translateX(120%)';
    setTimeout(() => notification.remove(), 200);
  }, 3000);
}

function initSystem() {
  updateUI();
  setupEventListeners();
}

function updateUI() {
  updateTotalTelemetry();
  updateCountdown();
  updateStreak();
  renderLogTable();
  renderMilestones();
  renderChart();
  updateGlobalProgress();
  updateGlobalExtra();
  updateQuickStats();
}

function updateTotalTelemetry() {
  const totalSteps = entries.reduce((acc, c) => acc + c.steps, 0);
  const stepsDisplay = document.getElementById('current-steps-display');
  if (stepsDisplay) stepsDisplay.textContent = totalSteps.toLocaleString('es-AR');

  const stride = userConfig.stridePerKm || 1315;
  const totalKm = totalSteps / stride;
  const distanceDisplay = document.getElementById('current-distance-display');
  if (distanceDisplay) distanceDisplay.textContent = `${totalKm.toFixed(2)} KM`;

  const weight = userConfig.weight || 75;
  const totalKcal = totalKm * weight * 0.57;
  const kcalDisplay = document.getElementById('current-kcal-display');
  if (kcalDisplay) kcalDisplay.textContent = `${Math.round(totalKcal)} KCAL`;
}

function updateGlobalProgress() {
  const totalSteps = entries.reduce((acc, c) => acc + c.steps, 0);
  const goalPerDay = userConfig.dailyGoal;
  const targetDateStr = userConfig.targetDate;
  const percentSpan = document.getElementById('global-percent-display');
  const progressTrack = document.getElementById('global-progress-track');
  const stepsDoneSpan = document.getElementById('global-steps-done');
  const stepsGoalSpan = document.getElementById('global-steps-goal');

  if (!percentSpan || !progressTrack || !targetDateStr || entries.length === 0) {
    if (percentSpan) percentSpan.textContent = '0%';
    if (progressTrack) progressTrack.style.width = '0%';
    return;
  }

  const sortedDates = entries.map(e => e.date).sort();
  const startDate = new Date(sortedDates[0] + 'T00:00:00');
  const targetDate = new Date(targetDateStr + 'T00:00:00');
  const diffDays = Math.max(1, Math.ceil((targetDate - (isNaN(startDate.getTime()) ? new Date() : startDate)) / 86400000));
  const globalGoal = goalPerDay * diffDays;
  const percent = Math.min((totalSteps / globalGoal) * 100, 100);

  percentSpan.textContent = `${percent.toFixed(1)}%`;
  progressTrack.style.width = `${percent}%`;
  if (stepsDoneSpan) stepsDoneSpan.textContent = totalSteps.toLocaleString();
  if (stepsGoalSpan) stepsGoalSpan.textContent = globalGoal.toLocaleString();
}

function updateGlobalExtra() {
  const totalSteps = entries.reduce((acc, c) => acc + c.steps, 0);
  const targetDateStr = userConfig.targetDate;
  if (!targetDateStr || entries.length === 0) return;

  const target = new Date(targetDateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const remainingDays = Math.max(1, Math.ceil((target - now) / 86400000));
  const goalPerDay = userConfig.dailyGoal;
  const globalGoal = goalPerDay * Math.max(1, Math.ceil((target - new Date(entries.map(e => e.date).sort()[0] + 'T00:00:00')) / 86400000));
  const remaining = Math.max(0, globalGoal - totalSteps);
  const dailyNeeded = remainingDays > 0 ? Math.ceil(remaining / remainingDays) : 0;

  const remainingSpan = document.getElementById('global-steps-remaining');
  const dailySpan = document.getElementById('global-daily-needed');
  if (remainingSpan) remainingSpan.textContent = remaining.toLocaleString();
  if (dailySpan) dailySpan.textContent = dailyNeeded.toLocaleString();
}

function updateQuickStats() {
  if (entries.length === 0) {
    ['stats-avg', 'stats-best', 'stats-streak'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '0';
    });
    return;
  }

  const totalSteps = entries.reduce((acc, c) => acc + c.steps, 0);
  const avg = Math.round(totalSteps / entries.length);
  const best = Math.max(...entries.map(e => e.steps));

  const dataMap = {};
  entries.forEach(e => { dataMap[e.date] = (dataMap[e.date] || 0) + e.steps; });
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const goal = userConfig.dailyGoal;

  let streak = 0;
  let checkDate = (dataMap[todayStr] >= goal) ? new Date() : yesterday;
  if (dataMap[todayStr] >= goal || dataMap[yesterdayStr] >= goal) {
    while (true) {
      const checkStr = checkDate.toISOString().split('T')[0];
      if ((dataMap[checkStr] || 0) >= goal) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
  }

  const avgEl = document.getElementById('stats-avg');
  const bestEl = document.getElementById('stats-best');
  const streakEl = document.getElementById('stats-streak');
  if (avgEl) avgEl.textContent = avg.toLocaleString();
  if (bestEl) bestEl.textContent = best.toLocaleString();
  if (streakEl) streakEl.textContent = `${streak}`;
}

function updateCountdown() {
  const target = new Date(userConfig.targetDate + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const days = Math.ceil((target - now) / 86400000);
  const display = document.getElementById('countdown-display');
  if (display) display.textContent = days > 0 ? `${days} DÍAS` : "META ALCANZADA";
}

function updateStreak() {
  const display = document.getElementById('streak-display');
  if (!display) return;
  if (entries.length === 0) { display.textContent = "0 DÍAS"; return; }

  const dataMap = {};
  entries.forEach(e => { dataMap[e.date] = (dataMap[e.date] || 0) + e.steps; });
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const goal = userConfig.dailyGoal;

  let streak = 0;
  let checkDate = (dataMap[todayStr] >= goal) ? new Date() : yesterday;
  if (dataMap[todayStr] >= goal || dataMap[yesterdayStr] >= goal) {
    while (true) {
      const checkStr = checkDate.toISOString().split('T')[0];
      if ((dataMap[checkStr] || 0) >= goal) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
  }
  display.textContent = `${streak} DÍAS`;
}

function renderLogTable() {
  const tbody = document.getElementById('log-table-body');
  if (!tbody) return;
  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.75rem;">Sin registros activos</td></tr>`;
    return;
  }

  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = sorted.map(e => {
    const formattedDate = e.date.split('-').reverse().join('/');
    const goalReached = e.steps >= userConfig.dailyGoal;
    return `
      <tr style="transition:background 0.15s;">
        <td style="font-family:monospace;font-size:0.75rem;padding:0.5rem;">${formattedDate}</td>
        <td style="font-family:monospace;font-size:0.75rem;text-align:right;padding:0.5rem;color:${goalReached ? 'var(--success)' : 'var(--text-muted)'};font-weight:${goalReached ? '700' : '400'};">${e.steps.toLocaleString()}</td>
        <td style="text-align:center;padding:0.5rem;display:flex;gap:0.5rem;justify-content:center;">
          <button class="action-btn edit-entry-btn" data-date="${e.date}" title="Editar métrica" style="background:transparent;border:none;cursor:pointer;color:#10b981;font-size:0.75rem;padding:0.25rem;transition:all 0.15s;border-radius:var(--radius-sm);"><i class="fas fa-pencil-alt"></i></button>
          <button class="delete-entry-btn" data-date="${e.date}" title="Eliminar métrica" style="background:transparent;border:none;cursor:pointer;color:#ef4444;font-size:0.75rem;padding:0.25rem;transition:all 0.15s;border-radius:var(--radius-sm);"><i class="fas fa-trash-alt"></i></button>
        </td>
      </tr>`;
  }).join('');
}

function renderMilestones() {
  const container = document.getElementById('milestones-container');
  if (!container) return;
  const totalSteps = entries.reduce((acc, c) => acc + c.steps, 0);
  const stride = userConfig.stridePerKm || 1315;
  const totalKm = totalSteps / stride;

  container.innerHTML = MILESTONES.map(m => {
    const percent = Math.min((totalKm / m.km) * 100, 100).toFixed(1);
    const done = totalKm >= m.km;
    const currentKm = Math.min(totalKm, m.km).toFixed(1);
    return `
      <div style="border:1px solid var(--border);padding:0.75rem;background:var(--surface-accent);border-radius:var(--radius-sm);">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;font-size:0.7rem;">
          <span style="font-weight:700;color:${done ? 'var(--accent)' : 'var(--text-main)'};"><i class="fas ${m.icon}" style="margin-right:0.4rem;"></i>${m.name}</span>
          <span style="font-family:monospace;color:var(--text-muted);">${percent}%</span>
        </div>
        <div class="progress-rail" style="height:4px;margin-bottom:0.5rem;"><div class="progress-track" style="width:${percent}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:0.65rem;font-family:monospace;color:var(--text-muted);">
          <span>${currentKm} / ${m.km} km</span>
          <span style="max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.desc}</span>
        </div>
      </div>`;
  }).join('');
}

function renderChart() {
  const canvas = document.getElementById('steps-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  const dataMap = {};
  const today = new Date(); today.setHours(0,0,0,0);

  if (chartRange === 'all') {
    if (entries.length > 0) {
      const sortedDates = entries.map(e => e.date).sort();
      const oldestDate = new Date(sortedDates[0] + 'T00:00:00');
      const diffTime = Math.abs(today - oldestDate);
      const diffDays = Math.ceil(diffTime / 86400000) + 1;
      const maxDays = Math.min(diffDays, 365);
      for (let i = maxDays - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dataMap[d.toISOString().split('T')[0]] = 0;
      }
    } else {
      chartRange = 7;
    }
  }

  if (chartRange !== 'all') {
    const days = typeof chartRange === 'number' ? chartRange : 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dataMap[d.toISOString().split('T')[0]] = 0;
    }
  }

  entries.forEach(e => {
    if (dataMap.hasOwnProperty(e.date)) dataMap[e.date] += e.steps;
    else if (chartRange === 'all') dataMap[e.date] = e.steps;
  });

  const sortedKeys = Object.keys(dataMap).sort();
  const labels = sortedKeys.map(s => s.split('-').reverse().slice(0, 2).join('/'));
  const values = sortedKeys.map(k => dataMap[k]);

  if (chartInstance) chartInstance.destroy();
  const isDark = document.documentElement.classList.contains('dark');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.03)',
        borderWidth: 1.5, tension: 0.15, fill: true,
        pointRadius: chartRange === 7 ? 3 : 0,
        pointBackgroundColor: '#6366f1'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }, ticks: { color: '#777', font: { size: 9, family: 'monospace' } } },
        x: { grid: { display: false }, ticks: { color: '#777', font: { size: 9, family: 'monospace' } } }
      }
    }
  });
}

function setupEventListeners() {
  const stepsForm = document.getElementById('steps-form');
  stepsForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    const dateInput = document.getElementById('steps-date');
    const stepsInput = document.getElementById('steps-input');
    const chosenDate = dateInput.value;
    const stepsVal = parseInt(stepsInput.value, 10);

    if (!chosenDate || isNaN(stepsVal) || stepsVal <= 0) return;

    const existingIndex = entries.findIndex(item => item.date === chosenDate);
    if (existingIndex > -1) {
      entries[existingIndex].steps += stepsVal;
    } else {
      entries.push({ date: chosenDate, steps: stepsVal });
    }

    localStorage.setItem('stepData', JSON.stringify(entries));
    updateUI();
    stepsInput.value = '';
    showNotification('Métrica inyectada correctamente', 'success');
  });

  const logTableBody = document.getElementById('log-table-body');
  logTableBody?.addEventListener('click', function(e) {
    const deleteBtn = e.target.closest('.delete-entry-btn');
    if (deleteBtn) {
      const date = deleteBtn.dataset.date;
      window.deleteEntry(date);
      return;
    }

    const editBtn = e.target.closest('.edit-entry-btn');
    if (editBtn) {
      const date = editBtn.dataset.date;
      window.editEntry(date);
      return;
    }
  });

  // EXPORT BUTTON - Improved Markdown Report
  const exportBtn = document.getElementById('export-data-btn');
  exportBtn?.addEventListener('click', () => {
    if (entries.length === 0) return alert("No hay registros en el sistema para exportar.");

    // ----- Helper calculations (reuse existing logic, no DOM dependency) -----
    const totalSteps = entries.reduce((acc, c) => acc + c.steps, 0);
    const stride = userConfig.stridePerKm || 1315;
    const totalKm = totalSteps / stride;
    const weight = userConfig.weight || 75;
    const totalKcal = totalKm * weight * 0.57;
    const dailyGoal = userConfig.dailyGoal;
    const targetDateStr = userConfig.targetDate;

    // --- Consistency Streak ---
    const dataMap = {};
    entries.forEach(e => { dataMap[e.date] = (dataMap[e.date] || 0) + e.steps; });
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    let streak = 0;
    let checkDate = (dataMap[todayStr] >= dailyGoal) ? new Date() : yesterday;
    if (dataMap[todayStr] >= dailyGoal || dataMap[yesterdayStr] >= dailyGoal) {
      while (true) {
        const checkStr = checkDate.toISOString().split('T')[0];
        if ((dataMap[checkStr] || 0) >= dailyGoal) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
        else break;
      }
    }

    // --- Global Goal Progress ---
    let globalGoal = 0;
    let percent = 0;
    let remainingSteps = 0;
    let dailyNeeded = 0;
    if (targetDateStr && entries.length > 0) {
      const sortedDates = entries.map(e => e.date).sort();
      const startDate = new Date(sortedDates[0] + 'T00:00:00');
      const targetDate = new Date(targetDateStr + 'T00:00:00');
      const diffDays = Math.max(1, Math.ceil((targetDate - (isNaN(startDate.getTime()) ? new Date() : startDate)) / 86400000));
      globalGoal = dailyGoal * diffDays;
      percent = Math.min((totalSteps / globalGoal) * 100, 100);
      remainingSteps = Math.max(0, globalGoal - totalSteps);
      const now = new Date(); now.setHours(0,0,0,0);
      const remainingDays = Math.max(1, Math.ceil((targetDate - now) / 86400000));
      dailyNeeded = remainingDays > 0 ? Math.ceil(remainingSteps / remainingDays) : 0;
    } else {
      globalGoal = dailyGoal;
      percent = Math.min((totalSteps / globalGoal) * 100, 100);
      remainingSteps = Math.max(0, globalGoal - totalSteps);
      dailyNeeded = remainingSteps;
    }

    // --- Tactical Statistics ---
    const avgSteps = Math.round(totalSteps / entries.length);
    const bestDay = Math.max(...entries.map(e => e.steps));

    // --- Geographic Milestones ---
    const milestonesData = MILESTONES.map(m => {
      const currentKm = Math.min(totalKm, m.km).toFixed(1);
      const percentMilestone = Math.min((totalKm / m.km) * 100, 100).toFixed(1);
      return { name: m.name, percent: percentMilestone, current: currentKm, target: m.km };
    });

    // --- Historical Log (sorted by date ascending) ---
    const sortedLog = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

    // ----- Build Markdown Content -----
    const reportDate = new Date().toISOString().split('T')[0];
    let md = `# NEAT MDQ — TACTICAL TELEMETRY REPORT\n`;
    md += `**FECHA DE GENERACIÓN:** ${reportDate}  \n`;
    md += `**ESTADO DEL SISTEMA:** OPERATIVO\n\n`;

    md += `## 1. CONSISTENCY STREAK\n`;
    md += `- **Racha actual:** ${streak} días consecutivos\n`;
    md += `- **Objetivo diario:** ${dailyGoal.toLocaleString()} pasos\n`;
    md += `- **Días que cumplen meta:** ${streak}\n\n`;

    md += `## 2. GLOBAL GOAL PROGRESS\n`;
    md += `- **Completado:** ${percent.toFixed(1)}%\n`;
    md += `- **Pasos acumulados:** ${totalSteps.toLocaleString()}\n`;
    md += `- **Meta global:** ${globalGoal.toLocaleString()} pasos\n`;
    md += `- **Pasos restantes:** ${remainingSteps.toLocaleString()}\n`;
    md += `- **Promedio diario requerido:** ${dailyNeeded.toLocaleString()} pasos/día\n\n`;

    md += `## 3. TACTICAL STATISTICS\n`;
    md += `- **Promedio diario:** ${avgSteps.toLocaleString()} pasos\n`;
    md += `- **Mejor día:** ${bestDay.toLocaleString()} pasos\n`;
    md += `- **Racha actual:** ${streak} días\n\n`;

    md += `## 4. ACCUMULATED TELEMETRY\n`;
    md += `- **Total pasos:** ${totalSteps.toLocaleString()}\n`;
    md += `- **Distancia total:** ${totalKm.toFixed(2)} KM\n`;
    md += `- **Energía estimada:** ${Math.round(totalKcal).toLocaleString()} KCAL\n\n`;

    md += `## 5. GEOGRAPHIC MILESTONE PROGRESS\n`;
    md += `| Hito | Progreso | Distancia recorrida | Objetivo |\n`;
    md += `| :--- | :---: | :---: | :---: |\n`;
    milestonesData.forEach(m => {
      md += `| ${m.name} | ${m.percent}% | ${m.current} km | ${m.target} km |\n`;
    });
    md += `\n`;

    md += `## 6. HISTORICAL LOG\n`;
    md += `| Fecha | Pasos |\n`;
    md += `| :--- | :---: |\n`;
    sortedLog.forEach(e => {
      const formattedDate = e.date.split('-').reverse().join('/');
      md += `| ${formattedDate} | ${e.steps.toLocaleString()} |\n`;
    });

    // Create and download .md file
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", blobUrl);
    downloadAnchor.setAttribute("download", `neat_mdq_tactical_${reportDate}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(blobUrl);
  });

  const settingsForm = document.getElementById('settings-form');
  settingsForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    userConfig.weight = Math.max(30, Math.min(200, parseInt(document.getElementById('config-weight').value, 10) || 75));
    userConfig.dailyGoal = Math.max(1000, Math.min(50000, parseInt(document.getElementById('config-goal').value, 10) || 3500));
    userConfig.targetDate = document.getElementById('config-date').value || userConfig.targetDate;
    localStorage.setItem('userConfig', JSON.stringify(userConfig));
    updateUI();
    toggleModal('settings-modal', false);
    showNotification('Configuración guardada correctamente', 'success');
  });

  const editForm = document.getElementById('edit-form');
  editForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    const originalDate = document.getElementById('edit-date-original').value;
    const newDate = document.getElementById('edit-date').value;
    const newSteps = parseInt(document.getElementById('edit-steps').value, 10);

    if (!newDate || isNaN(newSteps) || newSteps <= 0) return;

    const index = entries.findIndex(e => e.date === originalDate);
    if (index > -1) {
      if (originalDate !== newDate) {
        entries.splice(index, 1);
        const existingIndex = entries.findIndex(e => e.date === newDate);
        if (existingIndex > -1) {
          entries[existingIndex].steps = newSteps;
        } else {
          entries.push({ date: newDate, steps: newSteps });
        }
      } else {
        entries[index].steps = newSteps;
      }
    }

    localStorage.setItem('stepData', JSON.stringify(entries));
    updateUI();
    toggleModal('edit-modal', false);
    showNotification('Registro actualizado correctamente', 'success');
  });

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.range-btn').forEach(b => b.setAttribute('aria-selected', 'false'));
      e.target.setAttribute('aria-selected', 'true');
      const rangeAttr = e.target.getAttribute('data-range');
      if (rangeAttr === 'all') {
        chartRange = 'all';
      } else {
        chartRange = parseInt(rangeAttr, 10);
      }
      renderChart();
    });
  });

  const openSettingsBtn = document.getElementById('open-settings');
  const closeSettingsBtn = document.getElementById('close-settings');
  const cancelSettingsBtn = document.getElementById('cancel-settings');

  openSettingsBtn?.addEventListener('click', () => toggleModal('settings-modal', true));
  closeSettingsBtn?.addEventListener('click', () => toggleModal('settings-modal', false));
  cancelSettingsBtn?.addEventListener('click', () => toggleModal('settings-modal', false));

  const closeEditBtn = document.getElementById('close-edit');
  const cancelEditBtn = document.getElementById('cancel-edit');

  closeEditBtn?.addEventListener('click', () => toggleModal('edit-modal', false));
  cancelEditBtn?.addEventListener('click', () => toggleModal('edit-modal', false));

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const html = document.documentElement;
      const isDark = html.classList.contains('dark');
      if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('appTheme', 'light');
      } else {
        html.classList.add('dark');
        localStorage.setItem('appTheme', 'dark');
      }
      renderChart();
    });
  }
}

const toggleModal = (id, show) => {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (show) {
    if (id === 'settings-modal') {
      document.getElementById('config-weight').value = userConfig.weight || 75;
      document.getElementById('config-goal').value = userConfig.dailyGoal || 3500;
      document.getElementById('config-date').value = userConfig.targetDate || '2026-10-26';
      modal.classList.remove('hidden');
      document.getElementById('config-weight').focus();
    } else {
      modal.classList.remove('hidden');
    }
  } else {
    modal.classList.add('hidden');
  }
};