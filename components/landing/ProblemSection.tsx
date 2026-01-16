"use client";

import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { DashboardMockup } from "./DashboardMockup";

export function ProblemSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current || !wrapperRef.current) return;

      const panels = gsap.utils.toArray<HTMLElement>(".problem-panel");
      const wrapper = wrapperRef.current;

      // Calculate scroll distance
      const scrollDistance = wrapper.scrollWidth - window.innerWidth;

      // Create horizontal scroll animation
      const scrollTween = gsap.to(wrapper, {
        x: -scrollDistance,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true,
          scrub: 1,
          start: "top top",
          end: () => `+=${scrollDistance}`,
          anticipatePin: 1,
          snap: {
            snapTo: 1 / (panels.length - 1),
            duration: { min: 0.2, max: 0.5 },
            ease: "power1.inOut",
          },
        },
      });

      // Panel 2 - Line reveals with blur effect
      const panel2Lines = gsap.utils.toArray<HTMLElement>(".panel2-line");
      panel2Lines.forEach((line, i) => {
        gsap.fromTo(
          line,
          {
            opacity: 0,
            filter: "blur(10px)",
            y: 30
          },
          {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: line,
              containerAnimation: scrollTween,
              start: "left 80%",
              end: "left 50%",
              scrub: true,
            },
          }
        );
      });

      // Panel 4 - Dashboard mockup reveal
      gsap.fromTo(
        ".panel4-dashboard",
        {
          opacity: 0,
          scale: 0.8,
          y: 50
        },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".panel4-dashboard",
            containerAnimation: scrollTween,
            start: "left 70%",
            end: "left 30%",
            scrub: true,
          },
        }
      );

      // Floating stats that appear during scroll
      gsap.utils.toArray<HTMLElement>(".floating-stat").forEach((stat, i) => {
        gsap.fromTo(
          stat,
          { opacity: 0, scale: 0.8 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            scrollTrigger: {
              trigger: stat,
              containerAnimation: scrollTween,
              start: "left 80%",
              end: "left 60%",
              scrub: true,
            },
          }
        );
      });

      return () => {
        scrollTween.kill();
      };
    },
    { scope: containerRef }
  );

  return (
    <>
      {/* Desktop: Horizontal Scroll */}
      <section
        ref={containerRef}
        className="hidden md:block relative h-screen bg-neutral-950 overflow-hidden"
      >
        <div
          ref={wrapperRef}
          className="flex h-full gpu-accelerate"
          style={{ width: "400vw" }}
        >
          {/* Panel 1: EVERY CALL IS A SIGNAL */}
          <div className="problem-panel w-screen h-full flex items-center justify-center px-8">
            <h2 className="text-center">
              <span className="block text-[15vw] font-black text-white leading-none tracking-tighter">
                EVERY CALL
              </span>
              <span className="block text-[15vw] font-black text-primary leading-none tracking-tighter">
                IS A SIGNAL.
              </span>
            </h2>
          </div>

          {/* Panel 2: Three lines with blur-in */}
          <div className="problem-panel w-screen h-full flex items-center justify-center px-8 relative">
            <div className="max-w-4xl space-y-6">
              <p className="panel2-line text-2xl md:text-3xl text-white/70 font-normal leading-relaxed">
                The objection that keeps coming up.
              </p>
              <p className="panel2-line text-2xl md:text-3xl text-white/70 font-normal leading-relaxed">
                The rep who&apos;s struggling.
              </p>
              <p className="panel2-line text-2xl md:text-3xl text-primary font-normal leading-relaxed">
                The deal that&apos;s about to die.
              </p>
            </div>

            {/* Floating stat */}
            <div className="floating-stat absolute top-1/4 right-[15%] px-4 py-2 bg-white/10 backdrop-blur rounded-lg">
              <span className="text-2xl font-bold text-white">312</span>
              <span className="text-sm text-white/60 ml-2">calls</span>
            </div>
          </div>

          {/* Panel 3: ARE YOU LISTENING? */}
          <div className="problem-panel w-screen h-full flex items-center justify-center px-8 relative">
            <h2 className="text-center">
              <span className="block text-[18vw] font-black text-white leading-none tracking-tighter">
                ARE YOU
              </span>
              <span className="block text-[18vw] font-black text-white leading-none tracking-tighter">
                LISTENING<span className="text-primary">?</span>
              </span>
            </h2>

            {/* Floating stats */}
            <div className="floating-stat absolute bottom-1/4 left-[10%] px-4 py-2 bg-primary/20 backdrop-blur rounded-lg border border-primary/30">
              <span className="text-lg font-bold text-primary">7</span>
              <span className="text-sm text-white/60 ml-2">flagged</span>
            </div>
            <div className="floating-stat absolute top-1/3 right-[12%] px-4 py-2 bg-white/10 backdrop-blur rounded-lg">
              <span className="text-lg font-bold text-white">23%</span>
              <span className="text-sm text-white/60 ml-2">at risk</span>
            </div>
          </div>

          {/* Panel 4: levvl is. + Dashboard */}
          <div className="problem-panel w-screen h-full flex items-center justify-center px-8">
            <div className="flex items-center gap-12 max-w-7xl w-full">
              {/* Text */}
              <div className="flex-shrink-0">
                <h2 className="text-[10vw] font-black text-primary leading-none tracking-tighter">
                  levvl is.
                </h2>
              </div>

              {/* Dashboard Mockup */}
              <div className="panel4-dashboard flex-1 max-w-3xl">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile: Vertical Stack */}
      <section className="md:hidden bg-neutral-950 py-20 px-6">
        {/* Panel 1 */}
        <div className="min-h-[60vh] flex items-center justify-center mb-20">
          <h2 className="text-center">
            <span className="block text-5xl font-black text-white leading-none tracking-tighter">
              EVERY CALL
            </span>
            <span className="block text-5xl font-black text-primary leading-none tracking-tighter mt-2">
              IS A SIGNAL.
            </span>
          </h2>
        </div>

        {/* Panel 2 */}
        <div className="min-h-[50vh] flex items-center justify-center mb-20">
          <div className="space-y-4">
            <p className="text-xl text-white/70 font-normal leading-relaxed">
              The objection that keeps coming up.
            </p>
            <p className="text-xl text-white/70 font-normal leading-relaxed">
              The rep who&apos;s struggling.
            </p>
            <p className="text-xl text-primary font-normal leading-relaxed">
              The deal that&apos;s about to die.
            </p>
          </div>
        </div>

        {/* Panel 3 */}
        <div className="min-h-[60vh] flex items-center justify-center mb-20">
          <h2 className="text-center">
            <span className="block text-5xl font-black text-white leading-none tracking-tighter">
              ARE YOU
            </span>
            <span className="block text-5xl font-black text-white leading-none tracking-tighter mt-2">
              LISTENING<span className="text-primary">?</span>
            </span>
          </h2>
        </div>

        {/* Panel 4 */}
        <div className="min-h-[80vh] flex flex-col items-center justify-center gap-8">
          <h2 className="text-5xl font-black text-primary leading-none tracking-tighter">
            levvl is.
          </h2>
          <div className="w-full max-w-lg">
            <DashboardMockup />
          </div>
        </div>
      </section>
    </>
  );
}
