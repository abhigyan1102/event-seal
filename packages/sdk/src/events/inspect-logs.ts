import { hashEventData } from "../receipt.js";
import type { TransactionInspection } from "../types.js";

type InspectedLogs = Pick<
  TransactionInspection,
  "invokedPrograms" | "logsStatus" | "candidates"
>;

/** Discovers candidate eight-byte log prefixes without asserting event identity. */
export function inspectLogs(logs: readonly string[]): InspectedLogs {
  const result: InspectedLogs = {
    invokedPrograms: [],
    logsStatus: "available",
    candidates: [],
  };
  const frames: string[] = [];
  const incomplete = (): InspectedLogs => ({
    ...result,
    logsStatus: "incomplete",
    candidates: [],
  });
  if (logs.length > 2048) return incomplete();
  const encoder = new TextEncoder();
  let bytes = 0;
  for (const line of logs) {
    bytes += encoder.encode(line).length;
    if (bytes > 256 * 1024 || /^Log truncated/i.test(line)) return incomplete();
    const invoke =
      /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) invoke \[(\d+)\]$/.exec(line);
    if (invoke) {
      const program = invoke[1]!;
      if (Number(invoke[2]) !== frames.length + 1 || frames.length >= 64)
        return incomplete();
      frames.push(program);
      if (!result.invokedPrograms.includes(program))
        result.invokedPrograms.push(program);
      if (result.invokedPrograms.length > 128) return incomplete();
      continue;
    }
    const exit =
      /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) (?:success|failed:.*)$/.exec(
        line,
      );
    if (exit) {
      if (frames.pop() !== exit[1]) return incomplete();
      continue;
    }
    if (!line.startsWith("Program data: ")) continue;
    const program = frames.at(-1);
    if (!program) return incomplete();
    const dataBase64 = line.slice("Program data: ".length);
    let data: Uint8Array;
    try {
      data = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
    } catch {
      return incomplete();
    }
    if (data.length < 8) continue;
    if (result.candidates.length >= 128) return incomplete();
    result.candidates.push({
      eventPosition: result.candidates.length,
      emitterProgramId: program,
      discriminator: Array.from(data.subarray(0, 8), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join(""),
      dataBase64,
      eventDataHash: hashEventData(data),
    });
  }
  return frames.length ? incomplete() : result;
}
