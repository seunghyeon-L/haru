'use strict';

/* =========================================================
   하루 — 매일 루틴 + 스트릭 + OKR
   웹에서는 localStorage, 안드로이드 앱에서는 위젯과 같은 네이티브 저장소를 쓴다.
   ========================================================= */

const KEY = 'haru.v1';
const SLOTS = [
  { id: 'morning', label: '아침' },
  { id: 'afternoon', label: '오후' },
  { id: 'evening', label: '저녁' },
  { id: 'anytime', label: '언제든' },
];
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월요일부터 표시
// 루틴 색 (위젯 HaruStore.PALETTE 와 같은 순서)
const PALETTE = ['#4c7df0', '#7b6cf0', '#b062e0', '#e2659b', '#ec5b57', '#f08a3e', '#dfa42a', '#3aae73', '#1fa79f', '#6b7a90'];
const ICONS = ['💧', '🏃', '📖', '✍️', '🧘', '💻', '🎧', '📝', '🧠', '😴', '🦷', '💊', '🧹', '🌱', '🎸', '🍎', '☕', '🚶', '🏋️', '💰', '🗣️', '🎯', '⭐'];
const SVG = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

/* ---------- 날짜 ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const dow = (s) => parse(s).getDay();
const mondayOf = (s) => addDays(s, -((dow(s) + 6) % 7));
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const md = (s) => { const d = parse(s); return `${d.getMonth() + 1}.${d.getDate()}`; };
const longDate = (s) => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`; };

function quarterRange(offset = 0) {
  const n = new Date();
  const q = Math.floor(n.getMonth() / 3) + offset;
  const y = n.getFullYear() + Math.floor(q / 4);
  const qq = ((q % 4) + 4) % 4;
  return [ymd(new Date(y, qq * 3, 1)), ymd(new Date(y, qq * 3 + 3, 0))];
}
function monthRange() {
  const n = new Date();
  return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(new Date(n.getFullYear(), n.getMonth() + 1, 0))];
}
function yearRange() {
  const y = new Date().getFullYear();
  return [`${y}-01-01`, `${y}-12-31`];
}

/* ---------- 유틸 ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
const pct = (r) => `${Math.round(r * 100)}%`;
const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : PALETTE[0]);
const firstChar = (s) => (Array.from(String(s).trim())[0] || '·').toUpperCase();

function readPref(k) { try { return localStorage.getItem(k); } catch { return null; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* 무시 */ } }

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2200);
}

function ring(ratio, size, stroke, color) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"${color ? ` style="--c:${color}"` : ''}>
    <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="bar" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - clamp(ratio, 0, 1))}"/>
  </svg>`;
}

/* ---------- 상태 ---------- */
const native = window.HaruNative || null;
const emptyState = () => ({ version: 1, habits: [], log: {}, objectives: [] });

// 예전 데이터에는 색/아이콘이 없다. 순서대로 색을 정해 준다.
function normalize(s) {
  s.habits.forEach((h, i) => {
    if (!/^#[0-9a-f]{6}$/i.test(h.color || '')) h.color = PALETTE[i % PALETTE.length];
    if (typeof h.icon !== 'string') h.icon = '';
  });
  return s;
}

function load() {
  try {
    const s = JSON.parse(native ? native.load() : localStorage.getItem(KEY));
    if (s && s.version === 1) return normalize(s);
  } catch { /* 처음 실행 또는 손상 */ }
  return emptyState();
}
function save() {
  const json = JSON.stringify(state);
  try {
    if (native) native.save(json);
    else localStorage.setItem(KEY, json);
  } catch { toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); }
}

let state = load();
let tab = readPref('haru.tab') || 'today';
let viewDate = null; // null이면 오늘
let justToggled = null;
let showPast = false;

/* ---------- 루틴 계산 ---------- */
const sortedHabits = () => [...state.habits].sort((a, b) => a.order - b.order);
const isScheduled = (h, d) => d >= h.createdAt && h.days.includes(dow(d));
const isDone = (h, d) => (state.log[d] || []).includes(h.id);

function setDone(h, d, on) {
  const list = state.log[d] || [];
  const i = list.indexOf(h.id);
  if (on && i < 0) list.push(h.id);
  if (!on && i >= 0) list.splice(i, 1);
  if (list.length) state.log[d] = list;
  else delete state.log[d];
}

// 현재 연속 달성: 오늘을 아직 안 했으면 어제부터 센다.
function streak(h) {
  let d = today();
  if (!isDone(h, d)) d = addDays(d, -1);
  let n = 0;
  while (d >= h.createdAt) {
    if (h.days.includes(dow(d))) {
      if (isDone(h, d)) n++;
      else break;
    }
    d = addDays(d, -1);
  }
  return n;
}

function bestStreak(h) {
  const t = today();
  let best = 0, cur = 0;
  for (let d = h.createdAt; d <= t; d = addDays(d, 1)) {
    if (!h.days.includes(dow(d))) continue;
    if (isDone(h, d)) best = Math.max(best, ++cur);
    else if (d !== t) cur = 0;
  }
  return best;
}

const totalDone = (h) => Object.values(state.log).reduce((n, ids) => n + (ids.includes(h.id) ? 1 : 0), 0);

// 기간 내 달성률. 오늘은 완료했을 때만 분모에 넣는다.
function rangeStats(from, to, habits = state.habits) {
  const t = today();
  let done = 0, total = 0;
  for (let d = from; d <= to && d <= t; d = addDays(d, 1)) {
    for (const h of habits) {
      if (!isScheduled(h, d)) continue;
      const ok = isDone(h, d);
      if (d === t && !ok) continue;
      total++;
      if (ok) done++;
    }
  }
  return { done, total, rate: total ? done / total : 0 };
}

function dayProgress(d) {
  const sched = state.habits.filter((h) => isScheduled(h, d));
  return { total: sched.length, done: sched.filter((h) => isDone(h, d)).length };
}

function daysLabel(days) {
  const s = [...days].sort().join('');
  if (s === '0123456') return '매일';
  if (s === '12345') return '평일';
  if (s === '06') return '주말';
  return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => WEEK[d]).join('·');
}

const chip = (h, cls = '') =>
  `<span class="chip-icon ${cls}" style="--c:${safeColor(h.color)}" aria-hidden="true">${h.icon ? esc(h.icon) : esc(firstChar(h.title))}</span>`;

/* ---------- OKR 계산 ---------- */
function krValue(kr, o) {
  if (kr.mode !== 'habit') return num(kr.current);
  let n = 0;
  for (const [d, ids] of Object.entries(state.log)) {
    if (d < o.start || d > o.end) continue;
    for (const id of ids) if (kr.habitIds.includes(id)) n++;
  }
  return n;
}
function krProgress(kr, o) {
  const v = krValue(kr, o);
  const s = kr.mode === 'habit' ? 0 : num(kr.start);
  const t = num(kr.target);
  if (t === s) return v >= t ? 1 : 0;
  return clamp((v - s) / (t - s), 0, 1);
}
function objProgress(o) {
  if (!o.krs.length) return 0;
  return o.krs.reduce((a, kr) => a + krProgress(kr, o), 0) / o.krs.length;
}
function elapsed(o) {
  const total = diffDays(o.start, o.end) + 1;
  return clamp((diffDays(o.start, today()) + 1) / total, 0, 1);
}
function objStatus(o) {
  const p = objProgress(o);
  if (today() > o.end) return p >= 1 ? ['good', '달성'] : ['muted', '종료'];
  if (today() < o.start) return ['muted', '시작 전'];
  if (!o.krs.length) return ['muted', '핵심 결과 없음'];
  if (p >= 1) return ['good', '달성'];
  const gap = elapsed(o) - p;
  if (gap <= 0.1) return ['good', '순조로움'];
  if (gap <= 0.25) return ['warn', '조금 늦음'];
  return ['bad', '뒤처짐'];
}
const krsForHabit = (h) => state.objectives.flatMap((o) => o.krs.filter((kr) => kr.mode === 'habit' && kr.habitIds.includes(h.id)));
const krColor = (kr) => {
  const h = kr.mode === 'habit' ? state.habits.find((x) => kr.habitIds.includes(x.id)) : null;
  return h ? safeColor(h.color) : 'var(--accent)';
};

/* =========================================================
   렌더링
   ========================================================= */
const view = document.getElementById('view');

function render() {
  document.querySelectorAll('.tabbar button').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  if (tab === 'stats') view.innerHTML = renderStats();
  else if (tab === 'okr') view.innerHTML = renderOkr();
  else view.innerHTML = renderToday();
  justToggled = null;
}

/* ---------- 오늘 ---------- */
function renderToday() {
  const t = today();
  const d = viewDate || t;
  const isToday = d === t;
  const dt = parse(d);
  const list = sortedHabits().filter((h) => isScheduled(h, d));
  const done = list.filter((h) => isDone(h, d)).length;
  const yesterday = addDays(t, -1);
  const title = isToday ? '오늘' : d === yesterday ? '어제' : `${dt.getMonth() + 1}월 ${dt.getDate()}일`;
  const eyebrow = isToday || d === yesterday ? longDate(d) : `${WEEK[dt.getDay()]}요일`;
  const complete = list.length > 0 && done === list.length;

  const header = `
    <header class="head">
      <div>
        <div class="eyebrow">${eyebrow}</div>
        <h1 class="title">${title}</h1>
      </div>
      ${list.length ? `<div class="head-ring ${complete ? 'complete' : ''}" aria-label="${done}/${list.length} 완료">${ring(done / list.length, 44, 4)}<span class="num">${done}/${list.length}</span></div>` : ''}
    </header>
    ${weekStrip(d)}`;

  let body;
  if (!state.habits.length) {
    body = `
      <div class="empty">
        <div class="art">🌱</div>
        <h2>매일 반복할 일을 추가해 보세요</h2>
        <p>요일과 시간대를 정해 두면<br>그날 할 일만 보여줘요.</p>
        <div class="row">
          <button class="btn" data-action="add-habit">루틴 추가</button>
          <button class="btn ghost" data-action="seed">예시로 시작</button>
        </div>
      </div>`;
  } else if (!list.length) {
    body = `<div class="empty"><div class="art">☕</div><h2>예정된 루틴이 없어요</h2><p>${isToday ? '오늘은 쉬어 가는 날이에요.' : '이 날은 반복 요일에 해당하는 루틴이 없어요.'}</p></div>`;
  } else {
    body = `
      ${SLOTS.map((slot) => {
        const items = list.filter((h) => h.slot === slot.id);
        if (!items.length) return '';
        const n = items.filter((h) => isDone(h, d)).length;
        return `
          <section class="group">
            <div class="group-head"><h3 class="group-title">${slot.label}</h3><span class="group-count">${n}/${items.length}</span></div>
            <ul class="tasks">${items.map((h) => taskItem(h, d)).join('')}</ul>
          </section>`;
      }).join('')}
      ${isToday && complete ? '<div class="perfect"><b>🎉</b>오늘 루틴을 모두 끝냈어요</div>' : ''}`;
  }

  return `${header}${body}
    ${state.habits.length ? `<button class="fab" data-action="add-habit" aria-label="루틴 추가">${SVG.plus}</button>` : ''}`;
}

function weekStrip(d) {
  const t = today();
  const mon = mondayOf(d);
  const sun = addDays(mon, 6);
  const range = parse(mon).getMonth() === parse(sun).getMonth()
    ? `${parse(mon).getMonth() + 1}월 ${parse(mon).getDate()}일 – ${parse(sun).getDate()}일`
    : `${md(mon)} – ${md(sun)}`;
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(mon, i);
    const p = day <= t ? dayProgress(day) : { total: 0, done: 0 };
    const mark = !p.total || !p.done ? '' : p.done === p.total ? 'full' : 'partial';
    return `
      <button class="day ${day === t ? 'today' : ''} ${day === d ? 'selected' : ''}" data-action="pick-day" data-date="${day}" ${day > t ? 'disabled' : ''} aria-label="${longDate(day)}">
        <span class="dow">${WEEK[dow(day)]}</span>
        <span class="dnum">${parse(day).getDate()}</span>
        <span class="mark ${mark}"></span>
      </button>`;
  }).join('');
  return `
    <div class="week-bar">
      <span class="eyebrow">${range}</span>
      <span>
        ${d !== t ? '<button class="link" data-action="go-today" style="margin-right:6px">오늘로</button>' : ''}
        <button class="icon-btn" data-action="prev-week" aria-label="지난주" style="display:inline-grid">${SVG.prev}</button>
        <button class="icon-btn" data-action="next-week" aria-label="다음 주" style="display:inline-grid" ${addDays(mon, 7) > t ? 'disabled' : ''}>${SVG.next}</button>
      </span>
    </div>
    <div class="week">${days}</div>`;
}

function taskItem(h, d) {
  const done = isDone(h, d);
  const s = streak(h);
  const krs = krsForHabit(h);
  const meta = [
    s > 0 ? `<span class="streak">🔥 ${s}</span>` : '',
    `<span>${daysLabel(h.days)}</span>`,
    krs.length ? `<span class="kr-tag"><span>${esc(krs[0].title)}${krs.length > 1 ? ` 외 ${krs.length - 1}` : ''}</span></span>` : '',
  ].join('');
  return `
    <li class="task ${done ? 'done' : ''} ${justToggled === h.id && done ? 'pop' : ''}" style="--c:${safeColor(h.color)}">
      <button class="task-body" data-action="edit-habit" data-id="${h.id}">
        ${chip(h)}
        <span class="task-text">
          <span class="task-title">${esc(h.title)}</span>
          <span class="task-meta">${meta}</span>
        </span>
      </button>
      <button class="check" data-action="toggle" data-id="${h.id}" aria-label="${esc(h.title)} ${done ? '완료 취소' : '완료'}" aria-pressed="${done}"><i>${SVG.check}</i></button>
    </li>`;
}

/* ---------- 기록 ---------- */
// 잔디: 열 수를 고정하고 칸 크기는 폭에 맞춰 나눈다 (잘리지 않음).
function heatGrid({ weeks, labels, cell, color }) {
  const t = today();
  const start = addDays(mondayOf(t), -7 * (weeks - 1));
  const off = labels ? 2 : 1;
  let html = '';
  if (labels) {
    [['월', 0], ['수', 2], ['금', 4]].forEach(([w, r]) => { html += `<span class="w" style="grid-column:1;grid-row:${r + 2}">${w}</span>`; });
    let lastCol = -9;
    for (let w = 0; w < weeks; w++) {
      const mon = addDays(start, 7 * w);
      const prev = w ? addDays(mon, -7) : null;
      if (prev && parse(prev).getMonth() === parse(mon).getMonth()) continue;
      if (w === 0 && parse(addDays(mon, 21)).getMonth() !== parse(mon).getMonth()) continue; // 첫 달 꼬리는 생략
      if (w - lastCol < 3) continue;
      html += `<span class="m" style="grid-column:${w + off} / span 3;grid-row:1">${parse(mon).getMonth() + 1}월</span>`;
      lastCol = w;
    }
  }
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, 7 * w + r);
      const cls = d > t ? 'fut' : `${cell(d)}${d === t ? ' now' : ''}`;
      html += `<i class="${cls}" style="grid-column:${w + off};grid-row:${r + (labels ? 2 : 1)}" title="${d}"></i>`;
    }
  }
  const cols = `${labels ? '14px ' : ''}repeat(${weeks}, minmax(0, 1fr))`;
  return `<div class="heat ${labels ? '' : 'small'}" style="grid-template-columns:${cols};${color ? `--c:${color}` : ''}">${html}</div>`;
}

function renderStats() {
  const t = today();
  const habits = sortedHabits();
  const week = rangeStats(mondayOf(t), t);
  const month = rangeStats(addDays(t, -29), t);
  const longest = habits.reduce((m, h) => Math.max(m, streak(h)), 0);
  const WEEKS = 18;

  const overall = heatGrid({
    weeks: WEEKS, labels: true,
    cell: (d) => {
      const p = dayProgress(d);
      if (!p.total) return 'off';
      return p.done ? `l${Math.ceil((p.done / p.total) * 4)}` : '';
    },
  });

  const cards = habits.map((h) => {
    const r = rangeStats(addDays(t, -29), t, [h]);
    const s = streak(h);
    const grid = heatGrid({
      weeks: WEEKS, labels: false, color: safeColor(h.color),
      cell: (d) => (!isScheduled(h, d) ? 'off' : isDone(h, d) ? 'on' : ''),
    });
    return `
      <div class="card habit-card" style="--c:${safeColor(h.color)}">
        <div class="hc-head">
          ${chip(h)}
          <div class="hc-name"><b>${esc(h.title)}</b><span>${daysLabel(h.days)} · ${SLOTS.find((x) => x.id === h.slot)?.label || ''}</span></div>
          <div class="hc-streak"><b>${s > 0 ? '🔥 ' : ''}${s}</b><span>연속</span></div>
        </div>
        ${grid}
        <div class="chips">
          <span class="stat-chip">최고 <b>${bestStreak(h)}</b>일</span>
          <span class="stat-chip">30일 <b>${r.total ? pct(r.rate) : '–'}</b></span>
          <span class="stat-chip">총 <b>${totalDone(h)}</b>회</span>
        </div>
      </div>`;
  }).join('');

  return `
    <header class="head"><div><div class="eyebrow">꾸준함이 쌓이는 곳</div><h1 class="title">기록</h1></div></header>
    <div class="card summary">
      <div><b>${week.total ? pct(week.rate) : '–'}</b><span>이번 주</span></div>
      <div><b>${month.total ? pct(month.rate) : '–'}</b><span>최근 30일</span></div>
      <div><b>${longest}일</b><span>최장 연속</span></div>
    </div>
    <div class="card">
      <div class="card-title">전체 달성 <small>최근 ${WEEKS}주</small></div>
      ${overall}
      <div class="legend"><span>적음</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>많음</span></div>
    </div>

    ${habits.length ? `<h3 class="section-title">루틴별</h3>${cards}` : ''}

    <h3 class="section-title">데이터</h3>
    <div class="card menu" style="padding:0">
      <button data-action="export">백업 내보내기</button>
      <button data-action="import">백업 가져오기</button>
      <button data-action="reset" class="danger-text">전체 초기화</button>
    </div>
    <p class="note">데이터는 이 기기에만 저장돼요. 앱을 지우면 함께 사라지니 가끔 백업해 두세요.</p>`;
}

/* ---------- OKR ---------- */
function renderOkr() {
  const t = today();
  const active = state.objectives.filter((o) => o.end >= t).sort((a, b) => a.start.localeCompare(b.start));
  const past = state.objectives.filter((o) => o.end < t).sort((a, b) => b.end.localeCompare(a.end));

  const body = !state.objectives.length
    ? `<div class="empty">
         <div class="art">🎯</div>
         <h2>이번 분기 목표를 세워 보세요</h2>
         <p>목표 하나에 측정할 핵심 결과를 2~4개 붙여요.<br>루틴을 연결하면 체크할 때마다 자동으로 올라가요.</p>
         <div class="row"><button class="btn" data-action="add-obj">목표 추가</button></div>
       </div>`
    : `${active.map(objCard).join('') || '<p class="note">진행 중인 목표가 없어요.</p>'}
       ${past.length ? `<button class="past-toggle" data-action="toggle-past">${showPast ? '▾' : '▸'} 지난 목표 ${past.length}개</button>${showPast ? past.map(objCard).join('') : ''}` : ''}`;

  return `
    <header class="head">
      <div><div class="eyebrow">${active.length ? `진행 중인 목표 ${active.length}개` : '목표와 핵심 결과'}</div><h1 class="title">OKR</h1></div>
    </header>
    ${body}
    ${state.objectives.length ? `<button class="fab" data-action="add-obj" aria-label="목표 추가">${SVG.plus}</button>` : ''}`;
}

function objCard(o) {
  const p = objProgress(o);
  const [cls, label] = objStatus(o);
  const t = today();
  const inRange = t >= o.start && t <= o.end;
  const period = `${md(o.start)} – ${md(o.end)}${inRange ? ` · D-${diffDays(t, o.end)}` : ''}`;

  const krs = o.krs.map((kr) => {
    const v = krValue(kr, o);
    const kp = krProgress(kr, o);
    const unit = kr.mode === 'habit' ? '회' : esc(kr.unit || '');
    const linked = kr.mode === 'habit' ? state.habits.filter((h) => kr.habitIds.includes(h.id)) : [];
    return `
      <li class="kr" style="--c:${krColor(kr)}">
        <button class="kr-main" data-action="edit-kr" data-obj="${o.id}" data-kr="${kr.id}">
          <span class="kr-top"><span class="kr-title">${esc(kr.title)}</span><span class="kr-val"><b>${fmt(v)}</b> / ${fmt(num(kr.target))}${unit}</span></span>
          <span class="bar" style="display:block"><span class="fill" style="width:${kp * 100}%"></span></span>
          ${linked.length ? `<span class="kr-link"><i></i>${esc(linked[0].title)}${linked.length > 1 ? ` 외 ${linked.length - 1}개` : ''} 체크로 자동 기록</span>` : ''}
        </button>
        ${kr.mode !== 'habit' ? `
          <span class="stepper">
            <button data-action="kr-step" data-step="1" data-obj="${o.id}" data-kr="${kr.id}" aria-label="${esc(kr.title)} 1 늘리기">+</button>
            <button data-action="kr-step" data-step="-1" data-obj="${o.id}" data-kr="${kr.id}" aria-label="${esc(kr.title)} 1 줄이기">−</button>
          </span>` : ''}
      </li>`;
  }).join('');

  return `
    <article class="card ${t > o.end ? 'ended' : ''}">
      <div class="obj-head">
        <div class="obj-info">
          <button class="obj-title" data-action="edit-obj" data-obj="${o.id}">${esc(o.title)}</button>
          <div class="obj-meta"><span class="badge ${cls}">${label}</span><span class="num">${period}</span></div>
          ${inRange ? `<div class="obj-meta">기간 ${pct(elapsed(o))} 지남 · 진행 ${pct(p)}</div>` : ''}
        </div>
        <div class="obj-ring">${ring(p, 52, 5, cls === 'good' ? 'var(--good)' : null)}<span>${pct(p)}</span></div>
      </div>
      <ul class="krs">${krs}</ul>
      <button class="add-kr" data-action="add-kr" data-obj="${o.id}">+ 핵심 결과 추가</button>
    </article>`;
}

/* =========================================================
   시트(입력 폼)
   ========================================================= */
const sheet = document.getElementById('sheet');
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

function openSheet({ title, inner, submit = '저장', del, onSubmit, onMount }) {
  sheet.innerHTML = `
    <form class="sheet-form" novalidate>
      <div class="handle"></div>
      <header class="sheet-head">
        <button type="button" data-close>취소</button>
        <h2>${title}</h2>
        <span></span>
      </header>
      ${inner}
      <div class="sheet-foot">
        <button class="btn block" type="submit">${submit}</button>
        ${del ? `<button type="button" class="text-danger" data-delete>${del}</button>` : ''}
      </div>
    </form>`;
  const form = sheet.querySelector('form');
  form.querySelector('[data-close]').addEventListener('click', () => sheet.close());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (onSubmit(form, new FormData(form)) !== false) { sheet.close(); save(); render(); }
  });
  onMount?.(form);
  sheet.showModal();
  sheet.scrollTop = 0;
}

function onDelete(form, msg, fn) {
  form.querySelector('[data-delete]')?.addEventListener('click', () => {
    if (!confirm(msg)) return;
    fn();
    sheet.close(); save(); render();
  });
}

/* ---------- 루틴 폼 ---------- */
function habitSheet(h) {
  const slot = h?.slot || (new Date().getHours() < 12 ? 'morning' : 'anytime');
  const days = h?.days || [0, 1, 2, 3, 4, 5, 6];
  const color = safeColor(h?.color || PALETTE[state.habits.length % PALETTE.length]);
  const icon = h?.icon || '';
  const inner = `
    <input class="big-input" name="title" placeholder="무엇을 반복할까요?" maxlength="60" value="${esc(h?.title)}" ${h ? '' : 'autofocus'} autocomplete="off">
    <div class="field">
      <span class="label">시간대</span>
      <div class="seg">${SLOTS.map((s) => `<label><input type="radio" name="slot" value="${s.id}" ${s.id === slot ? 'checked' : ''}><span>${s.label}</span></label>`).join('')}</div>
    </div>
    <div class="field">
      <span class="label">반복 요일</span>
      <div class="presets">
        <button type="button" class="preset" data-preset="0123456">매일</button>
        <button type="button" class="preset" data-preset="12345">평일</button>
        <button type="button" class="preset" data-preset="06">주말</button>
        <button type="button" class="preset" data-preset="135">월수금</button>
        <button type="button" class="preset" data-preset="24">화목</button>
      </div>
      <div class="days">${WEEK_ORDER.map((d) => `<label><input type="checkbox" name="day" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${WEEK[d]}</span></label>`).join('')}</div>
    </div>
    <div class="field">
      <span class="label">색</span>
      <div class="swatches">${PALETTE.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''} aria-label="색 ${c}"><span style="--sw:${c}"></span></label>`).join('')}</div>
    </div>
    <div class="field">
      <span class="label">아이콘</span>
      <div class="icons">
        <label><input type="radio" name="icon" value="" ${icon ? '' : 'checked'} aria-label="첫 글자"><span class="letter" data-letter>${esc(firstChar(h?.title || '가'))}</span></label>
        ${ICONS.map((ic) => `<label><input type="radio" name="icon" value="${ic}" ${ic === icon ? 'checked' : ''}><span>${ic}</span></label>`).join('')}
      </div>
    </div>`;

  openSheet({
    title: h ? '루틴 편집' : '새 루틴',
    inner,
    submit: h ? '저장' : '추가',
    del: h ? '루틴 삭제' : null,
    onSubmit: (form, fd) => {
      const title = String(fd.get('title') || '').trim();
      const picked = fd.getAll('day').map(Number);
      if (!title) { toast('루틴 이름을 적어 주세요'); form.elements.title.focus(); return false; }
      if (!picked.length) { toast('반복할 요일을 하나 이상 골라 주세요'); return false; }
      const data = { title, slot: fd.get('slot'), days: picked, color: safeColor(fd.get('color')), icon: String(fd.get('icon') || '') };
      if (h) Object.assign(h, data);
      else {
        const d = viewDate || today();
        state.habits.push({
          id: uid(), ...data,
          createdAt: d < today() ? d : today(),
          order: Math.max(0, ...state.habits.map((x) => x.order + 1)),
        });
        toast('루틴을 추가했어요');
      }
    },
    onMount: (form) => {
      form.style.setProperty('--c', color);
      form.querySelectorAll('input[name=color]').forEach((r) => r.addEventListener('change', () => form.style.setProperty('--c', r.value)));
      const letter = form.querySelector('[data-letter]');
      form.elements.title.addEventListener('input', (e) => { letter.textContent = firstChar(e.target.value || '가'); });
      form.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
        form.querySelectorAll('input[name=day]').forEach((c) => { c.checked = b.dataset.preset.includes(c.value); });
      }));
      if (h) onDelete(form, `'${h.title}' 루틴과 기록을 모두 지울까요?`, () => {
        state.habits = state.habits.filter((x) => x.id !== h.id);
        for (const d of Object.keys(state.log)) {
          state.log[d] = state.log[d].filter((id) => id !== h.id);
          if (!state.log[d].length) delete state.log[d];
        }
        for (const o of state.objectives) for (const kr of o.krs) kr.habitIds = (kr.habitIds || []).filter((id) => id !== h.id);
      });
    },
  });
}

/* ---------- 목표 폼 ---------- */
function objSheet(o) {
  const [s, e] = o ? [o.start, o.end] : quarterRange(0);
  const inner = `
    <input class="big-input" name="title" placeholder="이루고 싶은 목표" maxlength="80" value="${esc(o?.title)}" ${o ? '' : 'autofocus'} autocomplete="off">
    <div class="field">
      <span class="label">기간</span>
      <div class="presets">
        <button type="button" class="preset" data-range="q0">이번 분기</button>
        <button type="button" class="preset" data-range="q1">다음 분기</button>
        <button type="button" class="preset" data-range="m">이번 달</button>
        <button type="button" class="preset" data-range="y">올해</button>
      </div>
      <div class="grid2">
        <label><span class="label">시작</span><input class="input" type="date" name="start" value="${s}" required></label>
        <label><span class="label">끝</span><input class="input" type="date" name="end" value="${e}" required></label>
      </div>
    </div>
    ${o ? '' : '<p class="hint">저장한 뒤 카드의 “핵심 결과 추가”로 측정 기준을 붙여요.</p>'}`;

  openSheet({
    title: o ? '목표 편집' : '새 목표',
    inner,
    submit: o ? '저장' : '추가',
    del: o ? '목표 삭제' : null,
    onSubmit: (form, fd) => {
      const title = String(fd.get('title') || '').trim();
      const start = fd.get('start'), end = fd.get('end');
      if (!title) { toast('목표를 적어 주세요'); return false; }
      if (!start || !end || start > end) { toast('기간을 확인해 주세요'); return false; }
      if (o) Object.assign(o, { title, start, end });
      else state.objectives.push({ id: uid(), title, start, end, krs: [] });
    },
    onMount: (form) => {
      const ranges = { q0: () => quarterRange(0), q1: () => quarterRange(1), m: monthRange, y: yearRange };
      form.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
        const [a, z] = ranges[b.dataset.range]();
        form.elements.start.value = a; form.elements.end.value = z;
      }));
      if (o) onDelete(form, `'${o.title}' 목표를 지울까요?`, () => {
        state.objectives = state.objectives.filter((x) => x.id !== o.id);
      });
    },
  });
}

/* ---------- 핵심 결과 폼 ---------- */
function krSheet(o, kr) {
  const mode = kr?.mode || 'number';
  const habits = sortedHabits();
  const linked = kr?.habitIds || [];
  const inner = `
    <input class="big-input" name="title" placeholder="측정할 결과 (예: 책 6권 읽기)" maxlength="80" value="${esc(kr?.title)}" ${kr ? '' : 'autofocus'} autocomplete="off">
    <div class="field">
      <span class="label">측정 방식</span>
      <div class="seg">
        <label><input type="radio" name="mode" value="number" ${mode !== 'habit' ? 'checked' : ''}><span>숫자 직접 입력</span></label>
        <label><input type="radio" name="mode" value="habit" ${mode === 'habit' ? 'checked' : ''}><span>루틴 횟수</span></label>
      </div>
    </div>
    <div class="field" data-mode="number">
      <div class="grid3">
        <label><span class="label">시작값</span><input class="input" type="number" inputmode="decimal" step="any" name="start" value="${kr?.start ?? 0}"></label>
        <label><span class="label">현재값</span><input class="input" type="number" inputmode="decimal" step="any" name="current" value="${kr?.current ?? 0}"></label>
        <label><span class="label">목표값</span><input class="input" type="number" inputmode="decimal" step="any" name="target" value="${kr?.target ?? 10}"></label>
      </div>
      <label style="display:block;margin-top:10px"><span class="label">단위</span><input class="input" name="unit" placeholder="권, kg, 점…" maxlength="10" value="${esc(kr?.unit)}"></label>
      <p class="hint">줄이는 목표(예: 체중 70 → 65)는 목표값을 시작값보다 작게 넣으면 돼요.</p>
    </div>
    <div class="field" data-mode="habit">
      <label><span class="label">목표 횟수 (${md(o.start)} – ${md(o.end)})</span><input class="input" type="number" inputmode="numeric" min="1" step="1" name="htarget" value="${kr?.mode === 'habit' ? kr.target : 30}"></label>
      <span class="label" style="margin-top:16px">연결할 루틴</span>
      ${habits.length
        ? `<div class="check-list">${habits.map((h) => `<label><input type="checkbox" name="habit" value="${h.id}" ${linked.includes(h.id) ? 'checked' : ''}>${chip(h)}${esc(h.title)}</label>`).join('')}</div>`
        : '<p class="hint">먼저 오늘 탭에서 루틴을 만들어 주세요.</p>'}
      <p class="hint">연결한 루틴을 체크할 때마다 1회씩 올라가요.</p>
    </div>`;

  openSheet({
    title: kr ? '핵심 결과 편집' : '새 핵심 결과',
    inner,
    submit: kr ? '저장' : '추가',
    del: kr ? '핵심 결과 삭제' : null,
    onSubmit: (form, fd) => {
      const title = String(fd.get('title') || '').trim();
      const m = fd.get('mode');
      if (!title) { toast('핵심 결과를 적어 주세요'); return false; }
      let data;
      if (m === 'habit') {
        const ids = fd.getAll('habit');
        const target = Math.round(num(fd.get('htarget')));
        if (!ids.length) { toast('연결할 루틴을 하나 이상 골라 주세요'); return false; }
        if (target < 1) { toast('목표 횟수를 1 이상으로 적어 주세요'); return false; }
        data = { title, mode: 'habit', habitIds: ids, target, start: 0, current: 0, unit: '회' };
      } else {
        const start = num(fd.get('start')), target = num(fd.get('target'));
        if (start === target) { toast('시작값과 목표값이 같아요'); return false; }
        data = { title, mode: 'number', habitIds: [], start, target, current: num(fd.get('current')), unit: String(fd.get('unit') || '').trim() };
      }
      if (kr) Object.assign(kr, data);
      else o.krs.push({ id: uid(), ...data });
    },
    onMount: (form) => {
      const sync = () => {
        const m = form.querySelector('input[name=mode]:checked').value;
        form.querySelectorAll('[data-mode]').forEach((el) => { el.hidden = el.dataset.mode !== m; });
      };
      form.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', sync));
      sync();
      if (kr) onDelete(form, `'${kr.title}' 핵심 결과를 지울까요?`, () => {
        o.krs = o.krs.filter((x) => x.id !== kr.id);
      });
    },
  });
}

/* =========================================================
   이벤트
   ========================================================= */
const findObj = (id) => state.objectives.find((o) => o.id === id);
const findHabit = (id) => state.habits.find((h) => h.id === id);

view.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  const o = el.dataset.obj ? findObj(el.dataset.obj) : null;
  const kr = o && el.dataset.kr ? o.krs.find((k) => k.id === el.dataset.kr) : null;

  switch (action) {
    case 'toggle': {
      const h = findHabit(id);
      const d = viewDate || today();
      if (!h || d > today()) return;
      const on = !isDone(h, d);
      setDone(h, d, on);
      if (on) { justToggled = h.id; navigator.vibrate?.(8); }
      save(); render();
      break;
    }
    case 'edit-habit': habitSheet(findHabit(id)); break;
    case 'add-habit': habitSheet(); break;
    case 'pick-day': viewDate = el.dataset.date === today() ? null : el.dataset.date; render(); break;
    case 'prev-week': viewDate = addDays(viewDate || today(), -7); render(); break;
    case 'next-week': {
      const n = addDays(viewDate || today(), 7);
      viewDate = n >= today() ? null : n;
      render();
      break;
    }
    case 'go-today': viewDate = null; render(); break;
    case 'seed': seedExamples(); break;

    case 'add-obj': objSheet(); break;
    case 'edit-obj': objSheet(o); break;
    case 'add-kr': krSheet(o); break;
    case 'edit-kr': krSheet(o, kr); break;
    case 'kr-step':
      kr.current = Math.round((num(kr.current) + Number(el.dataset.step)) * 100) / 100;
      save(); render();
      break;
    case 'toggle-past': showPast = !showPast; render(); break;

    case 'export': exportData(); break;
    case 'import': document.getElementById('import-file').click(); break;
    case 'reset':
      if (confirm('모든 루틴, 기록, OKR을 지울까요? 되돌릴 수 없어요.')) {
        state = emptyState(); save(); render(); toast('초기화했어요');
      }
      break;
  }
});

document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  writePref('haru.tab', tab);
  render();
  window.scrollTo(0, 0);
}));

// 자정을 넘겨 다시 열었을 때 화면 날짜를 맞춘다.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    lastDay = today();
    viewDate = null;
    render();
  }
});

/* ---------- 백업 ---------- */
function exportData() {
  if (native) { native.exportBackup(JSON.stringify(state, null, 2), `haru-backup-${today()}.json`); return; }
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `haru-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.version !== 1 || !Array.isArray(data.habits) || !Array.isArray(data.objectives) || typeof data.log !== 'object') throw new Error('형식');
    if (!confirm('지금 데이터를 백업 파일 내용으로 바꿀까요?')) return;
    state = normalize(data); save(); render(); toast('백업을 불러왔어요');
  } catch {
    toast('하루 백업 파일이 아니에요');
  }
});

/* ---------- 예시 ---------- */
function seedExamples() {
  const t = today();
  const mk = (title, slot, days, icon, order) => ({ id: uid(), title, slot, days, icon, color: PALETTE[order % PALETTE.length], createdAt: t, order });
  const habits = [
    mk('물 한 잔 마시기', 'morning', [0, 1, 2, 3, 4, 5, 6], '💧', 0),
    mk('스트레칭 10분', 'morning', [0, 1, 2, 3, 4, 5, 6], '🧘', 1),
    mk('운동 30분', 'afternoon', [1, 3, 5], '🏃', 2),
    mk('책 20쪽 읽기', 'evening', [0, 1, 2, 3, 4, 5, 6], '📖', 3),
    mk('내일 할 일 정리', 'evening', [1, 2, 3, 4, 5], '📝', 4),
  ];
  const [qs, qe] = quarterRange(0);
  state.habits.push(...habits);
  state.objectives.push({
    id: uid(), title: '건강하고 꾸준한 분기 만들기', start: qs, end: qe,
    krs: [
      { id: uid(), title: '운동 30회 하기', mode: 'habit', habitIds: [habits[2].id], target: 30, start: 0, current: 0, unit: '회' },
      { id: uid(), title: '책 5권 완독', mode: 'number', habitIds: [], start: 0, current: 0, target: 5, unit: '권' },
    ],
  });
  save(); render();
  toast('예시를 넣었어요. 눌러서 고치거나 지울 수 있어요');
}

/* ---------- 시작 ---------- */
// 위젯에서 체크한 뒤 앱으로 돌아오면 네이티브가 호출한다.
window.haruReload = () => {
  if (sheet.open) sheet.close();
  state = load();
  if (today() !== lastDay) { lastDay = today(); viewDate = null; }
  render();
};

render();
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
