// 레이아웃 잘림 검사. 브라우저 콘솔(또는 자동화)에서 실행하면 문제 목록을 돌려준다.
//  - offscreen: 화면 폭 밖으로 나간 요소
//  - clipped: overflow 가 visible 이 아닌 부모에 잘린 자식
//  - hscroll: 가로 스크롤이 생긴 요소/페이지
//  - ellipsis: 말줄임으로 잘린 텍스트 (정보용)
(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList.length) s += '.' + [...el.classList].join('.');
    const t = (el.textContent || '').trim().slice(0, 20);
    return t ? `${s} "${t}"` : s;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // 테두리처럼 쓰인 box-shadow(spread)와 outline 도 그려지는 영역에 넣는다.
  const paintRect = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    let grow = 0;
    if (cs.outlineStyle !== 'none') grow = Math.max(grow, parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset || 0));
    if (cs.boxShadow !== 'none') {
      for (const part of cs.boxShadow.split(/,(?![^(]*\))/)) {
        if (/inset/.test(part)) continue;
        const nums = (part.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
        const [x = 0, y = 0, blur = 0, spread = 0] = nums;
        // 흐린 그림자는 장식이라 잘려도 괜찮다. 테두리처럼 선명한 것만 본다.
        if (blur <= 1) grow = Math.max(grow, spread + Math.max(Math.abs(x), Math.abs(y)));
      }
    }
    return { left: r.left - grow, right: r.right + grow, top: r.top - grow, bottom: r.bottom + grow };
  };
  const root = document.querySelector('dialog[open]') || document.body;
  const all = [...root.querySelectorAll('*')].filter(visible);

  if (document.documentElement.scrollWidth > vw + 1) out.push({ type: 'hscroll', el: 'page', by: document.documentElement.scrollWidth - vw });

  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (el.closest('.fab, .toast')) continue;
    const pr = paintRect(el);
    if (pr.right > vw + 0.5 && r.right <= vw + 0.5) out.push({ type: 'offscreen-paint', el: name(el), right: Math.round(pr.right), vw });
    if (r.right > vw + 0.5 || r.left < -0.5) out.push({ type: 'offscreen', el: name(el), left: Math.round(r.left), right: Math.round(r.right), vw });

    const cs = getComputedStyle(el);
    const clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    if (clips && !el.matches('html, body, dialog')) {
      if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push({ type: 'hscroll', el: name(el), by: el.scrollWidth - el.clientWidth });
      for (const c of el.querySelectorAll('*')) {
        if (!visible(c)) continue;
        const cr = paintRect(c);
        const cut = Math.max(r.left - cr.left, cr.right - r.right);
        if (cut > 1 && cs.overflowX !== 'visible') out.push({ type: 'clipped', el: name(c), in: name(el), by: Math.round(cut) });
      }
    }
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push({ type: 'ellipsis', el: name(el) });
  }
  return { vw, issues: out.length, list: out.slice(0, 40) };
})();
