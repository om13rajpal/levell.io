"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register all GSAP plugins (only on client)
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Configure GSAP defaults
gsap.defaults({
  ease: "power2.out",
  duration: 0.8,
});

// Configure ScrollTrigger defaults
ScrollTrigger.defaults({
  toggleActions: "play none none reverse",
});

export { gsap, ScrollTrigger, useGSAP };
