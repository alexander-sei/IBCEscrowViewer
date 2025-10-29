import axios from "axios";
import { LCD_URL, DEFAULT_PAGE_LIMIT } from "../config";

export interface Pagination {
  next_key?: string | null;
  total?: string;
}

export interface Coin {
  denom: string;
  amount: string;
}

export interface ChannelCounterparty {
  port_id?: string;
  channel_id?: string;
}

export interface Channel {
  state: string; // e.g. STATE_OPEN
  ordering?: string;
  counterparty?: ChannelCounterparty;
  connection_hops?: string[];
  version?: string;
  port_id: string;
  channel_id: string;
}

export interface ChannelResponse {
  channels: Channel[];
  pagination?: Pagination;
}

export interface EscrowAddressResponse {
  escrow_address: string;
}

export interface BalancesResponse {
  balances: Coin[];
  pagination?: Pagination;
}

export interface DenomTrace {
  path: string;
  base_denom: string;
}

export interface DenomTraceResponse {
  denom_trace: DenomTrace;
}

export interface DenomUnit {
  denom: string;
  exponent: number;
}

export interface DenomMetadata {
  description?: string;
  denom_units?: DenomUnit[];
  base: string;
  display?: string;
  name?: string;
  symbol?: string;
}

export interface DenomsMetadataResponse {
  metadatas: DenomMetadata[];
  pagination?: Pagination;
}

export interface ConnectionResponse {
  connection?: {
    client_id?: string;
  };
}

export interface ClientStateResponse {
  identified_client_state?: {
    client_state?: {
      chain_id?: string;
    };
  };
  client_state?: {
    chain_id?: string;
  };
}

const http = axios.create({ baseURL: LCD_URL, timeout: 20_000 });

async function getAllPages<T extends { pagination?: Pagination }>(
  path: string,
  key: keyof T
): Promise<T[typeof key] extends Array<infer U> ? U[] : never> {
  const items: any[] = [];
  let nextKey: string | null | undefined = undefined;
  do {
    const url = new URL(path, LCD_URL);
    const params = new URLSearchParams();
    params.set("pagination.limit", String(DEFAULT_PAGE_LIMIT));
    if (nextKey) params.set("pagination.key", nextKey);
    url.search = params.toString();
    const { data } = await http.get<T>(url.toString().replace(LCD_URL, ""));
    const pageItems: any[] = (data as any)[key] ?? [];
    items.push(...pageItems);
    nextKey = data.pagination?.next_key ?? null;
  } while (nextKey);
  return items as any;
}

export async function getAllChannels(): Promise<Channel[]> {
  return getAllPages<ChannelResponse>("/ibc/core/channel/v1/channels", "channels");
}

export async function getEscrowAddress(channelId: string, portId = "transfer"): Promise<string> {
  const { data } = await http.get<EscrowAddressResponse>(
    `/ibc/apps/transfer/v1/channels/${channelId}/ports/${portId}/escrow_address`
  );
  return data.escrow_address;
}

export async function getAllBalances(address: string): Promise<Coin[]> {
  const balances: Coin[] = [];
  let nextKey: string | null | undefined = undefined;
  do {
    const params = new URLSearchParams();
    params.set("pagination.limit", String(DEFAULT_PAGE_LIMIT));
    if (nextKey) params.set("pagination.key", nextKey);
    const { data } = await http.get<BalancesResponse>(
      `/cosmos/bank/v1beta1/balances/${address}?${params.toString()}`
    );
    balances.push(...(data.balances ?? []));
    nextKey = data.pagination?.next_key ?? null;
  } while (nextKey);
  return balances;
}

export async function getDenomTrace(hash: string): Promise<DenomTrace | null> {
  try {
    const { data } = await http.get<DenomTraceResponse>(
      `/ibc/apps/transfer/v1/denom_traces/${hash}`
    );
    return data.denom_trace ?? null;
  } catch (_e) {
    return null;
  }
}

export async function getAllDenomsMetadata(): Promise<DenomMetadata[]> {
  const items: DenomMetadata[] = [];
  let nextKey: string | null | undefined = undefined;
  do {
    const params = new URLSearchParams();
    params.set("pagination.limit", String(DEFAULT_PAGE_LIMIT));
    if (nextKey) params.set("pagination.key", nextKey);
    const { data } = await http.get<DenomsMetadataResponse>(
      `/cosmos/bank/v1beta1/denoms_metadata?${params.toString()}`
    );
    items.push(...(data.metadatas ?? []));
    nextKey = data.pagination?.next_key ?? null;
  } while (nextKey);
  return items;
}

export async function getCounterpartyChainId(connectionId: string): Promise<string | undefined> {
  try {
    const { data: conn } = await http.get<ConnectionResponse>(
      `/ibc/core/connection/v1/connections/${connectionId}`
    );
    const clientId = conn.connection?.client_id;
    if (!clientId) return undefined;
    const { data: client } = await http.get<ClientStateResponse>(
      `/ibc/core/client/v1/client_states/${clientId}`
    );
    return (
      client.identified_client_state?.client_state?.chain_id || client.client_state?.chain_id
    );
  } catch (_e) {
    return undefined;
  }
}


