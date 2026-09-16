/**
 * 共通型定義とプロジェクト定数（日本市場版）。
 * 本番データは data/ev-sales.json（app.js が読むパス）。
 * 単位は「台・非負整数」。日本のBEVは数百〜数万台規模のため世界版の万台単位は使わない。
 */

export type FetchResult =
  | {
      status: 'ok';
      makerId: MakerId;
      year: number;
      value: number; // 台・整数（登録車BEV台数）
      sourceUrl: string;
      fetchedAt: string;
    }
  | { status: 'skipped'; makerId: MakerId; reason: string }
  | { status: 'failed'; makerId: MakerId; reason: string };

export interface EvSales {
  meta: {
    unit: string;
    note: string;
    updated: string;
    latestYear: number;
    trendMax: number;
    sources: string[];
  };
  kpis: Record<string, { value: number; decimals: number; unit: string; label: string; sub: string }>;
  makers: Record<string, { name: string; origin: string; color: string }>;
  years: Record<string, Record<string, number>>;
  trendSeries: string[];
  share: { name: string; color: string; pct: number }[];
  regions: { name: string; pct: number; color: string }[];
  models: { name: string; value: number }[];
}

/**
 * 正準メーカーID（日本市場版）。index.html の data-bar と完全一致すること。
 * 増減はHTML修正を伴うため禁止。
 *  import=輸入車合計 / kei=軽BEV / 以下は登録車の国産メーカー別
 */
export const MAKER_IDS = [
  'import',
  'kei',
  'nissan',
  'toyota',
  'honda',
  'mitsubishi',
  'mazda',
  'subaru',
] as const;
export type MakerId = (typeof MAKER_IDS)[number];

/**
 * 区分（データ取得の性質）:
 *  A = 自販連の燃料別メーカー別（登録車の国産）から機械取得しやすい
 *  B = 輸入車合計（JAIA/自販連の輸入車行）。ブランド内訳は非公表
 *  C = 軽BEV。全軽自協＋報道の合成が必要で手動維持寄り
 */
export const MAKER_TIER: Record<MakerId, 'A' | 'B' | 'C'> = {
  nissan: 'A',
  toyota: 'A',
  honda: 'A',
  mitsubishi: 'A',
  mazda: 'A',
  subaru: 'A',
  import: 'B',
  kei: 'C',
};

export const DATA_PATH = 'japan/data/ev-sales.json';
export const QUARTERLY_PATH = 'japan/data/quarterly.json';
export const CACHE_DIR = '.cache';

export const USER_AGENT =
  'who_is_EV_Top-databot/1.0 (+https://github.com/owlANDowlet0214/who_is_EV_Top; contact: REPLACE_WITH_CONTACT_EMAIL)';

export const MIN_REQUEST_INTERVAL_MS = 1000;
