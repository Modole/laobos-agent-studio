import process from "node:process";
import { startBridge } from "../bridge/server.mjs";

const parentPort = process.parentPort;
if (!parentPort) {
  throw new Error("Bridge process must be launched by Electron.");
}

const bridge = await startBridge({
  host: "127.0.0.1",
  port: Number(process.env.PI_STUDIO_PORT || 0),
  token: process.env.PI_STUDIO_TOKEN,
});

parentPort.postMessage({
  type: "ready",
  url: bridge.url,
});

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await bridge.close();
  process.exit(0);
}

parentPort.on("message", (event) => {
  if (event.data?.type === "shutdown") {
    void close();
  }
});

process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
