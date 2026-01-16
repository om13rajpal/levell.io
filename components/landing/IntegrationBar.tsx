"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";

gsap.registerPlugin(ScrollTrigger);

const integrations = [
  {
    name: "Fireflies.ai",
    logo: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
        F
      </div>
    ),
    description: "Call recordings",
  },
  {
    name: "HubSpot",
    logo: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-xs font-bold">
        H
      </div>
    ),
    description: "CRM sync",
  },
];

export function IntegrationBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!barRef.current) return;

      gsap.fromTo(
        ".integration-item",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          scrollTrigger: {
            trigger: barRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );
    },
    { scope: barRef }
  );

  return (
    <section
      ref={barRef}
      className="py-8 md:py-12 border-y bg-muted/30"
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
          <span className="integration-item text-sm text-muted-foreground">
            Seamlessly integrates with
          </span>
          <div className="flex items-center gap-4 md:gap-8">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="integration-item flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border hover:shadow-md transition-shadow"
              >
                {integration.logo}
                <div className="text-left">
                  <span className="font-medium text-foreground block text-sm">
                    {integration.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {integration.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <span className="integration-item text-xs text-muted-foreground italic">
            + more coming soon
          </span>
        </div>
      </div>
    </section>
  );
}
