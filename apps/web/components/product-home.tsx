"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const outcomes = [
  {
    id: "verified",
    label: "Verified",
    title: "The evidence matches.",
    body: "Finality, execution, program identity, and event identity all pass the requested checks.",
  },
  {
    id: "rejected",
    label: "Rejected",
    title: "The evidence disproves the request.",
    body: "A failed transaction or mismatched event identity produces an explicit rejection instead of a false positive.",
  },
  {
    id: "indeterminate",
    label: "Inconclusive",
    title: "The evidence is not strong enough.",
    body: "Missing or unreliable RPC evidence remains inconclusive and is never presented as verified.",
  },
] as const;

type OutcomeId = (typeof outcomes)[number]["id"];

export function ProductHome() {
  const root = useRef<HTMLElement>(null);
  const [activeOutcome, setActiveOutcome] = useState<OutcomeId>("verified");

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-home-intro]:not(.home-actions)", {
          autoAlpha: 0,
          y: 32,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.09,
        });

        gsap.from(".home-actions", {
          y: 24,
          duration: 0.82,
          ease: "power3.out",
        });

        gsap.utils
          .toArray<HTMLElement>("[data-home-ledger]")
          .forEach((ledger) => {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: ledger,
                  start: "top 92%",
                  end: "bottom 8%",
                  scrub: 0.65,
                },
              })
              .fromTo(
                ledger,
                { opacity: 0.24, scale: 0.82 },
                { opacity: 1, scale: 1, duration: 0.62, ease: "none" },
              )
              .to(ledger, {
                opacity: 0.32,
                scale: 1.04,
                duration: 0.38,
                ease: "none",
              });
          });

        gsap.utils
          .toArray<HTMLElement>("[data-home-card]")
          .forEach((card, index) => {
            gsap.fromTo(
              card,
              { y: 88, scale: 0.94 },
              {
                y: 0,
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: card,
                  start: "top 92%",
                  end: "top 42%",
                  scrub: 0.55,
                },
                delay: index * 0.03,
              },
            );
          });
      });

      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <main className="product-home" ref={root}>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <h1
            className="home-hero__title"
            id="home-title"
            aria-label="Verify Solana events before your backend acts."
            data-home-intro
          >
            <span className="home-hero__title-line" aria-hidden="true">
              Verify Solana
              <span className="home-hero__inline-ledger" />
            </span>
            <span className="home-hero__title-line" aria-hidden="true">
              events before your
              <span className="home-hero__mobile-break" /> backend acts.
            </span>
          </h1>
          <p className="home-hero__lede" data-home-intro>
            EventSeal checks finalized transaction evidence against the program
            and event identity your application expects, then issues a shareable
            receipt.
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
        <div
          className="home-hero__ledger"
          aria-hidden="true"
          data-home-ledger
        />
      </section>

      <section className="home-proof" aria-labelledby="home-proof-title">
        <div className="home-section-heading">
          <h2 id="home-proof-title">
            A receipt is only as strong as the evidence behind it.
          </h2>
          <p>
            EventSeal reports what the finalized transaction proves. When the
            evidence is incomplete, it fails closed.
          </p>
        </div>

        <div className="home-bento">
          <article className="home-bento__primary">
            <div>
              <h3>Verify what the chain can prove—nothing outside it.</h3>
              <p>
                Every decision is bound to a transaction, a Solana cluster, and
                the trusted event identity supplied by your application.
              </p>
            </div>
            <div
              className="home-bento__ledger"
              aria-hidden="true"
              data-home-ledger
            />
          </article>

          <article className="home-bento__support home-bento__support--finality">
            <div className="home-proof-mark" aria-hidden="true">
              <span />
            </div>
            <div>
              <h3>Finalized first.</h3>
              <p>
                EventSeal checks finalized commitment and successful execution
                before trusting an emitted event.
              </p>
            </div>
          </article>

          <article className="home-bento__support home-bento__support--identity">
            <div className="home-identity-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <h3>Identity, not inference.</h3>
              <p>
                The expected program and event discriminator come from your
                trusted request—not discovered log candidates.
              </p>
            </div>
          </article>
        </div>

        <div className="home-marquee" aria-label="Verification evidence">
          <div className="home-marquee__track">
            {[0, 1].flatMap((group) =>
              [
                "Finality",
                "Execution",
                "Program identity",
                "Event discriminator",
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

      <section className="home-workflow" aria-labelledby="home-workflow-title">
        <div className="home-workflow__intro">
          <div>
            <h2 id="home-workflow-title">
              From signature to defensible receipt.
            </h2>
            <p>
              Inspection discovers candidates. Verification independently checks
              the identity your application trusts. The result becomes a stable
              public record.
            </p>
          </div>

          <div className="home-outcomes">
            {outcomes.map((outcome) => {
              const active = activeOutcome === outcome.id;
              return (
                <div
                  className={`home-outcome${active ? " home-outcome--active" : ""}`}
                  key={outcome.id}
                >
                  <button
                    aria-controls={`outcome-${outcome.id}`}
                    aria-expanded={active}
                    onClick={() => setActiveOutcome(outcome.id)}
                    type="button"
                  >
                    <span>{outcome.label}</span>
                    <span aria-hidden="true">{active ? "−" : "+"}</span>
                  </button>
                  <div
                    className="home-outcome__content"
                    id={`outcome-${outcome.id}`}
                    hidden={!active}
                  >
                    <strong>{outcome.title}</strong>
                    <p>{outcome.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="home-workflow__cards">
          <article className="home-workflow-card" data-home-card>
            <div className="home-workflow-card__topline">
              <span>Transaction input</span>
              <span aria-hidden="true">↗</span>
            </div>
            <h3>Inspect the transaction.</h3>
            <p>
              Start with a signature and network. See invoked programs and
              supported log candidates without treating inspection as proof.
            </p>
            <code>signature · cluster</code>
          </article>

          <article className="home-workflow-card" data-home-card>
            <div className="home-workflow-card__topline">
              <span>Trusted request</span>
              <span aria-hidden="true">↗</span>
            </div>
            <h3>Verify the expected identity.</h3>
            <p>
              Supply the program ID and event discriminator your application
              expects. EventSeal checks them against finalized evidence.
            </p>
            <code>program · discriminator</code>
          </article>

          <article className="home-workflow-card" data-home-card>
            <div className="home-workflow-card__topline">
              <span>Stable output</span>
              <span aria-hidden="true">↗</span>
            </div>
            <h3>Share the receipt.</h3>
            <p>
              Use the deterministic receipt ID or public link to review the
              verdict and the exact identity bound into that decision.
            </p>
            <code>verdict · reason · evidence</code>
          </article>
        </div>
      </section>

      <section className="home-cta" aria-labelledby="home-cta-title">
        <div className="home-cta__copy">
          <h2 id="home-cta-title">
            Know what happened before your backend acts.
          </h2>
          <p>
            Inspect the transaction, verify the event identity, and keep a
            receipt your team can review later.
          </p>
          <div className="home-actions home-actions--dark">
            <Link className="home-button home-button--primary" href="/verify">
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
        <div className="home-cta__ledger" aria-hidden="true" data-home-ledger />
      </section>
    </main>
  );
}
