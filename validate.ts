/**
 * validate.ts — 第3節の不変条件を機械検査し、違反があれば非ゼロ終了する。
 * さらに第4.3節の異常値検知を行う。
 *
 * 使い方:
 *   node validate.ts                 現行 data/ev-sales.json を検査
 *   node validate.ts --prev <path>   前回JSONと比較して異常値検知
 *   node validate.ts --html <path>   index.html の data-bar と makers キー一致も検査
 *
 * 終了コード: 0=OK（警告のみ含む） / 1=不変条件違反またはエラー級異常
 * 警告は標準出力に "WARN:" 行で出す（PR本文に転記される）。
 */
import { promises as fs } from 'fs';
import { EvSales, MAKER_IDS, DATA_PATH } from './types';

interface Args {
  dataPath: string;
  prevPath?: string;
  htmlPath?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dataPath: DATA_PATH };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prev') a.prevPath = argv[++i];
    else if (argv[i] === '--html') a.htmlPath = argv[++i];
    else if (argv[i] === '--data') a.dataPath = argv[++i];
  }
  return a;
}

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

/** 台・非負整数か（日本版は台数そのもの） */
function isNonNegInteger(v: number): boolean {
  if (typeof v !== 'number' || !isFinite(v)) return false;
  return Number.isInteger(v) && v >= 0;
}

function checkInvariants(d: EvSales): void {
  const makerKeys = new Set(Object.keys(d.makers));
  const canonical = new Set<string>(MAKER_IDS);

  // 不変条件5: makers のキーは data-bar 属性値の集合と一致
  for (const k of makerKeys) if (!canonical.has(k)) err(`[inv5] makers に未知のキー: ${k}`);
  for (const k of canonical) if (!makerKeys.has(k)) err(`[inv5] makers に必須キーが欠落: ${k}`);

  // 不変条件1: years 各年のキーは makers のキー集合と完全一致
  // 不変条件2: 値は万台・小数1桁
  let maxYearValue = -Infinity;
  for (const [year, obj] of Object.entries(d.years)) {
    const keys = new Set(Object.keys(obj));
    for (const k of makerKeys) if (!keys.has(k)) err(`[inv1] years.${year} にキー欠落: ${k}`);
    for (const k of keys) if (!makerKeys.has(k)) err(`[inv1] years.${year} に余分なキー: ${k}`);
    for (const [k, v] of Object.entries(obj)) {
      if (!isNonNegInteger(v)) err(`[inv2] years.${year}.${k}=${v} は非負整数（台）でない`);
      if (v > maxYearValue) maxYearValue = v;
    }
  }

  // 不変条件3: share[].pct は整数、合計ちょうど100
  let shareSum = 0;
  for (const s of d.share) {
    if (!Number.isInteger(s.pct)) err(`[inv3] share "${s.name}" の pct=${s.pct} が整数でない`);
    shareSum += s.pct;
  }
  if (shareSum !== 100) err(`[inv3] share の pct 合計が ${shareSum}（100であること）`);

  // 不変条件4: regions は4要素、models は5要素
  if (d.regions.length !== 4) err(`[inv4] regions は4要素（現在 ${d.regions.length}）`);
  if (d.models.length !== 5) err(`[inv4] models は5要素（現在 ${d.models.length}）`);

  // 不変条件6: meta.trendMax は years 内最大値より大きい
  if (!(d.meta.trendMax > maxYearValue)) {
    err(`[inv6] meta.trendMax=${d.meta.trendMax} が years 最大値 ${maxYearValue} 以下`);
  }

  // trendSeries は makers に存在するキーであること（app.js が参照する）
  for (const k of d.trendSeries) {
    if (!makerKeys.has(k)) err(`[trendSeries] "${k}" が makers に存在しない`);
  }
}

/** 不変条件7（削除禁止）＋異常値検知（第4.3節） */
function checkAgainstPrev(cur: EvSales, prev: EvSales): void {
  // 不変条件7: 既存の年を削除しない
  for (const year of Object.keys(prev.years)) {
    if (!(year in cur.years)) err(`[inv7] 既存の年 ${year} が削除されている`);
  }
  // 異常値検知
  for (const [year, prevObj] of Object.entries(prev.years)) {
    const curObj = cur.years[year];
    if (!curObj) continue;
    for (const [k, pv] of Object.entries(prevObj)) {
      const cv = curObj[k];
      if (cv == null) continue;
      if (pv === cv) continue;
      // エラー級: 10倍以上 or 負値（単位間違いの典型）
      // ただし前回0からの立ち上がり（新型投入）は正当なので除外。
      // また小さな実数(前回<100台)からの倍増も誤検知しやすいので閾値を設ける。
      if (cv < 0) err(`[anomaly] years.${year}.${k} が負値 ${cv}`);
      else if (pv >= 100 && cv >= pv * 10) {
        err(`[anomaly] years.${year}.${k}: ${pv} → ${cv}（10倍以上。単位間違いの疑い）`);
      } else if (pv > 0) {
        // 警告級: ±50%超の変動
        const change = (cv - pv) / pv;
        if (Math.abs(change) > 0.5) {
          const sign = change > 0 ? '+' : '';
          warn(`${k} ${year}: 前回値から ${sign}${Math.round(change * 100)}%（${pv} → ${cv}）要確認`);
        }
      }
    }
  }
}

/** index.html の data-bar 集合と makers キーの一致を検査（任意） */
async function checkHtml(d: EvSales, htmlPath: string): Promise<void> {
  let html: string;
  try {
    html = await fs.readFile(htmlPath, 'utf8');
  } catch {
    warn(`--html: ${htmlPath} を読めなかったためHTML整合チェックをスキップ`);
    return;
  }
  const found = new Set<string>();
  const re = /data-bar="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.add(m[1]);
  const makerKeys = new Set(Object.keys(d.makers));
  for (const k of makerKeys) if (!found.has(k)) err(`[html] index.html に data-bar="${k}" が無い`);
  for (const k of found) if (!makerKeys.has(k)) err(`[html] index.html の data-bar="${k}" が makers に無い`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let cur: EvSales;
  try {
    cur = JSON.parse(await fs.readFile(args.dataPath, 'utf8')) as EvSales;
  } catch (e) {
    console.error(`ERROR: ${args.dataPath} を読めない/JSON不正: ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  checkInvariants(cur);

  if (args.prevPath) {
    try {
      const prev = JSON.parse(await fs.readFile(args.prevPath, 'utf8')) as EvSales;
      checkAgainstPrev(cur, prev);
    } catch (e) {
      warn(`--prev: ${args.prevPath} を読めずスキップ（${(e as Error).message}）`);
    }
  }

  if (args.htmlPath) await checkHtml(cur, args.htmlPath);

  for (const w of warnings) console.log(`WARN: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR: ${e}`);
    console.error(`\n検証失敗: ${errors.length} 件の違反`);
    process.exit(1);
  }
  console.log(`検証OK（警告 ${warnings.length} 件）`);
}

main();
