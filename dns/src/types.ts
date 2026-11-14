// B1sTeam - Minimal Cloudflare Worker types (du de typecheck khong can @cloudflare/workers-types)
// Neu them workers-types thi bo file nay di.

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(col?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  DB?: D1Database;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Cloudflare's CacheStorage has a `default` member that the standard WebWorker
 * `CacheStorage` type does not declare. Cast to this shape instead.
 */
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface CloudflareCacheStorage {
  default: CacheLike;
}

/** ExecutionContext in this worker is the standard CF one. */

export interface DnsProfileRow {
  nextdns_profile_id: string | null;
  status: string | null;
  rotation_required: number | null;
  is_current: number | null;
  query_limit: number | null;
  cycle_start: string | null;
  cycle_end: string | null;
  counter: number | null;
}
