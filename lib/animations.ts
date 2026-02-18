"use client";

import { gsap, ScrollTrigger } from "./gsap-config";

// Easing presets for consistency
export const EASINGS = {
  smooth: "power2.out",
  smoothInOut: "power2.inOut",
  bounce: "back.out(1.7)",
  elastic: "elastic.out(1, 0.3)",
  sharp: "power4.out",
  snappy: "power3.out",
} as const;

// Animation durations
export const DURATIONS = {
  fast: 0.3,
  normal: 0.6,
  slow: 0.8,
  slower: 1.0,
  slowest: 1.2,
} as const;

/**
 * Staggered fade-in animation for multiple elements
 */
export function createFadeInStagger(
  elements: string | Element | Element[] | NodeList,
  options?: {
    y?: number;
    x?: number;
    duration?: number;
    stagger?: number;
    delay?: number;
    ease?: string;
    scrollTrigger?: ScrollTrigger.Vars;
  }
) {
  const {
    y = 40,
    x = 0,
    duration = DURATIONS.slow,
    stagger = 0.1,
    delay = 0,
    ease = EASINGS.smooth,
    scrollTrigger,
  } = options || {};

  return gsap.fromTo(
    elements,
    { opacity: 0, y, x },
    {
      opacity: 1,
      y: 0,
      x: 0,
      duration,
      stagger,
      delay,
      ease,
      scrollTrigger,
    }
  );
}

/**
 * Simple fade-in animation
 */
export function createFadeIn(
  element: string | Element | Element[],
  options?: {
    y?: number;
    duration?: number;
    delay?: number;
    ease?: string;
    scrollTrigger?: ScrollTrigger.Vars;
  }
) {
  const {
    y = 30,
    duration = DURATIONS.slow,
    delay = 0,
    ease = EASINGS.smooth,
    scrollTrigger,
  } = options || {};

  return gsap.fromTo(
    element,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration,
      delay,
      ease,
      scrollTrigger,
    }
  );
}

/**
 * Scale in animation
 */
export function createScaleIn(
  element: string | Element | Element[],
  options?: {
    scale?: number;
    duration?: number;
    delay?: number;
    ease?: string;
    scrollTrigger?: ScrollTrigger.Vars;
  }
) {
  const {
    scale = 0.9,
    duration = DURATIONS.slow,
    delay = 0,
    ease = EASINGS.smooth,
    scrollTrigger,
  } = options || {};

  return gsap.fromTo(
    element,
    { opacity: 0, scale },
    {
      opacity: 1,
      scale: 1,
      duration,
      delay,
      ease,
      scrollTrigger,
    }
  );
}

/**
 * Counter animation for stats/numbers
 */
export function animateCounter(
  element: Element,
  endValue: number,
  options?: {
    duration?: number;
    prefix?: string;
    suffix?: string;
    ease?: string;
  }
) {
  const {
    duration = 2,
    prefix = "",
    suffix = "",
    ease = EASINGS.smooth,
  } = options || {};

  const obj = { value: 0 };
  return gsap.to(obj, {
    value: endValue,
    duration,
    ease,
    onUpdate: () => {
      element.textContent = `${prefix}${Math.round(obj.value).toLocaleString()}${suffix}`;
    },
  });
}

/**
 * Horizontal scroll section with GSAP ScrollTrigger
 */
export function createHorizontalScroll(
  container: Element,
  panelsWrapper: Element,
  panels: Element[],
  options?: {
    scrub?: number | boolean;
    snap?: boolean | number;
  }
) {
  const { scrub = 1, snap = true } = options || {};

  const scrollDistance = panelsWrapper.scrollWidth - window.innerWidth;

  const scrollTriggerConfig: ScrollTrigger.Vars = {
    trigger: container,
    pin: true,
    scrub: scrub,
    start: "top top",
    end: () => `+=${scrollDistance}`,
    anticipatePin: 1,
  };

  if (snap) {
    scrollTriggerConfig.snap = {
      snapTo: 1 / (panels.length - 1),
      duration: { min: 0.2, max: 0.5 },
      ease: "power1.inOut",
    };
  }

  return gsap.to(panelsWrapper, {
    x: -scrollDistance,
    ease: "none",
    scrollTrigger: scrollTriggerConfig,
  });
}

/**
 * Parallax effect for elements
 */
export function createParallax(
  element: Element | string,
  options?: {
    speed?: number;
    direction?: "y" | "x";
    start?: string;
    end?: string;
  }
) {
  const {
    speed = 0.3,
    direction = "y",
    start = "top bottom",
    end = "bottom top",
  } = options || {};

  const distance = speed * 100;

  return gsap.fromTo(
    element,
    { [direction]: -distance },
    {
      [direction]: distance,
      ease: "none",
      scrollTrigger: {
        trigger: element as Element,
        start,
        end,
        scrub: true,
      },
    }
  );
}

/**
 * 3D tilt effect on mouse move
 */
export function create3DTilt(
  element: HTMLElement,
  options?: {
    intensity?: number;
    perspective?: number;
    scale?: number;
  }
): () => void {
  const {
    intensity = 10,
    perspective = 1000,
    scale = 1.02,
  } = options || {};

  element.style.transformStyle = "preserve-3d";
  element.style.perspective = `${perspective}px`;

  const handleMouseMove = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -intensity;
    const rotateY = ((x - centerX) / centerX) * intensity;

    gsap.to(element, {
      rotateX,
      rotateY,
      scale,
      duration: 0.3,
      ease: EASINGS.smooth,
      transformPerspective: perspective,
    });
  };

  const handleMouseLeave = () => {
    gsap.to(element, {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      duration: 0.5,
      ease: EASINGS.smooth,
    });
  };

  element.addEventListener("mousemove", handleMouseMove);
  element.addEventListener("mouseleave", handleMouseLeave);

  // Return cleanup function
  return () => {
    element.removeEventListener("mousemove", handleMouseMove);
    element.removeEventListener("mouseleave", handleMouseLeave);
  };
}

/**
 * Text reveal animation with split characters
 */
export function createTextReveal(
  element: Element,
  options?: {
    duration?: number;
    stagger?: number;
    ease?: string;
    scrollTrigger?: ScrollTrigger.Vars;
  }
) {
  const {
    duration = 0.6,
    stagger = 0.02,
    ease = EASINGS.smooth,
    scrollTrigger,
  } = options || {};

  const text = element.textContent || "";
  element.innerHTML = text
    .split("")
    .map((char) => `<span class="char">${char === " " ? "&nbsp;" : char}</span>`)
    .join("");

  const chars = element.querySelectorAll(".char");

  return gsap.fromTo(
    chars,
    { opacity: 0, y: 20 },
    {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      ease,
      scrollTrigger,
    }
  );
}

/**
 * Create a timeline for hero section animations
 */
export function createHeroTimeline(
  elements: {
    badge?: Element | string;
    headline?: Element | string;
    subheadline?: Element | string;
    ctas?: Element | string | Element[];
    visual?: Element | string;
  },
  options?: {
    startDelay?: number;
  }
) {
  const { startDelay = 0.2 } = options || {};

  const tl = gsap.timeline({
    defaults: { ease: EASINGS.snappy },
    delay: startDelay,
  });

  if (elements.badge) {
    tl.fromTo(
      elements.badge,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6 }
    );
  }

  if (elements.headline) {
    tl.fromTo(
      elements.headline,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8 },
      "-=0.3"
    );
  }

  if (elements.subheadline) {
    tl.fromTo(
      elements.subheadline,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6 },
      "-=0.4"
    );
  }

  if (elements.ctas) {
    tl.fromTo(
      elements.ctas,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
      "-=0.3"
    );
  }

  if (elements.visual) {
    tl.fromTo(
      elements.visual,
      { opacity: 0, scale: 0.92, y: 60 },
      { opacity: 1, scale: 1, y: 0, duration: 1, ease: EASINGS.smooth },
      "-=0.5"
    );
  }

  return tl;
}

/**
 * Create scroll-triggered section reveal
 */
export function createSectionReveal(
  trigger: Element | string,
  elements: Element | string | Element[],
  options?: {
    y?: number;
    stagger?: number;
    start?: string;
  }
) {
  const { y = 50, stagger = 0.1, start = "top 80%" } = options || {};

  return gsap.fromTo(
    elements,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration: DURATIONS.slow,
      stagger,
      ease: EASINGS.smooth,
      scrollTrigger: {
        trigger: trigger as Element,
        start,
        toggleActions: "play none none reverse",
      },
    }
  );
}

/**
 * Magnetic button effect
 */
export function createMagneticEffect(
  button: HTMLElement,
  options?: {
    strength?: number;
    ease?: string;
  }
): () => void {
  const { strength = 0.3, ease = EASINGS.smooth } = options || {};

  const handleMouseMove = (e: MouseEvent) => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to(button, {
      x: x * strength,
      y: y * strength,
      duration: 0.3,
      ease,
    });
  };

  const handleMouseLeave = () => {
    gsap.to(button, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease,
    });
  };

  button.addEventListener("mousemove", handleMouseMove);
  button.addEventListener("mouseleave", handleMouseLeave);

  return () => {
    button.removeEventListener("mousemove", handleMouseMove);
    button.removeEventListener("mouseleave", handleMouseLeave);
  };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Apply reduced motion settings globally
 */
export function setupReducedMotion() {
  if (prefersReducedMotion()) {
    gsap.globalTimeline.timeScale(1000); // Instantly complete animations
  }
}
