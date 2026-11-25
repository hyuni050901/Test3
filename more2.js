// more2.js - ① 파급 단계 분석 ② 산업 프로필 (새 페이지) ③ 유발계수 지도에 산업 선택 + 목표 역산 계산기 + 행렬 히트맵 추가
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f3 = (x) => Number(x).toFixed(3);
  const fmt0 = (x) => Number(x).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  const short = (s) => (s.length > 9 ? s.slice(0, 9) + '…' : s);
  const secs = () => { try { return typeof sectors !== 'undefined' ? sectors : []; } catch (e) { return []; } };
  const SMALL = 30;   // 선택 산업이 이 개수 이하면 숫자 표, 초과하면 색 그림

  const style = document.createElement('style');
  style.textContent = '.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}.pgrid ol{padding-left:1.3em;margin:4px 0}.xbar-value.wide{flex-basis:17em}#hm-canvas{width:100%;max-width:760px;image-rendering:pixelated;display:block;border:1px solid rgba(128,128,128,.4)}.sub-section{margin-top:32px;padding-top:16px;border-top:2px solid rgba(128,128,128,.3)}.chip{display:inline-flex;align-items:center;gap:4px;margin:4px 6px 4px 0;padding:2px 4px 2px 10px;border:1px solid rgba(128,128,128,.5);border-radius:14px;font-size:.9em}.chip button{margin:0;padding:0 8px;background:transparent;color:inherit;font-size:1.1em}#pk-list{max-height:320px;overflow:auto;border:1px solid rgba(128,128,128,.4);border-radius:8px;padding:8px 12px;margin:8px 0}#pk-list[hidden]{display:none}.pk-item{display:flex;align-items:center;gap:8px;margin:2px 0;font-weight:400;cursor:pointer}.pk-item input{width:auto;margin:0;display:inline-block}';
  document.head.append(style);

  function waitReady() {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const timer = setInterval(() => {
        const sheet = $('sheet'), status = ($('status') && $('status').textContent) || '';
        if (sheet && !sheet.disabled) { clearInterval(timer); resolve(); }
        else if (status.startsWith('준비 실패')) { clearInterval(timer); reject(Error('자료 불러오기에 실패했습니다.')); }
        else if (Date.now() - t0 > 240000) { clearInterval(timer); reject(Error('시간이 너무 오래 걸립니다. 새로고침 후 다시 시도하세요.')); }
      }, 400);
    });
  }
  async function ensure() { const b = $('load-basic'); if (b && !b.disabled) b.click(); await waitReady(); }
  const say = (id, t, err) => { const e = $(id); if (e) { e.textContent = t; e.style.color = err ? '#b91c1c' : ''; } };

  const picker = (id, label, none) => `<label>${label} 검색<input id="${id}-q" placeholder="산업 이름 또는 코드"></label><label>${label}<select id="${id}">${none ? '<option value="">비교 안 함</option>' : ''}</select></label>`;
  function fillPicker(id, none) {
    const q = $(id + '-q').value.trim(), sel = $(id), cur = sel.value;
    sel.innerHTML = (none ? '<option value="">비교 안 함</option>' : '') + secs().filter((s) => (s.code + ' ' + s.name).includes(q)).map((s) => `<option value="${s.code}">${esc(s.code + ' ' + s.name)}</option>`).join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }
  const bindPicker = (id, none) => $(id + '-q').addEventListener('input', () => fillPicker(id, none));

  // ---------- 페이지/메뉴 삽입 (이용 안내 앞에 끼워 넣기) ----------
  function addPage(id, title, desc, html, menuIcon, menuText, btnText) {
    const d = document.createElement('div');
    d.id = 'page-' + id; d.className = 'page-view';
    d.innerHTML = `<p class="back-bar"><button type="button" data-page="main">← 메인 화면으로 돌아가기</button></p><h2>${title}</h2>${html}`;
    document.querySelector('main').append(d);

    const nav = document.querySelector('nav');
    const a = document.createElement('a');
    a.href = '#'; a.setAttribute('data-page', id); a.textContent = menuText;
    const guideLink = nav.querySelector('a[data-page="guide"]');
    if (guideLink) nav.insertBefore(a, guideLink); else nav.append(a);

    const cards = document.querySelector('.menu-cards');
    const c = document.createElement('div');
    c.className = 'menu-card';
    c.innerHTML = `<h3>${menuIcon} ${menuText}</h3><p>${desc}</p><button type="button" data-page="${id}">${btnText}</button>`;
    const guideBtn = cards.querySelector('[data-page="guide"]');
    const guideCard = guideBtn ? guideBtn.closest('.menu-card') : null;
    if (guideCard) cards.insertBefore(c, guideCard); else cards.append(c);
  }

  // ======================= ① 파급 단계 분석 =======================
  addPage('stages', '6. 파급 단계 분석', '수요 증가의 효과가 1차, 2차, 3차…로 어떻게 퍼지는지 단계별로 보여줍니다.',
    '<p>산업 하나의 최종수요가 늘면, 그 산업이 쓰는 국산 중간재 생산이 늘고(1차), 그 중간재를 만드는 데 다시 투입이 늘어나는(2차) 식으로 효과가 이어집니다. 단계가 지날수록 효과는 빠르게 줄어듭니다.</p>' +
    picker('sg-sec', '산업') + '<label>수요 증가액 (백만원)<input id="sg-amt" type="number" value="1000000" min="1"></label>' +
    '<button type="button" id="sg-run">단계별 계산</button><p id="sg-status" role="status">이 화면에서 산업을 고르고 계산하세요.</p><div id="sg-out"></div>',
    '🌊', '파급 단계 분석', '파급 단계 분석으로 이동');

  async function runStages() {
    const code = $('sg-sec').value, amt = Number($('sg-amt').value);
    if (!code || !(amt > 0)) { say('sg-status', '산업과 양의 증가액을 확인하세요.', true); return; }
    say('sg-status', '계산 중…');
    try {
      const r = await call('stages', { code, k: 12 });
      const tot = r.total, max = Math.max(...r.values) || 1;
      let cum = 0, h80 = -1, h90 = -1, rows = '';
      r.values.forEach((v, k) => {
        cum += v; const c = cum / tot;
        if (h80 < 0 && c >= 0.8) h80 = k;
        if (h90 < 0 && c >= 0.9) h90 = k;
        rows += `<div class="xbar"><span class="xbar-label">${k === 0 ? '최초 수요' : k + '차 파급'}</span><span class="xbar-track"><span class="xbar-fill" style="width:${v / max * 100}%;background:${k === 0 ? '#2b6cb0' : '#dd6b20'}"></span></span><span class="xbar-value wide">${fmt0(v * amt)} · 누적 ${(c * 100).toFixed(1)}%</span></div>`;
      });
      const rest = Math.max(0, tot - cum);
      rows += `<div class="xbar"><span class="xbar-label">13차 이후</span><span class="xbar-track"><span class="xbar-fill" style="width:${rest / max * 100}%;background:#718096"></span></span><span class="xbar-value wide">${fmt0(rest * amt)} · 누적 100%</span></div>`;
      const name = secs().find((s) => s.code === code).name;
      $('sg-out').innerHTML = `<h3>${esc(name)} 수요 ${fmt0(amt)}백만원 → 생산유발액 ${fmt0(tot * amt)}백만원 (승수 ${f3(tot)})</h3>` +
        `<p><b>전체 효과의 80%는 ${h80}차 파급까지, 90%는 ${h90}차 파급까지</b> 나타납니다. (최초 수요 = 0차)</p>${rows}` +
        '<p class="note">단계별 값은 국산투입계수행렬(Ad)을 k번 곱해 구한 생산 증가분이며, 모든 단계를 더하면 생산유발액이 됩니다. 단위는 백만원입니다.</p>';
      say('sg-status', '');
    } catch (e) { say('sg-status', '계산 실패: ' + e.message, true); }
  }

  // ======================= ② 산업 프로필 =======================
  addPage('profile', '7. 산업 프로필', '산업 하나를 고르면 380개 산업 중 순위와 연결 산업 TOP10을 진단 카드로 보여줍니다.',
    '<p>산업을 고르면 유발계수·영향력·감응도의 순위와 함께, 이 산업이 누구를 끌어올리고 누구에게 끌려 올라가는지 보여줍니다. 두 번째 산업을 고르면 나란히 비교합니다.</p><div class="pgrid"><div>' +
    picker('pf-a', '산업 A') + '</div><div>' + picker('pf-b', '비교 산업 B', true) + '</div></div>' +
    '<button type="button" id="pf-run">프로필 보기</button><p id="pf-status" role="status">산업을 고르고 버튼을 누르세요.</p><div class="pgrid" id="pf-out"></div>',
    '🏭', '산업 프로필', '산업 프로필로 이동');

  function pcard(p) {
    const row = (k, l, v) => `<tr><th scope="row">${l}</th><td>${f3(v)}</td><td>${p.ranks[k]}위 (상위 ${Math.ceil(p.ranks[k] / p.n * 100)}%)</td></tr>`;
    const list = (a) => '<ol>' + a.map((x) => `<li>${esc(x.name)} <small>${f3(x.value)}</small></li>`).join('') + '</ol>';
    return `<div class="xcard"><h3>[${esc(p.code)}] ${esc(p.name)}</h3><table class="xtable"><thead><tr><th>지표</th><th>값</th><th>${p.n}개 중 순위</th></tr></thead><tbody>` +
      row('production', '생산유발계수', p.production) + row('valueAdded', '부가가치유발계수', p.valueAdded) + row('imports', '수입유발계수 (높을수록 수입 의존)', p.imports) +
      row('influence', '영향력계수 (후방)', p.influence) + row('sensitivity', '감응도계수 (전방)', p.sensitivity) + '</tbody></table>' +
      '<h4>이 산업의 수요가 늘 때 생산이 가장 크게 느는 산업 TOP10 (후방)</h4>' + list(p.backward) +
      '<h4>이 산업의 생산을 가장 크게 끌어올리는 수요 산업 TOP10 (전방)</h4>' + list(p.forward) +
      '<p class="note">TOP10 옆 숫자는 수요 1단위당 생산 증가분(생산유발계수 행렬의 원소)입니다. 자기 자신은 제외했습니다.</p></div>';
  }
  async function runProfile() {
    const a = $('pf-a').value, b = $('pf-b').value;
    if (!a) { say('pf-status', '산업 A를 고르세요.', true); return; }
    say('pf-status', '계산 중…');
    try {
      const ps = await Promise.all([a, b].filter(Boolean).map((code) => call('profile', { code })));
      $('pf-out').innerHTML = ps.map(pcard).join('');
      say('pf-status', '');
    } catch (e) { say('pf-status', '계산 실패: ' + e.message, true); }
  }

  // ======================= ③ 유발계수 지도 페이지에 추가 =======================
  const pick = [];   // 공용 산업 선택 목록 (산업 코드)
  const map = $('page-map');
  if (map) {
    const box = document.createElement('div');
    box.innerHTML =
      '<div class="sub-section"><h2>산업 선택 (목표 역산 · 히트맵 공용)</h2><p>비교하고 싶은 산업을 담으세요. <b>전체 선택</b>을 누르면 모든 산업(검색칸에 입력했다면 검색 결과 전체)을 한 번에 담습니다. 아무것도 담지 않으면 전체 산업 기준으로 보여주고, 담으면 담은 산업만 보여줍니다. 히트맵은 ' + SMALL + '개 이하면 이름과 숫자가 붙은 표로, 그보다 많으면 색 그림으로 보여줍니다.</p>' +
      '<div class="link-controls">' + picker('pk', '산업') + '<button type="button" id="pk-add">추가</button><button type="button" id="pk-every">전체 선택</button><button type="button" id="pk-all">전체 산업 목록 보기</button><button type="button" id="pk-clear">모두 비우기</button></div>' +
      '<div id="pk-list" hidden></div>' +
      '<p id="pk-status" role="status"></p><div id="pk-chips"></div></div>' +
      '<div class="sub-section"><h2>목표 역산 계산기</h2><p>거꾸로 계산합니다. 달성하고 싶은 유발액을 입력하면, 산업별로 <b>최종수요가 얼마나 필요한지</b> 적은 순으로 보여줍니다. 필요한 수요가 작을수록 효율이 높은 산업입니다.</p>' +
      '<div class="link-controls"><label>목표 지표<select id="gl-metric"><option value="valueAdded">부가가치유발액</option><option value="production">생산유발액</option></select></label>' +
      '<label>목표 금액 (백만원)<input id="gl-target" type="number" value="1000000" min="1"></label><button type="button" id="gl-run">역산하기</button></div>' +
      '<p id="gl-status" role="status"></p><div id="gl-out"></div></div>' +
      '<div class="sub-section"><h2>생산유발계수 행렬 히트맵</h2><p>생산유발계수 행렬을 색으로 봅니다. 열 산업의 수요가 1단위 늘 때 행 산업의 생산이 얼마나 느는지를 나타냅니다. 색이 짙을수록 값이 크고(로그 눈금), 대각선은 자기 산업 효과라 가장 짙습니다.</p>' +
      '<div class="link-controls"><label>정렬<select id="hm-sort"><option value="code">산업 코드 순</option><option value="sum">영향력(열합계) 큰 순</option></select></label><button type="button" id="hm-run">히트맵 그리기</button></div>' +
      '<p id="hm-status" role="status"></p><div id="hm-small"></div><canvas id="hm-canvas" width="380" height="380" hidden></canvas><p id="hm-info" class="note" role="status">전체 히트맵 위에 마우스를 올리면 값이 보입니다.</p></div>';
    map.append(box);
  }

  function renderChips() {
    const names = new Map(secs().map((s) => [s.code, s.name]));
    $('pk-chips').innerHTML = pick.length > SMALL
      ? '<p class="note"><b>' + pick.length + '개 산업</b>을 담았습니다. 목록이 길어 이름은 생략합니다. "전체 산업 목록 보기"에서 확인할 수 있습니다.</p>'
      : pick.length
      ? pick.map((c) => `<span class="chip">${esc(c + ' ' + (names.get(c) || ''))}<button type="button" data-rm="${esc(c)}" aria-label="삭제">×</button></span>`).join('')
      : '<p class="note">담은 산업이 없습니다. (전체 산업 기준으로 표시)</p>';
  }
  // 전체 산업 체크박스 목록 (검색칸 내용으로 걸러짐)
  function renderList() {
    const box = $('pk-list');
    if (box.hidden) return;
    const all = secs();
    if (!all.length) { box.innerHTML = '<p class="note">자료를 불러온 뒤에 목록이 표시됩니다.</p>'; return; }
    const q = $('pk-q').value.trim(), top = box.scrollTop;
    const list = all.filter((s) => (s.code + ' ' + s.name).includes(q));
    box.innerHTML = list.length
      ? list.map((s) => `<label class="pk-item"><input type="checkbox" data-code="${esc(s.code)}"${pick.includes(s.code) ? ' checked' : ''}>${esc(s.code + ' ' + s.name)}</label>`).join('')
      : '<p class="note">일치하는 산업이 없습니다.</p>';
    box.scrollTop = top;
  }
  function refreshPick() { renderChips(); renderList(); }
  function addPick() {
    const code = $('pk').value;
    if (!code) { say('pk-status', '먼저 자료가 불러와진 뒤 산업을 고르세요.', true); return; }
    if (pick.includes(code)) { say('pk-status', '이미 담은 산업입니다.', true); return; }
    pick.push(code); say('pk-status', ''); refreshPick();
  }
  function pickAll() {
    const q = $('pk-q').value.trim();
    const list = secs().filter((s) => (s.code + ' ' + s.name).includes(q));
    if (!list.length) { say('pk-status', '자료를 불러온 뒤, 일치하는 산업이 있을 때 사용할 수 있습니다.', true); return; }
    list.forEach((s) => { if (!pick.includes(s.code)) pick.push(s.code); });
    say('pk-status', (q ? '검색 결과 ' : '전체 ') + list.length + '개를 담았습니다. (현재 ' + pick.length + '개)');
    refreshPick();
  }
  async function toggleList() {
    const box = $('pk-list'), btn = $('pk-all');
    if (box.hidden) {
      box.hidden = false; btn.textContent = '전체 산업 목록 접기';
      if (!secs().length) {
        box.innerHTML = '<p class="note">자료를 불러오는 중입니다…</p>';
        try { await ensure(); } catch (e) { return; }
      }
      renderList();
    } else { box.hidden = true; btn.textContent = '전체 산업 목록 보기'; }
  }

  async function runGoal() {
    const metric = $('gl-metric').value, T = Number($('gl-target').value);
    if (!(T > 0)) { say('gl-status', '양의 목표 금액을 입력하세요.', true); return; }
    say('gl-status', '계산 중…');
    try {
      await ensure();
      const r = await call('coeff', null);
      let rows = r.rows.filter((x) => x[metric] > 1e-9).map((x) => ({ code: x.code, name: x.name, need: T / x[metric], imp: T / x[metric] * x.imports, prod: T / x[metric] * x.production }));
      rows.sort((a, b) => a.need - b.need);
      const chosen = pick.length > 0;
      if (chosen) rows = rows.filter((x) => pick.includes(x.code));
      if (!rows.length) { say('gl-status', '선택한 산업의 계수를 구할 수 없습니다.', true); return; }
      const top = rows.length <= SMALL ? rows : rows.slice(0, 15), max = top[top.length - 1].need || 1, lab = metric === 'valueAdded' ? '부가가치' : '생산';
      const title = (chosen ? `선택한 ${rows.length}개 산업` : '전체 산업') + (rows.length <= SMALL ? ' (필요 수요 적은 순)' : ' 중 필요 수요가 적은 15개');
      $('gl-out').innerHTML = `<h3>${lab}유발액 ${fmt0(T)}백만원을 만들기 위한 필요 최종수요 — ${title}</h3>` +
        top.map((x) => `<div class="xbar"><span class="xbar-label" style="flex-basis:13em">${esc(x.name)}</span><span class="xbar-track"><span class="xbar-fill" style="width:${x.need / max * 100}%;background:#2f855a"></span></span><span class="xbar-value wide">${fmt0(x.need)} (수입유발 ${fmt0(x.imp)})</span></div>`).join('') +
        '<div class="scroll"><table class="xtable"><thead><tr><th>순위</th><th>산업</th><th>필요 수요</th><th>생산유발액</th><th>수입유발액</th></tr></thead><tbody>' +
        rows.slice(0, chosen ? rows.length : 50).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.code + ' ' + x.name)}</td><td>${fmt0(x.need)}</td><td>${fmt0(x.prod)}</td><td>${fmt0(x.imp)}</td></tr>`).join('') +
        '</tbody></table></div><p class="note">필요 수요 = 목표 금액 ÷ 해당 유발계수 (단위: 백만원). 순위는 ' + (chosen ? '선택한 산업 안에서의' : '전체 산업 중') + ' 순위이고 ' + (chosen ? '표에는 선택한 산업을 모두' : '표에는 최대 50개를') + ' 표시합니다. 선형 모형의 기준 추정치이며 산업별 공급 능력은 반영하지 않습니다.</p>';
      say('gl-status', '');
    } catch (e) { say('gl-status', '계산 실패: ' + e.message, true); }
  }

  let hm = null, ord = [];
  const heatColor = (v) => {
    const t = v > 0 ? Math.min(1, Math.max(0, (Math.log10(Math.max(v, 1e-5)) + 5) / 5.3)) : 0;
    return { t, rgb: [255 - t * 225, 255 - t * 165, 255 - t * 80] };
  };
  function renderSmall(idx) {
    const head = idx.map((j) => `<th title="${esc(hm.codes[j] + ' ' + hm.names[j])}">${esc(short(hm.names[j]))}</th>`).join('');
    const body = idx.map((i) => `<tr><th scope="row" title="${esc(hm.codes[i] + ' ' + hm.names[i])}">${esc(short(hm.names[i]))}</th>` + idx.map((j) => {
      const v = hm.m[i][j], c = heatColor(v);
      return `<td style="text-align:center;background:rgb(${c.rgb.map(Math.round).join(',')});color:${c.t > 0.6 ? '#fff' : 'inherit'}" title="${esc(hm.names[j] + ' 수요 → ' + hm.names[i] + ' 생산')}">${f3(v)}</td>`;
    }).join('') + '</tr>').join('');
    $('hm-small').innerHTML = `<div class="scroll"><table class="xtable"><thead><tr><th>행: 생산이 느는 산업 ↓<br>열: 수요가 느는 산업 →</th>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
      '<p class="note">칸의 숫자는 열 산업의 최종수요가 1단위 늘 때 행 산업의 생산이 늘어나는 양입니다. 대각선은 자기 산업의 효과입니다. 칸에 마우스를 올리면 전체 이름이 보입니다.</p>';
  }
  async function drawHeat() {
    say('hm-status', '행렬 계산 중…');
    try {
      await ensure();
      if (!hm) hm = await call('matrix', null);
      const n = hm.codes.length, bySum = $('hm-sort').value === 'sum';
      const cs = bySum ? [...Array(n).keys()].map((j) => hm.m.reduce((a, r) => a + r[j], 0)) : null;
      const cv = $('hm-canvas');
      const idx = pick.length >= 2 ? pick.map((c) => hm.codes.indexOf(c)).filter((i) => i >= 0) : [...Array(n).keys()];
      idx.sort(bySum ? (a, b) => cs[b] - cs[a] : (a, b) => hm.codes[a].localeCompare(hm.codes[b]));
      if (idx.length <= SMALL) {
        cv.hidden = true; renderSmall(idx);
        $('hm-info').textContent = '선택한 ' + idx.length + '개 산업의 행렬입니다. 전체 히트맵을 보려면 "전체 선택"을 누르거나 선택 목록을 비우고 다시 그리세요.';
        say('hm-status', ''); return;
      }
      $('hm-small').innerHTML = '';
      ord = idx;
      const m = idx.length;
      cv.width = m; cv.height = m;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(m, m);
      for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
        const c = heatColor(hm.m[ord[y]][ord[x]]).rgb, p = (y * m + x) * 4;
        img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      cv.hidden = false;
      $('hm-info').textContent = (m === n ? '전체 ' : '선택한 ') + m + '개 산업의 히트맵입니다. 마우스를 올리면 값이 보입니다.';
      say('hm-status', '');
    } catch (e) { say('hm-status', '계산 실패: ' + e.message, true); }
  }
  function heatHover(e) {
    if (!hm || $('hm-canvas').hidden) return;
    const cv = $('hm-canvas'), r = cv.getBoundingClientRect(), n = ord.length;
    const x = Math.floor((e.clientX - r.left) / r.width * n), y = Math.floor((e.clientY - r.top) / r.height * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = ord[y], j = ord[x];
    $('hm-info').textContent = `[${hm.codes[j]}] ${hm.names[j]} 수요 1단위 → [${hm.codes[i]}] ${hm.names[i]} 생산 ${f3(hm.m[i][j])}`;
  }

  // ---------- 연결 ----------
  let inited = false;
  async function initPickers() {
    if (inited) return;
    try { await ensure(); } catch (e) { return; }
    inited = true;
    [['sg-sec', false], ['pf-a', false], ['pf-b', true], ['pk', false]].forEach(([id, none]) => { fillPicker(id, none); bindPicker(id, none); });
    refreshPick();
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-page]');
    if (el && ['stages', 'profile', 'map'].includes(el.getAttribute('data-page'))) initPickers();
  });
  $('sg-run').addEventListener('click', runStages);
  $('pf-run').addEventListener('click', runProfile);
  $('gl-run').addEventListener('click', runGoal);
  $('hm-run').addEventListener('click', drawHeat);
  $('hm-canvas').addEventListener('mousemove', heatHover);
  $('pk-add').addEventListener('click', addPick);
  $('pk-every').addEventListener('click', pickAll);
  $('pk-all').addEventListener('click', toggleList);
  $('pk-q').addEventListener('input', renderList);
  $('pk-clear').addEventListener('click', () => { pick.length = 0; refreshPick(); });
  $('pk-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const i = pick.indexOf(b.getAttribute('data-rm'));
    if (i >= 0) pick.splice(i, 1);
    refreshPick();
  });
  $('pk-list').addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-code]');
    if (!cb) return;
    const code = cb.getAttribute('data-code'), i = pick.indexOf(code);
    if (cb.checked) {
      if (i < 0) pick.push(code);
    } else if (i >= 0) pick.splice(i, 1);
    say('pk-status', ''); renderChips();
  });
  renderChips();
})();
