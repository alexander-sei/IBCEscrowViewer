import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pLimit from "p-limit";
import {
  getAllBalances,
  getAllChannels,
  getCounterpartyChainId,
  getEscrowAddress,
} from "../api/lcd";
import type { Channel } from "../api/lcd";
import { ENABLE_COUNTERPARTY_RESOLUTION, CONCURRENCY_LIMIT, AUTO_REFRESH_MS } from "../config";
import { formatAmount, primeDenomMetadataCache, resolveDenom, shortenBech32 } from "../lib/denom";
import type { ResolvedBalance } from "./ChannelCard";

interface ChannelRow {
  channel: Channel;
  escrowAddress?: string;
  counterpartyChainId?: string;
  balances?: ResolvedBalance[];
  error?: string;
}

export const ChannelList: React.FC = () => {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<number | undefined>(undefined);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | undefined>(undefined);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.channel.channel_id.toLowerCase().includes(q) ||
      (r.counterpartyChainId?.toLowerCase() ?? "").includes(q)
    );
  }, [rows, filter]);

  interface FlatRow {
    channelId: string;
    counterpartyChainId?: string;
    escrowAddress: string;
    displayAmount?: string;
    displayDenom?: string;
    rawDenom?: string;
    error?: string;
  }

  const flatRows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = [];
    for (const r of filteredRows) {
      if (r.error) {
        out.push({
          channelId: r.channel.channel_id,
          counterpartyChainId: r.counterpartyChainId,
          escrowAddress: r.escrowAddress || "",
          error: r.error,
        });
        continue;
      }
      const balances = r.balances || [];
      for (const b of balances) {
        out.push({
          channelId: r.channel.channel_id,
          counterpartyChainId: r.counterpartyChainId,
          escrowAddress: r.escrowAddress || "",
          displayAmount: b.displayAmount,
          displayDenom: b.displayDenom,
          rawDenom: b.rawDenom,
        });
      }
    }
    return out;
  }, [filteredRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      await primeDenomMetadataCache();
      const all = await getAllChannels();
      const openTransfer = all.filter(
        (c) => c.state === "STATE_OPEN" && c.port_id === "transfer"
      );
      const limit = pLimit(CONCURRENCY_LIMIT);

      const baseRows: ChannelRow[] = openTransfer.map((channel) => ({ channel }));
      setRows(baseRows);

      const updates = await Promise.all(
        openTransfer.map((channel) =>
          limit(async (): Promise<ChannelRow> => {
            try {
              const escrow = await getEscrowAddress(channel.channel_id);
              const rawBalances = await getAllBalances(escrow);
              const resolvedBalances: ResolvedBalance[] = [];
              for (const b of rawBalances) {
                if (!b || !b.amount || !b.denom) continue;
                if (b.amount === "0") continue; // skip zero balances
                const info = await resolveDenom(b.denom);
                const displayAmount = formatAmount(b.amount, info.decimals);
                resolvedBalances.push({
                  amount: b.amount,
                  rawDenom: b.denom,
                  displayAmount,
                  displayDenom: info.displayDenom,
                });
              }
              let counterpartyChainId: string | undefined = undefined;
              if (ENABLE_COUNTERPARTY_RESOLUTION) {
                const conn = channel.connection_hops?.[0];
                if (conn) counterpartyChainId = await getCounterpartyChainId(conn);
              }
              return {
                channel,
                escrowAddress: escrow,
                balances: resolvedBalances,
                counterpartyChainId,
              };
            } catch (e: any) {
              return {
                channel,
                error: e?.message || String(e),
              };
            }
          })
        )
      );

      setRows(updates);
      setLastUpdatedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => {
      load();
    }, AUTO_REFRESH_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [autoRefresh, load]);

  const totalCount = rows.length;
  const shownCount = filteredRows.length;
  const balancesCount = flatRows.length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          placeholder="Filter by channel id or counterparty chain"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: 10,
            border: "1px solid #334155",
            background: "#0f172a",
            color: "inherit",
            borderRadius: 8,
            flex: 1,
            minWidth: 240,
          }}
        />
        <button onClick={() => load()} style={{ padding: "10px 14px" }}>Refresh</button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          {shownCount === totalCount
            ? `${totalCount} channel${totalCount === 1 ? "" : "s"}`
            : `Showing ${shownCount} of ${totalCount}`}
          {balancesCount ? ` · ${balancesCount} balance${balancesCount === 1 ? "" : "s"}` : ""}
          {lastUpdatedAt ? ` · Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}
        </span>
      </div>

      {error && (
        <div style={{ color: "#b91c1c", marginBottom: 12 }}>Error: {error}</div>
      )}
      {!error && loading && (
        <div style={{ color: "#94a3b8", marginBottom: 12 }}>Loading…</div>
      )}
      {!error && !loading && shownCount === 0 && (
        <div style={{ color: "#94a3b8", marginTop: 8 }}>No channels match your filter.</div>
      )}

      {!error && balancesCount > 0 && (
        <div style={{ border: "1px solid #334155", borderRadius: 8, overflow: "hidden", background: "#0f172a" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: "14%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #334155", background: "#111827" }}>Channel</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #334155", background: "#111827" }}>Counterparty</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #334155", background: "#111827" }}>Escrow</th>
                <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #334155", background: "#111827" }}>Amount</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #334155", background: "#111827" }}>Asset</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #334155", background: "#111827" }}>Raw denom</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((r, idx) => (
                <tr key={`${r.channelId}-${idx}`}>
                  <td style={{ padding: "10px 12px", borderTop: "1px solid #1f2937" }}>{r.channelId}</td>
                  <td style={{ padding: "10px 12px", borderTop: "1px solid #1f2937", color: "#94a3b8" }}>{r.counterpartyChainId || ""}</td>
                  <td style={{ padding: "10px 12px", borderTop: "1px solid #1f2937", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {shortenBech32(r.escrowAddress)}
                  </td>
                  {r.error ? (
                    <td style={{ padding: "10px 12px", borderTop: "1px solid #1f2937", color: "#b91c1c" }} colSpan={3}>Error: {r.error}</td>
                  ) : (
                    <>
                      <td style={{ padding: "10px 12px", borderTop: "1px solid #1f2937", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.displayAmount}</td>
                      <td style={{ padding: "10px 12px", borderTop: "1px solid #1f2937", whiteSpace: "normal", wordBreak: "break-all", overflowWrap: "anywhere" }}>{r.displayDenom}</td>
                      <td style={{ padding: "10px 12px", borderTop: "1px solid #1f2937", color: "#94a3b8", whiteSpace: "normal", wordBreak: "break-all", overflowWrap: "anywhere" }}>
                        {r.rawDenom}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ChannelList;


