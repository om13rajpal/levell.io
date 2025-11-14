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
import { NavUser } from "@/components/nav-user";

const data = {
  user: { name: "shadcn", email: "m@example.com", avatar: "/avatars/shadcn.jpg" },
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
    { title: "Companies", url: "/companies", icon: IconListDetails },
    { title: "Calls", url: "/calls", icon: IconChartBar },
    { title: "Team", url: "/team", icon: IconUsers },
  ],
  navSecondary: [{ title: "Help", url: "/help", icon: IconHelp }],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <IconInnerShadowTop className="size-5" />
                <span className="font-semibold">Acme Inc.</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {data.navMain.map((item) => {
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

                {/* 🔥 Animated Indicator */}
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
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}