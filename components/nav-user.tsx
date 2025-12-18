"use client";

import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
  IconRocket,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabaseClient";
import { clearAppStorage } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  async function handleUpgradeConfirm() {
    try {
      setUpgradeLoading(true);

      // Get company name from localStorage
      const cachedCompany = localStorage.getItem("cachedCompany");
      const company = cachedCompany ? JSON.parse(cachedCompany) : null;

      const response = await fetch("/api/upgrade-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userName: user.name,
          userEmail: user.email,
          companyName: company?.company_name || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUpgradeSuccess(true);
        // Auto close after 2 seconds
        setTimeout(() => {
          setUpgradeDialogOpen(false);
          setUpgradeSuccess(false);
        }, 2000);
      } else {
        toast.error(result.error || "Failed to send upgrade request");
        setUpgradeDialogOpen(false);
      }
    } catch (error) {
      console.error("Upgrade request error:", error);
      toast.error("Failed to send upgrade request");
      setUpgradeDialogOpen(false);
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function logout() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("users")
          .update({ is_logged_in: false })
          .eq("id", user.id);
      }

      toast.loading("Logging you out...", {
        duration: 1500,
      });

      setTimeout(async () => {
        await supabase.auth.signOut();
        // Clear all app-related localStorage items
        clearAppStorage();
        toast.success("Logged out successfully!");
        router.replace("/login");
      }, 1200);
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  }

  return (
    <>
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/account')}>
              <IconUserCircle />
              Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/notification')}>
              <IconNotification />
              Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/business')}>
              <IconNotification />
              Business Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/integration')}>
              <IconNotification />
              Integrations
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setUpgradeDialogOpen(true)}
              className="text-primary"
            >
              <IconRocket className="text-primary" />
              Upgrade Plan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>

    {/* Upgrade Plan Confirmation Dialog */}
    <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
      <DialogContent className="sm:max-w-md">
        {upgradeSuccess ? (
          // Success state
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-5 w-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
              Request Sent!
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              We've received your upgrade request. Our team will contact you soon!
            </p>
          </div>
        ) : (
          // Confirmation state
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 flex items-center justify-center">
                  <IconRocket className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Upgrade Your Plan</DialogTitle>
                  <DialogDescription className="text-sm">
                    Unlock premium features
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Ready to take your experience to the next level? Upgrading gives you access to:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Advanced analytics and insights</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Unlimited team members</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Custom integrations</span>
                </li>
              </ul>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => setUpgradeDialogOpen(false)}
                disabled={upgradeLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpgradeConfirm}
                disabled={upgradeLoading}
                className="gap-2"
              >
                {upgradeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Confirm Upgrade Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
