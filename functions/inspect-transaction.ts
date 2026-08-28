import { inspectTransaction } from "../packages/sdk/src/index.ts";
import { createInspectTransactionHandler } from "./_shared/inspect-handler.ts";

export default createInspectTransactionHandler({
  getEnv: (name) => Deno.env.get(name),
  inspectTransaction,
});
