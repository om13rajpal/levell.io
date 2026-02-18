"use client";

import { ReactNode, useEffect, useRef, createContext, useContext } from "react";
import Lenis from "lenis";
import { gsap } from "@/lib/gsap-config";

interface LenisContextValue {
  lenis: Lenis | null;
}

const LenisContext = createContext<LenisContextValue>({ lenis: null });

export function useLenis() {
  return useContext(LenisContext);
}

interface LenisProviderProps {
  children: ReactNode;
  options?: {
    lerp?: number;
    duration?: number;
    smoothWheel?: boolean;
    wheelMultiplier?: number;
    touchMultiplier?: number;
  };
}

export function LenisProvider({ children, options = {} }: LenisProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Create Lenis instance
    const lenis = new Lenis({
      lerp: options.lerp ?? 0.1,
      duration: options.duration ?? 1.2,
      smoothWheel: options.smoothWheel ?? true,
      wheelMultiplier: options.wheelMultiplier ?? 1,
      touchMultiplier: options.touchMultiplier ?? 2,
    });

    lenisRef.current = lenis;

    // Sync Lenis with GSAP ticker for ScrollTrigger compatibility
    function update(time: number) {
      lenis.raf(time * 1000);
    }

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    // Update ScrollTrigger on scroll
    lenis.on("scroll", () => {
      // Import ScrollTrigger dynamically to avoid SSR issues
      import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
        ScrollTrigger.update();
      });
    });

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [options]);

  return (
    <LenisContext.Provider value={{ lenis: lenisRef.current }}>
      {children}
    </LenisContext.Provider>
  );
}

/**
 * Hook to scroll to a specific element or position
 */
export function useScrollTo() {
  const { lenis } = useLenis();

  return (target: string | HTMLElement | number, options?: { offset?: number; duration?: number }) => {
    if (!lenis) return;

    lenis.scrollTo(target, {
      offset: options?.offset ?? 0,
      duration: options?.duration ?? 1.2,
    });
  };
}
