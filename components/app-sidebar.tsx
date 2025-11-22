"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  IconDashboard,
  IconListDetails,
  IconChartBar,
  IconUsers,
  IconHelp,
  IconInnerShadowTop,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { supabase } from "@/lib/supabaseClient";
import { NavUser } from "@/components/nav-user";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const [user, setUser] = React.useState<any>(null);
  const [company, setCompany] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // ---------------------------------------------
  // Load user & company (LOCAL STORAGE FIRST)
  // ---------------------------------------------
  React.useEffect(() => {
    async function load() {
      // 1. Try reading from localStorage
      const cachedUser = localStorage.getItem("cachedUser");
      const cachedCompany = localStorage.getItem("cachedCompany");

      if (cachedUser && cachedCompany) {
        setUser(JSON.parse(cachedUser));
        setCompany(JSON.parse(cachedCompany));
        setLoading(false);
        return; // stop → do not fetch again
      }

      // 2. If nothing in localStorage → fetch from Supabase ONCE
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      const { data: companyRow } = await supabase
        .from("company")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      setUser(userRow);
      setCompany(companyRow);

      // 3. Store result in localStorage (so sidebar NEVER reloads again)
      localStorage.setItem("cachedUser", JSON.stringify(userRow));
      localStorage.setItem("cachedCompany", JSON.stringify(companyRow));

      setLoading(false);
    }

    load();
  }, []);

  const navMain = [
    { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
    { title: "Companies", url: "/companies", icon: IconListDetails },
    { title: "Calls", url: "/calls", icon: IconChartBar },
    { title: "Team", url: "/team", icon: IconUsers },
  ];

  const navSecondary = [{ title: "Help", url: "/help", icon: IconHelp }];

  if (loading) {
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarHeader className="p-4 text-sm text-muted-foreground">
          Loading…
        </SidebarHeader>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* HEADER: Company */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <IconInnerShadowTop className="size-5" />
                <span className="font-semibold">
                  {company?.company_name || "Your Company"}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* MENU */}
      <SidebarContent>
        <SidebarMenu>
          {navMain.map((item) => {
            const isActive = pathname === item.url;

            return (
              <SidebarMenuItem key={item.title} className="relative">
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "relative w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Link href={item.url}>
                    <item.icon className="size-4" />
                    {item.title}
                  </Link>
                </SidebarMenuButton>

                {isActive && (
                  <motion.span
                    layoutId="activeIndicator"
                    className="absolute left-0 top-0 h-full w-1 bg-primary rounded-r-md"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* FOOTER: User */}
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name || "No Name",
            email: user?.email,
            avatar: user?.avatar_url || "/avatars/default.png",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}