/**
 * kei.ts — 区分C（軽BEV。全軽自協＋報道の合成が必要で自動化困難）
 * 情報源: 全国軽自動車協会連合会 https://www.zenkeijikyo.or.jp/statistics/
 * 注意: 軽EV(サクラ/eKクロスEV/N-ONE e: 等)の年計は機械公開が不安定。手動維持を基本とする。
 *
 * ★実装状態: 手動維持。既定は skipped（既存値を保持）。
 *   全軽自協が機械可読な軽EV年計を出せば ok 実装に切り替える。
 */
import { FetchResult } from '../types';

const CONFIGURED = false;

export async function fetchKei(): Promise<FetchResult> {
  const makerId = 'kei' as const;
  if (!CONFIGURED) {
    return { status: 'skipped', makerId, reason: '軽BEVは手動維持（全軽自協＋報道の合成）。既存値を保持。' };
  }
  return { status: 'skipped', makerId, reason: '軽EV年計が未取得' };
}
