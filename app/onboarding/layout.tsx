"use client";

import Navbar from "@/components/Navbar";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { usePathname } from "next/navigation";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const step = Number(pathname.split("step")[1]) || 1;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Centered Navbar */}
      <div className="w-full flex justify-center border-b-0 py-4 mt-5">
          <Navbar />
      </div>

      {/* Centered Progress Bar (40% width) */}
      <div className="w-full flex justify-center py-4">
        <div className="w-[40%]">
          <OnboardingProgress step={step} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto p-6 w-full">
        {children}
      </main>
    </div>
  );
}