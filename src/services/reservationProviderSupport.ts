import type { ProductContract } from "../lib/productContract.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function contractText(contract: ProductContract): string {
  return [
    contract.originalPrompt,
    contract.canonicalInterpretation,
    ...contract.coreWorkflows,
    ...contract.functionalRequirements.map((requirement) => requirement.text),
    ...contract.integrations,
    ...contract.researchRequirements,
  ]
    .join("\n")
    .toLowerCase();
}

function reservationRequested(contract: ProductContract): boolean {
  if (contract.selectedTechnologyStack !== "flutter-node") return false;
  const text = contractText(contract);
  return (
    /\b(?:restaurant|table)\b[^\n]{0,100}\b(?:reservation|booking|availability)\b/.test(
      text,
    ) ||
    /\b(?:reservation|booking|availability)\b[^\n]{0,100}\b(?:restaurant|table)\b/.test(
      text,
    )
  );
}

function providerSource(): string {
  return `export type ProviderAuthorization = {
  mode: 'sandbox' | 'oauth' | 'partner_api';
  authorizedSource: true;
  accountId?: string;
};

export type AvailabilityQuery = {
  venueId: string;
  partySize: number;
  startIso: string;
  endIso: string;
};

export type AvailabilitySlot = {
  slotId: string;
  venueId: string;
  startsAt: string;
  partySize: number;
  provider: string;
};

export type BookingRequest = {
  slotId: string;
  partySize: number;
  idempotencyKey: string;
  confirmedByUser: boolean;
};

export type BookingResult = {
  reservationId: string;
  provider: string;
  status: 'confirmed';
};

export interface ReservationProvider {
  readonly id: string;
  readonly authorization: ProviderAuthorization;
  searchAvailability(query: AvailabilityQuery): Promise<AvailabilitySlot[]>;
  book(request: BookingRequest): Promise<BookingResult>;
}

export function assertAuthorizedProvider(provider: ReservationProvider): void {
  if (provider.authorization.authorizedSource !== true) {
    throw new Error('Reservation provider source is not authorized');
  }
  if (!['sandbox', 'oauth', 'partner_api'].includes(provider.authorization.mode)) {
    throw new Error('Reservation provider authorization mode is not allowed');
  }
}

export function assertConfirmedBooking(request: BookingRequest): void {
  if (!request.confirmedByUser) {
    throw new Error('Explicit user confirmation is required before booking');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error('Booking idempotency key is required');
  }
}
`;
}

function sandboxSource(): string {
  return `import {
  assertConfirmedBooking,
  type AvailabilityQuery,
  type AvailabilitySlot,
  type BookingRequest,
  type BookingResult,
  type ProviderAuthorization,
  type ReservationProvider,
} from './provider.js';

const slots: AvailabilitySlot[] = [
  {
    slotId: 'sandbox-slot-1900',
    venueId: 'sandbox-venue',
    startsAt: '2030-01-01T19:00:00.000Z',
    partySize: 2,
    provider: 'sandbox',
  },
  {
    slotId: 'sandbox-slot-1930',
    venueId: 'sandbox-venue',
    startsAt: '2030-01-01T19:30:00.000Z',
    partySize: 4,
    provider: 'sandbox',
  },
];

export class SandboxReservationProvider implements ReservationProvider {
  readonly id = 'sandbox';
  readonly authorization: ProviderAuthorization = {
    mode: 'sandbox',
    authorizedSource: true,
  };
  private readonly completed = new Map<string, BookingResult>();

  async searchAvailability(query: AvailabilityQuery): Promise<AvailabilitySlot[]> {
    if (!query.venueId.trim()) throw new Error('venueId is required');
    if (!Number.isInteger(query.partySize) || query.partySize < 1 || query.partySize > 20) {
      throw new Error('partySize must be between 1 and 20');
    }
    const start = Date.parse(query.startIso);
    const end = Date.parse(query.endIso);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      throw new Error('Availability time window is invalid');
    }
    return slots.filter((slot) =>
      slot.venueId === query.venueId &&
      slot.partySize >= query.partySize &&
      Date.parse(slot.startsAt) >= start &&
      Date.parse(slot.startsAt) <= end
    );
  }

  async book(request: BookingRequest): Promise<BookingResult> {
    assertConfirmedBooking(request);
    const existing = this.completed.get(request.idempotencyKey);
    if (existing) return existing;
    const slot = slots.find((candidate) => candidate.slotId === request.slotId);
    if (!slot) throw new Error('Sandbox slot is unavailable');
    if (request.partySize < 1 || request.partySize > slot.partySize) {
      throw new Error('Requested party size is unavailable');
    }
    const result: BookingResult = {
      reservationId: 'sandbox-reservation-' + request.idempotencyKey,
      provider: this.id,
      status: 'confirmed',
    };
    this.completed.set(request.idempotencyKey, result);
    return result;
  }
}
`;
}

function registrySource(): string {
  return `import { assertAuthorizedProvider, type ReservationProvider } from './provider.js';
import { SandboxReservationProvider } from './sandboxProvider.js';

export function reservationProviderFromEnvironment(): ReservationProvider {
  const mode = process.env.RESERVATION_PROVIDER_MODE?.trim().toLowerCase() || 'sandbox';
  if (mode === 'sandbox') {
    const provider = new SandboxReservationProvider();
    assertAuthorizedProvider(provider);
    return provider;
  }
  throw new Error('Production reservation provider is not configured; supply an authorized OAuth/partner adapter before enabling it');
}
`;
}

/** Adds a lawful provider boundary plus deterministic sandbox provider. */
export function applyReservationProviderSupport(
  generatedFiles: Record<string, string>,
  productContract: ProductContract,
): Record<string, string> {
  if (!reservationRequested(productContract)) return { ...generatedFiles };

  const files = { ...generatedFiles };
  const support = {
    "server/src/reservations/provider.ts": providerSource(),
    "server/src/reservations/sandboxProvider.ts": sandboxSource(),
    "server/src/reservations/providerRegistry.ts": registrySource(),
  };
  for (const [path, source] of Object.entries(support)) {
    if (!files[path]?.trim()) files[path] = source;
  }

  const serverEnv = (files["server/.env.example"] ?? "")
    .split("\n")
    .filter((line) => line.trim());
  if (
    !serverEnv.some((line) => line.startsWith("RESERVATION_PROVIDER_MODE="))
  ) {
    serverEnv.push("RESERVATION_PROVIDER_MODE=sandbox");
  }
  files["server/.env.example"] = `${serverEnv.join("\n")}\n`;

  const currentApi = (() => {
    try {
      return files["shared/contracts/product-api.json"]
        ? record(JSON.parse(files["shared/contracts/product-api.json"]))
        : {};
    } catch {
      return {};
    }
  })();
  files["shared/contracts/product-api.json"] = JSON.stringify(
    {
      ...currentApi,
      reservationProvider: {
        sandboxImplemented: true,
        productionProviderConfigured: false,
        authorizedSourcesOnly: true,
        scrapingAllowed: false,
        explicitBookingConfirmationRequired: true,
        idempotencyRequired: true,
        runtimeVerified: false,
      },
    },
    null,
    2,
  );

  return files;
}
