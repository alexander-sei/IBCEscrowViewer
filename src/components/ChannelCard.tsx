import React from "react";
import { shortenBech32 } from "../lib/denom";

export interface ResolvedBalance {
  amount: string;
  rawDenom: string;
  displayAmount: string;
  displayDenom: string;
}

export interface ChannelCardProps {
  channelId: string;
  escrowAddress: string;
  counterpartyChainId?: string;
  balances: ResolvedBalance[];
  error?: string;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channelId,
  escrowAddress,
  counterpartyChainId,
  balances,
  error,
}) => {
  return (
    <div style={{
      border: "1px solid #334155",
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      background: "#0f172a",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Channel {channelId}</div>
          {counterpartyChainId && (
            <div style={{ color: "#64748b", fontSize: 12 }}>Counterparty: {counterpartyChainId}</div>
          )}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12 }}>
          Escrow: {shortenBech32(escrowAddress)}
        </div>
      </div>

      {error ? (
        <div style={{ color: "#b91c1c", marginTop: 10 }}>Error: {error}</div>
      ) : balances.length === 0 ? (
        <div style={{ color: "#64748b", marginTop: 10 }}>No locked assets</div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 10,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "34%" }} />
            <col style={{ width: "26%" }} />
            <col style={{ width: "40%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: "right", borderBottom: "1px solid #334155", padding: "8px 0", fontWeight: 500 }}>Amount</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #334155", padding: "8px 0", fontWeight: 500 }}>Asset</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #334155", padding: "8px 0", fontWeight: 500 }}>Raw denom</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b, idx) => (
              <tr key={idx}>
                <td style={{ padding: "8px 0", borderTop: "1px solid #1f2937", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.displayAmount}</td>
                <td style={{ padding: "8px 0", borderTop: "1px solid #1f2937" }}>{b.displayDenom}</td>
                <td
                  style={{
                    padding: "8px 0",
                    borderTop: "1px solid #1f2937",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    color: "#94a3b8",
                    whiteSpace: "normal",
                    wordBreak: "break-all",
                    overflowWrap: "anywhere",
                  }}
                >
                  {b.rawDenom}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ChannelCard;


