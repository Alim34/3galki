(function () {
  'use strict';

  // ================== ХРАНИЛИЩЕ ==================
  var STORAGE_KEY = 'triGalochkiData';

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }

  var appData = loadData();

  // ================== ПРИВЫЧКИ ==================
  var HABITS_KEY = 'triGalochkiHabits';
  var LEGACY_IDS = ['write', 'move', 'grow'];

  // Библиотека готовых привычек. Названия в прошедшем времени:
  // отметка о сделанном, а не задача на будущее.
  var LIBRARY = {
    write:   { id: 'write',   name: 'Писал',        icon: '✍️' },
    move:    { id: 'move',    name: 'Двигался',     icon: '🏋️' },
    grow:    { id: 'grow',    name: 'Развивался',   icon: '📖' },
    sleep:   { id: 'sleep',   name: 'Спал 7 часов', icon: '😴' },
    water:   { id: 'water',   name: 'Пил воду',     icon: '💧' },
    read:    { id: 'read',    name: 'Читал',        icon: '📚' },
    learn:   { id: 'learn',   name: 'Учился',       icon: '🧠' },
    clean:   { id: 'clean',   name: 'Убирал',       icon: '🧹' },
    nophone: { id: 'nophone', name: 'Без телефона', icon: '📵' },
    plan:    { id: 'plan',    name: 'Планировал',   icon: '🗒️' }
  };

  var PRESETS = [
    { title: 'Базовый', hint: 'Классическая тройка', ids: ['write', 'move', 'grow'] },
    { title: 'Тело',    hint: 'Движение и режим',    ids: ['move', 'sleep', 'water'] },
    { title: 'Ум',      hint: 'Чтение и практика',   ids: ['read', 'write', 'learn'] },
    { title: 'Быт',     hint: 'Порядок вокруг',      ids: ['clean', 'plan', 'nophone'] }
  ];

  function presetHabits(preset) {
    return preset.ids.map(function (id) {
      var h = LIBRARY[id];
      return { id: h.id, name: h.name, icon: h.icon };
    });
  }

  var DEFAULT_HABITS = presetHabits(PRESETS[0]);

  function isValidConfig(list) {
    if (!Array.isArray(list) || list.length !== 3) return false;
    return list.every(function (h) {
      return h && typeof h.id === 'string' && h.id &&
             typeof h.name === 'string' && h.name &&
             typeof h.icon === 'string' && h.icon;
    });
  }

  function loadHabits() {
    try {
      var raw = localStorage.getItem(HABITS_KEY);
      if (!raw) return DEFAULT_HABITS.map(cloneHabit);
      var parsed = JSON.parse(raw);
      return isValidConfig(parsed) ? parsed : DEFAULT_HABITS.map(cloneHabit);
    } catch (e) {
      return DEFAULT_HABITS.map(cloneHabit);
    }
  }
  function saveHabits() {
    try { localStorage.setItem(HABITS_KEY, JSON.stringify(habitsConfig)); } catch (e) {}
  }
  function cloneHabit(h) { return { id: h.id, name: h.name, icon: h.icon }; }
  function habitIds() { return habitsConfig.map(function (h) { return h.id; }); }

  var habitsConfig = loadHabits();

  function emptyEntry() {
    var obj = { mood: null, habits: {}, completed: false };
    habitsConfig.forEach(function (h) { obj.habits[h.id] = false; });
    return obj;
  }
  // Запись могла быть сохранена с другим набором привычек — дополняем недостающие ключи.
  function normalizeEntry(entry) {
    if (!entry.habits) entry.habits = {};
    habitsConfig.forEach(function (h) {
      if (typeof entry.habits[h.id] !== 'boolean') entry.habits[h.id] = false;
    });
    return entry;
  }
  function getEntry(key) {
    return appData[key] ? normalizeEntry(appData[key]) : emptyEntry();
  }
  function setEntry(key, entry) { appData[key] = entry; saveData(); }

  function doneCount(entry) {
    var n = 0;
    habitsConfig.forEach(function (h) { if (entry.habits[h.id]) n++; });
    return n;
  }
  function isFullDay(entry) {
    return habitsConfig.length > 0 && doneCount(entry) === habitsConfig.length;
  }
  function isEmptyEntry(entry) {
    return !entry.mood && !entry.completed && doneCount(entry) === 0;
  }

  // ================== БЭКАП И МИГРАЦИЯ ==================
  var MIGRATION_KEY = 'triGalochkiHabitsMigration';
  var MIGRATION_VERSION = '1';

  function backupData(tag) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      localStorage.setItem('triGalochkiBackup-' + tag + '-' + Date.now(), raw);
    } catch (e) {}
  }

  // Старые записи хранили ключи write/move/grow. Если конфиг привычек
  // изменился, сопоставляем: сначала по id, потом по названию, иначе по позиции.
  function buildLegacyMap() {
    var map = {};
    LEGACY_IDS.forEach(function (legacyId, i) {
      var byId = habitsConfig.filter(function (h) { return h.id === legacyId; })[0];
      if (byId) { map[legacyId] = byId.id; return; }
      var legacyName = LIBRARY[legacyId].name;
      var byName = habitsConfig.filter(function (h) { return h.name === legacyName; })[0];
      if (byName) { map[legacyId] = byName.id; return; }
      if (habitsConfig[i]) map[legacyId] = habitsConfig[i].id;
    });
    return map;
  }

  function migrateLegacyEntries() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === MIGRATION_VERSION) return;
    } catch (e) {}

    var map = buildLegacyMap();
    var needsWork = LEGACY_IDS.some(function (id) { return map[id] && map[id] !== id; });

    if (needsWork) {
      backupData('legacy');
      Object.keys(appData).forEach(function (key) {
        var entry = appData[key];
        if (!entry || !entry.habits) return;
        LEGACY_IDS.forEach(function (legacyId) {
          var target = map[legacyId];
          if (!target || target === legacyId) return;
          if (typeof entry.habits[legacyId] !== 'boolean') return;
          if (entry.habits[target] !== true) entry.habits[target] = entry.habits[legacyId];
          delete entry.habits[legacyId];
        });
      });
      saveData();
    }
    try { localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION); } catch (e) {}
  }

  // Смена набора привычек (пресет или сброс): переносим отметки по позиции,
  // чтобы накопленные дни не осыпались.
  function remapEntries(oldConfig, newConfig) {
    var pairs = [];
    for (var i = 0; i < newConfig.length; i++) {
      if (oldConfig[i] && oldConfig[i].id !== newConfig[i].id) {
        pairs.push([oldConfig[i].id, newConfig[i].id]);
      }
    }
    if (!pairs.length) return;
    backupData('remap');
    Object.keys(appData).forEach(function (key) {
      var entry = appData[key];
      if (!entry || !entry.habits) return;
      var moved = {};
      pairs.forEach(function (p) {
        if (typeof entry.habits[p[0]] === 'boolean') {
          moved[p[1]] = entry.habits[p[0]];
          delete entry.habits[p[0]];
        }
      });
      Object.keys(moved).forEach(function (id) { entry.habits[id] = moved[id]; });
    });
    saveData();
  }

  function applyHabitsConfig(newConfig, remap) {
    var oldConfig = habitsConfig.map(cloneHabit);
    habitsConfig = newConfig.map(cloneHabit);
    if (remap) remapEntries(oldConfig, habitsConfig);
    saveHabits();
    try { localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION); } catch (e) {}
  }

  // ================== ДАТЫ ==================
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toKey(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function keyOf(date) { return toKey(date.getFullYear(), date.getMonth(), date.getDate()); }

  var WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var WEEKDAY_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  // Понедельник = 0 ... воскресенье = 6, для сетки календаря
  function mondayIndex(jsDay) { return (jsDay + 6) % 7; }

  // ================== СОСТОЯНИЕ ==================
  var today = new Date();
  var todayKey = keyOf(today);
  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth();
  var selectedDayKey = null;

  // ================== ВКЛАДКА "СЕГОДНЯ" ==================
  var moodRow = document.getElementById('mood-row');
  var habitsList = document.getElementById('habits-list');
  var finishBtn = document.getElementById('finish-day-btn');
  var badDayTip = document.getElementById('bad-day-tip');
  var streakNote = document.getElementById('streak-note');
  var todayDateEl = document.getElementById('today-date');

  function renderHabitsList() {
    var html = '';
    habitsConfig.forEach(function (h) {
      html += '<button type="button" class="habit-row" data-habit="' + h.id + '">' +
        '<span class="habit-icon">' + h.icon + '</span>' +
        '<span class="habit-name">' + h.name + '</span>' +
        '<span class="habit-check"><span class="check-mark">✓</span></span>' +
        '</button>';
    });
    habitsList.innerHTML = html;
  }

  function renderTodayHeading() {
    var weekday = WEEKDAY_LONG[today.getDay()];
    weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    todayDateEl.textContent = weekday + ', ' + today.getDate() + ' ' + MONTHS_GEN[today.getMonth()];
  }

  function renderToday() {
    var entry = getEntry(todayKey);

    // настроение
    var moodBtns = moodRow.querySelectorAll('.mood-btn');
    for (var i = 0; i < moodBtns.length; i++) {
      moodBtns[i].classList.toggle('is-selected', moodBtns[i].dataset.mood === entry.mood);
    }
    badDayTip.classList.toggle('is-hidden', entry.mood !== 'red');

    // привычки
    var rows = habitsList.querySelectorAll('.habit-row');
    for (var j = 0; j < rows.length; j++) {
      rows[j].classList.toggle('is-checked', !!entry.habits[rows[j].dataset.habit]);
    }

    // кнопка завершения дня
    if (entry.completed) {
      finishBtn.textContent = '✓ День завершён';
      finishBtn.classList.add('is-done');
    } else {
      finishBtn.textContent = 'День завершён';
      finishBtn.classList.remove('is-done');
    }

    renderStreakNote();
  }

  function renderStreakNote() {
    var streak = computeCurrentStreak();
    if (streak > 0) {
      streakNote.innerHTML = 'Текущая серия: <strong>' + streak + '</strong> ' + dayWord(streak);
    } else {
      streakNote.textContent = 'Отметь сегодняшний день, чтобы начать серию.';
    }
  }

  function dayWord(n) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'день';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
    return 'дней';
  }

  moodRow.addEventListener('click', function (e) {
    var btn = e.target.closest('.mood-btn');
    if (!btn) return;
    var entry = getEntry(todayKey);
    entry.mood = (entry.mood === btn.dataset.mood) ? null : btn.dataset.mood;
    setEntry(todayKey, entry);
    renderToday();
  });

  // ================== ПРАЗДНИК (конфетти + аффирмации) ==================
  var fxLayer = document.createElement('div');
  fxLayer.className = 'fx-layer';
  document.body.appendChild(fxLayer);

  var FX_COLORS = ['#a78bfa', '#8b5cf6', '#62d9a2', '#f0c05a', '#f2705d', '#7dd3fc'];
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lastBurstAt = 0;

  // Небольшой залп частиц из точки (x, y в px от окна).
  function burstAt(x, y, count, spread) {
    if (reducedMotion) return;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'fx-particle';
      var angle = Math.random() * Math.PI * 2;
      var dist = (0.35 + Math.random() * 0.65) * spread;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist - spread * 0.35; // чуть вверх
      var size = 5 + Math.random() * 5;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)];
      if (Math.random() < 0.4) p.style.borderRadius = '50%';
      p.style.setProperty('--fx-dx', dx + 'px');
      p.style.setProperty('--fx-dy', dy + 'px');
      p.style.setProperty('--fx-rot', (Math.random() * 540 - 270) + 'deg');
      p.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';
      fxLayer.appendChild(p);
    }
    lastBurstAt = Date.now();
    // чистим слой, когда частицы отжили
    window.setTimeout(function () {
      if (Date.now() - lastBurstAt >= 1400) fxLayer.innerHTML = '';
    }, 1500);
  }

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Залп на галочку: чем больше отмечено, тем щедрее.
  function celebrateHabit(row, checkedCount) {
    var c = centerOf(row.querySelector('.habit-check') || row);
    var counts = [10, 18, 30];
    var spreads = [70, 100, 140];
    var idx = Math.min(checkedCount, 3) - 1;
    burstAt(c.x, c.y, counts[idx], spreads[idx]);
  }

  // Фейерверк на завершение дня: серия залпов по экрану.
  function celebrateFinish() {
    if (reducedMotion) return;
    var w = window.innerWidth, h = window.innerHeight;
    burstAt(w * 0.5, h * 0.35, 34, 160);
    window.setTimeout(function () { burstAt(w * 0.25, h * 0.5, 22, 120); }, 180);
    window.setTimeout(function () { burstAt(w * 0.75, h * 0.45, 22, 120); }, 320);
    window.setTimeout(function () { burstAt(w * 0.5, h * 0.6, 26, 140); }, 500);
  }

  // ---------- Аффирмации ----------
  // Тон — как в разделе «Что это?»: спокойно, без сюсюканья, про возвращение.
  var PHRASES = {
    habit1: [
      'Начало положено.',
      'Первая есть. Уже не ноль.',
      'Маленький шаг — тоже шаг.',
      'Лёд тронулся.'
    ],
    habit2: [
      'Две из трёх. Хороший темп.',
      'Ещё одна — и день собран.',
      'Осталась последняя.',
      'Почти всё.'
    ],
    habit3: [
      'Все три. Сегодня — полный день.',
      '3 из 3. Красиво.',
      'Полный комплект. Так и живём.',
      'Вся тройка на месте.'
    ],
    finishGood: [
      'Отличный день. Завтра просто продолжай.',
      'Такие дни складываются в месяцы.',
      'Хороший день записан. Он теперь никуда не денется.'
    ],
    finishOk: [
      'Обычный день — это тоже день. Засчитано.',
      'Не каждый день праздник, и это нормально.',
      'День закрыт. Идём дальше.'
    ],
    finishBad: [
      'Сегодня не очень — но завтра будет лучше. Главное не останавливаться.',
      'Плохой день записан честно. Это уже смелость.',
      'Один такой день ничего не решает. Решает то, что ты вернулся.'
    ],
    finishEmpty: [
      'День закрыт. Даже пустой день, отмеченный честно, лучше забытого.',
      'Записал — значит не бросил.'
    ],
    streak: [
      'Один раз пропустить можно. Два — уже привычка наоборот.',
      'Серия растёт. Береги её, но не бойся за неё.'
    ]
  };

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // Тост — маленькое оконце с фразой внизу экрана.
  var toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.body.appendChild(toastEl);
  var toastTimer = null;

  function showToast(text, long) {
    toastEl.textContent = text;
    toastEl.classList.add('is-shown');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-shown');
    }, long ? 3600 : 2200);
  }

  function affirmationForFinish(entry) {
    var n = doneCount(entry);
    if (entry.mood === 'red') return pick(PHRASES.finishBad);
    if (n === 0 && !entry.mood) return pick(PHRASES.finishEmpty);
    if (entry.mood === 'green' || n === habitsConfig.length) return pick(PHRASES.finishGood);
    return pick(PHRASES.finishOk);
  }

  habitsList.addEventListener('click', function (e) {
    var row = e.target.closest('.habit-row');
    if (!row) return;
    var entry = getEntry(todayKey);
    var key = row.dataset.habit;
    entry.habits[key] = !entry.habits[key];
    setEntry(todayKey, entry);
    renderToday();

    // празднуем только постановку галочки, не снятие
    if (entry.habits[key]) {
      var n = doneCount(entry);
      celebrateHabit(row, n);
      if (n === 1) showToast(pick(PHRASES.habit1));
      else if (n === 2) showToast(pick(PHRASES.habit2));
      else if (n >= habitsConfig.length) showToast(pick(PHRASES.habit3));
    }
  });

  finishBtn.addEventListener('click', function () {
    var entry = getEntry(todayKey);
    entry.completed = !entry.completed;
    setEntry(todayKey, entry);
    renderToday();
    if (isCurrentMonthViewed()) renderStats();

    // празднуем только завершение, не отмену
    if (entry.completed) {
      celebrateFinish();
      var streak = computeCurrentStreak();
      // каждые 7 дней серии — отдельная фраза о серии
      if (streak > 1 && streak % 7 === 0) {
        showToast('Серия: ' + streak + ' ' + dayWord(streak) + '. ' + pick(PHRASES.streak), true);
      } else {
        showToast(affirmationForFinish(entry), true);
      }
    }
  });

  // ================== СЕРИЯ (STREAK) ==================
  // Текущая серия = подряд идущие завершённые дни, заканчивая сегодняшним
  // или вчерашним, если сегодняшний день ещё не отмечен.
  function computeCurrentStreak() {
    var cursor = new Date(today);
    if (!getEntry(keyOf(cursor)).completed) {
      cursor.setDate(cursor.getDate() - 1);
    }
    var streak = 0;
    while (getEntry(keyOf(cursor)).completed) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // Самая длинная серия завершённых дней внутри конкретного месяца
  function bestStreakInMonth(year, month) {
    var total = daysInMonth(year, month);
    var best = 0, current = 0;
    for (var d = 1; d <= total; d++) {
      if (getEntry(toKey(year, month, d)).completed) {
        current++;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    return best;
  }

  // ================== ВКЛАДКА "СТАТИСТИКА" ==================
  var monthTitleEl = document.getElementById('month-title');
  var statsGrid = document.getElementById('stats-grid');
  var weekdayRow = document.getElementById('weekday-row');
  var calendarGrid = document.getElementById('calendar-grid');
  var dayDetail = document.getElementById('day-detail');
  var summaryBtn = document.getElementById('summary-btn');
  var summaryCard = document.getElementById('summary-card');

  function isCurrentMonthViewed() {
    return viewYear === today.getFullYear() && viewMonth === today.getMonth();
  }

  function computeMonthStats(year, month) {
    var total = daysInMonth(year, month);
    var counts = {};
    habitsConfig.forEach(function (h) { counts[h.id] = 0; });
    var mood = { red: 0, yellow: 0, green: 0 };
    var recorded = 0, fullDays = 0, totalDone = 0;

    for (var d = 1; d <= total; d++) {
      var raw = appData[toKey(year, month, d)];
      if (!raw) continue;
      var entry = normalizeEntry(raw);
      if (entry.mood) mood[entry.mood]++;
      if (entry.completed) recorded++;
      habitsConfig.forEach(function (h) {
        if (entry.habits[h.id]) { counts[h.id]++; totalDone++; }
      });
      if (isFullDay(entry)) fullDays++;
    }

    var totalPossible = total * habitsConfig.length;
    var completionPct = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;

    return {
      total: total, counts: counts, mood: mood, recorded: recorded,
      fullDays: fullDays, totalDone: totalDone, totalPossible: totalPossible,
      completionPct: completionPct, bestStreak: bestStreakInMonth(year, month)
    };
  }

  function renderMonthNav() {
    monthTitleEl.textContent = MONTHS_NOM[viewMonth] + ' ' + viewYear;
  }

  function renderStatsGrid() {
    var s = computeMonthStats(viewYear, viewMonth);
    var html = '';

    habitsConfig.forEach(function (h) {
      var value = s.counts[h.id] || 0;
      var pct = s.total ? Math.round((value / s.total) * 100) : 0;
      html += '<div class="stat-row-wrap">' +
        '<div class="stat-row">' +
        '<span class="stat-icon">' + h.icon + '</span>' +
        '<span class="stat-name">' + h.name + '</span>' +
        '<span class="stat-value">' + value + '/' + s.total + '</span>' +
        '</div>' +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    });

    html += '<div class="stats-divider"></div>';
    html += '<div class="stat-highlight-row"><span class="stat-name">Выполнение</span><span class="stat-value">' + s.completionPct + '%</span></div>';
    html += '<div class="stat-highlight-row"><span class="stat-name">Дней все 3 привычки</span><span class="stat-value">' + s.fullDays + '</span></div>';
    html += '<div class="stat-highlight-row"><span class="stat-name">Лучшая серия</span><span class="stat-value">' + s.bestStreak + '</span></div>';

    statsGrid.innerHTML = html;
  }

  function renderWeekdayRow() {
    if (weekdayRow.childElementCount) return;
    weekdayRow.innerHTML = WEEKDAYS.map(function (w) { return '<span>' + w + '</span>'; }).join('');
  }

  function renderCalendar() {
    var total = daysInMonth(viewYear, viewMonth);
    var firstDow = mondayIndex(new Date(viewYear, viewMonth, 1).getDay());
    var html = '';

    for (var i = 0; i < firstDow; i++) html += '<div class="day-cell is-empty"></div>';

    for (var d = 1; d <= total; d++) {
      var key = toKey(viewYear, viewMonth, d);
      var raw = appData[key];
      var classes = ['day-cell'];
      if (key === todayKey) classes.push('is-today');
      if (key === selectedDayKey) classes.push('is-selected');
      if (raw) {
        var entry = normalizeEntry(raw);
        if (entry.mood) classes.push('has-mood-' + entry.mood);
        if (isFullDay(entry)) classes.push('is-full');
      }
      html += '<div class="' + classes.join(' ') + '" data-day-key="' + key + '">' + d + '</div>';
    }

    calendarGrid.innerHTML = html;
  }

  var MOOD_LABEL = { red: 'плохой 🔴', yellow: 'обычный 🟡', green: 'хороший 🟢' };

  function renderDayDetail() {
    if (!selectedDayKey) {
      dayDetail.classList.add('is-hidden');
      return;
    }
    var raw = appData[selectedDayKey];
    var parts = selectedDayKey.split('-');
    var label = parseInt(parts[2], 10) + ' ' + MONTHS_GEN[parseInt(parts[1], 10) - 1];

    if (!raw || isEmptyEntry(normalizeEntry(raw))) {
      dayDetail.innerHTML = '<strong>' + label + '</strong> — нет записи.';
    } else {
      var entry = normalizeEntry(raw);
      var icons = habitsConfig.filter(function (h) { return entry.habits[h.id]; })
                              .map(function (h) { return h.icon; });
      dayDetail.innerHTML = '<strong>' + label + '</strong> — ' +
        (entry.mood ? MOOD_LABEL[entry.mood] : 'настроение не отмечено') +
        (icons.length ? ', ' + icons.join(' ') : ', без привычек');
    }
    dayDetail.classList.remove('is-hidden');
  }

  calendarGrid.addEventListener('click', function (e) {
    var cell = e.target.closest('.day-cell');
    if (!cell || !cell.dataset.dayKey) return;
    selectedDayKey = (selectedDayKey === cell.dataset.dayKey) ? null : cell.dataset.dayKey;
    renderCalendar();
    renderDayDetail();
  });

  document.getElementById('prev-month').addEventListener('click', function () {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    selectedDayKey = null;
    summaryCard.classList.add('is-hidden');
    renderStats();
  });
  document.getElementById('next-month').addEventListener('click', function () {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    selectedDayKey = null;
    summaryCard.classList.add('is-hidden');
    renderStats();
  });

  function renderStats() {
    renderMonthNav();
    renderStatsGrid();
    renderWeekdayRow();
    renderCalendar();
    renderDayDetail();
  }

  // ================== ИТОГИ МЕСЯЦА ==================
  function renderSummary() {
    var s = computeMonthStats(viewYear, viewMonth);
    var isCurrent = isCurrentMonthViewed();
    var elapsed = isCurrent ? today.getDate() : s.total;

    var bestDayLabel = findBestDay(viewYear, viewMonth);
    var badDays = s.mood.red;

    var html = '<h3>' + MONTHS_NOM[viewMonth] + ' ' + viewYear + '</h3>';
    html += '<p class="summary-line">' + (isCurrent ? 'Прожито ' + elapsed + ' из ' + s.total + ' ' + dayWord(s.total) + '.' : 'Прожит ' + s.total + ' ' + dayWord(s.total) + '.') + '</p>';
    habitsConfig.forEach(function (h) {
      var value = s.counts[h.id] || 0;
      html += '<p class="summary-line">' + h.icon + ' ' + h.name + ' — <strong>' + value + '</strong> ' + dayWord(value) + '</p>';
    });
    html += '<p class="summary-line">Всего выполнено <strong>' + s.totalDone + '</strong> из ' + s.totalPossible + ' привычек.</p>';
    if (bestDayLabel) html += '<p class="summary-line">Лучший день: <strong>' + bestDayLabel + '</strong></p>';
    html += '<p class="summary-line">Самая длинная серия: <strong>' + s.bestStreak + '</strong> ' + dayWord(s.bestStreak) + '</p>';
    html += '<p class="summary-line">Плохих дней: <strong>' + badDays + '</strong></p>';

    var closing;
    if (badDays === 0 && s.recorded === 0) {
      closing = 'Пока нет ни одной записи за этот месяц.';
    } else if (badDays > 0) {
      closing = 'И ты всё равно продолжил.';
    } else {
      closing = 'Ни одного по-настоящему плохого дня.';
    }
    html += '<p class="summary-closing">' + closing + '</p>';

    summaryCard.innerHTML = html;
    summaryCard.classList.remove('is-hidden');
  }

  function findBestDay(year, month) {
    var total = daysInMonth(year, month);
    var bestKey = null, bestScore = -1, bestGreen = false;
    for (var d = 1; d <= total; d++) {
      var key = toKey(year, month, d);
      var raw = appData[key];
      if (!raw) continue;
      var entry = normalizeEntry(raw);
      var n = doneCount(entry);
      var isGreen = entry.mood === 'green';
      if (n > bestScore || (n === bestScore && isGreen && !bestGreen)) {
        bestScore = n; bestKey = key; bestGreen = isGreen;
      }
    }
    if (!bestKey || bestScore <= 0) return null;
    var parts = bestKey.split('-');
    return parseInt(parts[2], 10) + ' ' + MONTHS_GEN[parseInt(parts[1], 10) - 1];
  }

  summaryBtn.addEventListener('click', function () {
    if (summaryCard.classList.contains('is-hidden')) {
      renderSummary();
      summaryCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      summaryCard.classList.add('is-hidden');
    }
  });

  // ================== НАПОМИНАНИЕ ==================
  var LN = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
  var REMINDER_ID = 1001;
  var REMINDER_KEY = 'triGalochkiReminder';

  function loadReminder() {
    try {
      var raw = localStorage.getItem(REMINDER_KEY);
      return raw ? JSON.parse(raw) : { enabled: false, time: '21:00' };
    } catch (e) {
      return { enabled: false, time: '21:00' };
    }
  }
  function saveReminder(r) { localStorage.setItem(REMINDER_KEY, JSON.stringify(r)); }

  function parseTime(t) {
    var parts = t.split(':');
    return { hour: parseInt(parts[0], 10), minute: parseInt(parts[1], 10) };
  }

  function scheduleReminder(time) {
    if (!LN) return;
    var hm = parseTime(time);
    LN.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: 'Три галочки',
        body: 'Как прошёл день? Отметь за 20 секунд.',
        schedule: { on: { hour: hm.hour, minute: hm.minute }, allowWhileIdle: true }
      }]
    }).catch(function () {});
  }

  function cancelReminder() {
    if (!LN) return;
    LN.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(function () {});
  }

  var settingsBtn = document.getElementById('settings-btn');
  var settingsPanel = document.getElementById('settings-panel');
  var reminderToggle = document.getElementById('reminder-toggle');
  var reminderTime = document.getElementById('reminder-time');
  var reminderNote = document.getElementById('reminder-note');
  var reminder = loadReminder();

  reminderToggle.checked = reminder.enabled;
  reminderTime.value = reminder.time;

  if (!LN) {
    reminderToggle.disabled = true;
    reminderNote.textContent = 'Работает только в установленном приложении, не в браузере.';
  } else if (reminder.enabled) {
    scheduleReminder(reminder.time);
  }

  settingsBtn.addEventListener('click', function () {
    var willOpen = settingsPanel.classList.contains('is-hidden');
    settingsPanel.classList.toggle('is-hidden');
    if (willOpen) renderHabitsEditor();
  });

  reminderToggle.addEventListener('change', function () {
    if (!LN) { reminderToggle.checked = false; return; }
    if (reminderToggle.checked) {
      LN.requestPermissions().then(function (res) {
        if (res.display === 'granted') {
          reminder.enabled = true;
          saveReminder(reminder);
          scheduleReminder(reminder.time);
          reminderNote.textContent = '';
        } else {
          reminderToggle.checked = false;
          reminderNote.textContent = 'Уведомления запрещены в настройках телефона.';
        }
      });
    } else {
      reminder.enabled = false;
      saveReminder(reminder);
      cancelReminder();
      reminderNote.textContent = '';
    }
  });

  reminderTime.addEventListener('change', function () {
    reminder.time = reminderTime.value;
    saveReminder(reminder);
    if (reminder.enabled) scheduleReminder(reminder.time);
  });

  function enableReminderAt(time) {
    if (!LN) return;
    LN.requestPermissions().then(function (res) {
      if (res.display !== 'granted') return;
      reminder.enabled = true;
      reminder.time = time;
      saveReminder(reminder);
      scheduleReminder(time);
      reminderToggle.checked = true;
      reminderTime.value = time;
    }).catch(function () {});
  }

  // ================== РЕДАКТОР ПРИВЫЧЕК ==================
  var habitsEditor = document.getElementById('habits-editor');
  var habitsEditorNote = document.getElementById('habits-editor-note');
  var habitsSaveBtn = document.getElementById('habits-save');
  var habitsResetBtn = document.getElementById('habits-reset');

  var MAX_NAME = 24;

  function renderHabitsEditor() {
    var html = '';
    habitsConfig.forEach(function (h, i) {
      html += '<div class="habit-edit-row">' +
        '<input type="text" class="habit-edit-icon" data-index="' + i + '" value="' + escapeAttr(h.icon) + '" maxlength="4" aria-label="Иконка привычки ' + (i + 1) + '">' +
        '<input type="text" class="habit-edit-name" data-index="' + i + '" value="' + escapeAttr(h.name) + '" maxlength="' + MAX_NAME + '" aria-label="Название привычки ' + (i + 1) + '">' +
        '</div>';
    });
    habitsEditor.innerHTML = html;
    habitsEditorNote.textContent = '';
    habitsEditorNote.classList.remove('is-error');
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function editorNote(text, isError) {
    habitsEditorNote.textContent = text;
    habitsEditorNote.classList.toggle('is-error', !!isError);
  }

  habitsSaveBtn.addEventListener('click', function () {
    var iconInputs = habitsEditor.querySelectorAll('.habit-edit-icon');
    var nameInputs = habitsEditor.querySelectorAll('.habit-edit-name');
    var next = [];

    for (var i = 0; i < habitsConfig.length; i++) {
      var icon = (iconInputs[i].value || '').trim();
      var name = (nameInputs[i].value || '').trim();
      if (!name) { editorNote('Название не может быть пустым.', true); return; }
      if (name.length > MAX_NAME) { editorNote('Название длиннее ' + MAX_NAME + ' символов.', true); return; }
      if (!icon) { editorNote('Добавь иконку — эмодзи или один символ.', true); return; }
      if (Array.from(icon).length > 2) { editorNote('Иконка — не больше двух символов.', true); return; }
      next.push({ id: habitsConfig[i].id, name: name, icon: icon });
    }

    // id не меняются, поэтому накопленные отметки остаются на месте
    applyHabitsConfig(next, false);
    renderHabitsList();
    renderToday();
    renderStats();
    editorNote('Сохранено.', false);
  });

  habitsResetBtn.addEventListener('click', function () {
    applyHabitsConfig(DEFAULT_HABITS, true);
    renderHabitsEditor();
    renderHabitsList();
    renderToday();
    renderStats();
    editorNote('Вернул стандартный набор.', false);
  });

  // ================== ОНБОРДИНГ ==================
  var ONBOARD_KEY = 'triGalochkiOnboardDone';
  function onboardIsDone() {
    try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch (e) { return false; }
  }
  function markOnboardDone() {
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  }

  var onboard = document.getElementById('onboard');
  var onboardPresets = document.getElementById('onboard-presets');
  var onboardChosen = document.getElementById('onboard-chosen');
  var selectedPreset = 0;

  function onboardStep(n) {
    var steps = onboard.querySelectorAll('.onboard-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle('is-active', parseInt(steps[i].dataset.step, 10) === n);
    }
    var dots = onboard.querySelectorAll('.onboard-dot');
    for (var j = 0; j < dots.length; j++) {
      dots[j].classList.toggle('is-active', j === n - 1);
    }
    if (n === 3) renderChosen();
  }

  function renderPresetCards() {
    var html = '';
    PRESETS.forEach(function (p, i) {
      var habits = presetHabits(p);
      html += '<button type="button" class="preset-card' + (i === selectedPreset ? ' is-selected' : '') + '" data-preset="' + i + '">' +
        '<span class="preset-head"><strong>' + p.title + '</strong><span class="preset-hint">' + p.hint + '</span></span>' +
        '<span class="preset-habits">' +
        habits.map(function (h) { return '<span class="preset-habit">' + h.icon + ' ' + h.name + '</span>'; }).join('') +
        '</span>' +
        '</button>';
    });
    onboardPresets.innerHTML = html;
  }

  function renderChosen() {
    var habits = presetHabits(PRESETS[selectedPreset]);
    onboardChosen.innerHTML = habits.map(function (h) {
      return '<div class="chosen-row"><span class="habit-icon">' + h.icon + '</span><span class="habit-name">' + h.name + '</span></div>';
    }).join('');
  }

  function finishOnboarding(useDefaults) {
    var config = useDefaults ? DEFAULT_HABITS : presetHabits(PRESETS[selectedPreset]);
    applyHabitsConfig(config, true);
    markOnboardDone();
    onboard.classList.add('is-hidden');
    renderHabitsList();
    renderToday();
    renderStats();

    var wantsReminder = document.getElementById('onboard-reminder');
    if (!useDefaults && wantsReminder && wantsReminder.checked) enableReminderAt('21:00');
  }

  function initOnboarding() {
    if (onboardIsDone()) {
      onboard.classList.add('is-hidden');
      return;
    }
    onboard.classList.remove('is-hidden');
    renderPresetCards();
    onboardStep(1);

    onboardPresets.addEventListener('click', function (e) {
      var card = e.target.closest('.preset-card');
      if (!card) return;
      selectedPreset = parseInt(card.dataset.preset, 10);
      renderPresetCards();
    });

    onboard.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-onboard-go]');
      if (btn) { onboardStep(parseInt(btn.dataset.onboardGo, 10)); return; }
      if (e.target.closest('#onboard-skip')) { finishOnboarding(true); return; }
      if (e.target.closest('#onboard-finish')) { finishOnboarding(false); }
    });
  }

  // ================== ВКЛАДКИ ==================
  var TAB_ORDER = ['today', 'stats', 'about'];
  var tabBtns = document.querySelectorAll('.tab-btn');
  var views = {
    today: document.getElementById('view-today'),
    stats: document.getElementById('view-stats'),
    about: document.getElementById('view-about')
  };

  function activateTab(name) {
    if (!views[name]) return;
    tabBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === name); });
    Object.keys(views).forEach(function (k) { views[k].classList.toggle('is-active', k === name); });
    if (name === 'stats') renderStats();
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.dataset.tab); });
  });

  function currentTab() {
    var active = document.querySelector('.tab-btn.is-active');
    return active ? active.dataset.tab : 'today';
  }

  // ================== СВАЙП СО СДВИГОМ ==================
  // Экран следует за пальцем; при отпускании либо доезжает до соседней
  // вкладки, либо возвращается на место. На краях — «резинка».
  var appEl = document.querySelector('.app');
  var swipe = {
    tracking: false,  // палец на экране, ждём определения жеста
    dragging: false,  // жест распознан как горизонтальный, двигаем экраны
    startX: 0, startY: 0, startT: 0,
    dx: 0, width: 1,
    fromEl: null, toEl: null, toName: null, dir: 0
  };

  function beginDrag() {
    var name = currentTab();
    swipe.fromEl = views[name];
    swipe.width = swipe.fromEl.offsetWidth || window.innerWidth;
    swipe.dragging = true;
    swipe.fromEl.classList.add('view-dragging');
  }

  function attachNeighbor(dir) {
    // dir: 1 = свайп влево (следующая вкладка), -1 = вправо (предыдущая)
    detachNeighbor();
    var i = TAB_ORDER.indexOf(currentTab());
    var next = i + dir;
    if (next < 0 || next >= TAB_ORDER.length) { swipe.toEl = null; swipe.toName = null; return; }
    swipe.toName = TAB_ORDER[next];
    swipe.toEl = views[swipe.toName];
    if (swipe.toName === 'stats') renderStats();
    swipe.toEl.classList.add('view-peek', 'view-dragging');
    swipe.toEl.style.top = swipe.fromEl.offsetTop + 'px';
    swipe.dir = dir;
  }

  function detachNeighbor() {
    if (!swipe.toEl) return;
    swipe.toEl.classList.remove('view-peek', 'view-dragging', 'view-anim');
    swipe.toEl.style.top = '';
    swipe.toEl.style.transform = '';
    swipe.toEl = null;
    swipe.toName = null;
  }

  function setDragPosition(dx) {
    var dir = dx < 0 ? 1 : -1;
    if (dir !== swipe.dir || !swipe.toEl) attachNeighbor(dir);
    if (!swipe.toEl) dx = dx * 0.3; // край списка — сопротивление
    swipe.fromEl.style.transform = 'translateX(' + dx + 'px)';
    if (swipe.toEl) {
      swipe.toEl.style.transform = 'translateX(' + (dx + swipe.dir * swipe.width) + 'px)';
    }
  }

  function endDrag(commit) {
    var fromEl = swipe.fromEl, toEl = swipe.toEl, toName = swipe.toName;
    var width = swipe.width, dir = swipe.dir;
    swipe.dragging = false;
    swipe.fromEl = null;

    if (commit && toEl) {
      fromEl.classList.add('view-anim');
      toEl.classList.add('view-anim');
      fromEl.style.transform = 'translateX(' + (-dir * width) + 'px)';
      toEl.style.transform = 'translateX(0)';
      window.setTimeout(function () {
        fromEl.classList.remove('view-dragging', 'view-anim');
        fromEl.style.transform = '';
        toEl.classList.remove('view-peek', 'view-dragging', 'view-anim');
        toEl.style.top = '';
        toEl.style.transform = '';
        swipe.toEl = null; swipe.toName = null; swipe.dir = 0;
        activateTab(toName, true);
      }, 260);
    } else {
      // откат на место
      fromEl.classList.add('view-anim');
      fromEl.style.transform = 'translateX(0)';
      if (toEl) {
        toEl.classList.add('view-anim');
        toEl.style.transform = 'translateX(' + (dir * width) + 'px)';
      }
      window.setTimeout(function () {
        fromEl.classList.remove('view-dragging', 'view-anim');
        fromEl.style.transform = '';
        detachNeighbor();
        swipe.dir = 0;
      }, 260);
    }
  }

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1 || swipe.dragging) { swipe.tracking = false; return; }
    if (!onboard.classList.contains('is-hidden')) { swipe.tracking = false; return; }
    if (e.target.closest('.tabbar, .switch, input, .settings-panel')) { swipe.tracking = false; return; }
    swipe.tracking = true;
    swipe.startX = e.touches[0].clientX;
    swipe.startY = e.touches[0].clientY;
    swipe.startT = Date.now();
    swipe.dx = 0;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!swipe.tracking) return;
    var dx = e.touches[0].clientX - swipe.startX;
    var dy = e.touches[0].clientY - swipe.startY;

    if (!swipe.dragging) {
      // решаем, что это: горизонтальный сдвиг или вертикальный скролл
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { swipe.tracking = false; return; }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) beginDrag();
      else return;
    }

    swipe.dx = dx;
    setDragPosition(dx);
  }, { passive: true });

  document.addEventListener('touchend', function () {
    if (!swipe.tracking) return;
    swipe.tracking = false;
    if (!swipe.dragging) return;

    var elapsed = Date.now() - swipe.startT;
    var velocity = Math.abs(swipe.dx) / Math.max(elapsed, 1); // px/ms
    var farEnough = Math.abs(swipe.dx) > swipe.width * 0.28;
    var fastEnough = velocity > 0.45 && Math.abs(swipe.dx) > 40;

    endDrag((farEnough || fastEnough) && !!swipe.toEl);
  }, { passive: true });

  document.addEventListener('touchcancel', function () {
    swipe.tracking = false;
    if (swipe.dragging) endDrag(false);
  }, { passive: true });

  // ================== ТЕМА ==================
  var THEME_KEY = 'triGalochkiTheme';
  var themeBtn = document.getElementById('theme-btn');

  function loadTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'dark';
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeBtn.textContent = '☀';
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeBtn.textContent = '☾';
    }
  }

  var currentTheme = loadTheme();
  applyTheme(currentTheme);

  themeBtn.addEventListener('click', function () {
    currentTheme = (currentTheme === 'dark') ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, currentTheme); } catch (e) {}
    applyTheme(currentTheme);
  });

  // ================== СТАРТ ==================
  migrateLegacyEntries();
  initOnboarding();
  renderHabitsList();
  renderTodayHeading();
  renderToday();
  renderStats();
})();
