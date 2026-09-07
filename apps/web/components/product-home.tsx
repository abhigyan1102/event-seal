"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const outcomes = [
  {
    id: "rejected",
    label: "Rejected",
    scenario: "A reward event was emitted. The transaction failed.",
    context:
      "The event exists in the logs. That does not make the transaction successful.",
    title: "No reward should follow.",
    body: "EventSeal rejects failed transactions, even when they emitted the expected event.",
  },
  {
    id: "verified",
    label: "Verified",
    scenario: "The transaction succeeded. The expected event matches.",
    context:
      "Finalized evidence matches the program and event identity supplied by your application.",
    title: "The evidence checks out.",
    body: "EventSeal verifies the expected event. Your application still applies its own authorization and business rules before acting.",
  },
  {
    id: "indeterminate",
    label: "Indeterminate",
    scenario: "A transaction was submitted. The evidence is incomplete.",
    context:
      "The RPC cannot provide reliable, complete evidence for the requested checks.",
    title: "Wait for reliable evidence.",
    body: "Missing or unreliable RPC evidence remains inconclusive and is never presented as verified.",
  },
] as const;

const steps = [
  {
    title: "Inspect the transaction.",
    body: "Start with a signature and network. Inspection discovers candidates; it does not verify them.",
    input: "signature + cluster",
    symbol: "search",
  },
  {
    title: "Verify your expected event.",
    body: "Supply your trusted program ID and event discriminator. EventSeal checks them against finalized evidence, independently of discovered candidates.",
    input: "trusted program + event discriminator",
    symbol: "check",
  },
  {
    title: "Keep a shareable receipt.",
    body: "Review the verdict, reason, and evidence through a public receipt link. Sign in with GitHub to save it to your private history.",
    input: "verdict + reason + evidence",
    symbol: "receipt",
  },
] as const;

function StepSymbol({ kind }: { kind: (typeof steps)[number]["symbol"] }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {kind === "search" ? (
        <>
          <circle cx="20" cy="20" r="13" />
          <path d="m30 30 12 12" />
        </>
      ) : kind === "check" ? (
        <>
          <path d="m24 4 17 8v12c0 10-17 20-17 20S7 34 7 24V12Z" />
          <path d="m16 23 6 6 12-13" />
        </>
      ) : (
        <>
          <path d="M11 4h20l8 8v32H11Z" />
          <path d="M30 4v10h9M18 23h14M18 30h14M18 37h8" />
        </>
      )}
    </svg>
  );
}

export function ProductHome() {
  const root = useRef<HTMLElement>(null);
  const [activeOutcome, setActiveOutcome] = useState(0);
  const [marqueePaused, setMarqueePaused] = useState(false);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        // Keep content visible before hydration and during keyboard navigation.
        gsap.from("[data-home-intro]", {
          y: 20,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
        });
        gsap.utils
          .toArray<HTMLElement>("[data-home-media]")
          .forEach((image) => {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: image,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.6,
                },
              })
              .fromTo(
                image,
                { scale: 0.8 },
                { scale: 1, duration: 0.5, ease: "none" },
              )
              .to(image, { opacity: 0.2, duration: 0.5, ease: "none" });
          });
      });
      media.add(
        "(min-width: 1000px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)",
        () => {
          const cards = gsap.utils.toArray<HTMLElement>("[data-home-step]");
          ScrollTrigger.create({
            trigger: ".home-workflow__intro",
            start: "top 116px",
            endTrigger: ".home-workflow__steps",
            end: "bottom 600px",
            pin: true,
            pinSpacing: false,
            invalidateOnRefresh: true,
          });
          cards.slice(0, -1).forEach((card, index) => {
            ScrollTrigger.create({
              trigger: card,
              start: `top ${116 + index * 36}px`,
              endTrigger: ".home-workflow__steps",
              end: "bottom 560px",
              pin: true,
              pinSpacing: false,
              invalidateOnRefresh: true,
            });
            gsap.to(card, {
              scale: 0.96,
              transformOrigin: "top center",
              scrollTrigger: {
                trigger: cards[index + 1],
                start: "top 75%",
                end: "top 200px",
                scrub: true,
              },
            });
          });
        },
      );
      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <main className="product-home" ref={root}>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <h1 className="home-hero__title" id="home-title" data-home-intro>
            <span>Verify Solana events.</span>
            <span>Then act.</span>
          </h1>
          <p className="home-hero__lede" data-home-intro>
            Check the evidence before a log becomes a payout, a reward, or an
            update.
          </p>
          <div className="home-actions" data-home-intro>
            <Link className="home-button home-button--primary" href="/verify">
              Verify a transaction <span aria-hidden="true">→</span>
            </Link>
            <Link className="home-button home-button--secondary" href="/docs">
              Read the docs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="home-hero__media" aria-hidden="true">
          <img
            src="/home/evidence-gate.webp"
            alt=""
            width={1536}
            height={1024}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <p className="home-hero__footnote">
          Finalized evidence. Explicit outcomes. Shareable receipts.
        </p>
      </section>

      <section
        className="home-proof home-section"
        aria-labelledby="home-proof-title"
      >
        <h2 id="home-proof-title">
          A log is a signal.
          <br />
          Evidence is the deciding factor.
        </h2>
        <div
          className="home-scenarios"
          role="region"
          aria-roledescription="carousel"
          aria-label="Verification outcome examples"
        >
          <div
            className="home-scenarios__slides"
            aria-live="polite"
            aria-atomic="true"
          >
            {outcomes.map((outcome, index) => (
              <div
                key={outcome.id}
                className="home-scenario"
                hidden={activeOutcome !== index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${outcomes.length}: ${outcome.label}`}
              >
                <div className="home-scenario__question">
                  <h3>{outcome.scenario}</h3>
                  <p>{outcome.context}</p>
                </div>
                <div
                  className={`home-scenario__answer home-scenario__answer--${outcome.id}`}
                >
                  <p className="home-scenario__verdict">{outcome.label}</p>
                  <h3>{outcome.title}</h3>
                  <p>{outcome.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="home-scenarios__controls">
            <button
              type="button"
              aria-label="Previous example"
              onClick={() =>
                setActiveOutcome(
                  (activeOutcome + outcomes.length - 1) % outcomes.length,
                )
              }
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next example"
              onClick={() =>
                setActiveOutcome((activeOutcome + 1) % outcomes.length)
              }
            >
              →
            </button>
            <span>
              Example scenario{" "}
              <span className="home-scenarios__count">
                {activeOutcome + 1} / {outcomes.length}
              </span>
            </span>
          </div>
        </div>
        <div className="home-evidence-strip">
          <div
            className="home-marquee"
            role="group"
            aria-label="Evidence checks: finality, execution, program identity, event identity"
          >
            <div
              className={`home-marquee__track${marqueePaused ? " home-marquee__track--paused" : ""}`}
              aria-hidden="true"
            >
              {[0, 1].map((copy) => (
                <span className="home-marquee__group" key={copy}>
                  Finality <i>·</i> Execution <i>·</i> Program identity <i>·</i>{" "}
                  Event identity <i>·</i>
                </span>
              ))}
            </div>
          </div>
          <button
            className="home-marquee__toggle"
            type="button"
            aria-label={
              marqueePaused
                ? "Resume evidence animation"
                : "Pause evidence animation"
            }
            onClick={() => setMarqueePaused(!marqueePaused)}
          >
            {marqueePaused ? "Play" : "Pause"}
          </button>
        </div>
      </section>

      <section
        className="home-workflow home-section"
        aria-labelledby="home-workflow-title"
      >
        <h2 id="home-workflow-title">
          From one signature
          <br />
          to a <span>clear decision.</span>
        </h2>
        <div className="home-workflow__layout">
          <div className="home-workflow__intro">
            <p>
              Discover candidates. Check the identity your application trusts.
              Keep the evidence.
            </p>
            <h3>
              <span
                className="home-workflow__inline-image"
                aria-hidden="true"
              />
              Evidence you can revisit.
            </h3>
          </div>
          <div className="home-workflow__steps">
            {steps.map((step) => (
              <article
                className="home-workflow-card"
                data-home-step
                key={step.symbol}
              >
                <StepSymbol kind={step.symbol} />
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <p className="home-workflow-card__input">{step.input}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta" aria-labelledby="home-cta-title">
        <div className="home-cta__inner">
          <div className="home-cta__copy">
            <h2 id="home-cta-title">
              Before your backend acts,
              <br />
              check the evidence.
            </h2>
            <p>
              Start with a Solana transaction. Leave with a receipt you can
              share.
            </p>
            <div className="home-actions">
              <Link className="home-button home-button--light" href="/verify">
                Open the verifier <span aria-hidden="true">→</span>
              </Link>
              <a
                className="home-button home-button--dark-secondary"
                href="https://github.com/abhigyan1102/event-seal"
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <div className="home-cta__media" aria-hidden="true" data-home-media>
            <img
              src="/home/folded-paper.webp"
              alt=""
              width={1024}
              height={1536}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
