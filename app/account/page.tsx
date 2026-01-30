"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Trash2,
  Loader2,
  Save,
  User,
  Mail,
  Calendar,
  Clock,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

type UserData = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  last_login_time: string | null;
  is_logged_in: boolean;
  is_onboarding_done: boolean | null;
  sales_motion: string | null;
  ai_recommendations: string[] | null;
};

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Load user data from Supabase
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user data:", error);
          toast.error("Failed to load account data");
        } else if (data) {
          setUserData(data);
          setName(data.name || "");
        }
      } catch (err) {
        console.error("Error loading user:", err);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!userData) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("users")
        .update({ name: name.trim() })
        .eq("id", userData.id);

      if (error) {
        toast.error("Failed to update profile");
        console.error("Update error:", error);
      } else {
        setUserData({ ...userData, name: name.trim() });
        toast.success("Profile updated successfully");
        setEditDialogOpen(false);
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (userData) {
        await supabase
          .from("users")
          .update({ is_logged_in: false })
          .eq("id", userData.id);
      }

      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Failed to logout");
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    try {
      if (!userData) return;

      // Delete user data from users table
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", userData.id);

      if (error) {
        toast.error("Failed to delete account");
        console.error("Delete error:", error);
        return;
      }

      // Sign out
      await supabase.auth.signOut();
      toast.success("Account deleted successfully");
      window.location.href = "/login";
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Something went wrong");
    }
  };

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Account" />
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!userData) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader heading="Account" />
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">
              Unable to load account data. Please try logging in again.
            </p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader heading="Account" />

        <div className="mx-auto w-full max-w-4xl p-6 sm:p-8 space-y-8">
          {/* Header */}
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Account Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your account credentials, security settings, and profile.
            </p>
          </header>

          {/* PROFILE CARD */}
          <Card className="bg-card/60 border-border/60 shadow-sm backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription className="text-xs">
                Your personal information and avatar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={userData.avatar_url || ""} alt={userData.name} />
                  <AvatarFallback className="text-lg">
                    {getInitials(userData.name || "U")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{userData.name}</h3>
                  <p className="text-sm text-muted-foreground">{userData.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={userData.is_logged_in ? "default" : "secondary"}>
                      {userData.is_logged_in ? "Online" : "Offline"}
                    </Badge>
                    {userData.is_onboarding_done && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Onboarding Complete
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                >
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ACCOUNT DETAILS CARD */}
          <Card className="bg-card/60 border-border/60 shadow-sm backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Account Details</CardTitle>
              <CardDescription className="text-xs">
                Your account information and activity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AccountField
                  icon={<User className="h-4 w-4" />}
                  label="Full Name"
                  value={userData.name}
                />
                <AccountField
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={userData.email}
                />
                <AccountField
                  icon={<Calendar className="h-4 w-4" />}
                  label="Account Created"
                  value={formatDate(userData.created_at)}
                />
                <AccountField
                  icon={<Clock className="h-4 w-4" />}
                  label="Last Login"
                  value={formatDateTime(userData.last_login_time)}
                />
              </div>

              {/* Sales Settings */}
              {userData.sales_motion && (
                <>
                  <Separator className="my-4" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <AccountField
                      icon={<Settings className="h-4 w-4" />}
                      label="Sales Motion"
                      value={
                        <Badge variant="secondary" className="capitalize">
                          {userData.sales_motion.replace("-", " ")}
                        </Badge>
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* SECURITY CARD */}
          <Card className="bg-card/60 border-border/60 shadow-sm backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription className="text-xs">
                Manage your authentication and security settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* OAuth Connection */}
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">Google OAuth</div>
                    <div className="text-xs text-muted-foreground">
                      Connected via Google Account ({userData.email})
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    Connected
                  </Badge>
                </div>
              </div>

              {/* Logout */}
              <div className="rounded-lg border border-border/60 bg-card/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">Sign Out</div>
                    <div className="text-xs text-muted-foreground">
                      Sign out from your account on this device
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DANGER ZONE CARD */}
          <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              <CardDescription className="text-xs">
                Irreversible actions that affect your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-destructive/40 bg-card/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-destructive">
                      Delete Account
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Permanently delete your account and all associated data
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* EDIT PROFILE DIALOG */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={userData.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed as it&apos;s linked to your Google account.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATION DIALOG */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete your account? This action cannot be undone
                and all your data will be permanently removed.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}

/* === Components === */

function AccountField({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 border-border/60 bg-card/50">
      <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
