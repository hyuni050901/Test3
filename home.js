// home.js - 홈 화면에서 기능 카드를 빼고, 이용 안내 페이지의 내용을 홈 화면에 보여준다
// (이용 안내 페이지의 글을 복사해 오므로, index.html의 이용 안내를 고치면 홈에도 자동 반영됩니다)
(function () {
  'use strict';
  const home = document.getElementById('page-main');
  const guide = document.getElementById('page-guide');
  if (!home || !guide) return;

  // 1) 홈의 기능 선택 카드와 안내 문구 제거 (불러오기 버튼은 그대로 둔다)
  const cards = home.querySelector('.menu-cards');
  if (cards) cards.remove();
  const intro = home.querySelector('h2');
  if (intro) intro.remove();
  home.querySelectorAll(':scope > p:not(.load-bar)').forEach((p) => p.remove());

  // 2) 이용 안내 내용 복사 (돌아가기 막대는 제외)
  const wrap = document.createElement('div');
  wrap.className = 'home-guide';
  let card = null;
  Array.from(guide.children).forEach((el) => {
    if (el.classList.contains('back-bar')) return;
    const node = el.cloneNode(true);
    if (node.tagName === 'H2') { wrap.append(node); return; }
    if (node.tagName === 'H3') {   // 소제목마다 카드 하나로 묶는다
      card = document.createElement('section');
      card.className = 'guide-card';
      wrap.append(card);
    }
    (card || wrap).append(node);
  });
  home.append(wrap);

  // 3) 스타일
  const style = document.createElement('style');
  style.textContent =
    '.home-guide{margin-top:20px}' +
    '.home-guide > h2{margin:0 0 14px}' +
    '.guide-card{margin:0 0 18px;padding:22px 26px}' +
    '.guide-card > h3{margin-top:0}' +
    '.guide-card ol,.guide-card ul{padding-left:1.3em}' +
    '.guide-card li{margin:6px 0}';
  document.head.append(style);
})();
