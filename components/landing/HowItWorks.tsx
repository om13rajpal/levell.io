"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { Link2, Sparkles, Target, ArrowDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const steps = [
  {
    number: "01",
    title: "Connect Your Tools",
    description:
      "Link Fireflies.ai and HubSpot in just two clicks. Your calls start syncing automatically - no manual work required.",
    icon: Link2,
    gradient: "from-blue-500 to-cyan-500",
    visual: (
      <div className="relative flex items-center justify-center gap-4 py-4">
        <div className="relative group/logo">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl group-hover/logo:blur-2xl transition-all" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-lg">
            <Image
              src="https://cdn.brandfetch.io/idVVPG1ke4/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX"
              alt="Fireflies"
              width={32}
              height={32}
              className="w-8 h-8"
              unoptimized
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
          <div className="w-8 h-0.5 bg-gradient-to-r from-primary to-primary/20" />
          <div className="w-3 h-3 rounded-full bg-[#FF7A59] animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>

        <div className="relative group/logo">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-2xl blur-xl group-hover/logo:blur-2xl transition-all" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7A59] to-[#FF5C35] flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.164 7.93a3.162 3.162 0 0 0-1.582-.425 3.182 3.182 0 0 0-3.181 3.181c0 .552.141 1.072.39 1.525l-2.308 2.308a3.161 3.161 0 0 0-1.525-.39 3.182 3.182 0 0 0-3.181 3.181 3.182 3.182 0 0 0 3.181 3.181 3.182 3.182 0 0 0 3.181-3.181c0-.552-.14-1.072-.39-1.524l2.308-2.308c.454.249.973.39 1.525.39a3.182 3.182 0 0 0 3.181-3.181 3.18 3.18 0 0 0-1.599-2.757zM9.958 18.49a1.59 1.59 0 0 1-1.59-1.59 1.59 1.59 0 0 1 1.59-1.59 1.59 1.59 0 0 1 1.59 1.59 1.59 1.59 0 0 1-1.59 1.59zm6.623-6.623a1.59 1.59 0 0 1-1.59-1.59 1.59 1.59 0 0 1 1.59-1.59 1.59 1.59 0 0 1 1.59 1.59 1.59 1.59 0 0 1-1.59 1.59z"/>
            </svg>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    title: "AI Analyzes Every Call",
    description:
      "Our AI scores every call instantly. Talk ratio, sentiment, objections, and next steps - all captured and organized.",
    icon: Sparkles,
    gradient: "from-primary to-rose-500",
    visual: (
      <div className="space-y-3 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20">Talk Ratio</span>
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-[45%] bg-gradient-to-r from-green-500 to-emerald-400 rounded-full animate-pulse-slow" />
          </div>
          <span className="text-xs font-semibold text-green-500 w-10 text-right">45%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20">Sentiment</span>
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-[82%] bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse-slow" style={{ animationDelay: "0.3s" }} />
          </div>
          <span className="text-xs font-semibold text-blue-500 w-10 text-right">82%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20">Engagement</span>
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-[91%] bg-gradient-to-r from-primary to-rose-400 rounded-full animate-pulse-slow" style={{ animationDelay: "0.6s" }} />
          </div>
          <span className="text-xs font-semibold text-primary w-10 text-right">91%</span>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    title: "Coach with Precision",
    description:
      "Get actionable insights. Know exactly who needs help, why they're struggling, and how to improve their performance.",
    icon: Target,
    gradient: "from-green-500 to-emerald-500",
    visual: (
      <div className="py-4">
        <div className="relative p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 overflow-hidden">
          <div className="absolute top-2 right-2">
            <Zap className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            AI Coaching Insight
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            Mike's discovery questions dropped <span className="font-semibold text-primary">40%</span> this week.
            Recommend scheduling a 1:1 to review qualifying framework.
          </p>
        </div>
      </div>
    ),
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Header animation
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      headerTl
        .fromTo(
          ".how-badge",
          { opacity: 0, y: 20, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.7)" }
        )
        .fromTo(
          ".how-title",
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
          "-=0.2"
        )
        .fromTo(
          ".how-subtitle",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
          "-=0.3"
        );

      // Steps animation with stagger
      gsap.fromTo(
        ".step-card",
        { opacity: 0, x: -50, rotateY: -10 },
        {
          opacity: 1,
          x: 0,
          rotateY: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".steps-container",
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Animate the vertical line
      gsap.fromTo(
        ".vertical-line",
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: 1.2,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".steps-container",
            start: "top 70%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Animate step numbers
      gsap.fromTo(
        ".step-number",
        { scale: 0, rotate: -180 },
        {
          scale: 1,
          rotate: 0,
          duration: 0.6,
          stagger: 0.2,
          ease: "back.out(2)",
          scrollTrigger: {
            trigger: ".steps-container",
            start: "top 75%",
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
      id="how-it-works"
      className="relative py-24 md:py-32 px-6 bg-background overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-l from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-gradient-to-r from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="how-badge inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              How It Works
            </span>
          </div>
          <h2 className="how-title text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
            Three steps to{" "}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-primary via-red-500 to-rose-500 bg-clip-text text-transparent">
                better coaching
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-primary via-red-500 to-rose-500 rounded-full opacity-40" />
            </span>
          </h2>
          <p className="how-subtitle text-lg text-muted-foreground max-w-2xl mx-auto">
            Set up in minutes. See results in your next team meeting.
          </p>
        </div>

        {/* Steps - Vertical Timeline Layout */}
        <div className="steps-container relative max-w-4xl mx-auto">
          {/* Vertical connecting line */}
          <div className="vertical-line absolute left-[28px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20 origin-top hidden md:block" />

          {/* Step Cards */}
          <div className="space-y-12 md:space-y-0">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={cn(
                  "step-card relative",
                  "md:grid md:grid-cols-2 md:gap-12 md:items-center",
                  index % 2 === 1 && "md:direction-rtl"
                )}
                style={{ perspective: "1000px" }}
              >
                {/* Step Number - Center on desktop */}
                <div className="step-number absolute left-0 md:left-1/2 md:-translate-x-1/2 top-0 z-10">
                  <div className="relative">
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center",
                      "bg-gradient-to-br shadow-lg",
                      step.gradient
                    )}>
                      <span className="text-lg font-bold text-white">{step.number}</span>
                    </div>
                    <div className={cn(
                      "absolute inset-0 rounded-full blur-xl opacity-50",
                      `bg-gradient-to-br ${step.gradient}`
                    )} />
                  </div>
                </div>

                {/* Content Card */}
                <div className={cn(
                  "ml-20 md:ml-0",
                  index % 2 === 0 ? "md:pr-8" : "md:pl-8 md:col-start-2"
                )}>
                  <div className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {/* Icon */}
                    <div className={cn(
                      "relative w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                      "bg-gradient-to-br shadow-lg",
                      step.gradient
                    )}>
                      <step.icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Text */}
                    <h3 className="relative text-xl font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="relative text-sm text-muted-foreground leading-relaxed mb-4">
                      {step.description}
                    </p>

                    {/* Visual */}
                    <div className="relative">{step.visual}</div>
                  </div>
                </div>

                {/* Arrow indicator for mobile */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center my-4 md:hidden">
                    <ArrowDown className="w-5 h-5 text-primary/50 animate-bounce" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
