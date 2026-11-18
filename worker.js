// worker.js - Pyodide v0.23.4 (numpy, openpyxl) + model.py(initialize / explore / simulate)
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");

let pyodide = null;
let ready = false;

function post(type, extra = {}) {
  self.postMessage({ type, ...extra });
}

// 파이썬 트레이스백 전체 대신 마지막 줄(실제 에러 문장)만 보여준다
function cleanError(err) {
  const text = String((err && err.message) || err || "알 수 없는 오류").trim();
  const lines = text.split("\n").filter(Boolean);
  return lines[lines.length - 1];
}

async function initPyodide() {
  post("status", { message: "Pyodide v0.23.4 엔진 초기화 중..." });
  pyodide = await loadPyodide();

  post("status", { message: "파이썬 패키지(numpy, openpyxl) 로딩 중..." });
  await pyodide.loadPackage(["numpy", "openpyxl"]);

  post("status", { message: "model.py 로딩 중..." });
  const modelRes = await fetch("model.py?v=" + Date.now());
  if (!modelRes.ok) throw new Error("model.py 읽기 실패 (" + modelRes.status + ")");
  await pyodide.runPythonAsync(await modelRes.text());

  post("status", { message: "data/io-2023.xlsx 읽어오는 중..." });
  const dataRes = await fetch("data/io-2023.xlsx?v=" + Date.now());
  if (!dataRes.ok) throw new Error("data/io-2023.xlsx 읽기 실패 (" + dataRes.status + ")");
  const buf = new Uint8Array(await dataRes.arrayBuffer());

  post("status", { message: "380개 부문 계수 검증 중... (잠시 걸립니다)" });
  pyodide.globals.set("raw_xlsx", buf);
  const jsonStr = await pyodide.runPythonAsync("initialize(raw_xlsx.to_py())");
  pyodide.globals.delete("raw_xlsx");

  ready = true;
  return JSON.parse(jsonStr);
}

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "init") {
    try {
      const payload = await initPyodide();
      post("ready", { payload });
    } catch (err) {
      post("error", { where: "init", message: cleanError(err) });
    }
    return;
  }

  if (!ready) {
    post("error", { where: msg.type, message: "자료가 아직 준비되지 않았습니다." });
    return;
  }

  if (msg.type === "explore") {
    try {
      const fn = pyodide.globals.get("explore");
      const jsonStr = fn(msg.sheet, msg.rowcode || "");
      fn.destroy();
      post("exploreResult", { sheet: msg.sheet, payload: JSON.parse(jsonStr) });
    } catch (err) {
      post("error", { where: "explore", message: cleanError(err) });
    }
  } else if (msg.type === "simulate") {
    try {
      const fn = pyodide.globals.get("simulate");
      const jsonStr = fn(JSON.stringify(msg.payload));
      fn.destroy();
      post("simulationResult", { payload: JSON.parse(jsonStr) });
    } catch (err) {
      post("error", { where: "simulate", message: cleanError(err) });
    }
  }
};
