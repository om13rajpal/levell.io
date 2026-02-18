"use client";

import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { PhoneCall, Brain, Trophy, TrendingUp } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const panels = [
  {
    icon: PhoneCall,
    number: "01",
    title: "Your team makes 100+ calls a week",
    subtitle: "You hear maybe 5.",
    description:
      "Sales conversations happen every day. Without analysis, valuable insights slip through the cracks.",
    highlight: "95% of coaching opportunities are missed",
    stat: "300+",
    statLabel: "calls go unreviewed",
  },
  {
    icon: Brain,
    number: "02",
    title: "AI listens to every single one",
    subtitle: "So you don't have to.",
    description:
      "Our AI analyzes tone, patterns, and techniques. It identifies what works and flags what doesn't.",
    highlight: "Every call scored, summarized, and searchable",
    stat: "87%",
    statLabel: "detection accuracy",
  },
  {
    icon: Trophy,
    number: "03",
    title: "Your team levels up",
    subtitle: "Week over week.",
    description:
      "Data-driven coaching transforms good reps into great ones. Watch your close rates climb.",
    highlight: "Teams see 23% improvement in 90 days",
    stat: "+23%",
    statLabel: "avg improvement",
  },
];

export function HorizontalScrollSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current || !wrapperRef.current) return;

      const panels = gsap.utils.toArray<HTMLElement>(".hs-panel");
      const totalWidth = wrapperRef.current.scrollWidth - window.innerWidth;

      // Main horizontal scroll
      const scrollTween = gsap.to(wrapperRef.current, {
        x: -totalWidth,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true,
          scrub: 1,
          start: "top top",
          end: () => `+=${totalWidth}`,
          anticipatePin: 1,
        },
      });

      // Animate each panel's content
      panels.forEach((panel, i) => {
        const content = panel.querySelectorAll(".hs-content");
        const stat = panel.querySelector(".hs-stat");

        gsap.fromTo(
          content,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.8,
            scrollTrigger: {
              trigger: panel,
              containerAnimation: scrollTween,
              start: "left 70%",
              end: "left 30%",
              scrub: true,
            },
          }
        );

        // Counter animation for stat
        if (stat) {
          const statValue = stat.getAttribute("data-value") || "0";
          const numericValue = parseInt(statValue.replace(/[^0-9]/g, ""));
          const prefix = statValue.includes("+") ? "+" : "";
          const suffix = statValue.includes("%") ? "%" : "";

          gsap.fromTo(
            stat,
            { scale: 0.5, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.5,
              scrollTrigger: {
                trigger: panel,
                containerAnimation: scrollTween,
                start: "left 60%",
                toggleActions: "play none none reverse",
              },
            }
          );
        }
      });
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="bg-indigo-950 overflow-hidden">
      <div ref={wrapperRef} className="flex h-screen">
        {panels.map((panel, index) => (
          <div
            key={index}
            className="hs-panel flex-shrink-0 w-screen h-screen flex items-center justify-center px-6 md:px-16"
          >
            <div className="max-w-3xl flex flex-col md:flex-row items-center gap-8 md:gap-16">
              {/* Content */}
              <div className="flex-1">
                <div className="hs-content flex items-center gap-4 mb-4 md:mb-6">
                  <panel.icon className="w-10 h-10 md:w-12 md:h-12 text-indigo-400" />
                  <span className="text-4xl md:text-6xl font-bold text-indigo-400/30">
                    {panel.number}
                  </span>
                </div>

                <h2 className="hs-content text-3xl md:text-5xl font-bold text-white mb-2">
                  {panel.title}
                </h2>

                <p className="hs-content text-xl md:text-2xl text-indigo-200 mb-4 md:mb-6">
                  {panel.subtitle}
                </p>

                <p className="hs-content text-base md:text-lg text-indigo-300/80 mb-6 md:mb-8">
                  {panel.description}
                </p>

                <div className="hs-content inline-block px-5 py-2.5 md:px-6 md:py-3 rounded-full bg-indigo-500/20 border border-indigo-400/30">
                  <span className="text-sm md:text-base font-semibold text-indigo-300">
                    {panel.highlight}
                  </span>
                </div>
              </div>

              {/* Stat */}
              <div className="hs-content flex-shrink-0">
                <div className="relative w-36 h-36 md:w-48 md:h-48 rounded-full bg-indigo-500/10 border-2 border-indigo-400/30 flex flex-col items-center justify-center">
                  <span
                    className="hs-stat text-4xl md:text-5xl font-bold text-white"
                    data-value={panel.stat}
                  >
                    {panel.stat}
                  </span>
                  <span className="text-xs md:text-sm text-indigo-300 text-center mt-1">
                    {panel.statLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
