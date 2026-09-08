"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const setupCode = `git clone https://github.com/abhigyan1102/event-seal.git
cd event-seal
npm install
npm run dev

# open http://localhost:3000`;

const inspectCode = `import { inspectTransaction } from "@eventseal/sdk";

const inspection = await inspectTransaction({
  signature,
  cluster: "devnet",
});

if (inspection.reasonCode === "CANDIDATES_FOUND") {
  // Confirm identity from your trusted source.
}`;

const verifyCode = `import { verifyEvent } from "@eventseal/sdk";

const result = await verifyEvent({
  signature,
  cluster: "devnet",
  expectedProgramId,
  event: {
    format: "anchor-log",
    discriminator: expectedDiscriminator,
  },
  commitment: "finalized",
});`;

const decideCode = `switch (result.verdict) {
  case "verified":
    // Your application checks authorization and replay
    // protection before performing any protected action.
    break;
  case "rejected":
  case "indeterminate":
    return;
}`;

const concepts = [
  {
    id: "verdicts",
    title: "Verdicts",
    body: "Verified means the requested identity passed. Rejected means available evidence disproved it. Indeterminate means the evidence was not strong enough.",
    code: '"verified" | "rejected" | "indeterminate"',
    note: "Treat indeterminate as a stop, not as a tentative success.",
  },
  {
    id: "receipts",
    title: "Public receipts",
    body: "A deterministic receipt ID is issued only when the verifier has a complete identity and immutable event evidence. Share it without exposing account data.",
    code: "/receipts/es_<sha256>",
    note: "Public receipt evidence and private saved history are separate.",
  },
  {
    id: "boundary",
    title: "Security boundary",
    body: "Browser requests use the same-origin API. The server attaches the internal credential before calling protected verification functions.",
    code: "browser → /api/verify → protected function",
    note: "The internal credential stays on the server. It never enters browser code.",
  },
] as const;

const scenarios = [
  {
    label: "Verified",
    code: "VERIFIED",
    title: "The expected event matches.",
    body: "Finality, execution, program attribution, and event identity passed. Apply your application's authorization and business rules.",
    className: "verified",
  },
  {
    label: "Rejected",
    code: "TX_FAILED",
    title: "The transaction emitted an event, then failed.",
    body: "The log does not authorize an action. Stop and record the rejection reason.",
    className: "rejected",
  },
  {
    label: "Indeterminate",
    code: "RPC_UNAVAILABLE",
    title: "The RPC cannot supply reliable evidence.",
    body: "Do not act on this result. Retry or escalate according to the reason code and your application's policy.",
    className: "indeterminate",
  },
] as const;

const references = [
  {
    title: "API reference",
    description: "Inputs, outputs, and reason codes.",
    file: "api-reference.md",
  },
  {
    title: "Verification invariants",
    description: "The checks behind every decision.",
    file: "verification-invariants.md",
  },
  {
    title: "Transaction inspection",
    description: "Candidate discovery and its limits.",
    file: "transaction-inspection.md",
  },
  {
    title: "Threat model",
    description: "What EventSeal protects and where it stops.",
    file: "threat-model.md",
  },
];

function CodeBlock({
  label,
  language,
  code,
}: {
  label: string;
  language: string;
  code: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  const tokens = code.split(
    language === "Terminal"
      ? /(#[^\n]*)/g
      : /("(?:[^"\\]|\\.)*"|\/\/[^\n]*|\b(?:import|from|const|if|await|switch|case|break|return)\b)/g,
  );
  return (
    <div className="docs-code">
      <div className="docs-code__toolbar">
        <span>{language}</span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => void copy()}
        >
          {copyState === "copied" ? "Copied" : "Copy"}{" "}
          <span aria-hidden="true">⧉</span>
        </button>
      </div>
      <pre tabIndex={0} aria-label={label}>
        <code>
          {tokens.map((token, index) => {
            const type = token.startsWith('"')
              ? "string"
              : token.startsWith("//") || token.startsWith("#")
                ? "comment"
                : /^(import|from|const|if|await|switch|case|break|return)$/.test(
                      token,
                    )
                  ? "keyword"
                  : "plain";
            return (
              <span className={`docs-code__${type}`} key={index}>
                {token}
              </span>
            );
          })}
        </code>
      </pre>
      <p className="docs-code__status" role="status">
        {copyState === "copied"
          ? "Copied to clipboard."
          : copyState === "failed"
            ? "Copy unavailable. Select the code to copy it manually."
            : ""}
      </p>
    </div>
  );
}

export function DeveloperDocs() {
  const root = useRef<HTMLElement>(null);
  const [activeConcept, setActiveConcept] = useState<string>("verdicts");
  const [activeStep, setActiveStep] = useState("inspect");
  const [scenario, setScenario] = useState(0);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-docs-intro]", {
          y: 18,
          duration: 0.7,
          stagger: 0.07,
          ease: "power3.out",
        });
        gsap.fromTo(
          "[data-docs-word]",
          { color: "#65705e" },
          {
            color: "#20231f",
            stagger: 0.12,
            ease: "none",
            scrollTrigger: {
              trigger: ".docs-trust-statement",
              start: "top 90%",
              end: "top 50%",
              scrub: true,
            },
          },
        );
      });
      media.add(
        "(min-width: 1000px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)",
        () => {
          ScrollTrigger.create({
            trigger: ".docs-flow__rail",
            start: "top 112px",
            endTrigger: ".docs-flow__content",
            end: "bottom bottom",
            pin: true,
            pinSpacing: false,
            invalidateOnRefresh: true,
          });
        },
      );
      for (const id of ["inspect", "verify", "decide"]) {
        ScrollTrigger.create({
          trigger: `#${id}`,
          start: "top 38%",
          end: "bottom 38%",
          onEnter: () => setActiveStep(id),
          onEnterBack: () => setActiveStep(id),
        });
      }
      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <main className="developer-docs" ref={root}>
      <section className="docs-hero" id="overview" aria-labelledby="docs-title">
        <h1 id="docs-title" data-docs-intro>
          <span>Build on verified</span>
          <span>Solana events.</span>
        </h1>
        <p data-docs-intro>
          Inspect a transaction. Verify the event you expect.
          <br className="docs-mobile-break" /> Decide from the evidence.
        </p>
        <div className="docs-actions" data-docs-intro>
          <a className="docs-button docs-button--primary" href="#quickstart">
            Start locally <span aria-hidden="true">↓</span>
          </a>
          <Link className="docs-button docs-button--secondary" href="/verify">
            Open verifier <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="docs-hero__media" aria-hidden="true">
          <img
            src="/docs/field-guide.webp"
            width={1536}
            height={1024}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>

      <nav className="docs-chapters" aria-label="Documentation chapters">
        <a href="#quickstart">Quickstart</a>
        <a href="#inspect">Inspect</a>
        <a href="#verify">Verify</a>
        <a href="#decide">Decide</a>
        <a href="#concepts">Concepts</a>
      </nav>

      <section
        className="docs-quickstart docs-section"
        aria-labelledby="quickstart"
      >
        <h2 id="quickstart">Start with the repository.</h2>
        <p className="docs-section-lede">
          The SDK builds inside this workspace. Start here for local
          development.
        </p>
        <div className="docs-quickstart-grid">
          <CodeBlock
            label="Local setup commands"
            language="Terminal"
            code={setupCode}
          />
          <aside
            className="docs-prerequisites"
            aria-labelledby="prerequisites-title"
          >
            <h3 id="prerequisites-title">Before you run it</h3>
            <ul>
              <li>Use Node.js 20.18 or later.</li>
              <li>Install dependencies from the repository root.</li>
              <li>Configure the web environment using the README.</li>
            </ul>
            <a
              href="https://github.com/abhigyan1102/event-seal#local-development"
              target="_blank"
              rel="noreferrer"
            >
              Read the setup guide <span aria-hidden="true">↗</span>
            </a>
            <p>
              The SDK is currently distributed through this repository, not as a
              public npm release.
            </p>
          </aside>
        </div>
      </section>

      <section
        className="docs-flow docs-section"
        id="workflow"
        aria-labelledby="workflow-title"
      >
        <aside className="docs-flow__rail">
          <h2 id="workflow-title">The verification flow</h2>
          <nav aria-label="Verification flow sections">
            {["inspect", "verify", "decide"].map((id) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={activeStep === id ? "location" : undefined}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </a>
            ))}
          </nav>
          <p>Discovered candidates do not become trusted inputs.</p>
        </aside>
        <div className="docs-flow__content">
          <article className="docs-step" id="inspect">
            <h3>Inspect the transaction.</h3>
            <p>
              Start with a signature and network to discover the available
              evidence. Candidate program IDs and event bytes remain untrusted.
            </p>
            <p className="docs-endpoint">POST /api/inspect</p>
            <CodeBlock
              label="Inspect transaction example"
              language="TypeScript · SDK"
              code={inspectCode}
            />
            <p className="docs-boundary-note">
              <strong>No verdict. No receipt.</strong> Inspection does not
              verify event identity or persist evidence.
            </p>
          </article>
          <article className="docs-step" id="verify">
            <h3>Verify your expected event.</h3>
            <p>
              Supply the program ID and event discriminator from your trusted
              IDL or deployment configuration. Never take these values from
              inspection candidates.
            </p>
            <p className="docs-endpoint">POST /api/verify</p>
            <CodeBlock
              label="Verify event example"
              language="TypeScript · SDK"
              code={verifyCode}
            />
            <p className="docs-boundary-note">
              <strong>Trusted identity goes in.</strong> The expected
              discriminator must be eight bytes, encoded as 16 lowercase
              hexadecimal characters.
            </p>
          </article>
          <article className="docs-step" id="decide">
            <h3>Decide from the verdict.</h3>
            <p>
              Only verified evidence passes the event checks. Your application
              still decides whether an action is authorized and whether it has
              already been processed.
            </p>
            <CodeBlock
              label="Handle verification verdict example"
              language="TypeScript · Application policy"
              code={decideCode}
            />
            <p className="docs-boundary-note">
              <strong>Missing evidence never passes.</strong> Rejected and
              indeterminate results must not trigger a protected action.
            </p>
            <div
              className="docs-examples"
              role="region"
              aria-label="Verdict examples"
              aria-roledescription="carousel"
            >
              <div className="docs-examples__toolbar">
                <span>Example outcome</span>
                <div>
                  <button
                    type="button"
                    aria-label="Previous verdict example"
                    onClick={() => setScenario((value) => (value + 2) % 3)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Next verdict example"
                    onClick={() => setScenario((value) => (value + 1) % 3)}
                  >
                    →
                  </button>
                </div>
              </div>
              <div aria-live="polite" aria-atomic="true">
                {scenarios.map((item, index) => (
                  <div
                    className="docs-example"
                    hidden={scenario !== index}
                    key={item.code}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of 3: ${item.label}`}
                  >
                    <p
                      className={`docs-example__verdict docs-example__verdict--${item.className}`}
                    >
                      {item.label} <code>{item.code}</code>
                    </p>
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        className="docs-concepts docs-section"
        aria-labelledby="concepts"
      >
        <h2 id="concepts">Know what the result means.</h2>
        <p className="docs-section-lede">
          Three boundaries to keep explicit in your integration.
        </p>
        <div className="docs-concept-accordion">
          {concepts.map((concept) => {
            const active = activeConcept === concept.id;
            return (
              <article
                className={`docs-concept${active ? " docs-concept--active" : ""}`}
                key={concept.id}
              >
                <button
                  type="button"
                  aria-controls={`concept-${concept.id}`}
                  aria-expanded={active}
                  onClick={() => setActiveConcept(active ? "" : concept.id)}
                >
                  <span>{concept.title}</span>
                  <span aria-hidden="true">{active ? "−" : "+"}</span>
                </button>
                <div
                  id={`concept-${concept.id}`}
                  className="docs-concept__content"
                  hidden={!active}
                >
                  <p>{concept.body}</p>
                  <code>{concept.code}</code>
                  <p className="docs-concept__note">{concept.note}</p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="docs-trust-statement">
          {"Verify the evidence. Keep your own trust boundary."
            .split(" ")
            .map((word, index) => (
              <span data-docs-word key={index}>
                {word}{" "}
              </span>
            ))}
        </p>
      </section>

      <section
        className="docs-reference docs-section"
        aria-labelledby="reference-title"
      >
        <div className="docs-reference__copy">
          <h2 id="reference-title">
            Keep the evidence
            <br />
            close at hand.{" "}
            <span className="docs-reference__inline-image" aria-hidden="true" />
          </h2>
          <p>
            Use the verifier, then apply your own authorization and business
            rules.
          </p>
          <Link className="docs-button docs-button--primary" href="/verify">
            Open verifier <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="docs-reference__links">
          {references.map((reference) => (
            <a
              key={reference.file}
              href={`https://github.com/abhigyan1102/event-seal/blob/main/docs/${reference.file}`}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                {reference.title}
                <span aria-hidden="true">↗</span>
              </span>
              <p>{reference.description}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
