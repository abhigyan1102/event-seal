import "server-only";

import { createArcSettlementRoute } from "../../../../lib/arc-settlement-route";
import { verifyArcSettlement } from "../../../../lib/arc-settlement-verifier";

export const runtime = "nodejs";

export const POST = createArcSettlementRoute(verifyArcSettlement);
