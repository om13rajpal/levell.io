"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  IconListDetails,
  IconChartBar,
  IconUsers,
  IconPhone,
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
  // Load user & company (with smart caching)
  // ---------------------------------------------
  React.useEffect(() => {
    async function load() {
      // 1. Try reading from localStorage first for instant UI
      const cachedUser = localStorage.getItem("cachedUser");
      const cachedCompany = localStorage.getItem("cachedCompany");

      let parsedUser = cachedUser ? JSON.parse(cachedUser) : null;
      let parsedCompany = cachedCompany ? JSON.parse(cachedCompany) : null;

      // Check if cached company has required fields (company_name and company_url)
      const hasValidCompanyCache = parsedCompany?.company_name && parsedCompany?.company_url;

      // If we have valid cached data, use it immediately
      if (parsedUser && hasValidCompanyCache) {
        setUser(parsedUser);
        setCompany(parsedCompany);
        setLoading(false);
        return;
      }

      // 2. Fetch fresh data from Supabase if cache is missing or incomplete
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

      // 3. Store result in localStorage for future use
      if (userRow) {
        localStorage.setItem("cachedUser", JSON.stringify(userRow));
      }
      if (companyRow) {
        localStorage.setItem("cachedCompany", JSON.stringify(companyRow));
      }

      setLoading(false);
    }

    load();
  }, []);

  const navMain = [
    { title: "Calls", url: "/dashboard", icon: IconChartBar },
    { title: "Companies", url: "/companies", icon: IconListDetails },
    { title: "Team", url: "/team", icon: IconUsers },
  ];

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
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                  <IconPhone className="h-4 w-4 text-primary-foreground" />
                </div>
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

