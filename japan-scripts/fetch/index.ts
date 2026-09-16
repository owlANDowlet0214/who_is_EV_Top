/**
 * fetch のディスパッチャ（日本市場版）。全 fetcher を実行し、例外は failed に正規化する。
 * FETCH_ONLY（カンマ区切り makerId）で対象を絞れる。
 */
import { FetchResult, MakerId } from '../types';
import { fetchImport } from './import';
import { fetchKei } from './kei';
import { fetchNissan } from './nissan';
import { fetchToyota } from './toyota';
import { fetchHonda } from './honda';
import { fetchMitsubishi } from './mitsubishi';
import { fetchMazda } from './mazda';
import { fetchSubaru } from './subaru';

type Fetcher = () => Promise<FetchResult>;

const REGISTRY: Record<MakerId, Fetcher> = {
  import: fetchImport,
  kei: fetchKei,
  nissan: fetchNissan,
  toyota: fetchToyota,
  honda: fetchHonda,
  mitsubishi: fetchMitsubishi,
  mazda: fetchMazda,
  subaru: fetchSubaru,
};

let overrideRegistry: Partial<Record<MakerId, Fetcher>> | null = null;
export function __setFetchersForTest(reg: Partial<Record<MakerId, Fetcher>> | null): void {
  overrideRegistry = reg;
}

export async function runAllFetchers(): Promise<FetchResult[]> {
  const registry = overrideRegistry ?? REGISTRY;
  const only = (process.env.FETCH_ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as MakerId[];

  const ids = (only.length ? only : (Object.keys(registry) as MakerId[])).filter(
    (id): id is MakerId => id in registry,
  );

  const results: FetchResult[] = [];
  for (const id of ids) {
    try {
      results.push(await registry[id]!());
    } catch (e) {
      results.push({ status: 'failed', makerId: id, reason: `未捕捉例外: ${(e as Error).message}` });
    }
  }
  return results;
}
