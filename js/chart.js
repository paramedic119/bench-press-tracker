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
    // Chart.js が CDN から読み込めなかった場合（オフライン等）はヒートマップだけ描画
    const chartLibLoaded = typeof Chart !== 'undefined';

    const allHistory = getHistory().reverse(); // 時系列にするため反転
    const history = _filterHistoryByPeriod(allHistory);
    const chartSection = document.getElementById('chart-section');
    const emptyState = document.getElementById('chart-empty');
    const prSection = document.getElementById('pr-section');

    if (allHistory.length === 0) {
        if (chartSection) chartSection.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        if (prSection) prSection.style.display = 'none';
        return;
    }

    if (chartSection) chartSection.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (prSection) prSection.style.display = 'block';

    // ヒートマップは全履歴ベースで描画（期間フィルタの影響を受けない）
    renderHeatmap(allHistory);

    // 期間フィルタ後の履歴が空の場合は折れ線/棒グラフは描かずに早期 return
    if (history.length === 0) {
        // 期間内0件: 既存のチャートを残さないため destroy
        if (maxWeightChart) { maxWeightChart.destroy(); maxWeightChart = null; }
        if (volumeChart) { volumeChart.destroy(); volumeChart = null; }
        return;
    }

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

    // 実測 PR (1RM/3RM/5RM) を DOM に反映（main から取り込み）
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

    // Chart.js 未ロード時は折れ線/棒グラフをスキップ（ヒートマップは描画済）
    if (!chartLibLoaded) {
        console.warn('Chart.js が読み込まれていません。推移グラフをスキップします。');
        _renderChartFallback('maxWeightChart');
        _renderChartFallback('volumeChart');
        return;
    }

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
                        // 推定1RM (Epley) を背景塗りつぶし線で。PR 更新セッションを ⭐ で強調
                        label: '推定1RM',
                        data: estimatedMaxData,
                        borderColor: '#f0c040',
                        backgroundColor: 'rgba(240, 192, 64, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: prFlags.map(isPR => isPR ? '#fffacd' : '#f0c040'),
                        pointBorderColor: prFlags.map(isPR => isPR ? '#ffc627' : '#f0c040'),
                        pointBorderWidth: prFlags.map(isPR => isPR ? 2 : 0),
                        pointRadius: prFlags.map(isPR => isPR ? 6 : 2),
                        pointHoverRadius: prFlags.map(isPR => isPR ? 8 : 4),
                        pointStyle: prFlags.map(isPR => isPR ? 'star' : 'circle'),
                        tension: 0.3,
                        fill: true
                    },
                    {
                        // 実測 1RM 自己ベスト更新セッションのみマーカー表示
                        label: '実測1RM',
                        data: act1RMData,
                        borderColor: '#e2e8f0',
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
                        borderColor: '#e67e22',
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
                        borderColor: '#3b82f6',
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

// ==================================================
// トレーニング頻度ヒートマップ（直近12週間 × 7曜日）
// ==================================================

const HEATMAP_WEEKS = 12;

/**
 * 履歴からヒートマップを描画。曜日は月〜日（左上が月）。
 * @param {Array<object>} allHistory - 時系列ソート済み（古→新）の履歴
 */
function renderHeatmap(allHistory) {
    const container = document.getElementById('heatmap-container');
    if (!container) return;

    // 日付キー（YYYY-MM-DD・ローカルタイム）でボリュームを集計
    const volByDate = {};
    allHistory.forEach(rec => {
        const key = _dateKeyLocal(new Date(rec.date));
        let v = 0;
        rec.exercises.forEach(ex => ex.sets.forEach(s => { v += s.weight * s.reps; }));
        volByDate[key] = (volByDate[key] || 0) + v;
    });

    // グリッド開始日: 今日を含む週の月曜から (HEATMAP_WEEKS - 1) 週前の月曜
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0=月 ... 6=日
    const gridStart = new Date(today);
    gridStart.setDate(today.getDate() - dow - (HEATMAP_WEEKS - 1) * 7);

    // 期間内ボリュームから上位を取って強度しきい値を算出（外れ値耐性のため P90 を上限）
    const inRangeVols = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
        for (let d = 0; d < 7; d++) {
            const cell = new Date(gridStart);
            cell.setDate(gridStart.getDate() + w * 7 + d);
            if (cell > today) continue;
            const v = volByDate[_dateKeyLocal(cell)] || 0;
            if (v > 0) inRangeVols.push(v);
        }
    }
    inRangeVols.sort((a, b) => a - b);
    const p90 = inRangeVols.length > 0
        ? inRangeVols[Math.min(inRangeVols.length - 1, Math.floor(inRangeVols.length * 0.9))]
        : 1;

    // 統計サマリー
    const sessions = inRangeVols.length;
    const perWeek = (sessions / HEATMAP_WEEKS).toFixed(1);
    const totalVol = inRangeVols.reduce((s, v) => s + v, 0);
    const totalVolStr = totalVol >= 10000
        ? `${(totalVol / 1000).toFixed(1)}k`
        : totalVol.toLocaleString();

    // グリッド HTML 構築
    const dayLabels = ['月', '火', '水', '木', '金', '土', '日'];
    let html = '';

    html += `<div class="heatmap-stats">`;
    html += `  <div class="hm-stat"><div class="hm-stat-label">SESSIONS</div><div class="hm-stat-value">${sessions}</div></div>`;
    html += `  <div class="hm-stat"><div class="hm-stat-label">PER WEEK</div><div class="hm-stat-value">${perWeek}</div></div>`;
    html += `  <div class="hm-stat"><div class="hm-stat-label">VOLUME</div><div class="hm-stat-value">${totalVolStr}<small>kg</small></div></div>`;
    html += `</div>`;

    html += `<div class="heatmap">`;
    // 曜日ラベル列
    html += `<div class="heatmap-day-labels">`;
    dayLabels.forEach((d, i) => {
        // 月・水・金のみ表示してスペース節約
        const visible = i % 2 === 0;
        html += `<div class="heatmap-day-label">${visible ? d : ''}</div>`;
    });
    html += `</div>`;
    // 週のカラム
    html += `<div class="heatmap-weeks">`;
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
        html += `<div class="heatmap-week">`;
        for (let d = 0; d < 7; d++) {
            const cell = new Date(gridStart);
            cell.setDate(gridStart.getDate() + w * 7 + d);
            const key = _dateKeyLocal(cell);
            const v = volByDate[key] || 0;
            const isFuture = cell > today;
            const level = isFuture ? -1 : _heatmapLevel(v, p90);
            const cls = isFuture
                ? 'heatmap-cell future'
                : `heatmap-cell level-${level}`;
            const title = isFuture
                ? key
                : (v > 0 ? `${key}: ${v.toLocaleString()}kg` : `${key}: 休`);
            html += `<div class="${cls}" title="${title}"></div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;

    // 凡例
    html += `<div class="heatmap-legend">`;
    html += `  <span>Less</span>`;
    html += `  <div class="heatmap-cell level-0"></div>`;
    html += `  <div class="heatmap-cell level-1"></div>`;
    html += `  <div class="heatmap-cell level-2"></div>`;
    html += `  <div class="heatmap-cell level-3"></div>`;
    html += `  <div class="heatmap-cell level-4"></div>`;
    html += `  <span>More</span>`;
    html += `</div>`;

    container.innerHTML = html;
}

/**
 * Date を YYYY-MM-DD のローカル日付文字列に。`toISOString()` だと UTC ずれが
 * 起きるので getFullYear/Month/Date を使う。
 */
function _dateKeyLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/**
 * ボリュームから 0〜4 の強度レベルを返す（P90 を上限の基準にする）
 */
function _heatmapLevel(v, p90) {
    if (v <= 0) return 0;
    const r = Math.min(1, v / p90);
    if (r < 0.25) return 1;
    if (r < 0.5) return 2;
    if (r < 0.75) return 3;
    return 4;
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

/**
 * Chart.js 未ロード時、canvas を覆うフォールバックメッセージを表示
 */
function _renderChartFallback(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    // 既存フォールバックがあれば差し替えで終了
    if (parent.querySelector('.chart-fallback')) return;
    canvas.style.display = 'none';
    const fb = document.createElement('div');
    fb.className = 'chart-fallback';
    fb.innerHTML = `
      <div class="cf-icon">📡</div>
      <div class="cf-msg">グラフライブラリの読み込みに失敗しました<br><small>オフラインの場合はネットワーク復帰後に再読込してください</small></div>
    `;
    parent.appendChild(fb);
}
