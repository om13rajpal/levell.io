"use client";

import { LenisProvider } from "@/providers/LenisProvider";
import {
  Navigation,
  Hero,
  LogoCloud,
  Features,
  HowItWorks,
  StatsSection,
  FinalCTA,
  Footer,
} from "@/components/landing";

export default function Page() {
  return (
    <LenisProvider
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      }}
    >
      <main className="relative overflow-x-hidden">
        <Navigation />
        <Hero />
        <LogoCloud />
        <Features />
        <HowItWorks />
        <StatsSection />
        <FinalCTA />
        <Footer />
      </main>
    </LenisProvider>
  );
}
