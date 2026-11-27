// start.js - 홈 화면 위쪽에 "시작하기" 단계 띠를 넣는다 (뉴스 카드 위에 표시)
(function () {
  'use strict';
  const home = document.getElementById('page-main');
  if (!home) return;
  const $ = (id) => document.getElementById(id);

  const STEPS = [
    { n: 1, title: '자료 불러오기', desc: '380개 기본부문 자료를 준비합니다. 처음에는 1분 정도 걸립니다.', load: true },
    { n: 2, title: '시뮬레이션', desc: '산업과 수요 증가액을 넣고 생산·수입·부가가치 파급효과를 계산합니다.', page: 'simulation' },
    { n: 3, title: '비교·저장', desc: '계산한 결과를 저장해 시나리오끼리 나란히 비교합니다.', page: 'compare' },
    { n: 4, title: '구조 분석', desc: '영향력·감응도, 유발계수 지도로 산업 구조를 살펴봅니다.', page: 'linkage' }
  ];

  const style = document.createElement('style');
  style.textContent =
    '.start{margin:0 0 28px}' +
    '.start-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}' +
    '.start-head h2{margin:0}.start-head a{font-weight:700;font-size:.92rem;text-decoration:none}' +
    '.start-head a:hover{text-decoration:underline}' +
    '.start-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}' +
    '.start-step{display:flex;flex-direction:column;gap:6px;padding:18px 20px;border:1px solid var(--rule,#e6e2d6);border-radius:18px;background:var(--sheet,#fff);color:inherit;text-decoration:none;box-shadow:var(--shadow,none);transition:transform .15s,box-shadow .15s,border-color .15s}' +
    '.start-step:hover{transform:translateY(-3px);border-color:var(--accent,#1f7a52);box-shadow:var(--shadow-hover,0 8px 20px rgba(0,0,0,.12))}' +
    '.start-num{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:999px;background:var(--accent-tint,#e7f0e9);color:var(--accent-dark,#0f4c33);font-weight:800;font-size:.95rem}' +
    '.start-step.done .start-num{background:var(--accent,#1f7a52);color:#fff}' +
    '.start-title{font-weight:800;font-size:1.05rem;letter-spacing:-.02em}' +
    '.start-desc{font-size:.88rem;line-height:1.55;color:var(--muted,#7a6f63)}';
  document.head.append(style);

  const wrap = document.createElement('section');
  wrap.className = 'start';
  wrap.innerHTML =
    '<div class="start-head"><h2>시작하기</h2><a href="#" data-page="guide">전체 이용 안내 보기 →</a></div>' +
    '<div class="start-steps">' + STEPS.map((s) =>
      `<a class="start-step" href="#" ${s.load ? 'data-step="load"' : 'data-page="' + s.page + '"'}><span class="start-num">${s.n}</span><span class="start-title">${s.title}</span><span class="start-desc">${s.desc}</span></a>`
    ).join('') + '</div>';
  home.prepend(wrap);

  // 1단계: 눌러서 자료 불러오기 (나머지 단계는 nav.js가 data-page로 이동 처리)
  const first = wrap.querySelector('[data-step="load"]');
  first.addEventListener('click', (e) => {
    e.preventDefault();
    const b = $('load-basic');
    if (b && !b.disabled) b.click();
  });

  // 자료 준비가 끝나면 1단계에 완료 표시
  const desc = first.querySelector('.start-desc'), num = first.querySelector('.start-num');
  const original = desc.textContent;
  function sync() {
    const sheet = $('sheet');
    const ready = !!sheet && !sheet.disabled;
    first.classList.toggle('done', ready);
    num.textContent = ready ? '✓' : '1';
    desc.textContent = ready ? '자료 준비가 끝났습니다. 아래 단계로 이어서 진행하세요.' : original;
  }
  const sheet = $('sheet');
  if (sheet) new MutationObserver(sync).observe(sheet, { attributes: true, attributeFilter: ['disabled'] });
  sync();
})();
