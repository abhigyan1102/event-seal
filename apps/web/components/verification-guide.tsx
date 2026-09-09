"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const outcomes = [
  {
    title: "Verified",
    body: "The expected event passed its checks. Apply your own authorization and replay policy before acting.",
  },
  {
    title: "Rejected",
    body: "Available evidence disproved the requested event. Stop the protected action and use the reason code to investigate.",
  },
  {
    title: "Indeterminate",
    body: "The evidence was not strong enough to decide. Do not act. Retry or escalate according to the reason code.",
  },
] as const;

export function VerificationGuide() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".verify-guide__image",
          { scale: 0.8 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top bottom",
              end: "top 50%",
              scrub: true,
            },
          },
        );
        gsap.to(".verify-guide__image", {
          opacity: 0.2,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "bottom 30%",
            end: "bottom top",
            scrub: true,
          },
        });
        // A shallow stack settles into separate rows; no text or controls overlap.
        gsap.from(".verify-guide__outcome", {
          y: (index) => 18 * index,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "top 55%",
            scrub: true,
          },
        });
      });
      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <section
      className="verify-guide"
      ref={root}
      aria-labelledby="verify-guide-title"
    >
      <div className="verify-guide__intro">
        <h2 id="verify-guide-title">
          Know when
          <br />
          to act.
          <span className="verify-guide__image" aria-hidden="true" />
        </h2>
        <p>Verification checks evidence. Your application owns the decision.</p>
        <Link href="/docs#decide">
          Read the integration guide <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div
        className="verify-guide__outcomes"
        role="region"
        aria-label="Understanding verdicts"
      >
        {outcomes.map((outcome, index) => (
          <div
            className={`verify-guide__outcome verify-guide__outcome--${outcome.title.toLowerCase()}`}
            key={outcome.title}
          >
            <button
              type="button"
              aria-expanded={active === index}
              aria-controls={`guide-outcome-${index}`}
              onClick={() => setActive(active === index ? -1 : index)}
            >
              <span>{outcome.title}</span>
              <span aria-hidden="true">{active === index ? "−" : "+"}</span>
            </button>
            <p id={`guide-outcome-${index}`} hidden={active !== index}>
              {outcome.body}
            </p>
          </div>
        ))}
        <div className="verify-guide__pager">
          <button
            type="button"
            aria-label="Previous verdict explanation"
            onClick={() => setActive((active + 2) % 3)}
          >
            ← Previous
          </button>
          <button
            type="button"
            aria-label="Next verdict explanation"
            onClick={() => setActive((active + 1) % 3)}
          >
            Next →
          </button>
        </div>
        <p className="verify-guide__announcement" role="status">
          {active >= 0
            ? `${outcomes[active]?.title}: ${outcomes[active]?.body}`
            : "Explanations collapsed."}
        </p>
      </div>
    </section>
  );
}
