// news.js - 홈 화면에 산업연관분석 뉴스를 매거진형으로 보여준다
// 가장 최근 기사 1건은 큰 카드, 나머지는 목록 (news.json을 읽어 표시)
(function () {
  'use strict';
  const home = document.getElementById('page-main');
  if (!home) return;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SHOW = 5;   // 큰 카드 아래 목록에 처음 보여줄 기사 수

  const style = document.createElement('style');
  style.textContent =
    '.news-card{margin:0 0 24px}' +
    '.news-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}' +
    '.news-head h2{margin:0}.news-updated{font-size:.82rem;color:var(--muted,#7a6f63)}' +
    '.news-feature{display:block;padding:24px 26px;border-radius:18px;background:var(--accent-tint,#e7f0e9);color:inherit;text-decoration:none;transition:transform .15s,box-shadow .15s}' +
    '.news-feature:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(28,43,33,.12)}' +
    '.news-badge{display:inline-block;padding:2px 12px;border-radius:999px;background:var(--accent,#1f7a52);color:#fff;font-size:.8rem;font-weight:800}' +
    '.news-feature-title{display:block;margin:12px 0 6px;font-size:1.4rem;font-weight:800;line-height:1.4;letter-spacing:-.02em}' +
    '.news-go{display:inline-block;margin-top:10px;font-weight:700;color:var(--accent-dark,#0f4c33)}' +
    '.news-list{list-style:none;margin:12px 0 0;padding:0}' +
    '.news-list li{border-top:1px solid var(--rule,#e6e2d6)}' +
    '.news-list li:first-child{border-top:0}' +
    '.news-item{display:block;padding:12px 10px;border-radius:12px;text-decoration:none;color:inherit}' +
    '.news-item:hover{background:var(--cream2,#f3efe4)}' +
    '.news-title{display:block;font-weight:700;line-height:1.5}' +
    '.news-meta{display:block;margin-top:2px;font-size:.84rem;color:var(--muted,#7a6f63)}' +
    '.news-more{margin-top:10px}';
  document.head.append(style);

  const card = document.createElement('section');
  card.className = 'news-card';
  card.innerHTML = '<div class="news-head"><h2>산업연관분석 뉴스</h2><span class="news-updated" id="news-updated"></span></div>' +
    '<p class="note" id="news-note">뉴스를 불러오는 중입니다…</p><div id="news-feature"></div><ul class="news-list" id="news-list"></ul><div id="news-more"></div>';
  const guideTitle = Array.from(home.querySelectorAll('h2')).find((h) => h.textContent.trim() === '이용 안내');
  if (guideTitle) home.insertBefore(card, guideTitle); else home.append(card);

  const fmtDate = (d) => (d ? d.replace(/-/g, '.') : '');
  const meta = (a) => esc([a.source, fmtDate(a.date)].filter(Boolean).join(' · '));
  const open = 'target="_blank" rel="noopener noreferrer"';

  function render(items, all) {
    const top = items[0], rest = items.slice(1);
    document.getElementById('news-feature').innerHTML =
      `<a class="news-feature" href="${esc(top.link)}" ${open}><span class="news-badge">최신 기사</span><span class="news-feature-title">${esc(top.title)}</span><span class="news-meta">${meta(top)}</span><span class="news-go">원문 보기 →</span></a>`;
    const list = document.getElementById('news-list');
    list.innerHTML = (all ? rest : rest.slice(0, SHOW)).map((a) =>
      `<li><a class="news-item" href="${esc(a.link)}" ${open}><span class="news-title">${esc(a.title)}</span><span class="news-meta">${meta(a)}</span></a></li>`
    ).join('');
    const more = document.getElementById('news-more');
    more.innerHTML = !all && rest.length > SHOW ? `<button type="button" class="news-more">기사 ${rest.length - SHOW}건 더 보기</button>` : '';
    const b = more.querySelector('button');
    if (b) b.addEventListener('click', () => render(items, true));
  }

  fetch('./news.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); })
    .then((d) => {
      const items = (d.items || []).filter((a) => a && a.title && /^https?:\/\//.test(a.link));
      if (!items.length) throw Error('기사 없음');
      document.getElementById('news-note').remove();
      document.getElementById('news-updated').textContent = d.updatedAt ? '갱신 ' + d.updatedAt : '';
      render(items, false);
    })
    .catch((e) => {
      document.getElementById('news-note').textContent = '뉴스를 불러오지 못했습니다. (' + e.message + ')';
    });
})();
