import { getAllDenomsMetadata, getDenomTrace } from "../api/lcd";
import type { DenomMetadata, DenomTrace } from "../api/lcd";

const denomTraceCache = new Map<string, DenomTrace | null>();
const metadataCacheByBase = new Map<string, DenomMetadata>();
let metadataLoaded = false;

export interface ResolvedDenomInfo {
  baseDenom: string;
  displayDenom: string;
  symbol?: string;
  decimals: number;
  rawDenom: string;
}

export async function primeDenomMetadataCache(): Promise<void> {
  if (metadataLoaded) return;
  try {
    const all = await getAllDenomsMetadata();
    for (const m of all) {
      if (m.base) metadataCacheByBase.set(m.base, m);
    }
  } finally {
    metadataLoaded = true;
  }
}

export async function resolveDenom(rawDenom: string): Promise<ResolvedDenomInfo> {
  let baseDenom = rawDenom;
  if (rawDenom.startsWith("ibc/")) {
    const hash = rawDenom.split("/")[1];
    let trace = denomTraceCache.get(hash);
    if (trace === undefined) {
      trace = await getDenomTrace(hash);
      denomTraceCache.set(hash, trace ?? null);
    }
    if (trace?.base_denom) {
      baseDenom = trace.base_denom;
    }
  }

  if (!metadataLoaded) {
    await primeDenomMetadataCache();
  }

  const meta = metadataCacheByBase.get(baseDenom);
  const display = meta?.display || baseDenom;
  const symbol = meta?.symbol || undefined;
  // Choose decimals as exponent where denom_units.denom === display
  const decimals = (() => {
    const displayUnit = meta?.denom_units?.find((u) => u.denom === (meta?.display || baseDenom));
    if (displayUnit?.exponent !== undefined) return displayUnit.exponent;
    // Fallback to base unit exponent 0, and default 6 when unknown
    const baseUnit = meta?.denom_units?.find((u) => u.denom === meta?.base);
    if (baseUnit?.exponent !== undefined) return baseUnit.exponent;
    return 6;
  })();

  return {
    baseDenom,
    displayDenom: symbol || display,
    symbol,
    decimals,
    rawDenom,
  };
}

export function formatAmount(amount: string, decimals: number): string {
  // Safe integer formatting using BigInt
  try {
    const negative = amount.startsWith("-");
    const digits = negative ? amount.slice(1) : amount;
    const bi = BigInt(digits || "0");
    const base = BigInt(10) ** BigInt(decimals);
    const whole = bi / base;
    const frac = bi % base;
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole.toString()}${fracStr ? `.${fracStr}` : ""}`;
  } catch {
    return amount;
  }
}

export function shortenBech32(addr: string, left = 8, right = 6): string {
  if (addr.length <= left + right + 3) return addr;
  return `${addr.slice(0, left)}...${addr.slice(-right)}`;
}


