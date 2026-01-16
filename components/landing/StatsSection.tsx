"use client";

import { useRef, useEffect, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { Phone, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  {
    value: 50,
    suffix: "K+",
    label: "Calls Analyzed",
    description: "Sales conversations processed",
    icon: Phone,
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-500/10 to-cyan-500/10",
  },
  {
    value: 200,
    suffix: "+",
    label: "Sales Teams",
    description: "Trust levvl for coaching",
    icon: Users,
    gradient: "from-primary to-rose-500",
    bgGradient: "from-primary/10 to-rose-500/10",
  },
  {
    value: 4.9,
    suffix: "/5",
    label: "Average Rating",
    description: "From verified customers",
    icon: Star,
    gradient: "from-amber-500 to-orange-500",
    bgGradient: "from-amber-500/10 to-orange-500/10",
    isDecimal: true,
  },
];

export function StatsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const countRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Animate floating decorations
      gsap.to(".stats-decoration", {
        y: "random(-10, 10)",
        x: "random(-5, 5)",
        rotation: "random(-5, 5)",
        duration: "random(3, 5)",
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: {
          each: 0.5,
          from: "random",
        },
      });

      // Header animation
      gsap.fromTo(
        ".stats-header",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Stats cards animation
      gsap.fromTo(
        ".stat-card",
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.15,
          ease: "back.out(1.5)",
          scrollTrigger: {
            trigger: ".stats-grid",
            start: "top 80%",
            toggleActions: "play none none reverse",
            onEnter: () => {
              if (!hasAnimated) {
                setHasAnimated(true);
                // Animate counters
                stats.forEach((stat, index) => {
                  const ref = countRefs.current[index];
                  if (!ref) return;

                  const obj = { value: 0 };
                  gsap.to(obj, {
                    value: stat.value,
                    duration: 2.5,
                    ease: "power2.out",
                    delay: index * 0.2,
                    onUpdate: () => {
                      if (stat.isDecimal) {
                        ref.textContent = obj.value.toFixed(1);
                      } else {
                        ref.textContent = Math.round(obj.value).toString();
                      }
                    },
                  });
                });
              }
            },
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative py-24 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 via-secondary/30 to-background" />

      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="stats-decoration absolute top-10 left-[15%] w-20 h-20 rounded-full border border-primary/20" />
        <div className="stats-decoration absolute top-20 right-[20%] w-12 h-12 rounded-xl bg-primary/5" />
        <div className="stats-decoration absolute bottom-16 left-[25%] w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-xl" />
        <div className="stats-decoration absolute bottom-24 right-[15%] w-24 h-24 rounded-full border-2 border-dashed border-primary/10" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <div className="stats-header text-center mb-14">
          <p className="text-lg text-muted-foreground">
            Join the teams already coaching smarter
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="stat-card group relative"
            >
              {/* Card */}
              <div className={cn(
                "relative p-8 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm",
                "transition-all duration-500",
                "hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
              )}>
                {/* Background gradient on hover */}
                <div className={cn(
                  "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  `bg-gradient-to-br ${stat.bgGradient}`
                )} />

                {/* Icon */}
                <div className={cn(
                  "relative w-14 h-14 rounded-xl flex items-center justify-center mb-6",
                  "bg-gradient-to-br shadow-lg",
                  stat.gradient,
                  "group-hover:scale-110 group-hover:shadow-xl transition-all duration-300"
                )}>
                  <stat.icon className="w-7 h-7 text-white" />
                  <div className={cn(
                    "absolute inset-0 rounded-xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity",
                    `bg-gradient-to-br ${stat.gradient}`
                  )} />
                </div>

                {/* Value */}
                <div className="relative mb-2">
                  <span
                    ref={(el) => {
                      countRefs.current[index] = el;
                    }}
                    className="text-5xl md:text-6xl font-bold text-foreground tabular-nums"
                  >
                    {stat.isDecimal ? "0.0" : "0"}
                  </span>
                  <span className={cn(
                    "text-4xl md:text-5xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                    stat.gradient
                  )}>
                    {stat.suffix}
                  </span>
                </div>

                {/* Label */}
                <h3 className="relative text-lg font-semibold text-foreground mb-1">
                  {stat.label}
                </h3>

                {/* Description */}
                <p className="relative text-sm text-muted-foreground">
                  {stat.description}
                </p>

                {/* Decorative corner */}
                <div className={cn(
                  "absolute top-4 right-4 w-8 h-8 rounded-full opacity-20 group-hover:opacity-40 transition-opacity",
                  `bg-gradient-to-br ${stat.gradient}`
                )} />
              </div>

              {/* Glow effect on hover */}
              <div className={cn(
                "absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl",
                `bg-gradient-to-br ${stat.gradient}`
              )} style={{ opacity: 0.15 }} />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
