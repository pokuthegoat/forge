import "server-only";
import { Connection, clusterApiUrl } from "@solana/web3.js";

export function getServerConnection(): Connection {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("mainnet-beta");
  return new Connection(url, "confirmed");
}
