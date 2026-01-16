"use client";

import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { animateCounter } from "@/lib/animations";

const stats = [
  { value: 50, suffix: "K+", label: "calls analyzed" },
  { value: 200, suffix: "+", label: "sales teams" },
  { value: 4.9, suffix: "/5", label: "rating", isDecimal: true },
];

export function SocialProofBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const statRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(
    () => {
      if (!barRef.current) return;

      // Fade in the bar
      gsap.fromTo(
        barRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.6,
          scrollTrigger: {
            trigger: barRef.current,
            start: "top 90%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Counter animations for each stat
      statRefs.current.forEach((ref, i) => {
        if (!ref) return;

        const stat = stats[i];
        const endValue = stat.value;

        gsap.fromTo(
          ref.parentElement,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            delay: i * 0.1,
            scrollTrigger: {
              trigger: barRef.current,
              start: "top 90%",
              toggleActions: "play none none reverse",
            },
            onComplete: () => {
              if (stat.isDecimal) {
                // For decimal values like 4.9
                const obj = { value: 0 };
                gsap.to(obj, {
                  value: endValue,
                  duration: 1.5,
                  ease: "power2.out",
                  onUpdate: () => {
                    ref.textContent = obj.value.toFixed(1);
                  },
                });
              } else {
                animateCounter(ref, endValue, {
                  duration: 1.5,
                  suffix: "",
                });
              }
            },
          }
        );
      });
    },
    { scope: barRef }
  );

  return (
    <section
      ref={barRef}
      className="h-20 border-y border-border bg-secondary/50"
    >
      <div className="h-full max-w-4xl mx-auto px-6 flex items-center justify-center">
        <div className="flex items-center gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-8 md:gap-12">
              <div className="text-center">
                <div className="text-lg md:text-xl font-bold text-foreground tabular-nums">
                  <span
                    ref={(el) => {
                      statRefs.current[i] = el;
                    }}
                  >
                    0
                  </span>
                  <span>{stat.suffix}</span>
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
              {i < stats.length - 1 && (
                <span className="text-muted-foreground/30 text-2xl font-light">
                  ·
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
