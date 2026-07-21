import { hashEventData } from "../receipt.js";
import type { EventEvidence, VerificationReasonCode } from "../types.js";

const INVOKE_PATTERN = /^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[(\d+)]$/;
const EXIT_PATTERN = /^Program ([1-9A-HJ-NP-Za-km-z]+) (?:success|failed:.*)$/;
const DATA_PREFIX = "Program data: ";

interface LocatedEvent extends EventEvidence {
  discriminator: string;
}

export interface AnchorLogAttribution {
  event?: EventEvidence;
  reasonCode: Extract<
    VerificationReasonCode,
    | "VERIFIED"
    | "EVENT_NOT_FOUND"
    | "AMBIGUOUS_EVENT"
    | "PROGRAM_MISMATCH"
    | "DISCRIMINATOR_MISMATCH"
  >;
  reason: string;
}

function decodeBase64(value: string): Uint8Array | undefined {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** Reconstructs Solana invocation frames before attributing Anchor `emit!` logs. */
export function attributeAnchorLogEvent(
  logs: readonly string[],
  expectedProgramId: string,
  expectedDiscriminator: string,
): AnchorLogAttribution {
  const frames: string[] = [];
  const located: LocatedEvent[] = [];
  let eventPosition = 0;

  for (const line of logs) {
    const invoke = INVOKE_PATTERN.exec(line);
    if (invoke) {
      const programId = invoke[1];
      const depth = Number(invoke[2]);
      if (!programId || !Number.isSafeInteger(depth) || depth < 1) continue;
      frames.splice(depth - 1, frames.length, programId);
      continue;
    }

    const exit = EXIT_PATTERN.exec(line);
    if (exit) {
      const programId = exit[1];
      const index = frames.lastIndexOf(programId ?? "");
      if (index >= 0) frames.splice(index);
      continue;
    }

    if (!line.startsWith(DATA_PREFIX)) continue;

    const data = decodeBase64(line.slice(DATA_PREFIX.length));
    const emitterProgramId = frames.at(-1);
    if (!data || data.length < 8 || !emitterProgramId) continue;

    located.push({
      eventPosition,
      emitterProgramId,
      eventDataHash: hashEventData(data),
      discriminator: bytesToHex(data.slice(0, 8)),
    });
    eventPosition += 1;
  }

  const matchingDiscriminator = located.filter(
    (candidate) => candidate.discriminator === expectedDiscriminator,
  );
  const matchingProgram = matchingDiscriminator.filter(
    (candidate) => candidate.emitterProgramId === expectedProgramId,
  );

  if (matchingProgram.length > 1) {
    return {
      reasonCode: "AMBIGUOUS_EVENT",
      reason:
        "More than one event matches the requested program and discriminator.",
    };
  }

  const match = matchingProgram[0];
  if (match) {
    return {
      event: {
        eventPosition: match.eventPosition,
        emitterProgramId: match.emitterProgramId,
        eventDataHash: match.eventDataHash,
      },
      reasonCode: "VERIFIED",
      reason:
        "The finalized transaction contains one event emitted by the expected program.",
    };
  }

  if (matchingDiscriminator.length > 0) {
    return {
      event: matchingDiscriminator[0],
      reasonCode: "PROGRAM_MISMATCH",
      reason:
        "Matching event bytes were emitted from a different program invocation frame.",
    };
  }

  if (
    located.some(
      (candidate) => candidate.emitterProgramId === expectedProgramId,
    )
  ) {
    return {
      reasonCode: "DISCRIMINATOR_MISMATCH",
      reason:
        "The expected program emitted data, but its discriminator did not match.",
    };
  }

  return {
    reasonCode: "EVENT_NOT_FOUND",
    reason: "No matching Anchor log event was present in the transaction logs.",
  };
}
