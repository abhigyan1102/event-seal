"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const concepts = [
  {
    id: "verdicts",
    title: "Verdicts",
    body: "Verified means the requested identity passed. Rejected means available evidence disproved it. Indeterminate means the evidence was not strong enough.",
    code: '"verified" | "rejected" | "indeterminate"',
  },
  {
    id: "receipts",
    title: "Public receipts",
    body: "A deterministic receipt ID is issued only when the verifier has a complete identity and immutable event evidence. Share it without exposing account data.",
    code: "/receipts/es_<sha256>",
  },
  {
    id: "boundary",
    title: "Security boundary",
    body: "Browser requests use the same-origin API. The server attaches the internal credential before calling protected verification functions.",
    code: "browser -> /api/verify -> protected function",
  },
] as const;

type ConceptId = (typeof concepts)[number]["id"];

export function DeveloperDocs() {
  const root = useRef<HTMLElement>(null);
  const [activeConcept, setActiveConcept] = useState<ConceptId>("verdicts");

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        "(min-width: 981px) and (prefers-reduced-motion: no-preference)",
        () => {
          const intro = root.current?.querySelector<HTMLElement>(
            ".docs-narrative__intro",
          );
          const panels = gsap.utils.toArray<HTMLElement>(
            ".docs-narrative-panel",
          );

          if (intro) {
            ScrollTrigger.create({
              trigger: ".docs-narrative",
              start: "top 88px",
              end: "bottom bottom-=120",
              pin: intro,
              pinSpacing: false,
            });
          }

          panels.forEach((panel, index) => {
            gsap.fromTo(
              panel,
              { y: 96, scale: 0.94 },
              {
                y: 0,
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: panel,
                  start: "top 92%",
                  end: "top 48%",
                  scrub: 0.55,
                },
                delay: index * 0.04,
              },
            );
          });
        },
      );

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-docs-intro]", {
          autoAlpha: 0,
          y: 30,
          duration: 0.82,
          ease: "power3.out",
          stagger: 0.08,
        });

        gsap.fromTo(
          ".docs-hero__ledger",
          { opacity: 0.32, scale: 0.84 },
          {
            opacity: 0.92,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".docs-hero",
              start: "top top",
              end: "bottom 26%",
              scrub: 0.7,
            },
          },
        );
      });

      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <main className="developer-docs" ref={root}>
      <section className="docs-hero" id="overview" aria-labelledby="docs-title">
        <div className="docs-hero__copy">
          <h1
            id="docs-title"
            aria-label="Build on verified Solana events."
            data-docs-intro
          >
            <span aria-hidden="true">Build on verified</span>
            <span aria-hidden="true">
              Solana <i className="docs-hero__inline-ledger" /> events.
            </span>
          </h1>
          <p data-docs-intro>
            Inspect finalized evidence, verify the identity your application
            expects, and decide from an explicit verdict.
          </p>
          <div className="docs-hero__actions" data-docs-intro>
            <a className="docs-button docs-button--primary" href="#quickstart">
              Start locally <span aria-hidden="true">↓</span>
            </a>
            <Link className="docs-button docs-button--secondary" href="/verify">
              Open verifier <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="docs-hero__ledger" aria-hidden="true" />
      </section>

      <section
        className="docs-quickstart"
        id="quickstart"
        aria-labelledby="quickstart-title"
      >
        <div className="docs-section-heading">
          <h2 id="quickstart-title">Quickstart</h2>
          <p>
            Run the current repository, then keep inspection and verification as
            separate decisions.
          </p>
        </div>

        <div className="docs-quickstart-grid">
          <article className="docs-local-card">
            <div>
              <h3>Run locally</h3>
              <p>
                The SDK currently builds from this monorepo workspace. The web
                app starts on port 3000.
              </p>
            </div>
            <pre tabIndex={0} aria-label="Local setup commands">
              <code>{`git clone https://github.com/abhigyan1102/event-seal.git
cd event-seal
npm install
npm run dev

# open http://localhost:3000`}</code>
            </pre>
          </article>

          <article className="docs-quick-card docs-quick-card--inspect">
            <span className="docs-quick-mark" aria-hidden="true" />
            <div>
              <h3>Inspect</h3>
              <p>
                Discover untrusted log candidates from finalized transaction
                evidence. Inspection has no verdict, receipt, or database write.
              </p>
              <code className="docs-route-label">POST /api/inspect</code>
            </div>
          </article>

          <article className="docs-quick-card docs-quick-card--verify">
            <span className="docs-quick-mark" aria-hidden="true" />
            <div>
              <h3>Verify</h3>
              <p>
                Supply the program and event discriminator from a trusted IDL or
                deployment record. Never promote discovered bytes into trust.
              </p>
              <code className="docs-route-label">POST /api/verify</code>
            </div>
          </article>
        </div>

        <div className="docs-vocabulary" aria-label="Verification vocabulary">
          <div className="docs-vocabulary__track">
            {[0, 1].flatMap((group) =>
              [
                "Finality",
                "Execution",
                "Program identity",
                "Event identity",
                "Deterministic receipt",
              ].map((item) => (
                <span key={`${group}-${item}`} aria-hidden={group === 1}>
                  {item}
                  <i aria-hidden="true" />
                </span>
              )),
            )}
          </div>
        </div>
      </section>

      <section
        className="docs-narrative"
        id="workflow"
        aria-labelledby="workflow-title"
      >
        <div className="docs-narrative__intro">
          <h2 id="workflow-title">Inspect first. Verify what you trust.</h2>
          <p>
            EventSeal separates discovery from authorization. Your application
            supplies the trusted identity and decides what each verdict permits.
          </p>
          <nav aria-label="Documentation sections">
            <a href="#inspect">Inspect</a>
            <a href="#verify">Verify</a>
            <a href="#decide">Decide</a>
            <a href="#concepts">Reference</a>
          </nav>
        </div>

        <div className="docs-narrative__panels">
          <article className="docs-narrative-panel" id="inspect">
            <div className="docs-narrative-panel__copy">
              <span aria-hidden="true">1</span>
              <h3>Inspect</h3>
              <p>
                Ask what evidence is available for a signature and cluster.
                Candidate bytes remain untrusted.
              </p>
              <strong>No verdict. No receipt.</strong>
            </div>
            <pre tabIndex={0} aria-label="Inspect transaction example">
              <code>{`import { inspectTransaction } from "@eventseal/sdk";

const inspection = await inspectTransaction({
  signature,
  cluster: "devnet",
});

if (inspection.reasonCode === "CANDIDATES_FOUND") {
  // Confirm identity from your trusted source.
}`}</code>
            </pre>
          </article>

          <article className="docs-narrative-panel" id="verify">
            <div className="docs-narrative-panel__copy">
              <span aria-hidden="true">2</span>
              <h3>Verify</h3>
              <p>
                Check one finalized event against the expected program and
                eight-byte Anchor discriminator.
              </p>
              <strong>Trusted identity goes in.</strong>
            </div>
            <pre tabIndex={0} aria-label="Verify event example">
              <code>{`import { verifyEvent } from "@eventseal/sdk";

const result = await verifyEvent({
  signature,
  cluster: "devnet",
  expectedProgramId,
  event: {
    format: "anchor-log",
    discriminator: "3f17c7d4d6763a2b",
  },
  commitment: "finalized",
});`}</code>
            </pre>
          </article>

          <article className="docs-narrative-panel" id="decide">
            <div className="docs-narrative-panel__copy">
              <span aria-hidden="true">3</span>
              <h3>Decide</h3>
              <p>
                Branch on the verdict. Only verified evidence should cross an
                authorization boundary.
              </p>
              <strong>Missing evidence never passes.</strong>
            </div>
            <pre tabIndex={0} aria-label="Handle verification verdict example">
              <code>{`switch (result.verdict) {
  case "verified":
    await performProtectedAction(result.receiptId);
    break;
  case "rejected":
  case "indeterminate":
    return;
}`}</code>
            </pre>
            <div className="docs-verdicts" aria-label="Verdict meanings">
              <p>
                <b>Verified</b>
                <span>The requested identity passed.</span>
              </p>
              <p>
                <b>Rejected</b>
                <span>Available evidence disproved it.</span>
              </p>
              <p>
                <b>Indeterminate</b>
                <span>The evidence was not sufficient.</span>
              </p>
            </div>
          </article>
        </div>
      </section>

      <section
        className="docs-concepts"
        id="concepts"
        aria-labelledby="concepts-title"
      >
        <div className="docs-section-heading docs-section-heading--concepts">
          <h2 id="concepts-title">Core concepts at a glance.</h2>
          <p>
            These boundaries keep unavailable or ambiguous evidence from being
            presented as proof.
          </p>
        </div>

        <div className="docs-concept-accordion">
          {concepts.map((concept, index) => {
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
                  onClick={() => setActiveConcept(concept.id)}
                >
                  <span aria-hidden="true">0{index + 1}</span>
                  <strong>{concept.title}</strong>
                </button>
                <div
                  className="docs-concept__content"
                  id={`concept-${concept.id}`}
                  hidden={!active}
                >
                  <p>{concept.body}</p>
                  <code>{concept.code}</code>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="docs-reference" aria-labelledby="reference-title">
        <div className="docs-reference__copy">
          <h2 id="reference-title">Keep the trust boundary explicit.</h2>
          <p>
            Use the verifier for proof, then apply your own business rules
            before your backend acts.
          </p>
          <div className="docs-reference__actions">
            <Link className="docs-button docs-button--primary" href="/verify">
              Verify a transaction <span aria-hidden="true">→</span>
            </Link>
            <a
              className="docs-button docs-button--dark"
              href="https://github.com/abhigyan1102/event-seal/blob/main/docs/api-reference.md"
              target="_blank"
              rel="noreferrer"
            >
              Read the API reference <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="docs-reference__links">
          <a
            href="https://github.com/abhigyan1102/event-seal/blob/main/docs/verification-invariants.md"
            target="_blank"
            rel="noreferrer"
          >
            Verification invariants <span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://github.com/abhigyan1102/event-seal/blob/main/docs/transaction-inspection.md"
            target="_blank"
            rel="noreferrer"
          >
            Transaction inspection <span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://github.com/abhigyan1102/event-seal/blob/main/docs/threat-model.md"
            target="_blank"
            rel="noreferrer"
          >
            Threat model <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="docs-reference__ledger" aria-hidden="true" />
      </section>
    </main>
  );
}
