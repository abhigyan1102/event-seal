import { createHeliusWebhookHandler } from "./_shared/handlers.ts";
import { verifyAndPersist } from "./_shared/verify-and-persist.ts";

export default createHeliusWebhookHandler({
  getEnv: (name) => Deno.env.get(name),
  logger: globalThis.console,
  verifyAndPersist,
});
