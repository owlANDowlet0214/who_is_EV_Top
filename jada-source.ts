/**
 * jada-source.ts — 自販連 月報Excel の取得＋年計パース＋キャッシュを束ねる共通ロジック。
 *
 * fetcher（nissan.ts 等）はこの getJadaYear(year) を呼び、自社IDの値を取り出すだけ。
 * 取得は1年分（=12ヶ月シートの入った1ファイル）を1回だけ行い、メモリキャッシュして使い回す。
 *
 * ★DL URLについて:
 *   自販連の燃料別ページ https://www.jada.or.jp/pages/342/ には
 *   「年別」ではなく年ごとの月報Excel（1ファイル12シート）が載る。URLはファイルIDを含み年で変わる。
 *   運用者が JADA_YEAR_XLSX_URL[year] に実URLを設定する（robots/規約確認のうえ）。
 *   ローカル検証用に環境変数 JADA_XLSX_<year>（ローカルファイルパス）でも差し込める。
 */
import { promises as fs } from 'fs';
import { parseJadaWorkbookForYear, JadaYearResult } from './jada-parser';
import { politeFetchBuffer } from './_util';

/** 年 → 月報ExcelのURL。運用者が実URLを設定する。空なら未設定＝取得不可。 */
export const JADA_YEAR_XLSX_URL: Record<number, string> = {
  // 例: 2025: 'https://www.jada.or.jp/files/libs/XXXX/xxxxxxxx.xlsx',
};

const cache = new Map<number, JadaYearResult>();

export async function getJadaYear(year: number): Promise<JadaYearResult> {
  const cached = cache.get(year);
  if (cached) return cached;

  // ローカル検証用の差し込み（実ファイルパス）
  const localPath = process.env[`JADA_XLSX_${year}`];
  let buf: Buffer;
  if (localPath) {
    buf = await fs.readFile(localPath);
  } else {
    const url = JADA_YEAR_XLSX_URL[year];
    if (!url) throw new Error(`JADA ${year} のExcel URL未設定`);
    buf = await politeFetchBuffer(url, `jada-${year}`);
  }

  const result = parseJadaWorkbookForYear(buf, year);
  // サニティ: 12ヶ月揃い、乗用車計>0 でなければ構造変化を疑う
  if (result.monthsCounted < 1 || result.total <= 0) {
    throw new Error(`JADA ${year} のパース結果が異常（months=${result.monthsCounted}, total=${result.total}）`);
  }
  cache.set(year, result);
  return result;
}
