/* ==================================================
   chart.js — グラフ可視化 (Chart.js)
   ================================================== */

let maxWeightChart = null;
let volumeChart = null;

/**
 * グラフを描画・更新
 */
function renderCharts() {
    const history = getHistory().reverse(); // 時系列にするため反転
    const chartSection = document.getElementById('chart-section');
    const emptyState = document.getElementById('chart-empty');

    if (history.length === 0) {
        if (chartSection) chartSection.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (chartSection) chartSection.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // データ抽出
    const labels = history.map(rec => formatDate(new Date(rec.date)));

    // 推定MAX推移 (各セッションの最高挙上重量から換算)
    const estimatedMaxData = history.map(rec => {
        let sessionBestMax = 0;
        rec.exercises.forEach(ex => {
            ex.sets.forEach(s => {
                const est = estimateMax(s.weight, s.reps);
                if (est > sessionBestMax) sessionBestMax = est;
            });
        });
        return sessionBestMax;
    });

    // トレーニングボリューム推移
    const volumeData = history.map(rec => {
        let total = 0;
        rec.exercises.forEach(ex => {
            ex.sets.forEach(s => {
                total += s.weight * s.reps;
            });
        });
        return total;
    });

    // 推定MAX推移グラフ
    const ctxMax = document.getElementById('maxWeightChart')?.getContext('2d');
    if (ctxMax) {
        if (maxWeightChart) maxWeightChart.destroy();
        maxWeightChart = new Chart(ctxMax, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '推定1RM (kg)',
                    data: estimatedMaxData,
                    borderColor: '#f0c040',
                    backgroundColor: 'rgba(240, 192, 64, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#f0c040',
                    pointRadius: 4,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: getChartOptions('推定1RM推移')
        });
    }

    // ボリューム推移グラフ
    const ctxVol = document.getElementById('volumeChart')?.getContext('2d');
    if (ctxVol) {
        if (volumeChart) volumeChart.destroy();
        volumeChart = new Chart(ctxVol, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '総負荷量 (kg)',
                    data: volumeData,
                    backgroundColor: 'rgba(91, 141, 239, 0.6)',
                    borderRadius: 4
                }]
            },
            options: getChartOptions('トレーニングボリューム')
        });
    }
}

/**
 * Chart.js 共通オプション
 * @param {string} title
 */
function getChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#1a1d2e',
                titleColor: '#9ba1b8',
                bodyColor: '#e8eaf0',
                borderColor: '#2e3350',
                borderWidth: 1
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#6b7194',
                    font: { size: 10 }
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#6b7194',
                    font: { size: 10 }
                }
            }
        }
    };
}
