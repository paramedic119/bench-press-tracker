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
    const prSection = document.getElementById('pr-section');

    if (history.length === 0) {
        if (chartSection) chartSection.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        if (prSection) prSection.style.display = 'none';
        return;
    }

    if (chartSection) chartSection.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (prSection) prSection.style.display = 'block';

    // データ抽出
    const labels = history.map(rec => formatDate(new Date(rec.date)));

    let max1RM = 0;
    let max3RM = 0;
    let max5RM = 0;
    let date1RM = '-';
    let date3RM = '-';
    let date5RM = '-';

    const act1RMData = [];
    const act3RMData = [];
    const act5RMData = [];

    // 推定MAX推移 (各セッションの最高挙上重量から換算) 及び PR計算
    const estimatedMaxData = history.map(rec => {
        let sessionBestMax = 0;
        let sessionAct1RM = null;
        let sessionAct3RM = null;
        let sessionAct5RM = null;

        const dateStr = formatDate(new Date(rec.date));

        rec.exercises.forEach(ex => {
            // PRの記録はベンチプレスのみが対象
            if (ex.type === 'bench_press') {
                ex.sets.forEach(s => {
                    // 実測1RM更新チェック
                    if (s.reps === 1) {
                        if (sessionAct1RM === null || s.weight > sessionAct1RM) sessionAct1RM = s.weight;
                        if (s.weight > max1RM) {
                            max1RM = s.weight;
                            date1RM = dateStr;
                        }
                    }
                    // 実測3RM更新チェック
                    if (s.reps === 3) {
                        if (sessionAct3RM === null || s.weight > sessionAct3RM) sessionAct3RM = s.weight;
                        if (s.weight > max3RM) {
                            max3RM = s.weight;
                            date3RM = dateStr;
                        }
                    }
                    // 実測5RM更新チェック
                    if (s.reps === 5) {
                        if (sessionAct5RM === null || s.weight > sessionAct5RM) sessionAct5RM = s.weight;
                        if (s.weight > max5RM) {
                            max5RM = s.weight;
                            date5RM = dateStr;
                        }
                    }
                });
            }

            // 既存の推定MAX計算
            ex.sets.forEach(s => {
                const est = estimateMax(s.weight, s.reps);
                if (est > sessionBestMax) sessionBestMax = est;
            });
        });

        // 自己ベスト更新（またはタイ記録）時のみプロットする
        if (sessionAct1RM !== null && sessionAct1RM >= max1RM) {
            act1RMData.push(sessionAct1RM);
        } else {
            act1RMData.push(null);
        }

        if (sessionAct3RM !== null && sessionAct3RM >= max3RM) {
            act3RMData.push(sessionAct3RM);
        } else {
            act3RMData.push(null);
        }

        if (sessionAct5RM !== null && sessionAct5RM >= max5RM) {
            act5RMData.push(sessionAct5RM);
        } else {
            act5RMData.push(null);
        }

        return sessionBestMax;
    });

    // PR表示をDOMに反映
    if (document.getElementById('pr-1rm-val')) {
        document.getElementById('pr-1rm-val').textContent = max1RM > 0 ? max1RM : '-';
        document.getElementById('pr-1rm-date').textContent = date1RM;
    }
    if (document.getElementById('pr-3rm-val')) {
        document.getElementById('pr-3rm-val').textContent = max3RM > 0 ? max3RM : '-';
        document.getElementById('pr-3rm-date').textContent = date3RM;
    }
    if (document.getElementById('pr-5rm-val')) {
        document.getElementById('pr-5rm-val').textContent = max5RM > 0 ? max5RM : '-';
        document.getElementById('pr-5rm-date').textContent = date5RM;
    }

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
                datasets: [
                    {
                        label: '推定1RM',
                        data: estimatedMaxData,
                        borderColor: '#f0c040',
                        backgroundColor: 'rgba(240, 192, 64, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: '#f0c040',
                        pointRadius: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '実測1RM',
                        data: act1RMData,
                        borderColor: '#e2e8f0', // Silver
                        backgroundColor: '#e2e8f0',
                        borderWidth: 3,
                        pointBackgroundColor: '#e2e8f0',
                        pointRadius: 4,
                        spanGaps: true,
                        tension: 0,
                        fill: false
                    },
                    {
                        label: '実測3RM',
                        data: act3RMData,
                        borderColor: '#e67e22', // Bronze/Orange
                        backgroundColor: '#e67e22',
                        borderWidth: 3,
                        pointBackgroundColor: '#e67e22',
                        pointRadius: 4,
                        spanGaps: true,
                        tension: 0,
                        fill: false
                    },
                    {
                        label: '実測5RM',
                        data: act5RMData,
                        borderColor: '#3b82f6', // Blue
                        backgroundColor: '#3b82f6',
                        borderWidth: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointRadius: 4,
                        spanGaps: true,
                        tension: 0,
                        fill: false
                    }
                ]
            },
            options: getChartOptions('推定/実測1RM推移', true)
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
                    label: '総負荷量(kg)',
                    data: volumeData,
                    backgroundColor: 'rgba(91, 141, 239, 0.6)',
                    borderRadius: 4
                }]
            },
            options: getChartOptions('トレーニングボリューム', false)
        });
    }
}

/**
 * Chart.js 共通オプション
 * @param {string} title
 * @param {boolean} showLegend
 */
function getChartOptions(title, showLegend = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: showLegend,
                labels: {
                    color: '#9ba1b8',
                    font: { size: 10 },
                    boxWidth: 12
                }
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
