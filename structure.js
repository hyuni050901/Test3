// structure.js - 수입의존도·부가가치 창출력 지도 (샘플 app.js는 수정하지 않음)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f3 = (x) => Number(x).toFixed(3);

  const TYPES = {
    best: { label: '수입 적고 파급 큼', cond: '수입유발 < 평균, 생산유발 ≥ 평균', color: '#2f855a' },
    imp: { label: '파급 크나 수입 의존 큼', cond: '수입유발 ≥ 평균, 생산유발 ≥ 평균', color: '#c53030' },
    low: { label: '수입 적고 파급 작음', cond: '수입유발 < 평균, 생산유발 < 평균', color: '#2b6cb0' },
    weak: { label: '수입 의존 큼 · 파급 작음', cond: '수입유발 ≥ 평균, 생산유발 < 평균', color: '#a0aec0' }
  };

  let data = null;   // [{code, name, production, imports, valueAdded, type}]
  let avg = null;    // {production, imports, valueAdded}
  let running = false;

  const typeOf = (imp, prod) => (imp < avg.imports ? (prod >= avg.production ? 'best' : 'low') : (prod >= avg.production ? 'imp' : 'weak'));

  function say(text, isError) {
    const el = $('st-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#b91c1c' : '';
  }

  function waitReady() {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const timer = setInterval(() => {
        const sheet = $('sheet');
        const status = ($('status') && $('status').textContent) || '';
        if (sheet && !sheet.disabled) { clearInterval(timer); resolve(); }
        else if (status.startsWith('준비 실패')) { clearInterval(timer); reject(Error('자료 불러오기에 실패했습니다.')); }
        else if (Date.now() - t0 > 240000) { clearInterval(timer); reject(Error('시간이 너무 오래 걸립니다. 새로고침 후 다시 시도하세요.')); }
      }, 400);
    });
  }

  async function start() {
    if (data || running) return;
    running = true;
    try {
      const loadBtn = $('load-basic');
      if (loadBtn && !loadBtn.disabled) loadBtn.click();
      say('자료를 불러오는 중입니다. 처음에는 1분 가까이 걸릴 수 있어요...');
      await waitReady();
      say('유발계수를 계산하는 중...');
      const res = await call('structure', null);   // app.js의 call() 사용
      avg = { production: res.avgProduction, imports: res.avgImports, valueAdded: res.avgValueAdded };
      data = res.rows.map((r) => ({ code: r.code, name: r.name, production: r.production, imports: r.imports, valueAdded: r.valueAdded, type: typeOf(r.imports, r.production) }));
      render();
      say('');
    } catch (err) {
      say('계산 실패: ' + err.message, true);
    } finally {
      running = false;
    }
  }

  function render() {
    $('st-body').hidden = false;
    const counts = { best: 0, imp: 0, low: 0, weak: 0 };
    data.forEach((r) => { counts[r.type]++; });
    $('st-cards').innerHTML = Object.keys(TYPES).map((k) =>
      `<div class="xcard"><span class="dot" style="background:${TYPES[k].color}"></span><b>${TYPES[k].label}</b><strong>${counts[k]}개</strong><small>${TYPES[k].cond}</small></div>`
    ).join('');
    $('st-avg').textContent = '380개 산업 단순평균: 수입유발계수 ' + f3(avg.imports) + ', 부가가치유발계수 ' + f3(avg.valueAdded) + ', 생산유발계수 ' + f3(avg.production);
    refreshTable();
  }

  const niceStep = (range) => (range <= 0.5 ? 0.05 : range <= 1 ? 0.1 : range <= 2 ? 0.25 : range <= 4 ? 0.5 : 1);

  function drawChart() {
    const q = $('st-search').value.trim();
    const hit = (r) => q && (r.code + ' ' + r.name).includes(q);
    const hits = q ? data.filter(hit) : [];
    const dim = hits.length > 0;

    const W = 640, H = 420, L = 56, R = 16, T = 16, B = 44;
    const xmin = 0;
    const xmax = Math.max(...data.map((r) => r.imports)) * 1.05;
    const ymin = Math.min(1, Math.floor(Math.min(...data.map((r) => r.production)) * 10) / 10);
    const ymax = Math.max(...data.map((r) => r.production)) * 1.05;
    const sx = (v) => L + ((v - xmin) / (xmax - xmin)) * (W - L - R);
    const sy = (v) => H - B - ((v - ymin) / (ymax - ymin)) * (H - T - B);
    const xs = niceStep(xmax - xmin), ys = niceStep(ymax - ymin);

    let g = '';
    for (let v = xmin; v <= xmax + 1e-9; v += xs) g += `<text x="${sx(v).toFixed(1)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">${+v.toFixed(2)}</text>`;
    for (let v = ymin; v <= ymax + 1e-9; v += ys) g += `<text x="${L - 8}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${+v.toFixed(2)}</text>`;
    // 평균선
    g += `<line x1="${sx(avg.imports).toFixed(1)}" y1="${T}" x2="${sx(avg.imports).toFixed(1)}" y2="${H - B}" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/>`;
    g += `<line x1="${L}" y1="${sy(avg.production).toFixed(1)}" x2="${W - R}" y2="${sy(avg.production).toFixed(1)}" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/>`;
    // 축
    g += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="currentColor" opacity=".6"/>`;
    g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="currentColor" opacity=".6"/>`;
    g += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="currentColor">수입유발계수 (수요 1단위당 수입유발)</text>`;
    g += `<text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="currentColor">생산유발계수 (수요 1단위당 생산유발)</text>`;
    // 사분면 이름
    g += `<text x="${L + 6}" y="${T + 14}" font-size="11" fill="currentColor" opacity=".55">수입 적고 파급 큼</text>`;
    g += `<text x="${W - R - 6}" y="${T + 14}" text-anchor="end" font-size="11" fill="currentColor" opacity=".55">파급 크나 수입 의존 큼</text>`;
    g += `<text x="${L + 6}" y="${H - B - 8}" font-size="11" fill="currentColor" opacity=".55">수입 적고 파급 작음</text>`;
    g += `<text x="${W - R - 6}" y="${H - B - 8}" text-anchor="end" font-size="11" fill="currentColor" opacity=".55">수입 의존 큼 · 파급 작음</text>`;

    const circle = (r, big) => `<circle cx="${sx(r.imports).toFixed(1)}" cy="${sy(r.production).toFixed(1)}" r="${big ? 6.5 : 3.5}" fill="${TYPES[r.type].color}" fill-opacity="${big ? 1 : dim ? 0.2 : 0.75}"${big ? ' stroke="currentColor" stroke-width="2"' : ''}><title>[${esc(r.code)}] ${esc(r.name)} · 수입유발 ${f3(r.imports)} · 부가가치유발 ${f3(r.valueAdded)} · 생산유발 ${f3(r.production)}</title></circle>`;
    data.forEach((r) => { if (!(dim && hit(r))) g += circle(r, false); });
    hits.forEach((r) => { g += circle(r, true); });
    if (hits.length && hits.length <= 6) {
      hits.forEach((r) => {
        const label = r.name.length > 14 ? r.name.slice(0, 14) + '…' : r.name;
        g += `<text x="${(sx(r.imports) + 9).toFixed(1)}" y="${(sy(r.production) - 8).toFixed(1)}" font-size="11" fill="currentColor" font-weight="700">${esc(label)}</text>`;
      });
    }

    $('st-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="산업별 수입유발계수와 생산유발계수 분포">${g}</svg>` +
      '<p class="note">점 하나가 산업 하나입니다. 점에 마우스를 올리면 산업명과 세 계수가 보입니다. 점선은 전체 평균입니다. 수입유발계수와 부가가치유발계수의 합은 항상 1이므로, 가로축에서 왼쪽일수록 부가가치유발계수가 큽니다. 아래 "산업 검색"에 입력하면 해당 산업이 강조됩니다.</p>';
  }

  function refreshTable() {
    if (!data) return;
    drawChart();
    const type = $('st-type').value;
    const q = $('st-search').value.trim();
    const sort = $('st-sort').value;
    const rows = data.filter((r) => (type === 'all' || r.type === type) && (!q || (r.code + ' ' + r.name).includes(q)));
    rows.sort((a, b) =>
      sort === 'imports' ? b.imports - a.imports :
      sort === 'production' ? b.production - a.production :
      sort === 'code' ? a.code.localeCompare(b.code) :
      b.valueAdded - a.valueAdded);
    $('st-count').textContent = rows.length + '개 산업';
    $('st-rows').innerHTML = rows.map((r) =>
      `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${f3(r.imports)}</td><td>${f3(r.valueAdded)}</td><td>${f3(r.production)}</td><td style="text-align:left"><span class="dot" style="background:${TYPES[r.type].color}"></span>${TYPES[r.type].label}</td><td style="text-align:center"><button type="button" data-sim="${esc(r.code)}">시뮬레이션</button></td></tr>`
    ).join('');
  }

  // 표의 "시뮬레이션" 버튼: 시뮬레이터로 이동해 해당 산업을 미리 선택해 둔다
  function goSimulate(code) {
    if (window.showPage) window.showPage('simulation');
    const search = $('sector-search');
    if (search) { search.value = ''; search.dispatchEvent(new Event('input')); }
    const sel = $('sector');
    if (sel) sel.value = code;
    const amt = $('amount');
    if (amt) amt.focus();
  }

  const csvCell = (v) => { let s = String(v); if (/^[=+@-]/.test(s) && typeof v !== 'number') s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  function download() {
    if (!data) return;
    const rows = [['산업코드', '산업명', '수입유발계수', '부가가치유발계수', '생산유발계수', '유형'],
      ...data.map((r) => [r.code, r.name, r.imports, r.valueAdded, r.production, TYPES[r.type].label])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'io-2023-structure.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 화면 연결
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-page]');
    if (el && el.getAttribute('data-page') === 'structure') start();
  });
  ['st-type', 'st-sort'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', refreshTable); });
  if ($('st-search')) $('st-search').addEventListener('input', refreshTable);
  if ($('st-download')) $('st-download').addEventListener('click', download);
  if ($('st-rows')) $('st-rows').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sim]');
    if (b) goSimulate(b.getAttribute('data-sim'));
  });
})();
