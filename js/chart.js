/* ==================================================
   chart.js — グラフ可視化 (Chart.js)
   ================================================== */

let maxWeightChart = null;
let volumeChart = null;

// 期間フィルタの状態: '1m' | '3m' | 'all'
let _chartPeriod = 'all';

/**
 * 期間フィルタを変更してグラフを再描画
 * @param {'1m'|'3m'|'all'} period
 */
function setChartPeriod(period) {
    _chartPeriod = period;
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });
    renderCharts();
}

/**
 * 期間フィルタに従って履歴を絞り込む
 * @param {Array<object>} history
 * @returns {Array<object>}
 */
function _filterHistoryByPeriod(history) {
    if (_chartPeriod === 'all') return history;
    const now = Date.now();
    const days = _chartPeriod === '1m' ? 30 : 90;
    const threshold = now - days * 24 * 60 * 60 * 1000;
    return history.filter(rec => new Date(rec.date).getTime() >= threshold);
}

/**
 * グラフを描画・更新
 */
function renderCharts() {
    const allHistory = getHistory().reverse(); // 時系列にするため反転
    const history = _filterHistoryByPeriod(allHistory);
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

    // PR (自己ベスト更新) 判定: 全期間で過去最大を超えた点を強調
    // _filterHistoryByPeriod の結果ではなく allHistory に対して計算し、
    // 期間外の PR が「フィルタを変えると突然 PR になる」のを防ぐ
    const allEstimatedMaxes = allHistory.map(rec => {
        let m = 0;
        rec.exercises.forEach(ex => ex.sets.forEach(s => {
            const est = estimateMax(s.weight, s.reps);
            if (est > m) m = est;
        }));
        return { date: rec.date, max: m };
    });
    const prDates = new Set();
    let runningMax = 0;
    allEstimatedMaxes.forEach(({ date, max }) => {
        if (max > runningMax) {
            runningMax = max;
            prDates.add(date);
        }
    });
    const prFlags = history.map(rec => prDates.has(rec.date));

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
                    pointBackgroundColor: prFlags.map(isPR => isPR ? '#fffacd' : '#f0c040'),
                    pointBorderColor: prFlags.map(isPR => isPR ? '#ffc627' : '#f0c040'),
                    pointBorderWidth: prFlags.map(isPR => isPR ? 2 : 1),
                    pointRadius: prFlags.map(isPR => isPR ? 7 : 4),
                    pointHoverRadius: prFlags.map(isPR => isPR ? 9 : 6),
                    pointStyle: prFlags.map(isPR => isPR ? 'star' : 'circle'),
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
