import type { Currency } from "@guideless/types";
import {
  ExperienceError,
  type ExperienceBookingResult,
  type ExperienceOption,
  type ExperienceProduct,
  type ExperienceSearchInput,
  type ExperienceSupplier,
} from "@/lib/experiences/types";
import fixtures from "./__fixtures__/mock-experiences.json";

/**
 * Deterministic experience supplier backed by __fixtures__/mock-experiences.json.
 *
 * This is not scaffolding to be deleted. There is no Viator account, and the repo already learned
 * (docs/hotel-provider-audit.md, scripts/liteapi-probe.mjs) that an adapter written from
 * documentation is a plausible integration rather than a verified one. So the whole pipeline —
 * search, import, markup, recheck — is built and tested against this, and the real adapter gets
 * written from real responses when there is a key to probe with.
 *
 * The fixture ids carry the awkward cases on purpose, because those are the ones that cost money:
 *   `-drift`   re-prices 12 % higher on recheck. Proves we notice before charging.
 *   `-gone`    vanishes on recheck. Proves we refuse rather than sell nothing.
 *   `-soldout` is unavailable from the start. Proves it never reaches an import.
 */

interface MockOption {
  supplierOptionId: string;
  name: string;
  startTime: string;
  netAmount: number;
  capacity: number;
  available?: boolean;
  cancellationPolicy: Array<{ daysBefore: number; refundPercentage: number }>;
}
interface MockProduct {
  supplierProductId: string;
  title: string;
  description: string;
  durationMinutes: number;
  supplierCategories: string[];
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  ratingCount: number;
  fromAmount: number;
  currency: string;
  options: MockOption[];
}

const PRODUCTS = (fixtures as { products: MockProduct[] }).products;

/** Metres between two points; the same equirectangular approximation the places mock uses. */
function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x = toRad(bLon - aLon) * Math.cos(toRad((aLat + bLat) / 2));
  const y = toRad(bLat - aLat);
  return Math.round(Math.sqrt(x * x + y * y) * R);
}

function matches(product: MockProduct, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const haystack = [
    product.title,
    product.description,
    product.address,
    ...product.supplierCategories,
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).some((word) => word.length > 2 && haystack.includes(word));
}

function toOption(o: MockOption, travelDate: string, currency: Currency): ExperienceOption {
  return {
    supplierOptionId: o.supplierOptionId,
    name: o.name,
    travelDate,
    startTime: o.startTime,
    currency,
    netAmount: o.netAmount,
    totalAmount: o.netAmount,
    capacity: o.capacity,
    available: o.available ?? true,
    cancellationPolicy: o.cancellationPolicy,
  };
}

export class MockExperienceSupplier implements ExperienceSupplier {
  readonly id = "mock" as const;

  search(input: ExperienceSearchInput): Promise<ExperienceProduct[]> {
    const results = PRODUCTS.filter((p) => matches(p, input.query ?? ""))
      .filter((p) => {
        if (input.latitude === undefined || input.longitude === undefined) return true;
        const radius = input.radiusMeters ?? 50_000;
        return distanceMeters(input.latitude, input.longitude, p.latitude, p.longitude) <= radius;
      })
      .slice(0, input.limit ?? 20)
      .map((p): ExperienceProduct => ({
        supplierProductId: p.supplierProductId,
        title: p.title,
        description: p.description,
        durationMinutes: p.durationMinutes,
        supplierCategories: p.supplierCategories,
        imageUrl: null,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        rating: p.rating,
        ratingCount: p.ratingCount,
        fromAmount: p.fromAmount,
        currency: p.currency as Currency,
      }));
    return Promise.resolve(results);
  }

  getOptions(supplierProductId: string, travelDate: string): Promise<ExperienceOption[]> {
    const product = PRODUCTS.find((p) => p.supplierProductId === supplierProductId);
    if (!product) {
      return Promise.reject(new ExperienceError("unavailable", "No such product"));
    }
    return Promise.resolve(
      product.options.map((o) => toOption(o, travelDate, product.currency as Currency)),
    );
  }

  recheckOption(supplierOptionId: string, travelDate: string): Promise<ExperienceOption | null> {
    // Withdrawn between quote and charge — the case that must never become a silent sale.
    if (supplierOptionId.endsWith("-gone")) return Promise.resolve(null);

    const product = PRODUCTS.find((p) =>
      p.options.some((o) => o.supplierOptionId === supplierOptionId),
    );
    const option = product?.options.find((o) => o.supplierOptionId === supplierOptionId);
    if (!product || !option) return Promise.resolve(null);

    const fresh = toOption(option, travelDate, product.currency as Currency);
    if (supplierOptionId.endsWith("-drift")) {
      const moved = Math.round(option.netAmount * 1.12);
      return Promise.resolve({ ...fresh, netAmount: moved, totalAmount: moved });
    }
    return Promise.resolve(fresh);
  }

  book(input: Parameters<ExperienceSupplier["book"]>[0]): Promise<ExperienceBookingResult> {
    if (input.supplierOptionId.endsWith("-gone") || input.supplierOptionId.endsWith("-soldout")) {
      return Promise.reject(new ExperienceError("sold_out", "That option is no longer bookable"));
    }
    const reference = `MOCK-${input.supplierOptionId.slice(-8).toUpperCase()}-${input.travelDate.replace(/-/g, "")}`;
    return Promise.resolve({
      supplierBookingId: `mock-booking-${reference}`,
      reference,
      voucherUrl: null,
      instructions: "Show this reference at the meeting point ten minutes before the start time.",
    });
  }

  cancel(supplierBookingId: string): Promise<{ cancelled: boolean; refundAmount: number | null }> {
    if (!supplierBookingId.startsWith("mock-booking-")) {
      return Promise.resolve({ cancelled: false, refundAmount: null });
    }
    // The refund a supplier gives us is not the refund we give a traveler: ours follows the
    // departure's cancellation ladder. Returning null keeps those two decisions separate.
    return Promise.resolve({ cancelled: true, refundAmount: null });
  }
}
