import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Command as CommandIcon,
  FileUp,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ScanEye,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { CommandPalette } from "./CommandPalette";

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/exam/setup", label: "Rubric Studio", Icon: Wand2 },
  { to: "/ingestion", label: "Ingestion", Icon: FileUp },
  { to: "/diagnostic-studio", label: "Diagnostic Studio", Icon: ScanEye },
  { to: "/analytics", label: "Analytics", Icon: BarChart3 },
  { to: "/settings", label: "Settings", Icon: Settings },
  { to: "/help", label: "Help", Icon: LifeBuoy },
];

export interface Crumb {
  label: string;
  to?: string;
}

export function AppShell({
  children,
  crumbs = [],
  title,
  actions,
  padded = true,
}: {
  children: ReactNode;
  crumbs?: Crumb[];
  title?: string;
  actions?: ReactNode;
  padded?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { teacher, token, clearToken } = useAuthStore();

  // Role-based access gate — unauthenticated sessions bounce to /login
  useEffect(() => {
    if (!token) navigate({ to: "/login" });
  }, [token, navigate]);

  const role = teacher?.role ?? "teacher";
  const roleLabel = role
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="flex min-h-screen">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* ── Sidebar — Oxford navy ───────────────────────────── */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[236px]",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <ScanEye size={18} className="shrink-0 text-sidebar-foreground" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">ScriptGrade</p>
              <p className="mono-token truncate text-[0.625rem] text-sidebar-foreground/55">
                8-DEBUGGER ENGINE
              </p>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
          {NAV.map(({ to, label, Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 pb-4">
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 md:hidden"
            aria-label="ScriptGrade home"
          >
            <ScanEye size={18} />
          </Link>

          <span className="hidden items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase sm:inline-flex">
            <Sparkles size={11} /> Qwen3.8-Max
          </span>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <CommandIcon size={13} /> Quick actions
            <kbd className="mono-token text-[0.625rem] text-muted-foreground/70">⌘K</kbd>
          </button>

          <button
            aria-label="Notifications"
            className="relative ml-auto grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground sm:ml-0"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warn" />
          </button>

          <div className="flex items-center gap-2.5 border-l border-border pl-3">
            <div className="grid size-7 place-items-center rounded-full bg-secondary text-[0.625rem] font-semibold text-secondary-foreground">
              {(teacher?.name ?? "SG")
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="hidden leading-tight lg:block">
              <p className="max-w-[130px] truncate text-xs font-medium">
                {teacher?.name ?? "Guest"}
              </p>
              <p className="flex items-center gap-1 text-[0.625rem] text-muted-foreground">
                <ShieldCheck size={9} /> {roleLabel}
              </p>
            </div>
            <button
              aria-label="Sign out"
              onClick={() => {
                clearToken();
                navigate({ to: "/login" });
              }}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {(crumbs.length > 0 || title || actions) && (
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-4 pt-7 pb-5 md:px-6">
            <div>
              {crumbs.length > 0 && (
                <nav
                  aria-label="Breadcrumb"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  {crumbs.map((c, i) => (
                    <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight size={12} className="opacity-40" />}
                      {c.to ? (
                        <Link to={c.to} className="transition-colors hover:text-foreground">
                          {c.label}
                        </Link>
                      ) : (
                        <span className="text-foreground">{c.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
              {title && (
                <h1 className="mt-2 text-[1.5rem] font-semibold tracking-tight md:text-[1.75rem]">
                  {title}
                </h1>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}

        <main className={cn("flex-1", padded && "px-4 py-8 md:px-6")}>{children}</main>
      </div>
    </div>
  );
}
