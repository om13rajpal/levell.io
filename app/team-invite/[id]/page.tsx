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

  const teamId = params?.id as string;
  console.log("TEAM ID:", teamId);

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
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
  // Fetch Team + Owner details
  // ---------------------------------------------------------
  const fetchTeam = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (error || !data) {
      setError("Invalid or expired invite.");
      return;
    }

    setTeam(data);

    if (data.owner) {
      const { data: ownerRow } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("id", data.owner)
        .maybeSingle();

      if (ownerRow) setOwner(ownerRow);
    }
  };

  // ---------------------------------------------------------
  // On mount → fetch user & admin
  // ---------------------------------------------------------
  useEffect(() => {
    if (!teamId) return;

    (async () => {
      await fetchCurrentUser();
      await fetchTeam();
      setLoading(false);
    })();
  }, [teamId]);

  // ---------------------------------------------------------
  // Check if the logged-in user is ALREADY a team member
  // ---------------------------------------------------------
  useEffect(() => {
    if (!team || !user) return;

    const members = team.members || [];

    if (members.includes(user.id)) {
      console.log("User is already a member");
      setAlreadyMember(true);
    }
  }, [team, user]);

  // ---------------------------------------------------------
  // Accept Invite
  // ---------------------------------------------------------
  const handleAcceptInvite = async () => {
    if (!team || !user) return;

    const members = team.members || [];

    // user already exists in the team
    if (members.includes(user.id)) {
      router.replace("/dashboard");
      return;
    }

    const updated = Array.from(new Set([...members, user.id]));

    const { error } = await supabase
      .from("teams")
      .update({ members: updated })
      .eq("id", team.id);

    if (error) {
      setError("Could not accept invite: " + error.message);
      return;
    }

    router.replace("/dashboard");
  };

  // 🟡 UI: Loading
  if (loading || !teamId) {
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
              <span className="font-semibold text-primary">
                {team?.team_name || owner?.name}
              </span>
              's team.
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
            Join <span className="font-semibold text-primary">{team?.team_name || owner?.name}</span>'s team
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