// Sample_IO 원본 worker.js 규격
importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodide = null;

async function initPyodide() {
  try {
    self.postMessage({ type: "status", message: "Pyodide 환경 초기화 중..." });
    pyodide = await loadPyodide();

    self.postMessage({ type: "status", message: "openpyxl 라이브러리 로딩 중..." });
    await pyodide.loadPackage("openpyxl");

    self.postMessage({ type: "status", message: "model.py 읽는 중..." });
    const modelCode = await (await fetch("model.py")).text();
    await pyodide.runPythonAsync(modelCode);

    self.postMessage({ type: "status", message: "data/io-2023.xlsx 분석 중..." });
    const response = await fetch("data/io-2023.xlsx");
    if (!response.ok) throw new Error("data/io-2023.xlsx 읽기 실패");
    const arrayBuffer = await response.arrayBuffer();
    pyodide.FS.writeFile("data/io-2023.xlsx", new Uint8Array(arrayBuffer));

    self.postMessage({ type: "status", message: "기본 부문 데이터 구조 생성 중..." });
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
