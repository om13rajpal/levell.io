"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { PhoneCall, Brain, Trophy, ArrowDown } from "lucide-react";

const sections = [
  {
    stat: "300+",
    label: "Calls Weekly",
    icon: PhoneCall,
    title: "Your team talks. A lot.",
    description:
      "But you only catch fragments. The patterns, the objections, the winning moments - they slip through unnoticed.",
    tag: "The Problem",
    gradient: "from-primary/20 to-brand-500/10",
  },
  {
    stat: "100%",
    label: "Analyzed",
    icon: Brain,
    title: "AI that never sleeps.",
    description:
      "Every call, every word, every inflection. Scored, summarized, and searchable in seconds. Nothing escapes.",
    tag: "The Solution",
    gradient: "from-brand-500/20 to-brand-600/10",
  },
  {
    stat: "+23%",
    label: "Win Rate",
    icon: Trophy,
    title: "Watch them level up.",
    description:
      "Data-driven coaching transforms good reps into closers. Week over week, deal over deal.",
    tag: "The Result",
    gradient: "from-brand-600/20 to-primary/10",
  },
];

export function ParallaxSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Background gradient shift
  const bgOpacity = useTransform(smoothProgress, [0, 0.5, 1], [0.02, 0.08, 0.02]);

  return (
    <section
      ref={containerRef}
      className="relative bg-gradient-to-b from-background via-muted/20 to-background"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl"
          style={{ opacity: bgOpacity }}
        />
        <motion.div
          className="absolute top-[50%] right-[10%] w-[400px] h-[400px] bg-brand-600/5 rounded-full blur-3xl"
          style={{ opacity: bgOpacity }}
        />
      </div>

      {/* Section header */}
      <div className="relative z-10 pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              The Journey
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
              From chaos to{" "}
              <span className="bg-gradient-to-r from-primary to-brand-500 bg-clip-text text-transparent">
                clarity
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See how levvl transforms your sales coaching workflow
            </p>
          </motion.div>
        </div>
      </div>

      {/* Scrolling sections */}
      <div className="relative z-10 pb-24">
        {sections.map((section, index) => (
          <ParallaxCard key={index} section={section} index={index} />
        ))}
      </div>

      {/* Scroll indicator at bottom */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <span className="text-sm text-muted-foreground">Keep scrolling</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ArrowDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function ParallaxCard({
  section,
  index,
}: {
  section: (typeof sections)[0];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.9, 1, 1, 0.9]);

  const Icon = section.icon;
  const isEven = index % 2 === 0;

  return (
    <motion.div
      ref={cardRef}
      className="min-h-[80vh] flex items-center py-16 px-6"
      style={{ opacity }}
    >
      <div className="max-w-7xl mx-auto w-full">
        <div
          className={`grid md:grid-cols-2 gap-12 lg:gap-20 items-center ${
            isEven ? "" : "md:flex-row-reverse"
          }`}
        >
          {/* Text content */}
          <motion.div
            className={`${isEven ? "md:order-1" : "md:order-2"}`}
            style={{ y, scale }}
          >
            {/* Tag */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6"
              initial={{ opacity: 0, x: isEven ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <motion.span
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-sm font-semibold text-primary">
                {section.tag}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h3
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight leading-[1.1]"
              initial={{ opacity: 0, x: isEven ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {section.title}
            </motion.h3>

            {/* Description */}
            <motion.p
              className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8"
              initial={{ opacity: 0, x: isEven ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {section.description}
            </motion.p>

            {/* Stats card */}
            <motion.div
              className="inline-flex items-center gap-4 p-4 rounded-2xl bg-card/80 backdrop-blur border border-border/50 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-brand-600 flex items-center justify-center shadow-lg">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {section.stat}
                </div>
                <div className="text-sm text-muted-foreground">
                  {section.label}
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Visual element */}
          <motion.div
            className={`${isEven ? "md:order-2" : "md:order-1"}`}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div
              className={`relative aspect-square max-w-md mx-auto rounded-3xl bg-gradient-to-br ${section.gradient} p-1`}
            >
              <div className="w-full h-full rounded-3xl bg-card/50 backdrop-blur-sm border border-border/30 flex items-center justify-center overflow-hidden">
                {/* Large stat display */}
                <div className="text-center">
                  <motion.div
                    className="text-8xl md:text-9xl font-black bg-gradient-to-br from-primary to-brand-600 bg-clip-text text-transparent"
                    initial={{ scale: 0.5, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: false, amount: 0.5 }}
                    transition={{ duration: 0.6, delay: 0.4, type: "spring" }}
                  >
                    {section.stat}
                  </motion.div>
                  <motion.div
                    className="text-lg md:text-xl text-muted-foreground font-medium mt-2"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    {section.label}
                  </motion.div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-6 right-6 w-16 h-16 rounded-full border border-primary/20 flex items-center justify-center">
                  <Icon className="w-8 h-8 text-primary/40" />
                </div>
                <div className="absolute bottom-6 left-6 w-12 h-12 rounded-full bg-primary/10" />
                <div className="absolute top-1/4 left-6 w-8 h-8 rounded-lg bg-brand-500/10" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
