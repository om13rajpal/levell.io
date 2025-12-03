"use client";

import { motion, AnimatePresence, Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

// Page transition variants with smooth easing
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      type: "tween",
      ease: [0.25, 0.1, 0.25, 1], // Custom cubic-bezier like Framer
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      type: "tween",
      ease: [0.25, 0.1, 0.25, 1],
      duration: 0.2
    }
  }
};

// Stagger container for children elements
const staggerContainer: Variants = {
  initial: {},
  enter: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1
    }
  }
};

// Individual stagger item animation
const staggerItem: Variants = {
  initial: {
    opacity: 0,
    y: 12
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      type: "tween",
      ease: [0.25, 0.1, 0.25, 1],
      duration: 0.25
    }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15 }
  }
};

// Fade in animation with delay
const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  enter: (delay: number) => ({
    opacity: 1,
    transition: {
      delay: delay || 0,
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }),
  exit: {
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

// Loading skeleton variants
const skeletonVariants: Variants = {
  initial: { opacity: 1 },
  enter: { opacity: 0, transition: { duration: 0.2 } },
  exit: { opacity: 1, transition: { duration: 0.2 } }
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
}

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

interface LoadingSkeletonProps {
  className?: string;
}

/**
 * Main page transition wrapper component
 * Wraps page content with smooth fade + slide animations
 */
export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Stagger container for animating multiple children with delay
 * Use this to wrap lists, grids, or any grouped content
 */
export function StaggerContainer({ children, className = "" }: StaggerProps) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Individual stagger item component
 * Use inside StaggerContainer for each animated child
 */
export function StaggerItem({ children, className = "" }: StaggerProps) {
  return (
    <motion.div
      variants={staggerItem}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Simple fade in animation with optional delay
 * Use for individual elements that need delayed entrance
 */
export function FadeIn({ children, delay = 0, className = "" }: FadeInProps) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={fadeInVariants}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Loading skeleton component for transition states
 * Shows during page transitions for better perceived performance
 */
export function LoadingSkeleton({ className = "" }: LoadingSkeletonProps) {
  return (
    <motion.div
      variants={skeletonVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-label="Loading content"
    />
  );
}

/**
 * Utility function for creating custom page transition variants
 * @param duration - Animation duration in seconds
 * @param yOffset - Vertical offset for slide animation
 */
export function createPageVariants(duration = 0.3, yOffset = 8): Variants {
  return {
    initial: { opacity: 0, y: yOffset },
    enter: {
      opacity: 1,
      y: 0,
      transition: {
        type: "tween",
        ease: [0.25, 0.1, 0.25, 1],
        duration
      }
    },
    exit: {
      opacity: 0,
      y: -yOffset,
      transition: {
        type: "tween",
        ease: [0.25, 0.1, 0.25, 1],
        duration: duration * 0.67
      }
    }
  };
}

/**
 * Scale transition variant (alternative to slide)
 * Good for modal-like transitions
 */
export const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  enter: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "tween",
      ease: [0.25, 0.1, 0.25, 1],
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.2 }
  }
};

/**
 * Slide from side variants
 * Use for drawer/sidebar animations
 */
export function createSlideVariants(direction: "left" | "right" | "up" | "down" = "right"): Variants {
  const isHorizontal = direction === "left" || direction === "right";
  const value = direction === "left" || direction === "up" ? -24 : 24;

  if (isHorizontal) {
    return {
      initial: { opacity: 0, x: value },
      enter: {
        opacity: 1,
        x: 0,
        transition: { type: "tween", ease: [0.25, 0.1, 0.25, 1], duration: 0.3 }
      },
      exit: { opacity: 0, x: -value / 2, transition: { duration: 0.2 } }
    };
  }

  return {
    initial: { opacity: 0, y: value },
    enter: {
      opacity: 1,
      y: 0,
      transition: { type: "tween", ease: [0.25, 0.1, 0.25, 1], duration: 0.3 }
    },
    exit: { opacity: 0, y: -value / 2, transition: { duration: 0.2 } }
  };
}
