// nav.js - 페이지 전환 전용 (샘플 app.js / worker.js / model.py는 수정하지 않음)
(function () {
  function showPage(name) {
    document.querySelectorAll(".page-view").forEach(function (p) {
      p.classList.remove("active");
    });
    var target = document.getElementById("page-" + name);
    if (target) target.classList.add("active");
    window.scrollTo(0, 0);

    // 기능 페이지로 들어가면, 아직 자료가 없을 때 샘플의 "기본부문 불러오기" 버튼을 자동으로 누른다.
    // (버튼이 disabled면 이미 로딩 중이거나 로딩 완료 상태이므로 건드리지 않는다)
    if (name === "explorer" || name === "simulation") {
      var loadBtn = document.getElementById("load-basic");
      if (loadBtn && !loadBtn.disabled) loadBtn.click();
    }
  }

  window.showPage = showPage;

  // data-page 속성이 있는 링크/버튼 클릭을 한 곳에서 처리
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-page]");
    if (!el) return;
    e.preventDefault();
    showPage(el.getAttribute("data-page"));
  });
})();
