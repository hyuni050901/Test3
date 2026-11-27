// layout.js - 왼쪽 메뉴에서 현재 보고 있는 페이지를 강조한다 (기존 JS는 수정하지 않음)
(function () {
  'use strict';
  const nav = document.querySelector('nav');
  const main = document.querySelector('main');
  if (!nav || !main) return;

  function sync() {
    const active = main.querySelector('.page-view.active');
    if (!active) return;
    const name = active.id.replace('page-', '');
    nav.querySelectorAll('a[data-page]').forEach((a) => {
      const on = a.getAttribute('data-page') === name;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // 페이지가 바뀌거나(클래스 변경), 새 페이지·새 메뉴가 추가될 때마다 다시 맞춘다
  new MutationObserver(sync).observe(main, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  new MutationObserver(sync).observe(nav, { childList: true });
  sync();
})();
