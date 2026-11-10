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
// 2. Sample_IO 원본 동작 로직 100% 복구
// ==========================================
let globalData = null;
let worker = null;

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const loadBtn = document.getElementById('load-basic');

  // Pyodide Web Worker 연결
  try {
    worker = new Worker('worker.js');
    worker.onmessage = function (e) {
      const { type, status, message, data, error } = e.data;
      if (type === 'status' && statusEl) {
        statusEl.textContent = message;
      } else if (type === 'loaded') {
        statusEl.textContent = "자료 불러오기 완료! 원자료 탐색 및 시뮬레이션을 이용하세요.";
        if (loadBtn) loadBtn.disabled = true;
        globalData = data;
        initAppFeatures(data); // 원자료 탐색 & 시뮬레이터 기능 활성화
      } else if (type === 'error') {
        if (statusEl) statusEl.textContent = "오류 발생: " + error;
        alert("자료 로딩 실패: " + error);
      }
    };
  } catch (err) {
    console.error("Worker 생성 실패:", err);
  }

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      if (statusEl) statusEl.textContent = "Pyodide 로딩 및 data/io-2023.xlsx 읽는 중...";
      if (worker) worker.postMessage({ action: 'load' });
    });
  }
});

// 데이터 로딩 완료 후 탐색창 및 시뮬레이터 UI 생성
function initAppFeatures(data) {
  const sheetSelect = document.getElementById('sheet-select');
  const rowSelect = document.getElementById('row-select');
  const searchInput = document.getElementById('search-input');

  if (!sheetSelect) return;

  // 1. 시트 목록 채우기
  sheetSelect.innerHTML = '<option value="">-- 시트 선택 --</option>';
  Object.keys(data.sheets || {}).forEach(sheetName => {
    const opt = document.createElement('option');
    opt.value = sheetName;
    opt.textContent = sheetName;
    sheetSelect.appendChild(opt);
  });
  sheetSelect.disabled = false;

  // 시트 변경 이벤트
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

  // 행 선택 & 검색 이벤트
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

  // 2. 시뮬레이터 UI 기본 렌더링
  initSimulatorUI(data);
}

// 시뮬레이터 입력 및 계산 UI
function initSimulatorUI(data) {
  const container = document.getElementById('simulation-inputs-container');
  if (!container) return;

  container.innerHTML = `
    <div style="background:white; padding:15px; border-radius:6px; border:1px solid #ddd;">
      <label><b>대상 산업 선택:</b></label>
      <select id="sim-industry-select" style="width:100%; padding:8px; margin:5px 0;">
        ${(data.industries || []).map(ind => `<option value="${ind.code}">[${ind.code}] ${ind.name}</option>`).join('')}
      </select>
      <label><b>수요 증가액 (백만원):</b></label>
      <input type="number" id="sim-amount-input" value="10000" style="width:100%; padding:8px; margin:5px 0; box-sizing:border-box;">
      <button type="button" id="btn-run-sim" class="btn-primary" style="margin-top:10px;">시뮬레이션 계산 실행</button>
    </div>
  `;

  document.getElementById('btn-run-sim').addEventListener('click', () => {
    const code = document.getElementById('sim-industry-select').value;
    const amount = parseFloat(document.getElementById('sim-amount-input').value) || 0;
    
    if (worker) {
      document.getElementById('status').textContent = "시뮬레이션 연산 중...";
      worker.postMessage({
        action: 'simulate',
        inputs: [{ code: code, amount: amount }]
      });
    }
  });
}
