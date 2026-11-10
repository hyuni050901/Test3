// worker.js - Pyodide 파이썬 백그라운드 처리 워커
importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodide = null;
let modelPy = null;

async function initPyodide() {
  try {
    self.postMessage({ type: 'status', message: 'Pyodide 엔진을 초기화하는 중입니다...' });
    pyodide = await loadPyodide();
    
    self.postMessage({ type: 'status', message: '엑셀 전처리 패키지(openpyxl)를 설치 중입니다...' });
    await pyodide.loadPackage("openpyxl");

    self.postMessage({ type: 'status', message: '파이썬 분석 모델(model.py)을 로딩 중입니다...' });
    const response = await fetch('model.py');
    if (!response.ok) throw new Error("model.py 파일을 찾을 수 없습니다.");
    modelPy = await response.text();

    self.postMessage({ type: 'status', message: '엑셀 데이터(data/io-2023.xlsx)를 읽어오는 중입니다...' });
    const excelRes = await fetch('data/io-2023.xlsx');
    if (!excelRes.ok) throw new Error("data/io-2023.xlsx 파일을 찾을 수 없습니다. 경로를 확인하세요.");
    
    const arrayBuffer = await excelRes.arrayBuffer();
    const dataArray = new Uint8Array(arrayBuffer);
    
    // 파이썬 가상 파일시스템에 엑셀 파일 저장
    pyodide.FS.writeFile('io-2023.xlsx', dataArray);

    self.postMessage({ type: 'status', message: '파이썬 계산 엔진 실행 중...' });
    await pyodide.runPythonAsync(modelPy);

    // 파이썬의 initialize_data() 실행 결과를 JSON으로 변환
    const resultJson = await pyodide.runPythonAsync("import json; json.dumps(initialize_data())");
    const parsedData = JSON.parse(resultJson);

    self.postMessage({ type: 'loaded', data: parsedData });
  } catch (err) {
    console.error(err);
    self.postMessage({ type: 'error', error: err.message });
  }
}

self.onmessage = async function (e) {
  const { action, inputs } = e.data;
  if (action === 'load') {
    await initPyodide();
  } else if (action === 'simulate' && pyodide) {
    try {
      const inputsJson = JSON.stringify(inputs);
      const resJson = await pyodide.runPythonAsync(`import json; json.dumps(run_simulation(${inputsJson}))`);
      self.postMessage({ type: 'simulationResult', data: JSON.parse(resJson) });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
};
