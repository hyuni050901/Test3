// menu.js - 햄버거 버튼으로 메뉴를 열고 닫는다 (기존 JS는 수정하지 않음)
(function () {
  'use strict';
  const nav = document.querySelector('nav');
  const header = document.querySelector('header');
  if (!nav || !header) return;

  // 1) header, main, footer를 하나의 판(#app-shell)으로 감싼다: 메뉴가 열릴 때 이 판이 밀리며 줄어든다
  const shell = document.createElement('div');
  shell.id = 'app-shell';
  document.body.insertBefore(shell, header);
  ['header', 'main', 'footer'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) shell.append(el);
  });

  // 2) 메뉴 버튼과 덮개
  nav.id = 'main-nav';
  const btn = document.createElement('button');
  btn.id = 'menu-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-controls', 'main-nav');
  btn.innerHTML =
    '<svg class="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
    '<svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const cover = document.createElement('div');
  cover.id = 'shell-cover';
  document.body.append(btn, cover);

  const root = document.documentElement;
  function setOpen(open) {
    root.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    nav.setAttribute('aria-hidden', String(!open));
  }
  setOpen(false);

  btn.addEventListener('click', () => setOpen(!root.classList.contains('menu-open')));
  cover.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('menu-open')) { setOpen(false); btn.focus(); }
  });

  // 3) 메뉴에서 페이지를 고르면 메뉴를 닫고, 본문은 맨 위로 되돌린다
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-page]');
    if (!link) return;
    if (nav.contains(link)) setOpen(false);
    setTimeout(() => { shell.scrollTop = 0; }, 0);   // nav.js의 window.scrollTo는 이 구조에서 듣지 않으므로 직접 처리
  });
})();
