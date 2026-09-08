import type { HotelSupplierId } from "@guideless/types";

/**
 * Supplier-agnostic plumbing shared by every adapter. No `server-only` here so adapters can be unit
 * tested in Node; the `index.ts` factory is the server-only entry point.
 */

export type SupplierErrorCode =
  | "timeout"
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "invalid_request"
  | "unavailable"
  | "unknown";

/** One error shape for every adapter, so services can decide retry / fallback without parsing. */
export class HotelSupplierError extends Error {
  readonly supplier: HotelSupplierId;
  readonly code: SupplierErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    supplier: HotelSupplierId,
    code: SupplierErrorCode,
    message: string,
    opts: { retryable?: boolean; status?: number; cause?: unknown } = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "HotelSupplierError";
    this.supplier = supplier;
    this.code = code;
    this.retryable = opts.retryable ?? (code === "timeout" || code === "rate_limited");
    this.status = opts.status;
  }
}

/** Per-call budgets (ms). One slow supplier must never hold a search hostage. */
export const SUPPLIER_TIMEOUTS = {
  search: 4_000,
  quote: 8_000,
  book: 8_000,
  cancel: 8_000,
} as const;

/** Runs `run` with an AbortSignal that fires after `ms`; aborts surface as a supplier timeout error. */
export async function withTimeout<T>(
  supplier: HotelSupplierId,
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new HotelSupplierError(
        supplier,
        "timeout",
        `${supplier} did not answer within ${ms} ms`,
        { retryable: true, cause: err },
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
