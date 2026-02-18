"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { DashboardMockup } from "./DashboardMockup";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      // Animate floating orbs - subtle movement
      gsap.to(".floating-orb", {
        y: "random(-8, 8)",
        x: "random(-5, 5)",
        duration: "random(5, 7)",
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: {
          each: 0.8,
          from: "random",
        },
      });

      // Animate grid lines
      gsap.fromTo(
        ".grid-line",
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1,
          opacity: 0.1,
          duration: 1.5,
          stagger: 0.1,
          ease: "power2.out",
        }
      );

      // Text content animation
      tl.fromTo(
        ".hero-badge",
        { opacity: 0, y: 20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5 }
      )
        .fromTo(
          ".hero-title-line",
          { opacity: 0, y: 40, rotateX: -20 },
          { opacity: 1, y: 0, rotateX: 0, duration: 0.7, stagger: 0.1 },
          "-=0.2"
        )
        .fromTo(
          ".hero-subtitle",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5 },
          "-=0.3"
        )
        .fromTo(
          ".hero-cta",
          { opacity: 0, y: 20, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1 },
          "-=0.2"
        )
        .fromTo(
          ".hero-stats",
          { opacity: 0 },
          { opacity: 1, duration: 0.5 },
          "-=0.2"
        );

      // Dashboard animation with spring effect
      gsap.fromTo(
        dashboardRef.current,
        { opacity: 0, y: 80, rotateX: 15, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          scale: 1,
          duration: 1.2,
          ease: "back.out(1.2)",
          delay: 0.5,
        }
      );

      // Continuous float animation for dashboard - subtle
      gsap.to(dashboardRef.current, {
        y: -6,
        duration: 4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // Animate sparkle icons
      gsap.to(".sparkle-icon", {
        rotate: 360,
        duration: 8,
        ease: "none",
        repeat: -1,
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen pt-32 pb-20 px-6 overflow-hidden"
    >
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Primary gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/40 via-background to-background" />

        {/* Gradient mesh orbs */}
        <div className="floating-orb absolute top-20 left-[10%] w-[500px] h-[500px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="floating-orb absolute top-40 right-[5%] w-[400px] h-[400px] bg-gradient-to-bl from-red-400/15 via-orange-400/5 to-transparent rounded-full blur-3xl" />
        <div className="floating-orb absolute bottom-20 left-[20%] w-[350px] h-[350px] bg-gradient-to-tr from-primary/10 via-rose-400/5 to-transparent rounded-full blur-3xl" />
        <div className="floating-orb absolute -bottom-20 right-[15%] w-[450px] h-[450px] bg-gradient-to-tl from-red-500/10 to-transparent rounded-full blur-3xl" />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_70%)]" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="floating-orb absolute w-2 h-2 rounded-full bg-primary/30"
            style={{
              top: `${20 + i * 15}%`,
              left: `${10 + i * 12}%`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="max-w-xl">
            {/* Badge with glow */}
            <div className="hero-badge relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 group">
              <span className="absolute inset-0 rounded-full bg-primary/5 blur-xl group-hover:bg-primary/10 transition-colors" />
              <Sparkles className="sparkle-icon relative w-4 h-4 text-primary" />
              <span className="relative text-sm font-medium text-primary">
                AI-Powered Sales Coaching
              </span>
            </div>

            {/* Headline with gradient text */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6" style={{ perspective: "1000px" }}>
              <span className="hero-title-line block text-foreground">
                Turn every call into a
              </span>
              <span className="hero-title-line block">
                <span className="bg-gradient-to-r from-primary via-red-500 to-rose-500 bg-clip-text text-transparent">
                  coaching opportunity
                </span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="hero-subtitle text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
              Automatically analyze sales calls, identify risks, and give your
              team data-driven feedback that actually improves performance.
            </p>

            {/* CTA Buttons with enhanced styling */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button
                onClick={() => (window.location.href = "/login")}
                className="hero-cta group relative h-14 px-8 bg-primary text-primary-foreground font-semibold rounded-full transition-all hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-1 flex items-center justify-center gap-2 overflow-hidden"
              >
                {/* Shine effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Start Free Trial</span>
                <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="hero-cta group h-14 px-8 bg-transparent hover:bg-muted/50 text-foreground font-semibold rounded-full border border-border hover:border-primary/30 transition-all flex items-center justify-center gap-2">
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Watch Demo
              </button>
            </div>

            {/* Stats with subtle animation */}
            <div className="hero-stats flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">50K+</span>
                <span>calls analyzed</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">200+</span>
                <span>sales teams</span>
              </div>
            </div>
          </div>

          {/* Right Column - Dashboard Preview */}
          <div
            ref={dashboardRef}
            className="relative lg:translate-x-8"
            style={{ perspective: "1200px" }}
          >
            {/* Enhanced glow effects */}
            <div className="absolute -inset-8 bg-gradient-to-r from-primary/30 via-red-500/20 to-rose-500/20 rounded-3xl blur-3xl opacity-50 animate-pulse-slow" />
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl blur-2xl" />

            {/* Dashboard with enhanced shadow */}
            <div className="relative transform-gpu rounded-2xl overflow-hidden shadow-2xl shadow-black/20 ring-1 ring-white/10">
              <DashboardMockup />
            </div>

            {/* Floating accent elements */}
            <div className="floating-orb absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-primary/30 to-transparent rounded-full blur-2xl" />
            <div className="floating-orb absolute -bottom-10 -left-10 w-36 h-36 bg-gradient-to-tr from-red-500/20 to-transparent rounded-full blur-3xl" />

            {/* Decorative elements */}
            <div className="absolute -top-3 left-1/4 w-6 h-6 rounded-full border-2 border-primary/30 animate-float" />
            <div className="absolute -bottom-4 right-1/3 w-4 h-4 rounded-full bg-primary/40 animate-float" style={{ animationDelay: "1s" }} />
          </div>
        </div>
      </div>
    </section>
  );
}
