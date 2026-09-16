/**
 * fetch/*.ts 共通ユーティリティ。
 * - リクエスト間隔 >= 1秒、連絡先入り User-Agent（第4.1節）
 * - 取得生データを .cache/ に保存（コミット対象外）
 * - 万台・小数1桁への丸めヘルパ
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { CACHE_DIR, MIN_REQUEST_INTERVAL_MS, USER_AGENT } from '../types';

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** 生レスポンスを .cache/ に保存。ファイル名はメーカーID+タイムスタンプ。 */
async function saveCache(makerId: string, ext: string, body: string): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.join(CACHE_DIR, `${makerId}-${stamp}.${ext}`), body, 'utf8');
  } catch {
    // キャッシュ保存失敗は取得自体を止めない
  }
}

/** 礼儀正しいテキスト取得。生データは .cache/ に保存する。 */
export async function politeFetchText(url: string, makerId: string): Promise<string> {
  await throttle();
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/json' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  const ext = url.endsWith('.json') || res.headers.get('content-type')?.includes('json') ? 'json' : 'html';
  await saveCache(makerId, ext, text);
  return text;
}

/** 礼儀正しいバイナリ取得（xlsx等）。生データは .cache/ に保存する。 */
export async function politeFetchBuffer(url: string, makerId: string): Promise<Buffer> {
  await throttle();
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.join(CACHE_DIR, `${makerId}-${stamp}.xlsx`), buf);
  } catch {
    /* キャッシュ失敗は取得を止めない */
  }
  return buf;
}

/** 台数(実数) → 万台・小数1桁。単位変換は fetch 側の責務（第4.1節）。 */
export function toManDai(units: number): number {
  return Math.round((units / 10000) * 10) / 10;
}

/** 既に万台の値を小数1桁に整える。 */
export function roundManDai(man: number): number {
  return Math.round(man * 10) / 10;
}

export function nowIso(): string {
  return new Date().toISOString();
}
