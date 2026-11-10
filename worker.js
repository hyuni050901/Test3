// worker.js - openpyxl/numpy 지원 버전(v0.23.4) 고정
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");

let pyodide = null;

async function initPyodide() {
  try {
    self.postMessage({ type: "status", message: "Pyodide v0.23.4 엔진 초기화 중..." });
    pyodide = await loadPyodide();

    self.postMessage({ type: "status", message: "파이썬 패키지(numpy, openpyxl) 로딩 중..." });
    // v0.23.4 버전에서는 두 패키지가 정상적으로 불러와집니다.
    await pyodide.loadPackage(["numpy", "openpyxl"]);

    self.postMessage({ type: "status", message: "model.py 로딩 중..." });
    const modelCode = await (await fetch("model.py?v=" + Date.now())).text();
    await pyodide.runPythonAsync(modelCode);

    self.postMessage({ type: "status", message: "data/io-2023.xlsx 읽어오는 중..." });
    const response = await fetch("data/io-2023.xlsx?v=" + Date.now());
    if (!response.ok) throw new Error("data/io-2023.xlsx 읽기 실패");
    const arrayBuffer = await response.arrayBuffer();

    try { pyodide.FS.mkdir("data"); } catch(e) {}
    pyodide.FS.writeFile("data/io-2023.xlsx", new Uint8Array(arrayBuffer));

    self.postMessage({ type: "status", message: "기본 부문 데이터 구조 계산 중..." });
    const jsonStr = await pyodide.runPythonAsync("load_and_prepare_data()");
    const payload = JSON.parse(jsonStr);

    self.postMessage({ type: "ready", payload: payload });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === "init") {
    await initPyodide();
  } else if (msg.type === "simulate") {
    try {
      const shockJson = JSON.stringify(msg.payload);
      const resJson = await pyodide.runPythonAsync(`run_simulation('${shockJson}')`);
      self.postMessage({ type: "simulationResult", payload: JSON.parse(resJson) });
    } catch (err) {
      self.postMessage({ type: "error", message: err.message });
    }
  }
};
