/**
 * アプリが扱うデータの形。
 * import/export を持たないので、JSDoc から名前だけで参照できる。
 */

type ExKey = 'BP' | 'NR' | 'LG';
type MaxKey = 'MB' | 'MN' | 'ML';

/** 12週プログラムの1セッション */
interface Session {
  id: number;
  week: number;
  day: number;
  ex: ExKey;
  /** MAX入力キー、または参照するセッションid */
  ref: MaxKey | number;
  coef: number;
  reps: number;
  sets: number;
  rpe: number;
}

/** 記録した1セット */
interface LogEntry {
  w: number;
  reps: number;
  rpe: number;
  /** 記録日時。旧データには無い */
  t?: number;
}

type Maxes = Record<MaxKey, number>;
/** セッションid → セットごとの記録（未記録は null） */
type LogMap = Record<number, (LogEntry | null)[]>;
/** セッションid → セットごとの完了時刻（未完了は false） */
type SetMap = Record<number, (number | boolean)[]>;

interface RestSettings {
  on: boolean;
  sound: boolean;
  vibrate: boolean;
  main: number;
  accessory: number;
  test: number;
}

interface SessionNote {
  text: string;
  bw?: number;
  t: number;
}

/** 完了したサイクルの記録 */
interface CycleArchive {
  n: number;
  started: number;
  ended: number;
  maxesStart: Maxes;
  maxesEnd: Maxes;
  best: Partial<Record<ExKey, number | null>>;
  logs: LogMap;
  sets: SetMap;
}

interface AppState {
  v: number;
  maxes: Maxes;
  round: number;
  bar: number;
  micro: number;
  adaptive: boolean;
  theme: 'auto' | 'dark' | 'light';
  warmup: boolean;
  rest: RestSettings;
  logs: LogMap;
  sets: SetMap;
  notes: Record<string, SessionNote>;
  ui: { week: number; day: number; ex: ExKey };
  history: CycleArchive[];
  cycle: { n: number; started: number };
  onboarded: boolean;
}

/** 計画チェーンの計算結果。W=重量, H=e1RM */
interface Plan {
  W: Record<number, number>;
  H: Record<number, number>;
}

/** ウォームアップの1セット */
interface WarmupSet {
  w: number;
  reps: number;
  isBar?: boolean;
  pct?: number;
}

/** レップマックス推移の1日分 */
interface RepMaxPoint {
  key: string;
  t: number;
  rm: Record<number, number>;
  e1: number | null;
  sets: number;
}
