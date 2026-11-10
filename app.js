// Chart.js를 활용한 영향력/감응도 4분면 맵 생성
function renderScatterChart(labels, powerData, sensitivityData) {
    const ctx = document.getElementById('linkageChart').getContext('2d');
    
    const chartData = labels.map((label, index) => ({
        x: powerData[index],         // 영향력계수 (X축)
        y: sensitivityData[index],   // 감응도계수 (Y축)
        label: label
    }));

    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '산업별 위치',
                data: chartData,
                backgroundColor: 'rgba(54, 162, 235, 0.6)'
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: '영향력계수 (후방연쇄효과)' }, min: 0 },
                y: { title: { display: true, text: '감응도계수 (전방연쇄효과)' }, min: 0 }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return `${ctx.raw.label}: (영향력 ${ctx.raw.x.toFixed(2)}, 감응도 ${ctx.raw.y.toFixed(2)})`;
                        }
                    }
                }
            }
        }
    });
}

// 시나리오 핫키 버튼 이벤트 연동
document.querySelectorAll('.btn-scenario').forEach(button => {
    button.addEventListener('click', (e) => {
        const targetIndustry = e.target.getAttribute('data-industry');
        const amount = e.target.getAttribute('data-value');
        
        // 해당 산업 입력창 찾아서 값 자동 입력 후 시뮬레이션 실행
        console.log(`${targetIndustry} 산업에 ${amount}백만 원 입력 완료`);
        // runSimulation(); 함수 호출
    });
});
