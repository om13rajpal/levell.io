"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextAnimate } from "./ui/text-animate";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import { toast } from "sonner";

interface LoginFormProps extends React.ComponentProps<"div"> {
  redirectUrl?: string | null;
}

export function LoginForm({
  className,
  redirectUrl,
  ...props
}: LoginFormProps) {
  // Build the callback URL with optional redirect
  const getCallbackUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://levell-io.vercel.app";
    const callbackPath = "/auth/callback";
    if (redirectUrl) {
      return `${baseUrl}${callbackPath}?redirect=${encodeURIComponent(redirectUrl)}`;
    }
    return `${baseUrl}${callbackPath}`;
  };

  const handleGoogleLogin = async () => {
    const res = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getCallbackUrl(),
      },
    });

    if (res.error) console.error("Error:", res.error.message);
  };

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getCallbackUrl(),
      },
    });

    if (error) {
      toast(`❌ ${error.message}`);
    } else {
      toast("Check your email for the login link!");
    }
    setLoading(false);
  };
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle> Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="johndoe@example.com"
                  required
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? "Sending link..." : "Login"}
                </Button>
                <FieldDescription className="flex justify-center items-center">
                  ----------------------------
                </FieldDescription>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleLogin}
                >
                  Login with Google
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
