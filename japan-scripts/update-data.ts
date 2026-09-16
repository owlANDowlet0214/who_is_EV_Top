/**
 * update-data.ts — 各 fetch/*.ts の結果を data/ev-sales.json にマージする（日本市場版）。
 *
 * 規則:
 *  - status:'ok' のみ years[year][makerId] に反映（台・整数）
 *  - skipped / failed は既存値を保持（ゼロ埋め・削除は禁止）
 *  - meta.updated を実行日(ISO日付)に更新
 *  - meta.latestYear は「その年の全メーカーが1度でも更新された」場合のみ繰り上げ
 *  - kpis/share/regions/models は自動更新しない
 *    ただし --recalc-share 指定時のみ share を years 最新年から機械再計算（合計100調整）
 *
 * 日本版は四半期分割を扱わない（各社の年次EV台数を直接反映）。
 *
 * 使い方:
 *   node update-data.ts [--recalc-share] [--dry-run]
 * 標準出力に PR本文生成用サマリを "SUMMARY_JSON:" 行で出す。
 */
import { promises as fs } from 'fs';
import { EvSales, FetchResult, MakerId, MAKER_IDS, DATA_PATH } from './types';
import { runAllFetchers } from './fetch';

interface Summary {
  updated: { makerId: string; year: number; value: number; sourceUrl: string }[];
  notUpdated: { makerId: string; reason: string }[];
  warnings: string[];
  anyFailed: boolean;
  allFailed: boolean;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** years 最新年から share を機械再計算。合計100になるよう最大シェアで端数調整。 */
function recalcShare(data: EvSales): void {
  const years = Object.keys(data.years).sort();
  const latest = years[years.length - 1];
  const row = data.years[latest];
  const total = Object.values(row).reduce((s, v) => s + v, 0);
  if (total <= 0) return;

  const alias: Record<string, MakerId> = {
    '輸入車': 'import',
    '軽BEV': 'kei',
    '日産(登録)': 'nissan',
    'トヨタ': 'toyota',
    'ホンダ': 'honda',
    '三菱(登録)': 'mitsubishi',
    'マツダ': 'mazda',
    'SUBARU': 'subaru',
  };

  let assignedSum = 0;
  let maxIdx = -1;
  let maxPct = -1;
  const entries = data.share.map((s) => ({ ...s }));
  entries.forEach((e, i) => {
    const id = alias[e.name];
    if (!id) {
      e.pct = -1; // 「その他」等は残余で埋める
      return;
    }
    const pct = Math.round((row[id] / total) * 100);
    e.pct = pct;
    assignedSum += pct;
    if (pct > maxPct) {
      maxPct = pct;
      maxIdx = i;
    }
  });

  const otherIdx = entries.findIndex((e) => e.pct === -1);
  if (otherIdx >= 0) entries[otherIdx].pct = Math.max(0, 100 - assignedSum);
  else if (maxIdx >= 0) entries[maxIdx].pct += 100 - assignedSum;

  data.share = entries;
}

async function main(): Promise<void> {
  const recalc = process.argv.includes('--recalc-share');
  const dryRun = process.argv.includes('--dry-run');

  const data = await readJson<EvSales | null>(DATA_PATH, null);
  if (!data) {
    console.error(`ERROR: ${DATA_PATH} が読めない`);
    process.exit(1);
    return;
  }

  const results: FetchResult[] = await runAllFetchers();

  const summary: Summary = {
    updated: [],
    notUpdated: [],
    warnings: [],
    anyFailed: false,
    allFailed: false,
  };

  let failCount = 0;
  const okByYear: Record<string, Set<string>> = {};

  for (const r of results) {
    if (r.status === 'ok') {
      const yearStr = String(r.year);
      const value = Math.round(r.value); // 台・整数
      data.years[yearStr] ??= {};
      data.years[yearStr][r.makerId] = value;
      okByYear[yearStr] ??= new Set();
      okByYear[yearStr].add(r.makerId);
      summary.updated.push({ makerId: r.makerId, year: r.year, value, sourceUrl: r.sourceUrl });
    } else {
      if (r.status === 'failed') {
        failCount++;
        summary.anyFailed = true;
      }
      summary.notUpdated.push({ makerId: r.makerId, reason: r.reason });
    }
  }

  summary.allFailed = results.length > 0 && failCount === results.length;
  data.meta.updated = new Date().toISOString().slice(0, 10);

  // latestYear 繰り上げ: その年の全メーカーが更新された場合のみ
  const allMakers = new Set<string>(MAKER_IDS);
  const candidateYears = Object.keys(okByYear).map(Number).sort((a, b) => b - a);
  for (const y of candidateYears) {
    const updatedSet = okByYear[String(y)];
    if ([...allMakers].every((m) => updatedSet.has(m)) && y > data.meta.latestYear) {
      data.meta.latestYear = y;
      break;
    }
  }

  if (recalc) recalcShare(data);

  if (dryRun) {
    console.log('DRY-RUN: 書き込みはしない');
  } else {
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  console.log(`SUMMARY_JSON:${JSON.stringify(summary)}`);
  console.log(`更新 ${summary.updated.length} 件 / 未更新 ${summary.notUpdated.length} 件 / failed ${failCount} 件`);
}

const isMain = process.argv[1] && /update-data\.ts$/.test(process.argv[1]);
if (isMain) main();

export { recalcShare, main };
export type { Summary };
