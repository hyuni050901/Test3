// app.js - UI 제어 및 Worker 통신
function showPage(pageId) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

let globalData = null;
let worker = null;

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const loadBtn = document.getElementById('load-basic');

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      if (statusEl) statusEl.textContent = "파이썬 엔진(Pyodide) 및 엑셀 로딩을 시작합니다...";
      
      if (!worker) {
        worker = new Worker('worker.js');
        
        worker.onmessage = function (e) {
          const { type, message, data, error } = e.data;

          if (type === 'status' && statusEl) {
            statusEl.textContent = message;
          } else if (type === 'loaded') {
            if (statusEl) statusEl.textContent = "✅ 자료 불러오기 완료! 원자료 탐색 및 시뮬레이션을 이용하세요.";
            loadBtn.disabled = true;
            globalData = data;
            initAppFeatures(globalData);
          } else if (type === 'error') {
            if (statusEl) statusEl.textContent = "❌ 로딩 실패: " + error;
            alert("자료 로딩 중 오류가 발생했습니다: " + error);
          }
        };

        worker.onerror = function (err) {
          if (statusEl) statusEl.textContent = "❌ worker.js 스크립트 실행 오류 발생";
        };
      }

      worker.postMessage({ action: 'load' });
    });
  }
});

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

    let html = `<h3 style="margin-top:15px;">${rowData.name} (${rowData.code || ''}) 데이터</h3>`;
    html += `<table><thead><tr><th>열 코드</th><th>열 이름</th><th>값 (백만원)</th></tr></thead><tbody>`;

    columns.forEach((col, i) => {
      const val = rowData.values[i];
      const match = (col.code && col.code.toLowerCase().includes(query)) || 
                    (col.name && col.name.toLowerCase().includes(query));
      if (match) {
        html += `<tr><td>${col.code || ''}</td><td>${col.name || ''}</td><td>${Number(val).toLocaleString()}</td></tr>`;
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
