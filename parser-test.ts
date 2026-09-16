/**
 * jada-parser の実ファイル検証。アップロードされた自販連Excelがある場合のみ実行。
 * 月報（月別シート12枚・合算）と年計（1シート=1年）の両形式、および相互検証。
 */
import { existsSync, readFileSync } from 'fs';
import { parseJadaWorkbookForYear, parseJadaAnnualWorkbook } from '../fetch/jada-parser';

const MONTHLY: { path: string; year: number; expect: Record<string, number>; total: number }[] = [
  { path: '/mnt/user-data/uploads/燃料別登録台数統計_2025年1月_12月_.xlsx', year: 2025,
    expect: { import: 30458, nissan: 4875, toyota: 4203, subaru: 330, honda: 10, mazda: 9 }, total: 39885 },
  { path: '/mnt/user-data/uploads/燃料別登録台数統計_2024年1月_12月_.xlsx', year: 2024,
    expect: { import: 24057, nissan: 7823, toyota: 1789, subaru: 229, honda: 147, mazda: 12 }, total: 34057 },
];

const ANNUAL_PATH = '/mnt/user-data/uploads/20260108101512344.xlsx';
const ANNUAL_EXPECT: Record<number, { total: number; import: number; nissan: number }> = {
  2021: { total: 21139, import: 8605, nissan: 10846 },
  2022: { total: 31592, import: 14348, nissan: 16017 },
  2023: { total: 43991, import: 22848, nissan: 17660 },
  2024: { total: 34057, import: 24057, nissan: 7823 },
  2025: { total: 39885, import: 30458, nissan: 4875 },
};

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  PASS: ${name}`); }
  else { fail++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
};

console.log('月報（12ヶ月合算）:');
for (const c of MONTHLY) {
  if (!existsSync(c.path)) { console.log(`  SKIP: ${c.year}`); continue; }
  const r = parseJadaWorkbookForYear(readFileSync(c.path), c.year);
  ok(`${c.year} 乗用車計=${c.total}`, r.total === c.total, `got ${r.total}`);
  for (const [id, exp] of Object.entries(c.expect))
    ok(`  ${c.year}.${id}=${exp}`, (r.perMaker as any)[id] === exp, `got ${(r.perMaker as any)[id]}`);
}

console.log('年計（1シート=1年）:');
if (existsSync(ANNUAL_PATH)) {
  const annual = parseJadaAnnualWorkbook(readFileSync(ANNUAL_PATH));
  for (const [ys, exp] of Object.entries(ANNUAL_EXPECT)) {
    const y = Number(ys); const r = annual.get(y);
    ok(`${y} 取得`, !!r);
    if (r) {
      ok(`${y} 乗用車計=${exp.total}`, r.total === exp.total, `got ${r.total}`);
      ok(`${y} import=${exp.import}`, r.perMaker.import === exp.import, `got ${r.perMaker.import}`);
      ok(`${y} nissan=${exp.nissan}`, r.perMaker.nissan === exp.nissan, `got ${r.perMaker.nissan}`);
    }
  }
  // 相互検証: 月報2025合算 == 年計2025
  if (existsSync(MONTHLY[0].path)) {
    const m = parseJadaWorkbookForYear(readFileSync(MONTHLY[0].path), 2025);
    const a = annual.get(2025)!;
    ok('相互検証 2025 total 一致', m.total === a.total, `${m.total} vs ${a.total}`);
    ok('相互検証 2025 import 一致', m.perMaker.import === a.perMaker.import);
  }
} else {
  console.log('  SKIP: 年計ファイル無し');
}

console.log(`\nパーサ検証: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
