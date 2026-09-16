/**
 * pr-body.ts — update-data.ts の SUMMARY_JSON と validate の警告から PR 本文を生成する。
 *
 * 使い方（ワークフローから）:
 *   node update-data.ts > update.log
 *   node validate.ts --prev prev.json --html index.html > validate.log || true
 *   node pr-body.ts update.log validate.log > pr-body.md
 *
 * 出力の最後に "PR_HAS_FAILED=1/0" と "PR_ALL_FAILED=1/0" を stderr に出し、
 * ワークフローがラベル付け/ジョブ失敗判定に使う。
 */
import { promises as fs } from 'fs';
import { MAKER_TIER, MakerId } from './types';

interface Summary {
  updated: { makerId: string; year: number; value: number; sourceUrl: string }[];
  notUpdated: { makerId: string; reason: string }[];
  anyFailed: boolean;
  allFailed: boolean;
}

const MAKER_LABEL: Record<string, string> = {
  import: '輸入車',
  kei: '軽BEV',
  nissan: '日産',
  toyota: 'トヨタ',
  honda: 'ホンダ',
  mitsubishi: '三菱',
  mazda: 'マツダ',
  subaru: 'SUBARU',
};

async function readText(p?: string): Promise<string> {
  if (!p) return '';
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return '';
  }
}

function parseSummary(updateLog: string): Summary | null {
  const line = updateLog.split('\n').find((l) => l.startsWith('SUMMARY_JSON:'));
  if (!line) return null;
  try {
    return JSON.parse(line.slice('SUMMARY_JSON:'.length)) as Summary;
  } catch {
    return null;
  }
}

function parseWarnings(validateLog: string): string[] {
  return validateLog
    .split('\n')
    .filter((l) => l.startsWith('WARN:'))
    .map((l) => l.slice('WARN:'.length).trim());
}

async function main(): Promise<void> {
  const [, , updatePath, validatePath] = process.argv;
  const updateLog = await readText(updatePath);
  const validateLog = await readText(validatePath);

  const summary = parseSummary(updateLog);
  const warnings = parseWarnings(validateLog);

  const out: string[] = [];

  out.push('## 更新されたメーカー');
  if (summary && summary.updated.length) {
    for (const u of summary.updated) {
      const label = MAKER_LABEL[u.makerId] ?? u.makerId;
      out.push(`- ${label} ${u.year}: ${u.value.toLocaleString()}台 → 出典: ${u.sourceUrl}`);
    }
  } else {
    out.push('- （なし）');
  }

  out.push('');
  out.push('## 更新されなかったメーカー');
  if (summary && summary.notUpdated.length) {
    for (const n of summary.notUpdated) {
      const label = MAKER_LABEL[n.makerId] ?? n.makerId;
      const tier = MAKER_TIER[n.makerId as MakerId];
      out.push(`- ${label}（区分${tier}）: ${n.reason}`);
    }
  } else {
    out.push('- （なし）');
  }

  out.push('');
  out.push('## 警告');
  if (warnings.length) {
    for (const w of warnings) out.push(`- ${w}`);
  } else {
    out.push('- （なし）');
  }

  out.push('');
  out.push('## 手動更新が必要な項目');
  out.push('kpis / share / regions / models（有償調査由来のため自動更新しない）');
  out.push('');
  out.push('---');
  out.push('_このPRは update-data.yml により自動生成されました。マージ前に数値と出典をご確認ください。_');

  process.stdout.write(out.join('\n') + '\n');

  // ワークフロー用フラグ
  process.stderr.write(`PR_HAS_FAILED=${summary?.anyFailed ? 1 : 0}\n`);
  process.stderr.write(`PR_ALL_FAILED=${summary?.allFailed ? 1 : 0}\n`);
}

main();
