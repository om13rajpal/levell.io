# Page Transition System

Smooth, Framer-like page transitions for Next.js App Router using Framer Motion.

## 📦 Installation

The component is already created at `components/PageTransition.tsx`. Framer Motion is already installed in your project.

## 🎨 Components

### 1. PageTransition

Main wrapper for page-level transitions with fade + slide animation.

```tsx
import { PageTransition } from "@/components/PageTransition";

export default function Page() {
  return (
    <PageTransition>
      <h1>Your Page Content</h1>
    </PageTransition>
  );
}
```

### 2. StaggerContainer & StaggerItem

Animate lists, grids, or grouped content with staggered delays.

```tsx
import { StaggerContainer, StaggerItem } from "@/components/PageTransition";

export default function ListPage() {
  return (
    <StaggerContainer>
      {items.map((item) => (
        <StaggerItem key={item.id}>
          <Card>{item.content}</Card>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
```

### 3. FadeIn

Simple fade animation with optional delay.

```tsx
import { FadeIn } from "@/components/PageTransition";

export default function HeroSection() {
  return (
    <>
      <FadeIn>
        <h1>Main Heading</h1>
      </FadeIn>
      <FadeIn delay={0.2}>
        <p>Subtitle appears after heading</p>
      </FadeIn>
    </>
  );
}
```

### 4. LoadingSkeleton

Loading placeholder during transitions.

```tsx
import { LoadingSkeleton } from "@/components/PageTransition";

export default function Card({ isLoading, content }) {
  if (isLoading) {
    return (
      <>
        <LoadingSkeleton className="h-8 w-48 mb-4" />
        <LoadingSkeleton className="h-4 w-full mb-2" />
        <LoadingSkeleton className="h-4 w-3/4" />
      </>
    );
  }

  return <div>{content}</div>;
}
```

## 🚀 Setup Instructions

### Step 1: Global CSS

Add smooth transition styles to your global CSS:

```tsx
// app/layout.tsx
import "@/styles/smooth-transitions.css";
```

Or add directly to `app/globals.css`:

```css
html {
  scroll-behavior: smooth;
}

* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Step 2: Layout Wrapper (Optional)

Wrap your entire app in `app/layout.tsx`:

```tsx
import { PageTransition } from "@/components/PageTransition";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PageTransition>
          {children}
        </PageTransition>
      </body>
    </html>
  );
}
```

### Step 3: Page-Level Usage

Or wrap individual pages:

```tsx
// app/dashboard/page.tsx
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/PageTransition";

export default function DashboardPage() {
  return (
    <PageTransition>
      <h1>Dashboard</h1>

      <StaggerContainer>
        <StaggerItem>
          <StatCard title="Users" value="1,234" />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Revenue" value="$5,678" />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Growth" value="+23%" />
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  );
}
```

## 🎯 Advanced Usage

### Custom Variants

Create custom transition effects:

```tsx
import { createPageVariants, createSlideVariants } from "@/components/PageTransition";

// Custom fade duration and offset
const slowFade = createPageVariants(0.6, 16);

// Slide from right
const slideFromRight = createSlideVariants("right");

<motion.div variants={slideFromRight} initial="initial" animate="enter">
  Sidebar content
</motion.div>
```

### Scale Transitions

Use for modals or cards:

```tsx
import { motion } from "framer-motion";
import { scaleVariants } from "@/components/PageTransition";

export function Modal({ isOpen }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={scaleVariants}
          initial="initial"
          animate="enter"
          exit="exit"
        >
          Modal content
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Conditional Animations

Disable animations during server-side rendering:

```tsx
"use client";

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/PageTransition";

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <PageTransition>
      Content with animations
    </PageTransition>
  );
}
```

## ⚡ Performance Tips

### 1. Use `will-change` Sparingly

```tsx
<motion.div
  className="will-change-transform"
  onAnimationComplete={() => {
    // Remove will-change after animation
    element.classList.remove("will-change-transform");
  }}
>
```

### 2. Lazy Load Heavy Components

```tsx
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <LoadingSkeleton className="h-64" />
});
```

### 3. Optimize Images

```tsx
import Image from "next/image";
import { FadeIn } from "@/components/PageTransition";

<FadeIn>
  <Image
    src="/hero.jpg"
    alt="Hero"
    priority
    placeholder="blur"
    blurDataURL="data:image/..."
  />
</FadeIn>
```

### 4. Reduce Motion Preference

Automatically handled by CSS, but you can also check in JavaScript:

```tsx
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

<PageTransition className={prefersReducedMotion ? "no-animation" : ""}>
```

## 🎨 Animation Timing

All animations use the same easing curve for consistency:

```
cubic-bezier(0.25, 0.1, 0.25, 1)
```

This matches Framer's default easing and provides smooth, natural motion.

### Duration Guidelines

- **Page transitions**: 300ms (enter) / 200ms (exit)
- **Stagger delay**: 50ms between items
- **Fade animations**: 300ms
- **Hover effects**: 200ms

## 🐛 Troubleshooting

### Issue: Animations not working

**Solution**: Ensure component is marked as `"use client"`:

```tsx
"use client";

import { PageTransition } from "@/components/PageTransition";
```

### Issue: Flash of unstyled content

**Solution**: Add disable-transitions class during load:

```tsx
<body className="disable-transitions">
  <script dangerouslySetInnerHTML={{
    __html: `
      setTimeout(() => {
        document.body.classList.remove('disable-transitions');
      }, 100);
    `
  }} />
```

### Issue: Animations too slow/fast

**Solution**: Customize duration with createPageVariants:

```tsx
const fasterTransition = createPageVariants(0.2, 8);
```

### Issue: Layout shift during animation

**Solution**: Set fixed dimensions or use aspect-ratio:

```tsx
<motion.div
  variants={pageVariants}
  className="min-h-screen"
>
```

## 📚 Examples

See the complete examples in:
- `docs/TRANSITION_EXAMPLES.md` - Real-world usage patterns
- `components/examples/` - Demo components (create these as needed)

## 🔗 Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Web Animation Best Practices](https://web.dev/animations/)
