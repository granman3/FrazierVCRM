"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Building2,
  Star,
  Briefcase,
  Newspaper,
  Send,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  readonly currentPath: string;
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/vips", label: "VIPs", icon: Star },
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ currentPath }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center border-b border-border px-6">
        <span className="text-lg font-semibold tracking-tight text-sage-200">
          Frazier
        </span>
        <span className="ml-1.5 text-lg font-light tracking-tight text-muted-foreground">
          CRM
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navLinks.map((link) => {
          const isActive =
            currentPath === link.href ||
            currentPath.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-sage-200/10 text-sage-200"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">
          Frazier VC Chief of Staff
        </p>
      </div>
    </aside>
  );
}
