import { PayOS } from "@payos/node";

// Singleton PayOS client (server-only). Returns null until the three PayOS
// credentials are present, so the app builds and runs before billing is
// configured — the checkout/webhook routes then surface a clear
// "payments not configured" error instead of crashing.
let payosClient;

export function getPayos() {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!clientId || !apiKey || !checksumKey) return null;
  if (!payosClient) {
    payosClient = new PayOS({ clientId, apiKey, checksumKey });
  }
  return payosClient;
}
