// worker.js - openpyxl 호환성 패치 버전
importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodide = null;

async function initPyodide() {
  try {
    self.postMessage({ type: "status", message: "Pyodide 환경 초기화 중..." });
    pyodide = await loadPyodide();

    self.postMessage({ type: "status", message: "micropip 및 openpyxl 패키지 설치 중..." });
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install("openpyxl");

    self.postMessage({ type: "status", message: "model.py 읽는 중..." });
    const modelCode = await (await fetch("model.py")).text();
    await pyodide.runPythonAsync(modelCode);

    self.postMessage({ type: "status", message: "data/io-2023.xlsx 읽어오는 중..." });
    const response = await fetch("data/io-2023.xlsx");
    if (!response.ok) throw new Error("data/io-2023.xlsx 파일을 찾을 수 없습니다.");
    const arrayBuffer = await response.arrayBuffer();
    
    // Pyodide 가상 파일시스템에 data 폴더 생성 및 엑셀 저장
    try { pyodide.FS.mkdir("data"); } catch(e) {}
    pyodide.FS.writeFile("data/io-2023.xlsx", new Uint8Array(arrayBuffer));

    self.postMessage({ type: "status", message: "기본 부문 데이터 계산 중..." });
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
