"use client"

import { cn } from "@/lib/utils";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { ArrowRightIcon } from "lucide-react";
import { MorphingText } from "@/components/ui/morphing-text";
import LiquidEther from "@/components/LiquidEther";
import { Highlighter } from "@/components/ui/highlighter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/stateful-button";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  const handleClick = () => {
    setTimeout(() => {
      router.push("/login");
    }, 2100);
  };

  return (
    <div className="z-10 flex min-h-64 h-screen items-center justify-center flex-col gap-3">
      <div className="absolute z-0 h-screen w-screen">
        <LiquidEther
          colors={["#5227FF", "#FF9FFC", "#B19EEF"]}
          mouseForce={20}
          cursorSize={100}
          isViscous={true}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>
      <Navbar classname="absolute z-10 top-10" />
      <div
        className={cn(
          "z-10 group rounded-full border border-black/5 bg-neutral-100 text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-neutral-200 dark:border-white/5 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        )}
      >
        <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
          <span>✨ Introducing levvl.io</span>
          <ArrowRightIcon className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
        </AnimatedShinyText>
      </div>
      <p>
        Experience{" "}
        <Highlighter action="underline" color="#FF9800">
          the power of levvl.io
        </Highlighter>{" "}
        doing your sales task effortlessly.
      </p>
      <MorphingText texts={["Track your calls", "AI workflows", "levvl.io"]} />
      <Button onClick={handleClick} className="bg-white text-black mt-3 z-10">
        Get Started
      </Button>
    </div>
  );
}
