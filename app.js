// ==========================================
// 1. 페이지 전환 제어 (CSS .active 기반)
// ==========================================
function showPage(pageId) {
  document.querySelectorAll(".page-view").forEach((p) => p.classList.remove("active"));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add("active");
  window.scrollTo(0, 0);

  // 기능 페이지로 들어가면 자료를 자동으로 불러온다 (이미 불러왔으면 무시)
  if (pageId === "explorer" || pageId === "simulator") startLoading();
}

// ==========================================
// 2. 공통 상태 / 유틸
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
let modelData = null;    // initialize() 결과: { sectors, sheets, residuals }
let exploreData = null;  // explore() 결과: { rows, selected, name, unit, cells }
let lastSimResult = null;
let activeRows = [];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmt(n, digits = 0) {
  return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "";
}

function notice(message) {
  return `<p style="padding:15px; background:#f7fafc; border:1px dashed #cbd5e0; border-radius:6px;">${esc(message)}</p>`;
}

// ==========================================
// 3. 워커 연결 / 자료 로딩
// ==========================================
function initWorker() {
  worker = new Worker("worker.js?v=" + Date.now());

  worker.onmessage = (e) => {
    const msg = e.data;

    if (msg.type === "status") {
      setStatus(msg.message);

    } else if (msg.type === "ready") {
      modelData = msg.payload;
      try {
        const maxRes = Math.max(...Object.values(modelData.residuals || { x: 0 }));
        setStatus(`자료 준비 완료 · 380개 부문 · 계수 검증 통과 (최대 잔차 ${maxRes.toExponential(2)})`);
        if (loadBasicBtn) loadBasicBtn.disabled = true;
        enableExplorer();
        enableSimulation();
      } catch (err) {
        console.error(err, modelData);
        setStatus("데이터 구조 오류: " + err.message, true);
      }

    } else if (msg.type === "exploreResult") {
      // 사용자가 그 사이 다른 시트를 골랐다면 이전 응답은 무시
      if (msg.sheet !== sheetSelect.value) return;
      exploreData = msg.payload;
      populateRowSelect();
      renderExplorerTable();

    } else if (msg.type === "simulationResult") {
      try {
        renderSimulationResult(msg.payload);
      } catch (err) {
        console.error(err, msg.payload);
        setStatus("결과 표시 오류: " + err.message, true);
      }

    } else if (msg.type === "error") {
      if (msg.where === "init") {
        handleLoadError(msg.message);
      } else if (msg.where === "explore") {
        setStatus(msg.message, true);
        if (explorerResult) explorerResult.innerHTML = notice("원자료를 읽는 중 오류: " + msg.message);
      } else {
        setStatus(msg.message, true);
        alert(msg.message);
      }
    }
  };

  worker.onerror = (e) => {
    handleLoadError("워커 실행 오류: " + (e.message || "알 수 없는 오류"));
  };
}

// 로딩 실패 시 워커를 정리하고 다시 시도할 수 있게 한다
function handleLoadError(message) {
  setStatus("불러오기 실패: " + message, true);
  if (worker) {
    worker.terminate();
    worker = null;
  }
  modelData = null;
  if (loadBasicBtn) loadBasicBtn.disabled = false;
  if (simulationInputs) {
    simulationInputs.innerHTML = notice(
      "자료 불러오기에 실패했습니다. 원자료 탐색 화면의 '기본부문 불러오기' 버튼으로 다시 시도하세요. (" + message + ")"
    );
  }
}

function startLoading() {
  if (modelData || worker) return; // 이미 불러왔거나 로딩 중
  initWorker();
  if (loadBasicBtn) loadBasicBtn.disabled = true;
  setStatus("Pyodide 및 엑셀 로딩 시작... (처음에는 수십 초 걸릴 수 있어요)");
  if (simulationInputs) simulationInputs.innerHTML = notice("자료를 불러오는 중입니다. 잠시만 기다려 주세요...");
  worker.postMessage({ type: "init" });
}

if (loadBasicBtn) loadBasicBtn.addEventListener("click", startLoading);

// ==========================================
// 4. 원자료 탐색
// ==========================================
function enableExplorer() {
  if (!sheetSelect) return;
  sheetSelect.disabled = false;
  sheetSelect.innerHTML = '<option value="">-- 시트를 선택하세요 --</option>';
  modelData.sheets.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sheetSelect.appendChild(opt);
  });
}

function requestExplore(sheet, rowcode) {
  if (!worker || !sheet) return;
  if (explorerResult) explorerResult.innerHTML = notice("원자료를 불러오는 중...");
  worker.postMessage({ type: "explore", sheet, rowcode: rowcode || "" });
}

function populateRowSelect() {
  rowSelect.innerHTML = "";
  exploreData.rows.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.code;
    opt.textContent = `[${r.code}] ${r.name}`;
    rowSelect.appendChild(opt);
  });
  rowSelect.value = exploreData.selected;
  rowSelect.disabled = false;
  searchInput.disabled = false;
}

if (sheetSelect) {
  sheetSelect.addEventListener("change", () => {
    exploreData = null;
    if (sheetSelect.value === "") {
      rowSelect.innerHTML = '<option value="">시트를 먼저 선택하세요</option>';
      rowSelect.disabled = true;
      searchInput.disabled = true;
      if (explorerResult) explorerResult.innerHTML = "";
      return;
    }
    requestExplore(sheetSelect.value, ""); // 첫 번째 행을 기본 선택
  });
}

if (rowSelect) {
  rowSelect.addEventListener("change", () => {
    requestExplore(sheetSelect.value, rowSelect.value);
  });
}

if (searchInput) searchInput.addEventListener("input", renderExplorerTable);

function renderExplorerTable() {
  if (!exploreData || !explorerResult) return;
  const query = searchInput.value.trim().toLowerCase();

  const cells = exploreData.cells.filter(
    (c) => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
  );

  let html = `<p style="margin-top:15px;"><strong>${esc(sheetSelect.value)}</strong> - [${esc(exploreData.selected)}] ${esc(exploreData.name)}</p>`;
  html += `<p style="font-size:0.85em; color:#666;">${esc(exploreData.unit)} · 열 ${cells.length}개 표시</p>`;
  html += `<table><thead><tr><th>열 코드</th><th>열 이름</th><th>값</th></tr></thead><tbody>`;
  cells.forEach((c) => {
    const v = typeof c.value === "number" ? fmt(c.value, 6) : (c.value ?? "-");
    html += `<tr><td>${esc(c.code)}</td><td>${esc(c.name)}</td><td>${esc(v)}</td></tr>`;
  });
  html += `</tbody></table>`;
  explorerResult.innerHTML = html;
}

// ==========================================
// 5. 수요충격 시뮬레이터
// ==========================================
function enableSimulation() {
  activeRows = [];
  renderSimulationInputs();
}

function sectorOptionsHtml(filter = "") {
  const q = filter.trim().toLowerCase();
  return modelData.sectors
    .filter((s) => !q || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .map((s) => `<option value="${esc(s.code)}">[${esc(s.code)}] ${esc(s.name)}</option>`)
    .join("");
}

function renderSimulationInputs() {
  if (!simulationInputs || !modelData) return;

  let html = `<div class="sim-row" style="background:white; padding:15px; border-radius:6px; border:1px solid #ddd;">
    <label><b>산업 검색: </b></label>
    <input type="text" id="sim-filter" placeholder="코드 또는 산업명" style="width:100%; padding:8px; margin:5px 0; box-sizing:border-box;">
    <label><b>부문 선택: </b></label>
    <select id="sim-code-select" style="width:100%; padding:8px; margin:5px 0;">
      <option value="">-- 부문 선택 --</option>
      ${sectorOptionsHtml()}
    </select>
    <label><b>증가액 (백만원): </b></label>
    <input type="number" id="sim-amount-input" placeholder="증가액 (백만원)" min="0" style="width:100%; padding:8px; margin:5px 0; box-sizing:border-box;">
    <p style="font-size:0.85em; color:#666; margin:0;">1,000백만원 = 10억원 · 양의 수요 증가만 지원합니다.</p>
    <button id="add-sim-btn" type="button" class="btn-primary" style="margin-top:10px;">시나리오 추가</button>
  </div>`;

  if (activeRows.length > 0) {
    html += `<ul style="margin-top:15px;">`;
    activeRows.forEach((item, idx) => {
      html += `<li>[${esc(item.code)}] ${esc(item.name)}: ${fmt(item.amount)} 백만원
        <button onclick="removeSimItem(${idx})" type="button" class="btn-secondary" style="padding:2px 6px; font-size:0.8em;">삭제</button></li>`;
    });
    html += `</ul>`;
    html += `<button id="run-sim-btn" type="button" class="btn-primary" style="margin-top:15px; background-color:#2b6cb0;">파급효과 계산</button>
             <button id="clear-sim-btn" type="button" class="btn-secondary" style="margin-top:15px;">시나리오 비우기</button>`;
  }

  simulationInputs.innerHTML = html;

  document.getElementById("sim-filter").addEventListener("input", (e) => {
    document.getElementById("sim-code-select").innerHTML =
      '<option value="">-- 부문 선택 --</option>' + sectorOptionsHtml(e.target.value);
  });

  document.getElementById("add-sim-btn").addEventListener("click", () => {
    const code = document.getElementById("sim-code-select").value;
    const amount = parseFloat(document.getElementById("sim-amount-input").value);
    if (!code || isNaN(amount) || amount <= 0) {
      alert("올바른 부문과 양의 금액을 입력하세요.");
      return;
    }
    const sector = modelData.sectors.find((s) => s.code === code);
    activeRows.push({ code: sector.code, name: sector.name, amount });
    renderSimulationInputs();
  });

  document.getElementById("run-sim-btn")?.addEventListener("click", () => {
    if (activeRows.length === 0 || !worker) return;
    setStatus("시뮬레이션 연산 중...");
    // model.py의 simulate()는 [{code, amount}, ...] 형태를 받는다
    worker.postMessage({
      type: "simulate",
      payload: activeRows.map(({ code, amount }) => ({ code, amount }))
    });
  });

  document.getElementById("clear-sim-btn")?.addEventListener("click", () => {
    activeRows = [];
    renderSimulationInputs();
  });
}

function removeSimItem(idx) {
  activeRows.splice(idx, 1);
  renderSimulationInputs();
}

function renderSimulationResult(res) {
  setStatus("시뮬레이션 완료");
  lastSimResult = res;

  if (simulationSummary) {
    simulationSummary.innerHTML = `<h3 style="margin-top:20px;">요약 결과</h3>
    <table>
      <tr><th>항목</th><th>금액 (백만원)</th></tr>
      <tr><td>최종수요 증가액</td><td>${fmt(res.demand)}</td></tr>
      <tr><td>총 생산유발액</td><td>${fmt(res.production)}</td></tr>
      <tr><td>총 수입유발액</td><td>${fmt(res.imports)}</td></tr>
      <tr><td>총 부가가치유발액</td><td>${fmt(res.valueAdded)}</td></tr>
      <tr><td>생산유발 승수</td><td>${res.multiplier.toFixed(4)}</td></tr>
    </table>`;
  }

  if (simulationTop15) {
    let html = `<h3 style="margin-top:20px;">생산유발액 상위 15개 산업</h3>
    <table><thead><tr><th>순위</th><th>코드</th><th>산업명</th><th>생산</th><th>수입</th><th>부가가치</th></tr></thead><tbody>`;
    res.rows.slice(0, 15).forEach((r, i) => {
      html += `<tr><td>${i + 1}</td><td>${esc(r.code)}</td><td>${esc(r.name)}</td>
        <td>${fmt(r.production)}</td><td>${fmt(r.imports)}</td><td>${fmt(r.valueAdded)}</td></tr>`;
    });
    html += `</tbody></table>
      <button id="download-csv-btn" type="button" class="btn-secondary" style="margin-top:10px;">전체 380개 산업 CSV 다운로드</button>`;
    simulationTop15.innerHTML = html;
    document.getElementById("download-csv-btn").addEventListener("click", downloadCsv);
  }
}

function downloadCsv() {
  if (!lastSimResult) return;
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = ["코드,산업,생산유발액,수입유발액,부가가치유발액"];
  lastSimResult.rows.forEach((r) => {
    lines.push([q(r.code), q(r.name), r.production, r.imports, r.valueAdded].join(","));
  });
  // 엑셀에서 한글이 깨지지 않도록 BOM 추가
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "simulation-result.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// 처음부터 시뮬레이터 영역을 비워 두지 않는다
if (simulationInputs) {
  simulationInputs.innerHTML = notice("메인 화면에서 시뮬레이터로 이동하면 자료를 자동으로 불러옵니다.");
}
