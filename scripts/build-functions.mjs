import { build } from "esbuild";

await build({
  entryPoints: [
    "functions/inspect-transaction.ts",
    "functions/verify-event.ts",
    "functions/get-receipt.ts",
    "functions/helius-webhook.ts",
  ],
  outdir: "functions/dist",
  bundle: true,
  external: ["npm:*"],
  format: "esm",
  platform: "neutral",
  target: "es2022",
  logLevel: "info",
});
