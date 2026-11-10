// ==========================================
// 1. 페이지 전환 제어 함수
// ==========================================
function showPage(pageId) {
  // 모든 .page-view 구역 숨기기
  const pages = document.querySelectorAll('.page-view');
  pages.forEach(page => {
    page.classList.remove('active');
  });

  // 해당 id의 구역만 활성화
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // 상단 스크롤
  window.scrollTo(0, 0);
}

// ==========================================
// 2. Pyodide / Worker 연동 및 메인 기능 로직 (원본 복구)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const loadBtn = document.getElementById('load-basic');

  // 웹 워커 생성 (model.py 연동)
  let worker;
  try {
    worker = new Worker('worker.js');
  } catch (e) {
    console.error("Worker 생성 실패:", e);
  }

  if (worker) {
    // Worker로부터 응답을 받았을 때의 처리
    worker.onmessage = function (e) {
      const { type, status, message, data, error } = e.data;

      if (type === 'status') {
        if (statusEl) statusEl.textContent = message;
      } else if (type === 'loaded') {
        if (statusEl) statusEl.textContent = "자료 불러오기 완료! 원자료 탐색 및 시뮬레이션을 시작하세요.";
        if (loadBtn) loadBtn.disabled = true;
        
        // 원자료 탐색 및 시뮬레이터 조작창 활성화 로직 실행
        if (typeof onDataLoaded === 'function') {
          onDataLoaded(data);
        }
      } else if (type === 'error') {
        if (statusEl) statusEl.textContent = "오류 발생: " + error;
        alert("자료 로딩 중 오류가 발생했습니다: " + error);
      }
    };
  }

  // "기본부문 불러오기" 버튼 클릭 이벤트
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      if (statusEl) statusEl.textContent = "Pyodide 로딩 및 data/io-2023.xlsx 파일 읽는 중... 잠시만 기다리세요.";
      if (worker) {
        worker.postMessage({ action: 'load' });
      }
    });
  }
});
