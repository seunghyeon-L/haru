// 레이아웃 검사용 테스트 데이터. 브라우저(localhost)에서만 실행한다 — 기존 데이터를 덮어쓴다.
(() => {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const t = new Date();
  const start = new Date(t);
  start.setDate(t.getDate() - 70);
  const H = [
    ['IELTS 리스닝 1세트', 'morning', [0, 1, 2, 3, 4, 5, 6]],
    ['단어장 50개', 'morning', [1, 2, 3, 4, 5]],
    ['코딩테스트 1문제', 'afternoon', [0, 1, 2, 3, 4, 5, 6]],
    ['운동 30분', 'afternoon', [1, 3, 5]],
    ['책 20쪽 읽기', 'evening', [0, 1, 2, 3, 4, 5, 6]],
    ['내일 할 일 정리하고 일기 쓰기 (긴 제목 테스트)', 'evening', [1, 2, 3, 4, 5]],
  ].map((h, i) => ({ id: 'h' + i, title: h[0], slot: h[1], days: h[2], createdAt: ymd(start), order: i }));
  const log = {};
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let d = new Date(start); d < t; d.setDate(d.getDate() + 1)) {
    const ids = H.filter((h) => h.days.includes(d.getDay()) && rnd() < 0.72).map((h) => h.id);
    if (ids.length) log[ymd(d)] = ids;
  }
  log[ymd(t)] = ['h0', 'h2'];
  const q = Math.floor(t.getMonth() / 3);
  const objectives = [
    {
      id: 'o1', title: 'IELTS 7.0 달성하기',
      start: ymd(new Date(t.getFullYear(), q * 3, 1)), end: ymd(new Date(t.getFullYear(), q * 3 + 3, 0)),
      krs: [
        { id: 'k1', title: '리스닝 60세트 풀기', mode: 'habit', habitIds: ['h0'], target: 60, start: 0, current: 0, unit: '회' },
        { id: 'k2', title: '모의고사 점수', mode: 'number', habitIds: [], start: 5.5, current: 6, target: 7, unit: '점' },
        { id: 'k3', title: '단어 3000개 외우기', mode: 'number', habitIds: [], start: 0, current: 1200, target: 3000, unit: '개' },
      ],
    },
    {
      id: 'o2', title: '건강한 몸 만들기',
      start: ymd(new Date(t.getFullYear(), t.getMonth(), 1)), end: ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0)),
      krs: [{ id: 'k4', title: '운동 12회', mode: 'habit', habitIds: ['h3'], target: 12, start: 0, current: 0, unit: '회' }],
    },
  ];
  localStorage.setItem('haru.v1', JSON.stringify({ version: 1, habits: H, log, objectives }));
  location.reload();
})();
