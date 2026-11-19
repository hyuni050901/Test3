// more.js - ① 직접·간접 효과 분해 ② 유발계수 지도 ③ 예시 시나리오 (샘플 app.js는 수정하지 않음)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const COLORS = ['#2b6cb0', '#dd6b20', '#2f855a', '#805ad5', '#d53f8c', '#718096'];
  const fmt0 = (x) => Number(x).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  const f3 = (x) => Number(x).toFixed(3);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // app.js의 전역 변수(result, basket, sectors)를 안전하게 읽는다
  const getResult = () => { try { return typeof result !== 'undefined' ? result : null; } catch (e) { return null; } };
  const getBasket = () => { try { return typeof basket !== 'undefined' ? basket : []; } catch (e) { return []; } };
  const getSectors = () => { try { return typeof sectors !== 'undefined' ? sectors : []; } catch (e) { return []; } };

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

  // ======================================================
  // ① 직접·간접 효과 분해 (시뮬레이터 결과 화면에 삽입)
  // ======================================================
  const METRIC_LABEL = { production: '생산유발액', imports: '수입유발액', valueAdded: '부가가치유발액' };

  function stackRow(label, segs, max, valueText) {
    const bars = segs.map(([v, c, t]) =>
      `<span class="xbar-fill" style="width:${max > 0 ? (v / max) * 100 : 0}%;background:${c}" title="${esc(t)} ${fmt0(v)}"></span>`).join('');
    return `<div class="xbar"><span class="xbar-label" title="${esc(label)}">${esc(label)}</span><span class="xbar-track stack">${bars}</span><span class="xbar-value">${valueText}</span></div>`;
  }

  function renderDecomp(r) {
    const metric = $('decomp-metric').value;
    const direct = new Map();
    getBasket().forEach((s) => direct.set(s.code, (direct.get(s.code) || 0) + Number(s.amount)));

    const demand = r.demand;
    const indirect = Math.max(0, r.production - demand);
    const total = r.production > 0 ? r.production : 1;
    const pct = (v) => ((v / total) * 100).toFixed(1) + '%';
    $('decomp-summary').innerHTML =
      '<h4>생산유발액 구성 (백만원)</h4>' +
      `<div class="xstack"><span style="width:${(demand / total) * 100}%;background:${COLORS[0]}" title="최초 수요"></span><span style="width:${(indirect / total) * 100}%;background:${COLORS[1]}" title="연쇄 효과"></span></div>` +
      `<ul class="xlegend"><li><i style="background:${COLORS[0]}"></i>최초 수요(직접) ${fmt0(demand)} · ${pct(demand)}</li>` +
      `<li><i style="background:${COLORS[1]}"></i>연쇄(간접) 유발 ${fmt0(indirect)} · ${pct(indirect)}</li></ul>` +
      (demand > 0 ? `<p class="note">연쇄 효과는 최초 수요의 ${(indirect / demand).toFixed(3)}배입니다. (생산유발 승수 − 1)</p>` : '');

    const top = r.rows.slice().sort((a, b) => b[metric] - a[metric]).slice(0, 15);
    const max = Math.max(...top.map((x) => x[metric]), 1);
    let html = `<h4>${METRIC_LABEL[metric]} 상위 15개 산업 (백만원)</h4><div class="vbars">`;
    top.forEach((x, i) => {
      const label = `${i + 1}. ${x.name}`;
      if (metric === 'production') {
        const d = Math.min(direct.get(x.code) || 0, x.production);
        html += stackRow(label, [[d, COLORS[0], '최초 수요(직접)'], [x.production - d, COLORS[1], '연쇄(간접)']], max, fmt0(x.production));
      } else {
        html += stackRow(label, [[x[metric], metric === 'imports' ? COLORS[4] : COLORS[2], METRIC_LABEL[metric]]], max, fmt0(x[metric]));
      }
    });
    html += '</div>';
    if (metric === 'production') {
      html += `<ul class="xlegend"><li><i style="background:${COLORS[0]}"></i>최초 수요(직접)</li><li><i style="background:${COLORS[1]}"></i>연쇄(간접) 유발</li></ul>` +
        '<p class="note">수요를 직접 입력한 산업은 파란 부분(최초 수요)이 보이고, 나머지 산업은 모두 연쇄 효과로 생산이 늘어난 것입니다.</p>';
    }
    $('decomp-chart').innerHTML = html;
  }

  function initDecomp() {
    const anchor = $('extra-block') || $('cards');
    if (!anchor) return;
    const block = document.createElement('div');
    block.id = 'decomp-block';
    block.innerHTML =
      '<h3>직접·간접 효과 분해</h3><div id="decomp-summary"></div>' +
      '<p><label>상위 15개 산업 차트 지표 <select id="decomp-metric">' +
      '<option value="production">생산유발액 (직접 + 연쇄)</option><option value="imports">수입유발액</option><option value="valueAdded">부가가치유발액</option></select></label></p>' +
      '<div id="decomp-chart"></div>';
    anchor.after(block);
    $('decomp-metric').addEventListener('change', () => { const r = getResult(); if (r && r.rows) renderDecomp(r); });
    const rows = $('result-rows');
    if (rows) new MutationObserver(() => { const r = getResult(); if (r && r.rows) renderDecomp(r); }).observe(rows, { childList: true });
  }

  // ======================================================
  // ② 유발계수 지도 (새 페이지: page-map)
  // ======================================================
  const MTYPES = {
    hi: { label: '고부가가치·고파급', cond: '부가가치유발 ≥ 평균, 생산유발 ≥ 평균' },
    va: { label: '부가가치 높음·파급 작음', cond: '부가가치유발 ≥ 평균, 생산유발 < 평균' },
    prod: { label: '파급 큼·부가가치 낮음', cond: '부가가치유발 < 평균, 생산유발 ≥ 평균' },
    low: { label: '부가가치·파급 모두 작음', cond: '부가가치유발 < 평균, 생산유발 < 평균' }
  };
  let mapData = null, mapRunning = false, mapMeans = null, impRange = null;

  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const impColor = (v) => {
    const t = impRange.max > impRange.min ? (v - impRange.min) / (impRange.max - impRange.min) : 0;
    return `rgb(${lerp(43, 197, t)},${lerp(108, 48, t)},${lerp(176, 48, t)})`;
  };
  function niceStep(range, target) {
    const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }
  function ticks(min, max) {
    const step = niceStep(max - min || 1, 6), out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
    return { out, dec: Math.max(0, -Math.floor(Math.log10(step))) };
  }
  const mapTypeOf = (r) => (r.valueAdded >= mapMeans.va ? (r.production >= mapMeans.prod ? 'hi' : 'va') : (r.production >= mapMeans.prod ? 'prod' : 'low'));

  function say(text, isError) {
    const el = $('map-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#b91c1c' : '';
  }

  async function startMap() {
    if (mapData || mapRunning) return;
    mapRunning = true;
    try {
      const loadBtn = $('load-basic');
      if (loadBtn && !loadBtn.disabled) loadBtn.click();
      say('자료를 불러오는 중입니다. 처음에는 1분 가까이 걸릴 수 있어요...');
      await waitReady();
      say('유발계수를 계산하는 중...');
      const res = await call('coeff', null);   // app.js의 call() 사용
      const n = res.rows.length;
      mapMeans = {
        prod: res.rows.reduce((a, r) => a + r.production, 0) / n,
        va: res.rows.reduce((a, r) => a + r.valueAdded, 0) / n,
        sum: res.rows.reduce((a, r) => a + r.imports + r.valueAdded, 0) / n
      };
      const imps = res.rows.map((r) => r.imports);
      impRange = { min: Math.min(...imps), max: Math.max(...imps) };
      mapData = res.rows.map((r) => Object.assign({}, r, { type: mapTypeOf(r) }));
      renderMap();
      say('');
    } catch (err) {
      say('계산 실패: ' + err.message, true);
    } finally {
      mapRunning = false;
    }
  }

  function renderMap() {
    $('map-body').hidden = false;
    const counts = { hi: 0, va: 0, prod: 0, low: 0 };
    mapData.forEach((r) => { counts[r.type]++; });
    $('map-cards').innerHTML = Object.keys(MTYPES).map((k) =>
      `<div class="xcard"><b>${MTYPES[k].label}</b><strong>${counts[k]}개</strong><small>${MTYPES[k].cond}</small></div>`).join('');
    $('map-check').textContent =
      `전체 평균: 생산유발계수 ${f3(mapMeans.prod)}, 부가가치유발계수 ${f3(mapMeans.va)}. ` +
      `수입유발계수와 부가가치유발계수의 합은 평균 ${f3(mapMeans.sum)}입니다. (1에 가까우면 두 계수는 서로 보완 관계입니다.)`;
    drawMap();
    refreshMapTable();
  }

  function drawMap() {
    const W = 640, H = 420, L = 56, R = 16, T = 16, B = 44;
    const xs = mapData.map((r) => r.valueAdded), ys = mapData.map((r) => r.production);
    const pad = (a) => (Math.max(...a) - Math.min(...a) || 1) * 0.06;
    const x0 = Math.min(...xs) - pad(xs), x1 = Math.max(...xs) + pad(xs);
    const y0 = Math.min(...ys) - pad(ys), y1 = Math.max(...ys) + pad(ys);
    const sx = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
    const sy = (v) => H - B - ((v - y0) / (y1 - y0)) * (H - T - B);
    const tx = ticks(x0, x1), ty = ticks(y0, y1);

    let g = '';
    tx.out.forEach((v) => { g += `<text x="${sx(v)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">${v.toFixed(tx.dec)}</text>`; });
    ty.out.forEach((v) => { g += `<text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${v.toFixed(ty.dec)}</text>`; });
    g += `<line x1="${sx(mapMeans.va)}" y1="${T}" x2="${sx(mapMeans.va)}" y2="${H - B}" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/>`;
    g += `<line x1="${L}" y1="${sy(mapMeans.prod)}" x2="${W - R}" y2="${sy(mapMeans.prod)}" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/>`;
    g += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="currentColor" opacity=".6"/>`;
    g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="currentColor" opacity=".6"/>`;
    g += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="currentColor">부가가치유발계수</text>`;
    g += `<text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="currentColor">생산유발계수</text>`;
    mapData.forEach((r) => {
      g += `<circle cx="${sx(r.valueAdded).toFixed(1)}" cy="${sy(r.production).toFixed(1)}" r="3.8" fill="${impColor(r.imports)}" fill-opacity=".8"><title>[${esc(r.code)}] ${esc(r.name)} · 생산유발 ${f3(r.production)} · 부가가치유발 ${f3(r.valueAdded)} · 수입유발 ${f3(r.imports)}</title></circle>`;
    });
    $('map-chart').innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="산업별 부가가치유발계수와 생산유발계수 분포">${g}</svg>` +
      `<div class="grad-legend"><span>수입유발계수 낮음 ${f3(impRange.min)}</span><i></i><span>높음 ${f3(impRange.max)}</span></div>` +
      '<p class="note">점 하나가 산업 하나이고, 점 색깔은 수입유발계수입니다. 점선은 전체 평균입니다. 오른쪽 위에 있고 파란색에 가까울수록 "부가가치와 파급효과는 크고 수입 의존은 낮은" 산업입니다.</p>';
  }

  function refreshMapTable() {
    if (!mapData) return;
    const type = $('map-type').value, q = $('map-search').value.trim(), sort = $('map-sort').value;
    const rows = mapData.filter((r) => (type === 'all' || r.type === type) && (!q || (r.code + ' ' + r.name).includes(q)));
    rows.sort((a, b) => sort === 'valueAdded' ? b.valueAdded - a.valueAdded : sort === 'importsAsc' ? a.imports - b.imports : sort === 'code' ? a.code.localeCompare(b.code) : b.production - a.production);
    $('map-count').textContent = rows.length + '개 산업';
    $('map-rows').innerHTML = rows.map((r) =>
      `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${f3(r.production)}</td><td>${f3(r.imports)}</td><td>${f3(r.valueAdded)}</td><td style="text-align:left">${MTYPES[r.type].label}</td></tr>`).join('');
  }

  const csvCell = (v) => { let s = String(v); if (/^[=+@-]/.test(s) && typeof v !== 'number') s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  function downloadMap() {
    if (!mapData) return;
    const rows = [['산업코드', '산업명', '생산유발계수', '수입유발계수', '부가가치유발계수', '유형'], ...mapData.map((r) => [r.code, r.name, r.production, r.imports, r.valueAdded, MTYPES[r.type].label])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'io-2023-coefficient-map.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function initMapPage() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-page]');
      if (el && el.getAttribute('data-page') === 'map') startMap();
    });
    ['map-type', 'map-sort'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', refreshMapTable); });
    if ($('map-search')) $('map-search').addEventListener('input', refreshMapTable);
    if ($('map-download')) $('map-download').addEventListener('click', downloadMap);
  }

  // ======================================================
  // ③ 예시 시나리오 버튼 (시뮬레이터 입력 화면에 삽입)
  //    keys: 산업명에 포함된 글자. 앞에서부터 차례로 찾아 처음 맞는 산업을 씁니다.
  //    amount: 백만원 단위 (1,000,000 = 1조 원). 산업명이 다르면 keys만 고치세요.
  // ======================================================
  const PRESETS = [
    { label: '반도체 +1조 원', items: [{ keys: ['반도체', '집적회로'], amount: 1000000 }] },
    { label: '자동차 +1조 원', items: [{ keys: ['승용차', '자동차'], amount: 1000000 }] },
    { label: '건설 +1조 원', items: [{ keys: ['건축', '건설'], amount: 1000000 }] },
    { label: '선박 +1조 원', items: [{ keys: ['선박'], amount: 1000000 }] },
    { label: '병원 +1조 원', items: [{ keys: ['병원', '의료'], amount: 1000000 }] },
    { label: '반도체·자동차 각 5천억 원', items: [{ keys: ['반도체', '집적회로'], amount: 500000 }, { keys: ['승용차', '자동차'], amount: 500000 }] }
  ];

  function findSector(keys) {
    const list = getSectors();
    for (const k of keys) { const s = list.find((x) => x.name.includes(k)); if (s) return s; }
    return null;
  }

  function applyPreset(p) {
    const msg = $('preset-msg');
    if (!getSectors().length) { msg.textContent = '먼저 자료를 불러오세요.'; return; }
    const found = [], missing = [];
    p.items.forEach((it) => {
      const s = findSector(it.keys);
      if (s) found.push({ code: s.code, name: s.name, amount: it.amount }); else missing.push(it.keys[0]);
    });
    if (!found.length) { msg.textContent = '이 예시에 맞는 산업을 찾지 못했습니다. (' + missing.join(', ') + ')'; return; }
    const b = getBasket();
    b.splice(0, b.length, ...found);        // 기존 시나리오를 예시로 교체
    if (typeof invalidate === 'function') invalidate();
    if (typeof renderBasket === 'function') renderBasket();
    msg.textContent = '입력됨: ' + found.map((f) => `[${f.code}] ${f.name} +${fmt0(f.amount)}백만원`).join(', ') +
      (missing.length ? ` · 찾지 못한 산업: ${missing.join(', ')}` : '') + ' → "파급효과 계산"을 눌러보세요.';
  }

  function initPresets() {
    const form = $('scenario');
    if (!form) return;
    const box = document.createElement('div');
    box.className = 'preset-box';
    box.innerHTML = '<b>예시 시나리오</b> <span class="preset-buttons">' +
      PRESETS.map((p, i) => `<button type="button" data-preset="${i}" disabled>${esc(p.label)}</button>`).join('') +
      '</span><p id="preset-msg" class="note" role="status"></p>';
    form.before(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (b) applyPreset(PRESETS[Number(b.getAttribute('data-preset'))]);
    });
    // 자료가 로딩되어 산업 선택 칸이 활성화되면 버튼도 활성화
    const sync = () => { box.querySelectorAll('[data-preset]').forEach((b) => { b.disabled = !!$('sector').disabled; }); };
    new MutationObserver(sync).observe($('sector'), { attributes: true, attributeFilter: ['disabled'] });
    sync();
  }

  [initDecomp, initMapPage, initPresets].forEach((fn) => {
    try { fn(); } catch (e) { console.error('[more.js] ' + fn.name + ' 초기화 실패:', e); }
  });
})();
