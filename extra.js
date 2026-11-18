// extra.js - 결과 요약·승수·단계별 구성 / 상위 산업 차트 지표 전환 / 시나리오 저장·비교 / 예시 시나리오 (샘플 app.js는 수정하지 않음)
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
  // 백만원 단위 금액을 읽기 쉬운 단위로 바꿔 보여준다
  const won = (x) => {
    const a = Math.abs(x);
    if (a >= 1e6) return (x / 1e6).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '조원';
    if (a >= 100) return (x / 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '억원';
    return fmt0(x) + '백만원';
  };

  // app.js의 전역 변수(result, basket, sectors)를 안전하게 읽는다
  const getResult = () => { try { return typeof result !== 'undefined' ? result : null; } catch (e) { return null; } };
  const getBasket = () => { try { return typeof basket !== 'undefined' ? basket : []; } catch (e) { return []; } };
  const getSectors = () => { try { return typeof sectors !== 'undefined' ? sectors : []; } catch (e) { return []; } };

  const METRICS = [['demand', '최종수요 증가액'], ['production', '생산유발액'], ['imports', '수입유발액'], ['valueAdded', '부가가치유발액'], ['multiplier', '생산유발 승수']];

  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { saved = []; }
  saved = Array.isArray(saved) ? saved.filter((s) => s && typeof s.production === 'number' && Array.isArray(s.top)) : [];
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* 저장 불가 환경은 무시 */ } };

  const csvCell = (v) => { let s = String(v); if (/^[=+@-]/.test(s) && typeof v !== 'number') s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };

  function barRow(label, value, max, color, valueText) {
    const pct = max > 0 ? Math.max(0, (value / max) * 100) : 0;
    return `<div class="xbar"><span class="xbar-label">${esc(label)}</span><span class="xbar-track"><span class="xbar-fill" style="width:${pct}%;background:${color}"></span></span><span class="xbar-value">${valueText}</span></div>`;
  }

  // ---------- 1. 결과 요약 / 승수 / 단계별 구성 (시뮬레이터 결과 화면에 삽입) ----------
  function injectBlock() {
    const cards = $('cards');
    if (!cards) return false;
    const block = document.createElement('div');
    block.id = 'extra-block';
    block.innerHTML =
      '<h3>결과 요약</h3><p id="result-summary"></p>' +
      '<h3>파급효과 구성</h3>' +
      '<div id="chart-amounts"></div><div id="chart-unit"></div><div id="chart-decomp"></div><div id="chart-top5"></div>' +
      '<p class="save-bar"><input id="save-name" maxlength="30" placeholder="시나리오 이름 (선택)" aria-label="시나리오 이름"/><button type="button" id="save-scenario">이 결과를 비교용으로 저장</button> <span id="save-msg" role="status"></span></p>';
    cards.after(block);
    $('save-scenario').addEventListener('click', saveScenario);
    return true;
  }

  function renderCharts(r) {
    const per = r.demand > 0 ? r.demand : 1;

    // 결과 요약 문장
    const top3 = r.rows.slice(0, 3).map((x) => x.name).join(', ');
    $('result-summary').textContent =
      '최종수요가 ' + won(r.demand) + ' 늘면 국내 생산이 ' + won(r.production) + '(승수 ' + fmt(r.production / per) + '), ' +
      '수입이 ' + won(r.imports) + ', 부가가치가 ' + won(r.valueAdded) + ' 늘어납니다. ' +
      '수요 자체를 뺀 연쇄 파급분은 ' + won(r.production - r.demand) + '이고, 생산유발이 큰 산업은 ' + top3 + ' 순입니다.';

    // 유발액 크기 비교
    const max = Math.max(r.production, r.imports, r.valueAdded, 1);
    $('chart-amounts').innerHTML =
      '<h4>유발액 크기 비교 (백만원)</h4>' +
      barRow('생산유발액', r.production, max, COLORS[0], fmt0(r.production)) +
      barRow('수입유발액', r.imports, max, COLORS[1], fmt0(r.imports)) +
      barRow('부가가치유발액', r.valueAdded, max, COLORS[2], fmt0(r.valueAdded));

    // 승수 카드
    const mult = [
      ['생산유발 승수', r.production / per, '생산', COLORS[0]],
      ['수입유발 승수', r.imports / per, '수입', COLORS[1]],
      ['부가가치유발 승수', r.valueAdded / per, '부가가치', COLORS[2]]
    ];
    $('chart-unit').innerHTML =
      '<h4>최종수요 1백만원당 유발효과 (승수)</h4><div class="xcards">' +
      mult.map(([title, v, what, color]) =>
        `<div class="xcard"><span class="dot" style="background:${color}"></span><b>${title}</b><strong>${fmt(v)}</strong><small>수요 1백만원당 ${what} ${fmt(v)}백만원</small></div>`
      ).join('') + '</div>';

    // 직접·간접효과 분해
    const d = r.decomp;
    if (d) {
      const tot = r.production > 0 ? r.production : 1;
      const segs = [
        { name: '최초 수요', val: d.initial, color: COLORS[0] },
        { name: '1차 파급 (직접효과)', val: d.first, color: COLORS[1] },
        { name: '2차 이후 파급 (간접효과)', val: d.later, color: COLORS[2] }
      ];
      $('chart-decomp').innerHTML =
        '<h4>생산유발액의 단계별 구성</h4>' +
        '<div class="xstack">' + segs.map((s) => `<span style="width:${Math.max(0, (s.val / tot) * 100)}%;background:${s.color}" title="${esc(s.name)}"></span>`).join('') + '</div>' +
        '<ul class="xlegend">' + segs.map((s) => `<li><i style="background:${s.color}"></i>${esc(s.name)} ${fmt0(s.val)}백만원 (${((s.val / tot) * 100).toFixed(1)}%)</li>`).join('') + '</ul>' +
        '<p class="note">최초 수요는 수요를 직접 받은 산업의 생산, 1차 파급은 그 생산에 필요한 국산 중간재 투입, 2차 이후 파급은 그 투입을 만들기 위해 다시 필요한 투입이 이어진 효과입니다. 세 값을 더하면 생산유발액이 됩니다.</p>';
    } else {
      $('chart-decomp').innerHTML = '';
    }

    // 상위 5개 집중도
    const top = r.rows.slice(0, 5);
    const topSum = top.reduce((a, x) => a + x.production, 0);
    const total = r.production > 0 ? r.production : 1;
    const segs5 = top.map((x, i) => ({ name: x.name, val: x.production, color: COLORS[i] }))
      .concat([{ name: '기타 산업', val: Math.max(0, r.production - topSum), color: COLORS[5] }]);
    $('chart-top5').innerHTML =
      '<h4>생산유발액의 산업별 집중도 (상위 5개 + 기타)</h4>' +
      '<div class="xstack">' + segs5.map((s) => `<span style="width:${(s.val / total) * 100}%;background:${s.color}" title="${esc(s.name)}"></span>`).join('') + '</div>' +
      '<ul class="xlegend">' + segs5.map((s) => `<li><i style="background:${s.color}"></i>${esc(s.name)} ${((s.val / total) * 100).toFixed(1)}%</li>`).join('') + '</ul>';
  }

  // 상위 15개 산업 차트: 생산/수입/부가가치 중 선택한 지표로 다시 그린다
  const METRIC_INFO = {
    production: { label: '생산유발액', color: '#168179' },
    imports: { label: '수입유발액', color: COLORS[1] },
    valueAdded: { label: '부가가치유발액', color: COLORS[2] }
  };
  function renderTopBars(r) {
    const sel = $('bars-metric'), bars = $('bars');
    if (!sel || !bars || !r || !r.rows) return;
    const k = METRIC_INFO[sel.value] ? sel.value : 'production';
    const info = METRIC_INFO[k];
    const title = $('bars-title');
    if (title) title.textContent = info.label + ' 상위 15개 산업';
    const top = r.rows.slice().sort((a, b) => b[k] - a[k]).slice(0, 15);
    const max = Math.max(top.length ? top[0][k] : 0, 1e-12);
    bars.innerHTML = top.map((x) =>
      `<div class="bar">${esc(x.name)} · ${fmt(x[k])}백만원<div class="track"><div class="fill" style="width:${Math.max(0, (x[k] / max) * 100)}%;background:${info.color}"></div></div></div>`
    ).join('');
  }

  function watchResults() {
    const rows = $('result-rows');
    if (!rows) return;
    new MutationObserver(() => {
      const r = getResult();
      if (r && r.rows) { renderCharts(r); renderTopBars(r); }
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
    const nameInput = $('save-name');
    const name = nameInput ? nameInput.value.trim().slice(0, 30) : '';
    saved.push({
      id: Date.now(), label, name, desc,
      demand: r.demand, production: r.production, imports: r.imports, valueAdded: r.valueAdded, multiplier: r.multiplier,
      top: r.rows.slice(0, 5).map((x) => ({ name: x.name, production: x.production }))
    });
    if (nameInput) nameInput.value = '';
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
    let html = '<div class="scroll"><table class="xtable"><thead><tr><th>항목 (백만원)</th>' +
      saved.map((s, i) => `<th><span class="dot" style="background:${COLORS[i % 5]}"></span>시나리오 ${s.label}${s.name ? '<br><b>' + esc(s.name) + '</b>' : ''}<br><small title="${esc(s.desc)}">${esc(short(s.desc))}</small><br><button type="button" data-del="${s.id}">삭제</button></th>`).join('') +
      '</tr></thead><tbody>';
    METRICS.forEach(([k, name]) => {
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
    html += '</tbody></table></div><p><button type="button" data-csv="1">비교표 CSV 다운로드</button> <button type="button" data-del="all">저장된 시나리오 모두 삭제</button></p>';
    box.innerHTML = html;
  }

  function downloadCompare() {
    if (!saved.length) return;
    const head = ['항목', ...saved.map((s) => '시나리오 ' + s.label + (s.name ? ' (' + s.name + ')' : ''))];
    const rows = [head, ['시나리오 내용', ...saved.map((s) => s.desc)]];
    METRICS.forEach(([k, name]) => rows.push([name + (k === 'multiplier' ? '' : ' (백만원)'), ...saved.map((s) => s[k])]));
    for (let i = 0; i < 5; i++) rows.push(['생산유발 상위 ' + (i + 1) + '위', ...saved.map((s) => (s.top[i] ? s.top[i].name + ' (' + Math.round(s.top[i].production) + ')' : ''))]);
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'io-2023-compare.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindCompare() {
    const box = $('compare-body');
    if (!box) return;
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-csv]')) { downloadCompare(); return; }
      const b = e.target.closest('[data-del]');
      if (!b) return;
      const id = b.getAttribute('data-del');
      saved = id === 'all' ? [] : saved.filter((s) => String(s.id) !== id);
      persist();
      renderCompare();
    });
  }

  // ---------- 3. 예시 시나리오 버튼 ----------
  let exBuilt = false;
  function buildExamples() {
    const box = $('example-box');
    if (!box || exBuilt) return;
    const list = getSectors();
    if (list.length < 380) return;
    exBuilt = true;
    const defs = [['반도체', 1000000, '1조원'], ['승용차', 1000000, '1조원'], ['건설', 1000000, '1조원'], ['벼', 1000, '10억원']];
    const found = defs.map(([kw, amount, label]) => {
      const s = list.find((x) => x.name === kw) || list.find((x) => x.name.includes(kw));
      return s ? { s, amount, label } : null;
    }).filter(Boolean);
    if (!found.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="note">예시 시나리오 (누르면 바로 계산합니다)</p>';
    found.forEach(({ s, amount, label }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.name + ' ' + label + ' 증가';
      b.addEventListener('click', () => {
        $('clear').click();
        getBasket().push({ code: s.code, name: s.name, amount });
        invalidate();
        renderBasket();
        $('run').click();
      });
      box.append(b);
    });
  }

  function watchSectors() {
    const sel = $('sector');
    if (sel) new MutationObserver(buildExamples).observe(sel, { childList: true });
    buildExamples();
  }

  injectBlock();
  watchResults();
  bindCompare();
  renderCompare();
  watchSectors();
  if ($('bars-metric')) $('bars-metric').addEventListener('change', () => {
    const r = getResult();
    if (r && r.rows) renderTopBars(r);
  });
})();
