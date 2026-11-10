// ==========================================
// 1. 페이지 전환 제어
// ==========================================
function showPage(pageId) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

// ==========================================
// 2. Pyodide & Worker 통신 처리
// ==========================================
let globalData = null;
let worker = null;

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const loadBtn = document.getElementById('load-basic');

  try {
    worker = new Worker('worker.js');
    
    worker.onmessage = function (e) {
      // Sample_IO 워커 응답 처리
      const data = e.data;

      // error 발생 시
      if (data.error) {
        if (statusEl) statusEl.textContent = "오류 발생: " + data.error;
        console.error("Worker Error:", data.error);
        return;
      }

      // 상태 메시지 수신 시
      if (data.type === 'status' || data.status) {
        if (statusEl) statusEl.textContent = data.message || data.status;
      }

      // 데이터 로딩 완결 시 (Sample_IO는 보통 loaded/ready/data 객체 전달)
      if (data.type === 'loaded' || data.type === 'ready' || data.sheets || data.data) {
        const payload = data.data || data;
        if (payload && payload.sheets) {
          globalData = payload;
          if (statusEl) statusEl.textContent = "자료 불러오기 완료! 원자료 탐색 및 시뮬레이션을 시작하세요.";
          if (loadBtn) loadBtn.disabled = true;
          initAppFeatures(globalData);
        }
      }
    };

    worker.onerror = function (err) {
      console.error("Worker 자체 에러:", err);
      if (statusEl) statusEl.textContent = "워커 스크립트 실행 중 오류가 발생했습니다. (Console 확인 필요)";
    };

  } catch (err) {
    console.error("Worker 생성 실패:", err);
  }

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      if (statusEl) statusEl.textContent = "Pyodide 로딩 및 data/io-2023.xlsx 읽는 중...";
      if (worker) {
        // 원본 Sample_IO 호환 메시지 전송
        worker.postMessage({ action: 'load', type: 'load' });
      }
    });
  }
});

// 탐색 UI 렌더링
function initAppFeatures(data) {
  const sheetSelect = document.getElementById('sheet-select');
  const rowSelect = document.getElementById('row-select');
  const searchInput = document.getElementById('search-input');

  if (!sheetSelect || !data.sheets) return;

  sheetSelect.innerHTML = '<option value="">-- 시트 선택 --</option>';
  Object.keys(data.sheets).forEach(sheetName => {
    const opt = document.createElement('option');
    opt.value = sheetName;
    opt.textContent = sheetName;
    sheetSelect.appendChild(opt);
  });
  sheetSelect.disabled = false;

  sheetSelect.addEventListener('change', (e) => {
    const sheetName = e.target.value;
    rowSelect.innerHTML = '<option value="">-- 행 선택 --</option>';
    if (!sheetName) {
      rowSelect.disabled = true;
      searchInput.disabled = true;
      return;
    }

    const sheetObj = data.sheets[sheetName];
    if (sheetObj && sheetObj.rows) {
      sheetObj.rows.forEach((r, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `[${r.code || idx}] ${r.name}`;
        rowSelect.appendChild(opt);
      });
      rowSelect.disabled = false;
    }
  });

  const renderTable = () => {
    const sheetName = sheetSelect.value;
    const rowIdx = rowSelect.value;
    const query = searchInput.value.toLowerCase();
    const container = document.getElementById('explorer-table-container');

    if (!sheetName || rowIdx === "" || !container) return;

    const rowData = data.sheets[sheetName].rows[rowIdx];
    const columns = data.sheets[sheetName].columns || [];

    let html = `<h3>${rowData.name} (${rowData.code || ''}) 데이터</h3>`;
    html += `<table><thead><tr><th>열 코드</th><th>열 이름</th><th>값</th></tr></thead><tbody>`;

    columns.forEach((col, i) => {
      const val = rowData.values[i];
      const match = col.code.toLowerCase().includes(query) || col.name.toLowerCase().includes(query);
      if (match) {
        html += `<tr><td>${col.code}</td><td>${col.name}</td><td>${Number(val).toLocaleString()}</td></tr>`;
      }
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
  };

  rowSelect.addEventListener('change', () => {
    searchInput.disabled = false;
    renderTable();
  });
  searchInput.addEventListener('input', renderTable);
}
