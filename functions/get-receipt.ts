import { createAdminClient } from "npm:@insforge/sdk";

import { createGetReceiptHandler } from "./_shared/handlers.ts";

export default createGetReceiptHandler({
  createAdminClient,
  getEnv: (name) => Deno.env.get(name),
  logger: globalThis.console,
});
