import net from "node:net";
import { encodeLengthPrefixedJson } from "./framing.js";

export async function probeLengthPrefixedSocket(socketPath) {
  const events = [];
  await new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    const timer = setTimeout(() => {
      events.push({ type: "timeout" });
      socket.destroy();
      resolve();
    }, 3000);

    socket.on("connect", () => {
      events.push({ type: "connect" });
      socket.write(
        encodeLengthPrefixedJson({
          jsonrpc: "2.0",
          id: 1,
          method: "getInfo",
          params: {
            session_id: "probe-session",
            turn_id: "probe-turn",
            session_context: "probe",
          },
        }),
      );
    });
    socket.on("data", (chunk) => events.push({ type: "data", bytes: chunk.length }));
    socket.on("end", () => events.push({ type: "end" }));
    socket.on("error", (error) => events.push({ type: "error", message: error.message }));
    socket.on("close", () => {
      clearTimeout(timer);
      events.push({ type: "close" });
      resolve();
    });
  });
  return events;
}
