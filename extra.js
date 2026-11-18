// extra.js - 시나리오 비교 / 파급효과 구성 차트 (샘플 app.js는 수정하지 않음)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const COLORS = ['#2b6cb0', '#dd6b20', '#2f855a', '#805ad5', '#d53f8c', '#718096'];
  const KEY = 'io-compare-v1';
  const MAX = 5;
  const fmt = (x) => Number(x).toLocaleString('ko-KR', { maximumFractionDigits: 3 });
  const fmt0 = (x) => Number(x).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = (s) => (s.length > 30 ? s.slice(0, 30) + '…' : s);

  // app.js의 전역 변수(result, basket)를 안전하게 읽는다
  const getResult = () => { try { return typeof result !== 'undefined' ? result : null; } catch (e) { return null; } };
  const getBasket = () => { try { return typeof basket !== 'undefined' ? basket : []; } catch (e) { return []; } };

  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { saved = []; }
  saved = Array.isArray(saved) ? saved.filter((s) => s && typeof s.production === 'number' && Array.isArray(s.top)) : [];
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* 저장 불가 환경은 무시 */ } };

  function barRow(label, value, max, color, valueText) {
    const pct = max > 0 ? Math.max(0, (value / max) * 100) : 0;
    return `<div class="xbar"><span class="xbar-label">${esc(label)}</span><span class="xbar-track"><span class="xbar-fill" style="width:${pct}%;background:${color}"></span></span><span class="xbar-value">${valueText}</span></div>`;
  }

  // ---------- 1. 파급효과 구성 차트 (시뮬레이터 결과 화면에 삽입) ----------
  function injectBlock() {
    const cards = $('cards');
    if (!cards) return false;
    const block = document.createElement('div');
    block.id = 'extra-block';
    block.innerHTML =
      '<h3>파급효과 구성</h3>' +
      '<div id="chart-amounts"></div><div id="chart-unit"></div><div id="chart-top5"></div>' +
      '<p class="save-bar"><button type="button" id="save-scenario">이 결과를 비교용으로 저장</button> <span id="save-msg" role="status"></span></p>';
    cards.after(block);
    $('save-scenario').addEventListener('click', saveScenario);
    return true;
  }

  function renderCharts(r) {
    const max = Math.max(r.production, r.imports, r.valueAdded, 1);
    $('chart-amounts').innerHTML =
      '<h4>유발액 크기 비교 (백만원)</h4>' +
      barRow('생산유발액', r.production, max, COLORS[0], fmt0(r.production)) +
      barRow('수입유발액', r.imports, max, COLORS[1], fmt0(r.imports)) +
      barRow('부가가치유발액', r.valueAdded, max, COLORS[2], fmt0(r.valueAdded));

    const per = r.demand > 0 ? r.demand : 1;
    $('chart-unit').innerHTML =
      '<h4>최종수요 1백만원당 유발효과 (백만원)</h4>' +
      '<table class="xtable"><thead><tr><th>생산</th><th>수입</th><th>부가가치</th></tr></thead><tbody><tr>' +
      `<td>${fmt(r.production / per)}</td><td>${fmt(r.imports / per)}</td><td>${fmt(r.valueAdded / per)}</td>` +
      '</tr></tbody></table>';

    const top = r.rows.slice(0, 5);
    const topSum = top.reduce((a, x) => a + x.production, 0);
    const total = r.production > 0 ? r.production : 1;
    const segs = top.map((x, i) => ({ name: x.name, val: x.production, color: COLORS[i] }))
      .concat([{ name: '기타 산업', val: Math.max(0, r.production - topSum), color: COLORS[5] }]);
    $('chart-top5').innerHTML =
      '<h4>생산유발액의 산업별 집중도 (상위 5개 + 기타)</h4>' +
      '<div class="xstack">' + segs.map((s) => `<span style="width:${(s.val / total) * 100}%;background:${s.color}" title="${esc(s.name)}"></span>`).join('') + '</div>' +
      '<ul class="xlegend">' + segs.map((s) => `<li><i style="background:${s.color}"></i>${esc(s.name)} ${((s.val / total) * 100).toFixed(1)}%</li>`).join('') + '</ul>';
  }

  function watchResults() {
    const rows = $('result-rows');
    if (!rows) return;
    new MutationObserver(() => {
      const r = getResult();
      if (r && r.rows) renderCharts(r);
    }).observe(rows, { childList: true });
  }

  // ---------- 2. 시나리오 저장 / 비교 ----------
  function say(text) {
    const el = $('save-msg');
    if (!el) return;
    el.textContent = text;
    setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 5000);
  }

  function saveScenario() {
    const r = getResult();
    if (!r || !r.rows) { say('먼저 파급효과를 계산하세요.'); return; }
    if (saved.length >= MAX) { say('최대 ' + MAX + '개까지 저장할 수 있어요. 비교 화면에서 삭제 후 저장하세요.'); return; }
    const desc = getBasket().map((s) => s.name + ' +' + fmt0(s.amount)).join(', ');
    if (saved.some((s) => s.desc === desc && s.production === r.production)) { say('같은 시나리오가 이미 저장돼 있어요.'); return; }
    const used = saved.map((s) => s.label);
    const label = 'ABCDE'.split('').find((l) => !used.includes(l));
    saved.push({
      id: Date.now(), label, desc,
      demand: r.demand, production: r.production, imports: r.imports, valueAdded: r.valueAdded, multiplier: r.multiplier,
      top: r.rows.slice(0, 5).map((x) => ({ name: x.name, production: x.production }))
    });
    persist();
    renderCompare();
    say('시나리오 ' + label + ' 로 저장했어요. 상단 "시나리오 비교" 메뉴에서 확인하세요.');
  }

  function renderCompare() {
    const link = document.querySelector('nav a[data-page="compare"]');
    if (link) link.textContent = '시나리오 비교' + (saved.length ? ' (' + saved.length + ')' : '');
    const box = $('compare-body');
    if (!box) return;
    if (!saved.length) {
      box.innerHTML = '<p>저장된 시나리오가 없어요. 시뮬레이터에서 계산한 뒤 <b>"이 결과를 비교용으로 저장"</b>을 누르면 여기서 비교할 수 있어요.</p>' +
        '<p><button type="button" data-page="simulation">시뮬레이터로 이동</button></p>';
      return;
    }
    const metrics = [['demand', '최종수요 증가액'], ['production', '생산유발액'], ['imports', '수입유발액'], ['valueAdded', '부가가치유발액'], ['multiplier', '생산유발 승수']];
    let html = '<div class="scroll"><table class="xtable"><thead><tr><th>항목 (백만원)</th>' +
      saved.map((s, i) => `<th><span class="dot" style="background:${COLORS[i % 5]}"></span>시나리오 ${s.label}<br><small title="${esc(s.desc)}">${esc(short(s.desc))}</small><br><button type="button" data-del="${s.id}">삭제</button></th>`).join('') +
      '</tr></thead><tbody>';
    metrics.forEach(([k, name]) => {
      const mx = Math.max(...saved.map((s) => s[k]));
      html += `<tr><th scope="row">${name}</th>` + saved.map((s) => `<td class="${saved.length > 1 && s[k] === mx ? 'best' : ''}">${fmt(s[k])}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table></div><p class="note">굵은 글씨는 각 항목에서 가장 큰 값입니다.</p>';

    const gmax = Math.max(1, ...saved.flatMap((s) => [s.production, s.imports, s.valueAdded]));
    html += '<h3>유발액 비교 (백만원)</h3>' + [['production', '생산유발액'], ['imports', '수입유발액'], ['valueAdded', '부가가치유발액']].map(([k, name]) =>
      '<h4>' + name + '</h4>' + saved.map((s, i) => barRow('시나리오 ' + s.label, s[k], gmax, COLORS[i % 5], fmt0(s[k]))).join('')
    ).join('');

    html += '<h3>생산유발액 상위 5개 산업</h3><div class="scroll"><table class="xtable"><thead><tr><th>순위</th>' +
      saved.map((s) => `<th>시나리오 ${s.label}</th>`).join('') + '</tr></thead><tbody>';
    for (let i = 0; i < 5; i++) {
      html += `<tr><th scope="row">${i + 1}</th>` + saved.map((s) => (s.top[i] ? `<td>${esc(s.top[i].name)}<br><small>${fmt0(s.top[i].production)}</small></td>` : '<td>-</td>')).join('') + '</tr>';
    }
    html += '</tbody></table></div><p><button type="button" data-del="all">저장된 시나리오 모두 삭제</button></p>';
    box.innerHTML = html;
  }

  function bindCompare() {
    const box = $('compare-body');
    if (!box) return;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      const id = b.getAttribute('data-del');
      saved = id === 'all' ? [] : saved.filter((s) => String(s.id) !== id);
      persist();
      renderCompare();
    });
  }

  injectBlock();
  watchResults();
  bindCompare();
  renderCompare();
})();
