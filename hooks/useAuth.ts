"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useAuth() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("sb-tuzuwzglmyajuxytaowi-auth-token");
    if (!token) {
      router.replace("/login");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);
}
