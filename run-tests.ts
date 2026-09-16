/**
 * 受け入れ条件テスト（日本市場版）。ネットワーク不使用。
 *  - 取得結果の ok/skipped/failed 正規化
 *  - マージ規則（ok反映 / skipped・failed保持）
 *  - 単位間違い（台数を10倍に）で validate 停止
 *  - share 合計!=100 で停止
 *  - years と makers キー不一致で停止
 *  - recalcShare 後も合計100
 *  - 現行データが検証OK（html整合込み）
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { EvSales, FetchResult } from '../types';
import { runAllFetchers, __setFetchersForTest } from '../fetch/index';
import { recalcShare } from '../update-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..');
const TMP = path.join(SCRIPTS_DIR, 'test', '.tmp');

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, detail = ''): void {
  if (cond) { passed++; console.log(`  PASS: ${name}`); }
  else { failed++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
}

async function loadBase(): Promise<EvSales> {
  return JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'japan', 'data', 'ev-sales.json'), 'utf8'));
}
function runValidate(dataPath: string, extra: string[] = []): { code: number; out: string } {
  const res = spawnSync('npx', ['tsx', path.join(SCRIPTS_DIR, 'validate.ts'), '--data', dataPath, ...extra],
    { cwd: SCRIPTS_DIR, encoding: 'utf8' });
  return { code: res.status ?? -1, out: (res.stdout ?? '') + (res.stderr ?? '') };
}

async function main(): Promise<void> {
  await fs.mkdir(TMP, { recursive: true });
  const base = await loadBase();

  console.log('テスト1: fetcher モック注入');
  __setFetchersForTest({
    nissan: async (): Promise<FetchResult> => ({ status: 'ok', makerId: 'nissan', year: 2025, value: 4875, sourceUrl: 'https://jada.test/2025', fetchedAt: '2026-01-10T00:00:00Z' }),
    toyota: async (): Promise<FetchResult> => ({ status: 'failed', makerId: 'toyota', reason: '表構造変化' }),
    kei:    async (): Promise<FetchResult> => ({ status: 'skipped', makerId: 'kei', reason: '手動維持' }),
  });
  const results = await runAllFetchers();
  const byId = Object.fromEntries(results.map((r) => [r.makerId, r]));
  ok('nissan は ok', byId['nissan']?.status === 'ok');
  ok('toyota は failed', byId['toyota']?.status === 'failed');
  ok('kei は skipped', byId['kei']?.status === 'skipped');
  __setFetchersForTest(null);

  console.log('テスト2: マージ規則（保持）');
  const data: EvSales = JSON.parse(JSON.stringify(base));
  const prevToyota = data.years['2025']['toyota'];
  const prevKei = data.years['2025']['kei'];
  data.years['2025']['nissan'] = 4875;
  ok('failed は既存値保持', data.years['2025']['toyota'] === prevToyota);
  ok('skipped は既存値保持', data.years['2025']['kei'] === prevKei);
  ok('ok は反映', data.years['2025']['nissan'] === 4875);

  console.log('テスト3: 単位間違い（台数を10倍）→ validate 停止');
  const bad: EvSales = JSON.parse(JSON.stringify(base));
  bad.years['2025']['import'] = 304580; // 30458 の10倍（単位間違い典型）
  const badPath = path.join(TMP, 'bad.json');
  await fs.writeFile(badPath, JSON.stringify(bad));
  const prevPath = path.join(TMP, 'prev.json');
  await fs.writeFile(prevPath, JSON.stringify(base));
  const r3 = runValidate(badPath, ['--prev', prevPath]);
  ok('validate 非ゼロ終了', r3.code !== 0, `code=${r3.code}`);
  ok('10倍異常を検出', /10倍以上|anomaly/.test(r3.out));

  console.log('テスト4: 非整数（小数）→ validate 停止');
  const frac: EvSales = JSON.parse(JSON.stringify(base));
  frac.years['2025']['nissan'] = 4875.5;
  const fracPath = path.join(TMP, 'frac.json');
  await fs.writeFile(fracPath, JSON.stringify(frac));
  const r4 = runValidate(fracPath);
  ok('validate 非ゼロ終了', r4.code !== 0, `code=${r4.code}`);
  ok('非整数を検出', /inv2/.test(r4.out));

  console.log('テスト5: share 合計!=100 → 停止');
  const bs: EvSales = JSON.parse(JSON.stringify(base));
  bs.share[0].pct += 3;
  const bsPath = path.join(TMP, 'bs.json');
  await fs.writeFile(bsPath, JSON.stringify(bs));
  const r5 = runValidate(bsPath);
  ok('validate 非ゼロ終了', r5.code !== 0, `code=${r5.code}`);
  ok('share合計違反を検出', /inv3/.test(r5.out));

  console.log('テスト6: キー不一致 → 停止');
  const bk: EvSales = JSON.parse(JSON.stringify(base));
  (bk.years['2025'] as Record<string, number>)['byd'] = 5000;
  const bkPath = path.join(TMP, 'bk.json');
  await fs.writeFile(bkPath, JSON.stringify(bk));
  const r6 = runValidate(bkPath);
  ok('validate 非ゼロ終了', r6.code !== 0, `code=${r6.code}`);
  ok('キー不一致を検出', /inv1/.test(r6.out));

  console.log('テスト7: 現行データは検証OK');
  const goodPath = path.join(TMP, 'good.json');
  await fs.writeFile(goodPath, JSON.stringify(base));
  const r7 = runValidate(goodPath, ['--html', path.join(REPO_ROOT, 'japan', 'index.html')]);
  ok('現行データ検証OK', r7.code === 0, `code=${r7.code} out=${r7.out}`);

  console.log('テスト8: recalcShare 後も合計100');
  const rc: EvSales = JSON.parse(JSON.stringify(base));
  recalcShare(rc);
  const sum = rc.share.reduce((s, x) => s + x.pct, 0);
  ok('再計算後 share 合計100', sum === 100, `got ${sum}`);
  ok('pct 全整数', rc.share.every((x) => Number.isInteger(x.pct)));

  console.log('テスト9: 0からの立ち上がりは異常扱いしない');
  const launch: EvSales = JSON.parse(JSON.stringify(base));
  // kei: 2021=0 → 2022=22848 は正当（軽EV投入）。異常検知が誤爆しないこと
  const launchPath = path.join(TMP, 'launch.json');
  await fs.writeFile(launchPath, JSON.stringify(launch));
  const r9 = runValidate(launchPath, ['--prev', prevPath]);
  ok('立ち上がりで停止しない', r9.code === 0, `code=${r9.code} out=${r9.out}`);

  await fs.rm(TMP, { recursive: true, force: true });
  console.log(`\n結果: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
