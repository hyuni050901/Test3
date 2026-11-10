// ==========================================
// 1. 페이지 전환 (CSS 기반 display 제어)
// ==========================================
function showPage(pageId) {
  const pages = document.querySelectorAll('.page-view');
  pages.forEach(p => p.classList.remove('active'));
  
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.add('active');
  }
  window.scrollTo(0, 0);
}

// ==========================================
// 2. Sample_IO 교수님 원본 app.js 통신 복구
// ==========================================
const statusEl = document.getElementById("status");
const loadBasicBtn = document.getElementById("load-basic");
const sheetSelect = document.getElementById("sheet-select");
const rowSelect = document.getElementById("row-select");
const searchInput = document.getElementById("search-input");
const explorerResult = document.getElementById("explorer-result");
const simulationInputs = document.getElementById("simulation-inputs");
const simulationSummary = document.getElementById("simulation-summary");
const simulationTop15 = document.getElementById("simulation-top15");

let worker = null;
let modelData = null;
let activeRows = [];

function setStatus(message, isError = false) {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#b91c1c" : "";
  }
}

function initWorker() {
  worker = new Worker("worker.js");
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === "status") {
      setStatus(msg.message);
    } else if (msg.type === "ready") {
      modelData = msg.payload;
      setStatus("자료 준비 완료: " + (modelData.metadata ? modelData.metadata.basic_title : "2023년 기본부문"));
      if (loadBasicBtn) loadBasicBtn.disabled = true;
      enableExplorer();
      enableSimulation();
    } else if (msg.type === "simulationResult") {
      renderSimulationResult(msg.payload);
    } else if (msg.type === "error") {
      setStatus(msg.message, true);
    }
  };
}

if (loadBasicBtn) {
  loadBasicBtn.addEventListener("click", () => {
    if (!worker) {
      initWorker();
    }
    loadBasicBtn.disabled = true;
    setStatus("Pyodide 및 엑셀 로딩 시작...");
    worker.postMessage({ type: "init" });
  });
}

function enableExplorer() {
  if (!sheetSelect) return;
  sheetSelect.disabled = false;
  sheetSelect.innerHTML = '<option value="">-- 시트를 선택하세요 --</option>';
  modelData.sheets.forEach((sheet, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${sheet.name} (${sheet.rows_count}x${sheet.cols_count})`;
    sheetSelect.appendChild(opt);
  });
}

if (sheetSelect) {
  sheetSelect.addEventListener("change", () => {
    const sheetIdx = sheetSelect.value;
    rowSelect.innerHTML = '<option value="">-- 행을 선택하세요 --</option>';
    explorerResult.innerHTML = "";
    if (sheetIdx === "") {
      rowSelect.disabled = true;
      searchInput.disabled = true;
      return;
    }
    const sheet = modelData.sheets[sheetIdx];
    rowSelect.disabled = false;
    sheet.rows.forEach((row, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `[${row.code}] ${row.name}`;
      rowSelect.appendChild(opt);
    });
  });
}

if (rowSelect) {
  rowSelect.addEventListener("change", () => {
    if (rowSelect.value === "") {
      searchInput.disabled = true;
      explorerResult.innerHTML = "";
      return;
    }
    searchInput.disabled = false;
    renderExplorerTable();
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    renderExplorerTable();
  });
}

function renderExplorerTable() {
  const sheetIdx = sheetSelect.value;
  const rowIdx = rowSelect.value;
  if (sheetIdx === "" || rowIdx === "") return;

  const sheet = modelData.sheets[sheetIdx];
  const row = sheet.rows[rowIdx];
  const query = searchInput.value.trim().toLowerCase();

  let html = `<p style="margin-top:15px;"><strong>${sheet.name}</strong> - [${row.code}] ${row.name}</p>`;
  html += `<table><thead><tr><th>열 코드</th><th>열 이름</th><th>값</th></tr></thead><tbody>`;

  sheet.columns.forEach((col, idx) => {
    const val = row.values[idx];
    const match = col.code.toLowerCase().includes(query) || col.name.toLowerCase().includes(query);
    if (match) {
      const formattedVal = typeof val === "number" ? val.toLocaleString() : val;
      html += `<tr><td>${col.code}</td><td>${col.name}</td><td>${formattedVal}</td></tr>`;
    }
  });

  html += `</tbody></table>`;
  explorerResult.innerHTML = html;
}

function enableSimulation() {
  activeRows = [];
  renderSimulationInputs();
}

function renderSimulationInputs() {
  if (!simulationInputs) return;
  let html = `<div class="sim-row" style="background:white; padding:15px; border-radius:6px; border:1px solid #ddd;">
    <label><b>부문 선택: </b></label>
    <select id="sim-code-select" style="width:100%; padding:8px; margin:5px 0;">
      <option value="">-- 부문 선택 --</option>
      ${modelData.basic_sectors.map(s => `<option value="${s.code}">[${s.code}] ${s.name}</option>`).join("")}
    </select>
    <label><b>증가액 (백만원): </b></label>
    <input type="number" id="sim-amount-input" placeholder="증가액 (백만원)" min="0" style="width:100%; padding:8px; margin:5px 0; box-sizing:border-box;">
    <button id="add-sim-btn" type="button" class="btn-primary" style="margin-top:10px;">시나리오 추가</button>
  </div>`;

  if (activeRows.length > 0) {
    html += `<ul style="margin-top:15px;">`;
    activeRows.forEach((item, idx) => {
      html += `<li>[${item.code}] ${item.name}: ${item.amount.toLocaleString()} 백만원 
        <button onclick="removeSimItem(${idx})" type="button" class="btn-secondary" style="padding:2px 6px; font-size:0.8em;">삭제</button></li>`;
    });
    html += `</ul>`;
    html += `<button id="run-sim-btn" type="button" class="btn-primary" style="margin-top:15px; background-color:#2b6cb0;">시뮬레이션 실행</button>`;
  }

  simulationInputs.innerHTML = html;

  document.getElementById("add-sim-btn")?.addEventListener("click", () => {
    const code = document.getElementById("sim-code-select").value;
    const amount = parseFloat(document.getElementById("sim-amount-input").value);
    if (!code || isNaN(amount) || amount <= 0) {
      alert("올바른 부문과 양의 금액을 입력하세요.");
      return;
    }
    const sector = modelData.basic_sectors.find(s => s.code === code);
    activeRows.push({ code: sector.code, name: sector.name, amount: amount });
    renderSimulationInputs();
  });

  document.getElementById("run-sim-btn")?.addEventListener("click", () => {
    if (activeRows.length === 0) return;
    setStatus("시뮬레이션 연산 중...");
    const shockDict = {};
    activeRows.forEach(item => {
      shockDict[item.code] = (shockDict[item.code] || 0) + item.amount;
    });
    worker.postMessage({ type: "simulate", payload: shockDict });
  });
}

function removeSimItem(idx) {
  activeRows.splice(idx, 1);
  renderSimulationInputs();
}

function renderSimulationResult(res) {
  setStatus("시뮬레이션 완료");
  
  if (simulationSummary) {
    let summaryHtml = `<h3 style="margin-top:20px;">요약 결과</h3>
    <table>
      <tr><th>항목</th><th>금액 (백만원)</th></tr>
      <tr><td>총 생산유발액</td><td>${res.summary.total_production.toLocaleString()}</td></tr>
      <tr><td>총 부가가치유발액</td><td>${res.summary.total_value_added.toLocaleString()}</td></tr>
      <tr><td>총 수입유발액</td><td>${res.summary.total_import.toLocaleString()}</td></tr>
    </table>`;
    simulationSummary.innerHTML = summaryHtml;
  }

  if (simulationTop15) {
    let top15Html = `<h3 style="margin-top:20px;">생산유발액 상위 15개 산업</h3>
    <table><thead><tr><th>순위</th><th>코드</th><th>산업명</th><th>생산유발액</th></tr></thead><tbody>`;
    res.top15.forEach((item, idx) => {
      top15Html += `<tr><td>${idx + 1}</td><td>${item.code}</td><td>${item.name}</td><td>${item.production.toLocaleString()}</td></tr>`;
    });
    top15Html += `</tbody></table>`;
    simulationTop15.innerHTML = top15Html;
  }
}
