"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      gsap.fromTo(
        ".cta-content",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 px-6 bg-gradient-to-b from-background to-secondary/30"
    >
      <div className="max-w-3xl mx-auto text-center">
        {/* Headline */}
        <h2 className="cta-content text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
          Ready to coach smarter?
        </h2>

        {/* Subtext */}
        <p className="cta-content text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
          Start analyzing your sales calls in minutes. No credit card required.
        </p>

        {/* CTA Button */}
        <div className="cta-content">
          <button
            onClick={() => (window.location.href = "/login")}
            className="inline-flex items-center gap-2 h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Trust indicators */}
        <p className="cta-content mt-6 text-sm text-muted-foreground">
          14-day free trial · No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  );
}
