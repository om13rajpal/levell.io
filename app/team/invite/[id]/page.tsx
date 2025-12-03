"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { validateInvitation, acceptInvitation, canUserJoinTeam } from "@/services/team";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function TeamInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [team, setTeam] = useState<{ id: number; team_name: string; owner: string } | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState("");
  const [alreadyInTeam, setAlreadyInTeam] = useState(false);
  const [existingTeamName, setExistingTeamName] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [userExistsInDb, setUserExistsInDb] = useState(false);
  const [emailMismatch, setEmailMismatch] = useState(false);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);

      // Validate the invitation token first to get invited email
      const { valid, team: inviteTeam, error: validationError } = await validateInvitation(token);

      if (!valid || !inviteTeam) {
        setError(validationError || "Invalid invitation link.");
        setLoading(false);
        return;
      }

      setTeam(inviteTeam);

      // Get invitation details including invited email
      const { data: inviteData } = await supabase
        .from("team_invitations")
        .select("email")
        .eq("token", token)
        .single();

      const invitedEmailAddress = inviteData?.email;
      setInvitedEmail(invitedEmailAddress);

      // Check if user with invited email exists in database
      if (invitedEmailAddress) {
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, email")
          .eq("email", invitedEmailAddress)
          .single();

        setUserExistsInDb(!!existingUser);
      }

      // Check if user is logged in
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        // User not logged in - handle based on whether user exists
        setLoading(false);
        return;
      }

      setUser(authUser);

      // Check if logged in email matches invited email
      if (authUser.email !== invitedEmailAddress) {
        setEmailMismatch(true);
        setLoading(false);
        return;
      }

      // Get owner name
      if (inviteTeam.owner) {
        const { data: ownerData } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", inviteTeam.owner)
          .single();

        if (ownerData) {
          setOwnerName(ownerData.name || ownerData.email);
        }
      }

      // Check if user is already in a team
      const { canJoin, existingTeam } = await canUserJoinTeam(authUser.id);
      if (!canJoin) {
        setAlreadyInTeam(true);
        setExistingTeamName(existingTeam);
      }

      // Check if user is already a member of this specific team
      const { data: teamData } = await supabase
        .from("teams")
        .select("members")
        .eq("id", inviteTeam.id)
        .single();

      if (teamData?.members?.includes(authUser.id)) {
        setSuccess(true);
      }

      setLoading(false);
    };

    load();
  }, [token, router]);

  const handleAcceptInvite = async () => {
    if (!team || !user) return;

    setAccepting(true);

    try {
      const { success: acceptSuccess, error: acceptError } = await acceptInvitation(token, user.id);

      if (!acceptSuccess) {
        console.error("Accept invitation failed:", acceptError);
        toast.error(acceptError || "Failed to accept invitation");
        setAccepting(false);
        return;
      }

      toast.success(`Welcome to ${team.team_name}!`);
      setSuccess(true);
      setAccepting(false);

      // Redirect to team page after a short delay
      setTimeout(() => {
        router.replace("/team");
      }, 1500);
    } catch (err) {
      console.error("Accept invitation error:", err);
      toast.error("An unexpected error occurred");
      setAccepting(false);
    }
  };

  const handleGoToTeam = () => {
    router.replace("/team");
  };

  const handleGoToDashboard = () => {
    router.replace("/dashboard");
  };

  const handleLoginRedirect = () => {
    // Store invite token in localStorage for after login
    localStorage.setItem("pending_invite_token", token);
    const returnUrl = encodeURIComponent(`/team/invite/${token}`);
    router.replace(`/login?redirect=${returnUrl}`);
  };

  const handleSignupRedirect = () => {
    // Store invite token in localStorage for after signup
    localStorage.setItem("pending_invite_token", token);
    localStorage.setItem("invite_onboarding", "true");
    if (team) {
      localStorage.setItem("invite_team_id", team.id.toString());
    }
    const returnUrl = encodeURIComponent(`/team/invite/${token}`);
    const emailParam = invitedEmail ? `&email=${encodeURIComponent(invitedEmail)}` : "";
    router.replace(`/login?redirect=${returnUrl}&newUser=true${emailParam}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace(`/login?redirect=${encodeURIComponent(`/team/invite/${token}`)}`);
  };

  // Loading state
  if (loading || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center px-4 bg-gradient-to-br from-background to-muted/30">
        <Card className="max-w-md w-full shadow-xl rounded-2xl border-destructive/30">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription className="text-base">{error}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={handleGoToDashboard} className="w-full max-w-xs">
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state - already a member or just accepted
  if (success) {
    return (
      <div className="flex h-screen items-center justify-center px-4 bg-gradient-to-br from-background to-muted/30">
        <Card className="max-w-md w-full shadow-xl rounded-2xl border-green-500/30">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">You&apos;re In!</CardTitle>
            <CardDescription className="text-base">
              You are now a member of <span className="font-semibold text-primary">{team?.team_name}</span>
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={handleGoToTeam} className="w-full max-w-xs">
              Go to Team
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Email mismatch state - logged in with different email
  if (emailMismatch && user) {
    return (
      <div className="flex h-screen items-center justify-center px-4 bg-gradient-to-br from-background to-muted/30">
        <Card className="max-w-md w-full shadow-xl rounded-2xl border-amber-500/30">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl">Email Mismatch</CardTitle>
            <CardDescription className="text-base">
              This invitation was sent to{" "}
              <span className="font-semibold text-primary">{invitedEmail}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              You&apos;re currently logged in as{" "}
              <span className="font-medium text-foreground">{user.email}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Please log out and sign in with the correct account to accept this invitation.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={handleLogout} className="w-full">
              Log Out & Switch Account
            </Button>
            <Button variant="ghost" onClick={handleGoToDashboard} className="w-full">
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // User not logged in + user EXISTS in database
  if (!user && userExistsInDb) {
    return (
      <div className="flex h-screen items-center justify-center px-4 bg-gradient-to-br from-background to-muted/30">
        <Card className="max-w-md w-full shadow-xl rounded-2xl border-primary/30">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome Back!</CardTitle>
            <CardDescription className="text-base">
              You have an account! Please log in to accept this invitation to{" "}
              <span className="font-semibold text-primary">{team?.team_name}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="p-4 rounded-xl bg-muted/50 border">
              <p className="text-sm text-muted-foreground">
                Invited email: <span className="font-medium text-foreground">{invitedEmail}</span>
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={handleLoginRedirect} className="w-full py-6 text-lg rounded-xl">
              Log In to Accept
            </Button>
            <Button variant="ghost" onClick={handleGoToDashboard} className="w-full">
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // User not logged in + user DOES NOT EXIST in database
  if (!user && !userExistsInDb) {
    return (
      <div className="flex h-screen items-center justify-center px-4 bg-gradient-to-br from-background to-muted/30">
        <Card className="max-w-md w-full shadow-xl rounded-2xl border-green-500/30">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Join {team?.team_name}</CardTitle>
            <CardDescription className="text-base">
              {ownerName ? (
                <>
                  <span className="font-medium text-foreground">{ownerName}</span> has invited you to join their team
                </>
              ) : (
                "You've been invited to join this team"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 rounded-xl bg-muted/50 border">
              <h3 className="text-xl font-semibold text-primary mb-2">{team?.team_name}</h3>
              <p className="text-sm text-muted-foreground">
                Invited email: <span className="font-medium text-foreground">{invitedEmail}</span>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Create your account to join the team and collaborate on sales calls, transcripts, and AI analysis.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button onClick={handleSignupRedirect} className="w-full py-6 text-lg rounded-xl">
              Create Account & Join
            </Button>
            <Button variant="ghost" onClick={handleGoToDashboard} className="w-full">
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Already in another team state
  if (alreadyInTeam) {
    return (
      <div className="flex h-screen items-center justify-center px-4 bg-gradient-to-br from-background to-muted/30">
        <Card className="max-w-md w-full shadow-xl rounded-2xl border-amber-500/30">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl">Already in a Team</CardTitle>
            <CardDescription className="text-base">
              You are already a member of <span className="font-semibold text-primary">{existingTeamName}</span>.
              You can only be in one team at a time.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              To join <span className="font-medium">{team?.team_name}</span>, you&apos;ll need to leave your current team first.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center gap-3">
            <Button variant="outline" onClick={handleGoToDashboard}>
              Cancel
            </Button>
            <Button onClick={handleGoToTeam}>
              Go to My Team
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Main invitation UI
  return (
    <div className="flex h-screen items-center justify-center px-4 bg-gradient-to-br from-background to-muted/30">
      <Card className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300 shadow-xl rounded-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Team Invitation</CardTitle>
          <CardDescription className="text-base">
            {ownerName ? (
              <>
                <span className="font-medium text-foreground">{ownerName}</span> has invited you to join
              </>
            ) : (
              "You've been invited to join"
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          <div className="p-4 rounded-xl bg-muted/50 border">
            <h3 className="text-xl font-semibold text-primary">{team?.team_name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Accept this invitation to collaborate with the team on sales calls, transcripts, and AI analysis.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={handleAcceptInvite}
            className="w-full py-6 text-lg rounded-xl"
            disabled={accepting}
          >
            {accepting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={handleGoToDashboard}
            className="w-full"
            disabled={accepting}
          >
            Decline
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
