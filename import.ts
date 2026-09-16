/**
 * import.ts — 輸入車（区分B）。自販連 燃料別メーカー別 EV列から年計を取得。
 * パースは jada-parser.ts、取得は jada-source.ts が担当。実データで検算済み。
 * 値は台・整数。取得元URL未設定 or 構造変化時は failed を返す（1社失敗で全体を止めない）。
 */
import { FetchResult } from '../types';
import { getJadaYear } from './jada-source';
import { nowIso } from './_util';

/** 対象年（前年の年計が固まる想定。運用で調整可）。 */
const TARGET_YEAR = Number(process.env.JADA_TARGET_YEAR ?? new Date().getFullYear() - 1);

export async function fetchImport(): Promise<FetchResult> {
  const makerId = 'import' as const;
  try {
    const y = await getJadaYear(TARGET_YEAR);
    const value = y.perMaker[makerId];
    if (value == null) {
      return { status: 'skipped', makerId, reason: `${TARGET_YEAR}年のEV実績が0/非掲載` };
    }
    return {
      status: 'ok',
      makerId,
      year: TARGET_YEAR,
      value,
      sourceUrl: 'https://www.jada.or.jp/pages/342/',
      fetchedAt: nowIso(),
    };
  } catch (e) {
    return { status: 'failed', makerId, reason: `自販連Excel取得/パース失敗: ${(e as Error).message}` };
  }
}
