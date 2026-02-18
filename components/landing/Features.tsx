"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import {
  BarChart3,
  AlertTriangle,
  CheckSquare,
  ArrowRightLeft,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { ScoreCircle } from "./ScoreCircle";
import { AlertList } from "./AlertList";
import { ChatMockup } from "./ChatMockup";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
  size?: "normal" | "large";
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  children,
  className,
  size = "normal",
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "feature-card group relative p-6 bg-card rounded-2xl border border-border/50",
        "transition-all duration-500 hover:border-primary/40",
        "hover:shadow-[0_0_40px_-10px] hover:shadow-primary/20",
        "hover:-translate-y-2",
        size === "large" && "lg:col-span-2",
        className
      )}
    >
      {/* Glow effect overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Border glow */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-sm" />

      {/* Icon with enhanced styling */}
      <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300">
        <Icon className="w-6 h-6 text-primary" />
        <div className="absolute inset-0 rounded-xl bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Title with hover effect */}
      <h3 className="relative text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
        {title}
      </h3>

      {/* Description */}
      <p className="relative text-sm text-muted-foreground leading-relaxed mb-4">
        {description}
      </p>

      {/* Live Component */}
      {children && <div className="relative mt-auto">{children}</div>}
    </div>
  );
}

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Animate floating background orbs
      gsap.to(".features-orb", {
        y: "random(-20, 20)",
        x: "random(-15, 15)",
        duration: "random(4, 6)",
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: {
          each: 0.3,
          from: "random",
        },
      });

      // Header animation with more flair
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      headerTl
        .fromTo(
          ".features-badge",
          { opacity: 0, y: 20, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.7)" }
        )
        .fromTo(
          ".features-title",
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
          "-=0.2"
        )
        .fromTo(
          ".features-desc",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
          "-=0.3"
        );

      // Cards stagger animation with scale and rotation
      gsap.fromTo(
        ".feature-card",
        { opacity: 0, y: 50, scale: 0.95, rotateX: 5 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.7,
          stagger: 0.12,
          ease: "back.out(1.2)",
          scrollTrigger: {
            trigger: ".features-grid",
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
      id="features"
      className="relative py-24 md:py-32 px-6 bg-secondary/30 overflow-hidden"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="features-orb absolute top-20 left-[10%] w-[400px] h-[400px] bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="features-orb absolute bottom-20 right-[10%] w-[350px] h-[350px] bg-gradient-to-tl from-primary/8 to-transparent rounded-full blur-3xl" />
        <div className="features-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="features-badge inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              What You Get
            </span>
          </div>
          <h2 className="features-title text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
            Everything you need to{" "}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-primary via-red-500 to-rose-500 bg-clip-text text-transparent">
                coach smarter
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-red-500 to-rose-500 rounded-full opacity-50" />
            </span>
          </h2>
          <p className="features-desc text-lg text-muted-foreground max-w-2xl mx-auto">
            From call scoring to AI insights, we give you the tools to turn
            every conversation into a growth opportunity.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ perspective: "1000px" }}>
          {/* Call Scoring - Large */}
          <FeatureCard
            icon={BarChart3}
            title="Call Scoring"
            description="Every call rated 0-100. Talk ratio, sentiment, objection handling - all analyzed automatically."
            size="large"
          >
            <div className="flex items-center justify-center pt-4">
              <ScoreCircle score={87} size={100} loop={true} />
            </div>
          </FeatureCard>

          {/* Risk Alerts - Large */}
          <FeatureCard
            icon={AlertTriangle}
            title="Risk Alerts"
            description="Calls that need immediate attention bubble to the top. Never miss a coaching moment."
            size="large"
          >
            <AlertList animate={true} loop={true} />
          </FeatureCard>

          {/* Action Items */}
          <FeatureCard
            icon={CheckSquare}
            title="Action Items"
            description="AI extracts follow-ups from every call. Tasks auto-assigned."
          >
            <div className="space-y-2 pt-2">
              {[
                { text: "Send proposal to Sarah", done: true },
                { text: "Schedule demo with Acme", done: false },
                { text: "Follow up on pricing", done: false },
              ].map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 text-xs group/item",
                    item.done && "line-through opacity-50"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all duration-200",
                      item.done
                        ? "bg-primary border-primary"
                        : "border-border group-hover/item:border-primary/50"
                    )}
                  >
                    {item.done && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </FeatureCard>

          {/* HubSpot Sync */}
          <FeatureCard
            icon={ArrowRightLeft}
            title="HubSpot Sync"
            description="One-click task creation. All data synced automatically."
          >
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ff7a59]/10 text-[#ff7a59] text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-[#ff7a59] animate-pulse" />
                Synced
              </div>
              <span className="text-[10px] text-muted-foreground">
                Last: 2 min ago
              </span>
            </div>
          </FeatureCard>

          {/* AI Agent - Spans 2 cols */}
          <FeatureCard
            icon={MessageSquare}
            title="AI Agent"
            description="Ask anything about your calls. Get instant insights and recommendations."
            size="large"
          >
            <div className="pt-2 border-t border-border/50 mt-4">
              <ChatMockup animate={true} loop={true} />
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
