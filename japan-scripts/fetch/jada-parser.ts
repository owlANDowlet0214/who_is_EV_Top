/**
 * jada-parser.ts — 自販連『燃料別メーカー別登録台数（乗用車）』月報Excelのパーサ。
 *
 * 実データ構造（2022〜2026の月報で確認済み）:
 *  - 1ファイル＝ある年の月別シート（例: '2025年12月' … '2025年1月'）。各シートは【単月】。
 *  - 6行目付近に燃料種ヘッダ: ガソリン / ＨＶ / ＰＨＶ / ディーゼル / ＥＶ / ＦＣＶ
 *  - メーカー名は B列（'ダイハツ' 'ホンダ' 'マツダ' '三菱' '日産' 'ＳＵＢＡＲＵ' 'スズキ' 'トヨタ'）と
 *    B列 '輸入車'、A列 '乗用車計'
 *  - 各メーカー行の直下に '構成比' 行がある（読み飛ばす）
 *  - 年計＝12ヶ月シートの EV列 を合算
 *
 * 検算済み: 2025年合算で 輸入車30,458 / 日産4,875 / トヨタ4,203 / 乗用車計39,885（報道確定値と一致）。
 *
 * 単位は「台・整数」でそのまま返す（単位変換不要）。
 */
import * as XLSX from 'xlsx';
import { MakerId } from '../types';

/** 自販連の日本語メーカー名 → makerId。輸入車は import。 */
const JADA_NAME_TO_ID: Record<string, MakerId> = {
  '日産': 'nissan',
  'トヨタ': 'toyota',
  'ホンダ': 'honda',
  '三菱': 'mitsubishi',
  'マツダ': 'mazda',
  'ＳＵＢＡＲＵ': 'subaru',
  'SUBARU': 'subaru',
  '輸入車': 'import',
  // ダイハツ・スズキはBEV実績が無く makers に無いので無視
};

const EV_HEADERS = new Set(['ＥＶ', 'EV']);

/** 1シートから makerId→EV台数 と 乗用車計EV を読む。EV列が見つからなければ null。 */
function parseSheet(ws: XLSX.WorkSheet): { perMaker: Partial<Record<MakerId, number>>; total: number } | null {
  const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, raw: true });
  // EV列インデックスをヘッダ行から特定
  let evCol = -1;
  for (let r = 0; r < Math.min(grid.length, 9); r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v != null && EV_HEADERS.has(String(v).trim())) {
        evCol = c;
        break;
      }
    }
    if (evCol >= 0) break;
  }
  if (evCol < 0) return null;

  const perMaker: Partial<Record<MakerId, number>> = {};
  let total = 0;
  for (const row of grid) {
    if (!row) continue;
    // メーカー名は B列(index1)、'乗用車計' は A列(index0)
    const nameB = row[1] != null ? String(row[1]).trim() : '';
    const nameA = row[0] != null ? String(row[0]).trim() : '';
    const ev = row[evCol];
    if (typeof ev !== 'number') continue;
    if (nameA === '乗用車計') {
      total += ev;
      continue;
    }
    const id = JADA_NAME_TO_ID[nameB];
    if (id) perMaker[id] = (perMaker[id] ?? 0) + ev;
  }
  return { perMaker, total };
}

export interface JadaYearResult {
  year: number;
  perMaker: Partial<Record<MakerId, number>>;
  total: number;
  monthsCounted: number;
}

/**
 * 1年分の月報ワークブック（Buffer/ArrayBuffer）を全シート合算して年計を返す。
 * yearHint は対象年（シート名から year を推定できない場合の保険）。
 */
export function parseJadaYearWorkbook(data: ArrayBuffer | Buffer | Uint8Array, yearHint?: number): JadaYearResult {
  const wb = XLSX.read(data, { type: 'buffer' });
  const perMaker: Partial<Record<MakerId, number>> = {};
  let total = 0;
  let months = 0;
  let year = yearHint ?? NaN;

  for (const sheetName of wb.SheetNames) {
    const m = /(20\d\d)\s*年/.exec(sheetName);
    if (m) year = Number(m[1]);
    const parsed = parseSheet(wb.Sheets[sheetName]);
    if (!parsed) continue;
    months++;
    for (const [id, v] of Object.entries(parsed.perMaker) as [MakerId, number][]) {
      perMaker[id] = (perMaker[id] ?? 0) + v;
    }
    total += parsed.total;
  }
  return { year, perMaker, total, monthsCounted: months };
}

/**
 * 年計ワークブック（1シート＝1年、シート名が "2021" 等）を解析し、年→結果 のマップを返す。
 * 月報（1ファイル＝1年・月別シート）とは別物なので専用関数にする。
 * シート名が4桁年で、月表記(年"…月")を含まないものを年計シートとみなす。
 */
export function parseJadaAnnualWorkbook(
  data: ArrayBuffer | Buffer | Uint8Array,
): Map<number, JadaYearResult> {
  const wb = XLSX.read(data, { type: 'buffer' });
  const out = new Map<number, JadaYearResult>();
  for (const sheetName of wb.SheetNames) {
    const name = sheetName.trim();
    // 純粋な4桁年シートのみ対象（"2025" ○ / "2025年12月" ×）
    if (!/^20\d\d$/.test(name)) continue;
    const year = Number(name);
    const parsed = parseSheet(wb.Sheets[sheetName]);
    if (!parsed) continue;
    out.set(year, { year, perMaker: parsed.perMaker, total: parsed.total, monthsCounted: 1 });
  }
  return out;
}

/**
 * 月報・年計のどちらのワークブックでも、対象年の年計を返す統一エントリ。
 * - 年計ワークブックに target 年シートがあればそれを使う（合算不要で正確）
 * - なければ月報とみなして全シート合算
 */
export function parseJadaWorkbookForYear(
  data: ArrayBuffer | Buffer | Uint8Array,
  targetYear: number,
): JadaYearResult {
  const annual = parseJadaAnnualWorkbook(data);
  const hit = annual.get(targetYear);
  if (hit) return hit;
  return parseJadaYearWorkbook(data, targetYear);
}
