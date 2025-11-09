"use client"

import { LoginForm } from "@/components/login-form";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";

export default function Page() {
  useAuth();
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Navbar classname="absolute z-10 top-10" />
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
