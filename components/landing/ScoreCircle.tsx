"use client";

import { useRef, useEffect, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";

interface ScoreCircleProps {
  score?: number;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
  loop?: boolean;
  delay?: number;
  className?: string;
}

// Multiple scores to cycle through for looping animation
const loopScores = [87, 72, 94, 65, 81];

export function ScoreCircle({
  score: initialScore = 87,
  size = 120,
  strokeWidth = 8,
  animate = true,
  loop = false,
  delay = 0,
  className,
}: ScoreCircleProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentScoreIndex, setCurrentScoreIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const score = loop ? loopScores[currentScoreIndex] : initialScore;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: "text-score-excellent", stroke: "stroke-score-excellent", glow: "shadow-green-500/50" };
    if (score >= 65) return { text: "text-score-good", stroke: "stroke-score-good", glow: "shadow-lime-500/50" };
    if (score >= 50) return { text: "text-score-fair", stroke: "stroke-score-fair", glow: "shadow-amber-500/50" };
    return { text: "text-score-poor", stroke: "stroke-score-poor", glow: "shadow-red-500/50" };
  };

  const colorClass = getScoreColor(score);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isVisible) {
              setIsVisible(true);
            }
          });
        },
        { threshold: 0.5 }
      );

      observer.observe(containerRef.current);

      return () => observer.disconnect();
    },
    { scope: containerRef }
  );

  // Initial animation
  useEffect(() => {
    if (!isVisible || !animate) return;

    const animateScore = (targetScore: number) => {
      const targetOffset = circumference - (targetScore / 100) * circumference;

      // Animate the circle stroke
      if (circleRef.current) {
        gsap.to(circleRef.current, {
          strokeDashoffset: targetOffset,
          duration: 1.2,
          ease: "power2.out",
        });
      }

      // Animate the number
      if (numberRef.current) {
        const currentValue = parseInt(numberRef.current.textContent || "0");
        const obj = { value: currentValue };
        gsap.to(obj, {
          value: targetScore,
          duration: 1.2,
          ease: "power2.out",
          onUpdate: () => {
            if (numberRef.current) {
              numberRef.current.textContent = Math.round(obj.value).toString();
            }
          },
        });
      }

      // Pulse the glow
      if (glowRef.current) {
        gsap.fromTo(
          glowRef.current,
          { scale: 0.8, opacity: 0 },
          { scale: 1.2, opacity: 0.6, duration: 0.6, ease: "power2.out", yoyo: true, repeat: 1 }
        );
      }
    };

    // Initial animation
    if (circleRef.current) {
      gsap.fromTo(
        circleRef.current,
        { strokeDashoffset: circumference },
        {
          strokeDashoffset: offset,
          duration: 1.5,
          ease: "power2.out",
          delay: delay,
        }
      );
    }

    if (numberRef.current) {
      const obj = { value: 0 };
      gsap.to(obj, {
        value: score,
        duration: 1.5,
        ease: "power2.out",
        delay: delay,
        onUpdate: () => {
          if (numberRef.current) {
            numberRef.current.textContent = Math.round(obj.value).toString();
          }
        },
      });
    }

    // Loop animation
    if (loop) {
      const interval = setInterval(() => {
        setCurrentScoreIndex((prev) => (prev + 1) % loopScores.length);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isVisible, animate, loop, delay, circumference]);

  // Animate when score changes (for looping)
  useEffect(() => {
    if (!isVisible || !loop) return;

    const targetOffset = circumference - (score / 100) * circumference;

    if (circleRef.current) {
      gsap.to(circleRef.current, {
        strokeDashoffset: targetOffset,
        duration: 1,
        ease: "power2.inOut",
      });
    }

    if (numberRef.current) {
      const currentValue = parseInt(numberRef.current.textContent || "0");
      const obj = { value: currentValue };
      gsap.to(obj, {
        value: score,
        duration: 1,
        ease: "power2.inOut",
        onUpdate: () => {
          if (numberRef.current) {
            numberRef.current.textContent = Math.round(obj.value).toString();
          }
        },
      });
    }

    if (glowRef.current) {
      gsap.fromTo(
        glowRef.current,
        { scale: 1, opacity: 0.3 },
        { scale: 1.3, opacity: 0.6, duration: 0.4, ease: "power2.out", yoyo: true, repeat: 1 }
      );
    }
  }, [score, loop, isVisible, circumference]);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Glow effect */}
      <div
        ref={glowRef}
        className={cn(
          "absolute inset-0 rounded-full blur-xl opacity-30 transition-all duration-500",
          score >= 80 ? "bg-green-500" : score >= 65 ? "bg-lime-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
        )}
      />

      <svg width={size} height={size} className="transform -rotate-90 relative z-10">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate ? circumference : offset}
          className={cn("transition-colors duration-500", colorClass.stroke)}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span
          ref={numberRef}
          className={cn("text-3xl font-bold tabular-nums transition-colors duration-500", colorClass.text)}
        >
          {animate ? 0 : score}
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Score</span>
      </div>

      {/* Rotating ring decoration */}
      {loop && (
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-spin"
          style={{ animationDuration: "20s" }}
        />
      )}
    </div>
  );
}
