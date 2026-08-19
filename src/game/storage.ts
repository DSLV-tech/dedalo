export interface RunRecord {
  readonly bestDepth: number;
  readonly bestShards: number;
  readonly runs: number;
}

const KEY = 'dedalo.record.v1';
const EMPTY: RunRecord = { bestDepth: 0, bestShards: 0, runs: 0 };

/** Accesso difensivo: in modalità privata o con storage pieno non deve rompere il gioco. */
export function loadRecord(): RunRecord {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const value = parsed as Partial<RunRecord>;
    return {
      bestDepth: typeof value.bestDepth === 'number' ? value.bestDepth : 0,
      bestShards: typeof value.bestShards === 'number' ? value.bestShards : 0,
      runs: typeof value.runs === 'number' ? value.runs : 0,
    };
  } catch {
    return EMPTY;
  }
}

export function saveRecord(record: RunRecord): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* storage non disponibile: il gioco resta pienamente giocabile */
  }
}

export function mergeRecord(record: RunRecord, depth: number, shards: number): RunRecord {
  return {
    bestDepth: Math.max(record.bestDepth, depth),
    bestShards: Math.max(record.bestShards, shards),
    runs: record.runs + 1,
  };
}
