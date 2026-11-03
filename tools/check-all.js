// 모든 화면과 시트를 돌며 layout-check.js 를 실행한다. (seed-demo.js 로 데이터를 넣은 뒤 사용)
// fontScale: 안드로이드 시스템 글자 크기를 흉내 낸다 (모든 font-size 를 배율만큼 키움).
async function checkAll(fontScale = 1) {
  const src = await fetch('/tools/layout-check.js').then((r) => r.text());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById('font-scale')?.remove();
  if (fontScale !== 1) {
    const css = [];
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        const fs = rule.style?.fontSize;
        if (fs && fs.endsWith('px')) css.push(`${rule.selectorText}{font-size:${parseFloat(fs) * fontScale}px}`);
      }
    }
    const st = document.createElement('style');
    st.id = 'font-scale';
    st.textContent = css.join('\n');
    document.head.append(st);
  }
  const sheetEl = document.getElementById('sheet');
  const results = {};
  const check = (label) => {
    const r = eval(src);
    const bad = r.list.filter((x) => x.type !== 'ellipsis');
    if (bad.length) results[label] = bad.slice(0, 4);
  };
  const go = async (t) => {
    if (sheetEl.open) sheetEl.close();
    document.querySelector(`[data-tab=${t}]`).click();
    await wait(120);
  };
  await go('today'); check('today');
  document.querySelector('[data-action=prev-week]').click(); await wait(80); check('today-lastweek');
  document.querySelector('[data-action=go-today]').click(); await wait(80);
  document.querySelector('.fab').click(); await wait(350); check('sheet-new-habit');
  await go('today'); document.querySelectorAll('[data-action=edit-habit]')[0].click(); await wait(350); check('sheet-edit-habit');
  await go('stats'); check('stats');
  await go('okr'); check('okr');
  document.querySelector('[data-action=edit-kr]').click(); await wait(350); check('sheet-kr-habit');
  await go('okr'); document.querySelectorAll('[data-action=edit-kr]')[1].click(); await wait(350); check('sheet-kr-number');
  await go('okr'); document.querySelector('[data-action=edit-obj]').click(); await wait(350); check('sheet-obj');
  await go('today');
  document.getElementById('font-scale')?.remove();
  return { vw: innerWidth, fontScale, screens: 9, problems: Object.keys(results).length ? results : 'none' };
}
