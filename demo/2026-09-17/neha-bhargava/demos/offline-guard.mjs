// A fail-closed safety guard, not a policy double: the current server is imported unchanged.
// Every attempted Node network operation is recorded without URL, headers, or payload.
// A single attempt FAILS the demo even if the production tool handles the exception.
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";

function deny() {
  appendFileSync(process.env.AIRLOCK_DEMO_NETWORK_LOG, "blocked-network-attempt\n", { mode: 0o600 });
  throw new Error("airlock-demo-network-disabled");
}
globalThis.fetch = deny;
globalThis.WebSocket = class { constructor() { deny(); } };
http.request = http.get = https.request = https.get = deny;
net.connect = net.createConnection = tls.connect = deny;
net.Socket.prototype.connect = deny;
dns.lookup = dns.resolve = deny;
dns.promises.lookup = dns.promises.resolve = deny;
syncBuiltinESMExports();
