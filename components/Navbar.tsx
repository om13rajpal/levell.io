import { GitGraph } from "lucide-react";
import { AnimatedThemeToggler } from "./ui/animated-theme-toggler";

export default function Navbar({ classname }: { classname?: string }) {
  return (
    <nav
      className={`w-full max-w-3xl h-20 
      flex items-center justify-between
      rounded-[40px] px-7
      border border-[#ffffff2c]
      bg-[#22222234] backdrop-blur-lg
      shadow-[0_8px_32px_rgba(0,0,0,0.2)]
      ${classname}`}
    >
      <span className="flex gap-2 items-center">
        <GitGraph size={25} className="text-white/90" />
        <span className="text-xl font-bold text-white">levvl.io</span>
      </span>
      <AnimatedThemeToggler />
    </nav>
  );
}
