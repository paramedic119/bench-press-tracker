/* ==================================================
   data.js — プログラムデータ・定数・ユーティリティ
   ================================================== */

// 種目名の日本語変換辞書
const EXERCISE_NAMES = {
  bench_press: 'ベンチプレス',
  narrow_bench_press: 'ナローベンチプレス',
  legs_up_bench_press: '足上げベンチプレス',
  legs_up_narrow_bench_press: '足上げナローベンチプレス'
};

// 種目アイコン
const EXERCISE_ICONS = {
  bench_press: '🏋️',
  narrow_bench_press: '💪',
  legs_up_bench_press: '🦵',
  legs_up_narrow_bench_press: '🔥'
};

// トレーニングプログラム一覧
const PROGRAMS = [
  {
    id: 'bps_bench',
    name: 'BPSベンチプレスプログラム',
    description: '9週間の基礎強化プログラム',
    weeks: [
      {
        week_number: 1,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 80, is_amrap: false, rpe_target: null },
              { type: 'narrow_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 72.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'legs_up_bench_press', target_sets: 5, target_reps: 5, percentage_of_max: 70, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 1, percentage_of_max: 92.5, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 70, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 90, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 2,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 80, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 72.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 90, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'narrow_bench_press', target_sets: 5, target_reps: 5, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'legs_up_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 70, is_amrap: false, rpe_target: null },
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 82.5, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 3,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 82.5, is_amrap: false, rpe_target: null },
              { type: 'narrow_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null },
              { type: 'legs_up_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 70, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 1, percentage_of_max: 95, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 70, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 90, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 4,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 85, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 72.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 5, percentage_of_max: 85, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null },
              { type: 'narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 102.5, is_amrap: false, rpe_target: null },
              { type: 'legs_up_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 72.5, is_amrap: false, rpe_target: null },
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 82.5, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 5,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 85, is_amrap: false, rpe_target: null },
              { type: 'narrow_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 1, percentage_of_max: 95, is_amrap: false, rpe_target: null },
              { type: 'legs_up_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 1, percentage_of_max: 95, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 72.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 6,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 85, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 72.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null },
              { type: 'narrow_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'legs_up_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 70, is_amrap: false, rpe_target: null },
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 82.5, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 7,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 85, is_amrap: false, rpe_target: null },
              { type: 'narrow_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 1, percentage_of_max: 95, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 8,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 87.5, is_amrap: false, rpe_target: null },
              { type: 'legs_up_narrow_bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 5, percentage_of_max: 87.5, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 92.5, is_amrap: false, rpe_target: null },
              { type: 'narrow_bench_press', target_sets: 5, target_reps: 3, percentage_of_max: 75, is_amrap: false, rpe_target: null }
            ]
          },
          {
            day_number: 4,
            exercises: [
              { type: 'legs_up_bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 72.5, is_amrap: false, rpe_target: null },
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 87.5, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      },
      {
        week_number: 9,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 105, is_amrap: false, rpe_target: null }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'urpest2_bench',
    name: 'URPEST2.0 6週間BPプログラム',
    description: 'RPEベースの6週間ベンチプレス強化プログラム（週3回）',
    weeks: [
      {
        week_number: 1,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 8, percentage_of_max: 77.5, is_amrap: false, rpe_target: 6 }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 80.0, is_amrap: false, rpe_target: 5 }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 3, percentage_of_max: 85.0, is_amrap: false, rpe_target: 5 },
              { type: 'bench_press', target_sets: 2, target_reps: 3, percentage_of_max: 87.5, is_amrap: false, rpe_target: 6 },
              { type: 'narrow_bench_press', target_sets: 2, target_reps: 6, percentage_of_max: 72.5, is_amrap: false, rpe_target: 6 }
            ]
          }
        ]
      },
      {
        week_number: 2,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 90.0, is_amrap: false, rpe_target: 6 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 92.5, is_amrap: false, rpe_target: 7.5 },
              { type: 'bench_press', target_sets: 3, target_reps: 8, percentage_of_max: 80.0, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 5, target_reps: 5, percentage_of_max: 82.5, is_amrap: false, rpe_target: 6 }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 87.5, is_amrap: false, rpe_target: 6 },
              { type: 'narrow_bench_press', target_sets: 2, target_reps: 6, percentage_of_max: 75.0, is_amrap: false, rpe_target: 7 }
            ]
          }
        ]
      },
      {
        week_number: 3,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 92.5, is_amrap: false, rpe_target: 7.5 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 97.5, is_amrap: false, rpe_target: 9 },
              { type: 'bench_press', target_sets: 1, target_reps: 8, percentage_of_max: 82.5, is_amrap: false, rpe_target: 8.5 },
              { type: 'bench_press', target_sets: 2, target_reps: 8, percentage_of_max: 80.0, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 5, percentage_of_max: 82.5, is_amrap: false, rpe_target: 6 },
              { type: 'bench_press', target_sets: 4, target_reps: 5, percentage_of_max: 85.0, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 3, percentage_of_max: 87.5, is_amrap: false, rpe_target: 7 },
              { type: 'bench_press', target_sets: 2, target_reps: 3, percentage_of_max: 90.0, is_amrap: false, rpe_target: 8 },
              { type: 'narrow_bench_press', target_sets: 2, target_reps: 6, percentage_of_max: 75.0, is_amrap: false, rpe_target: 7 }
            ]
          }
        ]
      },
      {
        week_number: 4,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 92.5, is_amrap: false, rpe_target: 7 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 95.0, is_amrap: false, rpe_target: 8 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 97.5, is_amrap: false, rpe_target: 9 },
              { type: 'bench_press', target_sets: 3, target_reps: 6, percentage_of_max: 82.5, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 4, percentage_of_max: 85.0, is_amrap: false, rpe_target: 6 },
              { type: 'bench_press', target_sets: 4, target_reps: 4, percentage_of_max: 87.5, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 2, percentage_of_max: 87.5, is_amrap: false, rpe_target: 6 },
              { type: 'bench_press', target_sets: 1, target_reps: 2, percentage_of_max: 90.0, is_amrap: false, rpe_target: 7 },
              { type: 'bench_press', target_sets: 2, target_reps: 2, percentage_of_max: 92.5, is_amrap: false, rpe_target: 8 },
              { type: 'narrow_bench_press', target_sets: 2, target_reps: 5, percentage_of_max: 75.0, is_amrap: false, rpe_target: 7 }
            ]
          }
        ]
      },
      {
        week_number: 5,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 92.5, is_amrap: false, rpe_target: 7.5 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 95.0, is_amrap: false, rpe_target: 8.5 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 100.0, is_amrap: false, rpe_target: 9.5 },
              { type: 'bench_press', target_sets: 1, target_reps: 6, percentage_of_max: 85.0, is_amrap: false, rpe_target: 8.5 },
              { type: 'bench_press', target_sets: 2, target_reps: 6, percentage_of_max: 82.5, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 4, percentage_of_max: 85.0, is_amrap: false, rpe_target: 6 },
              { type: 'bench_press', target_sets: 2, target_reps: 4, percentage_of_max: 87.5, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 2, percentage_of_max: 90.0, is_amrap: false, rpe_target: 7 },
              { type: 'bench_press', target_sets: 1, target_reps: 2, percentage_of_max: 92.5, is_amrap: false, rpe_target: 8 },
              { type: 'bench_press', target_sets: 1, target_reps: 2, percentage_of_max: 95.0, is_amrap: false, rpe_target: 9 },
              { type: 'narrow_bench_press', target_sets: 2, target_reps: 5, percentage_of_max: 77.5, is_amrap: false, rpe_target: 8 }
            ]
          }
        ]
      },
      {
        week_number: 6,
        days: [
          {
            day_number: 1,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 92.5, is_amrap: false, rpe_target: 7 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 95.0, is_amrap: false, rpe_target: 8 },
              { type: 'bench_press', target_sets: 3, target_reps: 5, percentage_of_max: 85.0, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 2,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 92.5, is_amrap: false, rpe_target: 7 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 95.0, is_amrap: false, rpe_target: 8 },
              { type: 'bench_press', target_sets: 3, target_reps: 3, percentage_of_max: 87.5, is_amrap: false, rpe_target: 7 }
            ]
          },
          {
            day_number: 3,
            exercises: [
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 95.0, is_amrap: false, rpe_target: 8 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 97.5, is_amrap: false, rpe_target: 9 },
              { type: 'bench_press', target_sets: 1, target_reps: 1, percentage_of_max: 100.0, is_amrap: false, rpe_target: 10 },
              { type: 'bench_press', target_sets: 1, target_reps: 5, percentage_of_max: 90.0, is_amrap: false, rpe_target: 10 },
              { type: 'bench_press', target_sets: 2, target_reps: 5, percentage_of_max: 82.5, is_amrap: false, rpe_target: 6 }
            ]
          }
        ]
      }
    ]
  }

];

/**
 * プログラムデータをIDで取得
 * @param {string} id - プログラムID
 * @returns {object|null}
 */
function getProgramById(id) {
  return PROGRAMS.find(p => p.id === id) || null;
}

// --- ユーティリティ関数 ---

/**
 * 重量を2.5kg単位に丸める
 * @param {number} weight - 丸め前の重量
 * @returns {number} 2.5kg単位に丸めた重量
 */
function roundWeight(weight) {
  return Math.round(weight / 2.5) * 2.5;
}

/**
 * MAX重量とパーセンテージから目標重量を計算（2.5kg丸め）
 * @param {number} maxWeight - 現在の1RM
 * @param {number} percentage - パーセンテージ (e.g. 80)
 * @returns {number} 目標重量
 */
function calcTargetWeight(maxWeight, percentage) {
  return roundWeight(maxWeight * percentage / 100);
}

/**
 * Epley式で推定1RMを計算
 * @param {number} weight - 挙上重量
 * @param {number} reps - 挙上回数
 * @returns {number} 推定1RM
 */
function estimateMax(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * 指定のプログラムかつ指定のWeek/Dayのメニューデータを取得
 * @param {string} programId - プログラムID
 * @param {number} weekNum - 週番号
 * @param {number} dayNum - 日番号
 * @returns {object|null} 該当するDayのデータ
 */
function getDayData(programId, weekNum, dayNum) {
  const program = getProgramById(programId);
  if (!program) return null;
  const week = program.weeks.find(w => w.week_number === weekNum);
  if (!week) return null;
  return week.days.find(d => d.day_number === dayNum) || null;
}

/**
 * 日付を "YYYY/MM/DD" 形式にフォーマット
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * 日付を "YYYY/MM/DD HH:mm" 形式にフォーマット
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hh}:${mm}`;
}
