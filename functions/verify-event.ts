import { createVerifyEventHandler } from "./_shared/handlers.ts";
import { verifyAndPersist } from "./_shared/verify-and-persist.ts";

export default createVerifyEventHandler({
  getEnv: (name) => Deno.env.get(name),
  logger: globalThis.console,
  verifyAndPersist,
});
