// linkage.js - 영향력계수·감응도계수 화면 (샘플 app.js는 수정하지 않음)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f3 = (x) => Number(x).toFixed(3);

  const TYPES = {
    both: { label: '전·후방 연쇄효과 모두 큼', cond: '영향력 ≥ 1, 감응도 ≥ 1', color: '#c53030' },
    back: { label: '후방연쇄효과 큼', cond: '영향력 ≥ 1, 감응도 < 1', color: '#2b6cb0' },
    fwd: { label: '전방연쇄효과 큼', cond: '영향력 < 1, 감응도 ≥ 1', color: '#2f855a' },
    low: { label: '연쇄효과 작음', cond: '영향력 < 1, 감응도 < 1', color: '#a0aec0' }
  };
  const typeOf = (inf, sen) => (inf >= 1 ? (sen >= 1 ? 'both' : 'back') : (sen >= 1 ? 'fwd' : 'low'));

  let data = null;   // [{code, name, influence, sensitivity, type}]
  let running = false;

  function say(text, isError) {
    const el = $('link-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#b91c1c' : '';
  }

  // 샘플 app.js의 자료 로딩이 끝날 때까지 기다린다 (시트 선택 칸이 활성화되면 준비 완료)
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
      say('연쇄효과 계수를 계산하는 중...');
      const res = await call('linkage', null);   // app.js의 call() 사용
      data = res.rows.map((r) => ({ code: r.code, name: r.name, influence: r.influence, sensitivity: r.sensitivity, type: typeOf(r.influence, r.sensitivity) }));
      render();
      say('');
    } catch (err) {
      say('계산 실패: ' + err.message, true);
    } finally {
      running = false;
    }
  }

  function render() {
    $('link-body').hidden = false;
    const counts = { both: 0, back: 0, fwd: 0, low: 0 };
    data.forEach((r) => { counts[r.type]++; });

    $('link-cards').innerHTML = Object.keys(TYPES).map((k) =>
      `<div class="xcard"><span class="dot" style="background:${TYPES[k].color}"></span><b>${TYPES[k].label}</b><strong>${counts[k]}개</strong><small>${TYPES[k].cond}</small></div>`
    ).join('');

    refreshTable();   // 표와 분포 그래프를 함께 그린다
  }

  function drawChart() {
    const q = $('link-search').value.trim();
    const hit = (r) => q && (r.code + ' ' + r.name).includes(q);
    const hits = q ? data.filter(hit) : [];
    const dim = hits.length > 0;

    const W = 640, H = 420, L = 52, R = 16, T = 16, B = 44;
    const xmax = Math.max(2, Math.max(...data.map((r) => r.influence)) * 1.05);
    const ymax = Math.max(2, Math.max(...data.map((r) => r.sensitivity)) * 1.05);
    const sx = (v) => L + (v / xmax) * (W - L - R);
    const sy = (v) => H - B - (v / ymax) * (H - T - B);
    const step = (m) => (m <= 3 ? 0.5 : m <= 6 ? 1 : 2);

    let g = '';
    for (let v = 0; v <= xmax; v += step(xmax)) g += `<text x="${sx(v)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">${v}</text>`;
    for (let v = 0; v <= ymax; v += step(ymax)) g += `<text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${v}</text>`;
    g += `<line x1="${sx(1)}" y1="${T}" x2="${sx(1)}" y2="${H - B}" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/>`;
    g += `<line x1="${L}" y1="${sy(1)}" x2="${W - R}" y2="${sy(1)}" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/>`;
    g += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="currentColor" opacity=".6"/>`;
    g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="currentColor" opacity=".6"/>`;
    g += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="currentColor">영향력계수 (후방연쇄)</text>`;
    g += `<text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="currentColor">감응도계수 (전방연쇄)</text>`;

    const circle = (r, big) => `<circle cx="${sx(r.influence).toFixed(1)}" cy="${sy(r.sensitivity).toFixed(1)}" r="${big ? 6.5 : 3.5}" fill="${TYPES[r.type].color}" fill-opacity="${big ? 1 : dim ? 0.2 : 0.75}"${big ? ' stroke="currentColor" stroke-width="2"' : ''}><title>[${esc(r.code)}] ${esc(r.name)} · 영향력 ${f3(r.influence)} · 감응도 ${f3(r.sensitivity)}</title></circle>`;
    data.forEach((r) => { if (!(dim && hit(r))) g += circle(r, false); });
    hits.forEach((r) => { g += circle(r, true); });
    if (hits.length && hits.length <= 6) {
      hits.forEach((r) => {
        const label = r.name.length > 14 ? r.name.slice(0, 14) + '…' : r.name;
        g += `<text x="${(sx(r.influence) + 9).toFixed(1)}" y="${(sy(r.sensitivity) - 8).toFixed(1)}" font-size="11" fill="currentColor" font-weight="700">${esc(label)}</text>`;
      });
    }

    $('link-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="산업별 영향력계수와 감응도계수 분포">${g}</svg>` +
      '<p class="note">점 하나가 산업 하나입니다. 점에 마우스를 올리면 산업명이 보입니다. 점선은 기준값 1입니다. 아래 "산업 검색"에 입력하면 해당 산업이 강조됩니다.</p>';
  }

  function refreshTable() {
    if (!data) return;
    drawChart();
    const type = $('link-type').value;
    const q = $('link-search').value.trim();
    const sort = $('link-sort').value;
    const rows = data.filter((r) => (type === 'all' || r.type === type) && (!q || (r.code + ' ' + r.name).includes(q)));
    rows.sort((a, b) => sort === 'sensitivity' ? b.sensitivity - a.sensitivity : sort === 'code' ? a.code.localeCompare(b.code) : b.influence - a.influence);
    $('link-count').textContent = rows.length + '개 산업';
    $('link-rows').innerHTML = rows.map((r) =>
      `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${f3(r.influence)}</td><td>${f3(r.sensitivity)}</td><td style="text-align:left"><span class="dot" style="background:${TYPES[r.type].color}"></span>${TYPES[r.type].label}</td><td style="text-align:center"><button type="button" data-sim="${esc(r.code)}">시뮬레이션</button></td></tr>`
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
    const rows = [['산업코드', '산업명', '영향력계수', '감응도계수', '유형'], ...data.map((r) => [r.code, r.name, r.influence, r.sensitivity, TYPES[r.type].label])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'io-2023-linkage.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 화면 연결
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-page]');
    if (el && el.getAttribute('data-page') === 'linkage') start();
  });
  ['link-type', 'link-sort'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', refreshTable); });
  if ($('link-search')) $('link-search').addEventListener('input', refreshTable);
  if ($('link-download')) $('link-download').addEventListener('click', download);
  if ($('link-rows')) $('link-rows').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sim]');
    if (b) goSimulate(b.getAttribute('data-sim'));
  });
})();
