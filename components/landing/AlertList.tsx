"use client";

import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { AlertTriangle, TrendingDown, Clock, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const allAlerts = [
  {
    icon: AlertTriangle,
    title: "Low engagement detected",
    rep: "Sarah M.",
    time: "Just now",
    severity: "high",
  },
  {
    icon: TrendingDown,
    title: "Talk ratio above 70%",
    rep: "James K.",
    time: "2m ago",
    severity: "medium",
  },
  {
    icon: Clock,
    title: "Missed follow-up",
    rep: "Mike T.",
    time: "5m ago",
    severity: "low",
  },
  {
    icon: Bell,
    title: "Competitor mentioned",
    rep: "Lisa R.",
    time: "8m ago",
    severity: "medium",
  },
  {
    icon: AlertTriangle,
    title: "Objection not handled",
    rep: "Tom H.",
    time: "12m ago",
    severity: "high",
  },
];

interface AlertListProps {
  animate?: boolean;
  loop?: boolean;
  className?: string;
}

export function AlertList({ animate = true, loop = false, className }: AlertListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [visibleAlerts, setVisibleAlerts] = useState(allAlerts.slice(0, 3));
  const [alertCount, setAlertCount] = useState(3);
  const [isVisible, setIsVisible] = useState(false);

  useGSAP(
    () => {
      if (!listRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isVisible) {
              setIsVisible(true);
            }
          });
        },
        { threshold: 0.3 }
      );

      observer.observe(listRef.current);

      return () => observer.disconnect();
    },
    { scope: listRef }
  );

  // Initial animation
  useGSAP(
    () => {
      if (!animate || !listRef.current || !isVisible) return;

      gsap.fromTo(
        ".alert-item",
        { opacity: 0, x: -20, scale: 0.95 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.12,
          ease: "back.out(1.5)",
        }
      );
    },
    { scope: listRef, dependencies: [isVisible] }
  );

  // Looping animation - cycle through alerts
  useEffect(() => {
    if (!loop || !isVisible) return;

    const interval = setInterval(() => {
      // Animate out the first item
      const firstItem = listRef.current?.querySelector(".alert-item:first-child");
      if (firstItem) {
        gsap.to(firstItem, {
          opacity: 0,
          x: -30,
          height: 0,
          marginBottom: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            // Shift alerts and add a new one
            setVisibleAlerts((prev) => {
              const next = [...prev.slice(1)];
              const nextIndex = (allAlerts.indexOf(prev[prev.length - 1]) + 1) % allAlerts.length;
              next.push({ ...allAlerts[nextIndex], time: "Just now" });
              return next;
            });
            setAlertCount((prev) => prev + 1);
          },
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loop, isVisible]);

  // Animate new items when they appear
  useEffect(() => {
    if (!loop || !isVisible) return;

    const lastItem = listRef.current?.querySelector(".alert-item:last-child");
    if (lastItem) {
      gsap.fromTo(
        lastItem,
        { opacity: 0, x: -20, scale: 0.9 },
        { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
      );
    }
  }, [visibleAlerts, loop, isVisible]);

  return (
    <div ref={listRef} className={cn("space-y-2", className)}>
      {/* Header Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-xs font-semibold text-primary">
            {alertCount} calls need attention
          </span>
        </div>
        {loop && (
          <span className="text-[10px] text-muted-foreground animate-pulse">Live</span>
        )}
      </div>

      {/* Alert Items */}
      <div className="space-y-2">
        {visibleAlerts.map((alert, index) => (
          <div
            key={`${alert.rep}-${index}-${alertCount}`}
            className={cn(
              "alert-item flex items-start gap-3 p-3 rounded-lg border transition-all duration-300",
              alert.severity === "high"
                ? "bg-primary/5 border-primary/20"
                : alert.severity === "medium"
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-muted/50 border-border"
            )}
          >
            <div
              className={cn(
                "p-1.5 rounded-md transition-colors",
                alert.severity === "high"
                  ? "bg-primary/10 text-primary"
                  : alert.severity === "medium"
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <alert.icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {alert.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {alert.rep}
                </span>
                <span className="text-[10px] text-muted-foreground/60">·</span>
                <span className={cn(
                  "text-[10px]",
                  alert.time === "Just now" ? "text-primary font-medium" : "text-muted-foreground/60"
                )}>
                  {alert.time}
                </span>
              </div>
            </div>
            {alert.time === "Just now" && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
