const BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
let py;
let chain = Promise.resolve();
let linkageReady = false;
let structureReady = false;

// [추가] 영향력계수·감응도계수 계산용 파이썬 코드 (model.py의 전역 변수 codes, names, L 사용)
const LINKAGE_PY = `
def linkages():
    n = len(codes)
    col = L.sum(axis=0)
    row = L.sum(axis=1)
    avg = float(L.sum()) / n
    rows = []
    for i in range(n):
        rows.append({'code': codes[i], 'name': names[i],
                     'influence': float(col[i]) / avg, 'sensitivity': float(row[i]) / avg,
                     'colSum': float(col[i]), 'rowSum': float(row[i])})
    return emit({'average': avg, 'rows': rows})
`;

// [추가] 수입·부가가치 지도용 파이썬 코드 (model.py의 전역 변수 codes, names, L, M, V 사용)
// 열합계 = 해당 산업의 최종수요 1단위당 유발효과
const STRUCTURE_PY = `
def structure():
    prod = L.sum(axis=0)
    imp = M.sum(axis=0)
    va = V.sum(axis=0)
    rows = []
    for i in range(len(codes)):
        rows.append({'code': codes[i], 'name': names[i],
                     'production': float(prod[i]), 'imports': float(imp[i]), 'valueAdded': float(va[i])})
    return emit({'avgProduction': float(prod.mean()), 'avgImports': float(imp.mean()),
                 'avgValueAdded': float(va.mean()), 'rows': rows})
`;

async function handle({id,type,payload}) {
  try {
    let result;
    if(type==='init') {
      postMessage({type:'status',text:'Python 실행 환경 준비 중…'});
      importScripts(BASE+'pyodide.js');
      py=await loadPyodide({indexURL:BASE});
      await py.loadPackage(['numpy','micropip']);
      await py.runPythonAsync("import micropip\nawait micropip.install('openpyxl==3.1.5')");
      const response=await fetch('./model.py');
      if(!response.ok) throw Error('model.py를 불러올 수 없습니다.');
      await py.runPythonAsync(await response.text());
      postMessage({type:'status',text:'Excel 읽기와 계수 검증 중…'});
      py.globals.set('raw_input',new Uint8Array(payload));
      await py.runPythonAsync('raw_bytes = raw_input.to_py()');
      result=await py.runPythonAsync('initialize(raw_bytes)');
      await py.runPythonAsync('del raw_input, raw_bytes');
    } else if(type==='explore') {
      py.globals.set('sheet_input',payload.sheet);
      py.globals.set('row_input',payload.row||'');
      result=py.runPython('explore(sheet_input, row_input)');
    } else if(type==='linkage') {
      if(!linkageReady) { await py.runPythonAsync(LINKAGE_PY); linkageReady=true; }
      result=py.runPython('linkages()');
    } else if(type==='structure') {
      if(!structureReady) { await py.runPythonAsync(STRUCTURE_PY); structureReady=true; }
      result=py.runPython('structure()');
    } else {
      py.globals.set('scenario_input',JSON.stringify(payload));
      result=py.runPython('simulate(scenario_input)');
    }
    postMessage({id,ok:true,result:JSON.parse(result)});
  } catch(error) { postMessage({id,ok:false,error:String(error)}); }
}
onmessage=e=>{ chain=chain.then(()=>handle(e.data)); };
