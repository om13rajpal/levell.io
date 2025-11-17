"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

export default function TeamInvitePage() {
  const router = useRouter();
  const params = useParams();

  const adminId = params?.id as string;
  console.log("ADMIN ID:", adminId);

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [error, setError] = useState("");

  // ---------------------------------------------------------
  // Fetch current logged-in user
  // ---------------------------------------------------------
  const fetchCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user || error) {
      setError("You must be logged in to accept this invite.");
      return;
    }

    setUser(user);
  };

  // ---------------------------------------------------------
  // Fetch Admin details via adminId
  // ---------------------------------------------------------
  const fetchAdminUser = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, team_members")
      .eq("id", adminId)
      .single();

    if (error || !data) {
      setError("Invalid or expired invite.");
      return;
    }

    setAdmin(data);
  };

  // ---------------------------------------------------------
  // On mount → fetch user & admin
  // ---------------------------------------------------------
  useEffect(() => {
    if (!adminId) return;

    (async () => {
      await fetchCurrentUser();
      await fetchAdminUser();
      setLoading(false);
    })();
  }, [adminId]);

  // ---------------------------------------------------------
  // Check if the logged-in user is ALREADY a team member
  // ---------------------------------------------------------
  useEffect(() => {
    if (!admin || !user) return;

    const team = admin.team_members || [];

    if (team.includes(user.id)) {
      console.log("User is already a member");
      setAlreadyMember(true);
    }
  }, [admin, user]);

  // ---------------------------------------------------------
  // Accept Invite
  // ---------------------------------------------------------
  const handleAcceptInvite = async () => {
    if (!admin || !user) return;

    const members = admin.team_members || [];

    // user already exists in the team
    if (members.includes(user.id)) {
      router.replace("/dashboard");
      return;
    }

    const updated = [...members, user.id];

    const { error } = await supabase
      .from("users")
      .update({ team_members: updated })
      .eq("id", adminId);

    if (error) {
      setError("Could not accept invite: " + error.message);
      return;
    }

    router.replace("/dashboard");
  };

  // 🟡 UI: Loading
  if (loading || !adminId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading invite…</p>
      </div>
    );
  }

  // 🔴 UI: Error
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/40 bg-destructive/10 text-destructive">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 🟢 UI: Already a Member
  if (alreadyMember) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <Card className="max-w-md w-full shadow-xl border border-border/50 rounded-2xl p-6 space-y-4 text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">
              You're already a team member
            </CardTitle>
            <CardDescription>
              You already have access to{" "}
              <span className="font-semibold text-primary">{admin?.name}</span>'s team.
            </CardDescription>
          </CardHeader>

          <CardFooter className="flex justify-center">
            <Button
              onClick={() => router.replace("/dashboard")}
              className="w-full max-w-xs py-6 text-lg rounded-xl"
            >
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 🟢 MAIN INVITE UI
  return (
    <div className="flex h-screen items-center justify-center px-4">
      <Card className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300 shadow-xl border border-border/50 rounded-2xl">

        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold text-center">
            Team Invitation
          </CardTitle>

          <CardDescription className="text-center text-base">
            Join <span className="font-semibold text-primary">{admin?.name}</span>'s team
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Accept this invite to collaborate with the team.
          </p>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button
            onClick={handleAcceptInvite}
            className="w-full max-w-xs text-lg py-6 rounded-xl"
          >
            Accept Invite
          </Button>
        </CardFooter>

      </Card>
    </div>
  );
}