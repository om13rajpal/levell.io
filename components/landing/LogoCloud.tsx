"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import Image from "next/image";

const integrations = [
  {
    name: "Fireflies.ai",
    logo: "https://cdn.brandfetch.io/idVVPG1ke4/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX",
    width: 120,
    height: 28,
  },
  {
    name: "HubSpot",
    logo: "https://cdn.brandfetch.io/idRt0LuzRf/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX",
    width: 100,
    height: 28,
  },
  {
    name: "Zoom",
    logo: "https://cdn.brandfetch.io/id3aO4Szj3/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX",
    width: 80,
    height: 28,
  },
  {
    name: "Google Meet",
    logo: "https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/ide81vGBGA.svg?c=1bxid64Mup7aczewSAYMX",
    width: 32,
    height: 32,
  },
  {
    name: "Microsoft Teams",
    logo: "https://cdn.brandfetch.io/id5aIBxRPy/w/400/h/85/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX",
    width: 120,
    height: 28,
  },
  {
    name: "Slack",
    logo: "https://cdn.brandfetch.io/idJ_HhtG0Z/w/400/h/143/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX",
    width: 90,
    height: 28,
  },
];

export function LogoCloud() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      gsap.fromTo(
        ".logo-item",
        { opacity: 0, y: 20, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          stagger: 0.08,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="py-16 px-6 border-y border-border/50 bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <p className="logo-item text-center text-sm font-medium text-muted-foreground mb-10">
          Seamlessly integrates with your favorite tools
        </p>

        {/* Logo Grid */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="logo-item group flex items-center justify-center px-4 py-3 rounded-xl bg-card/50 border border-transparent hover:border-primary/20 hover:bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-default min-w-[140px]"
            >
              <div className="opacity-70 group-hover:opacity-100 transition-all duration-300">
                <Image
                  src={integration.logo}
                  alt={integration.name}
                  width={integration.width}
                  height={integration.height}
                  className="h-7 w-auto object-contain"
                  unoptimized
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
