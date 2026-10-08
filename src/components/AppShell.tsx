import { AnimatePresence, motion } from "framer-motion";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { useAuth } from "../features/auth";
import type { AuthUser } from "../features/auth";
import { useAppStore } from "../store/app.store";
import { cn } from "../lib/cn";
import { EASE } from "../lib/animation";
import { RouteLoadingOverlay } from "./RouteLoadingOverlay";
import { Spinner } from "../components";

import {
  SquaresFour,
  UserCircle,
  GraduationCap,
  CheckSquareOffset,
  CalendarCheck,
  ChatCircleDots,
  Headset,
  PlugsConnected,
  SignOut,
  CaretDoubleLeft,
  CaretDoubleRight,
  List,
  X,
} from "@phosphor-icons/react";

const ROLE_LABELS: Record<string, string> = {
  architect: "Architect",
  field_coach: "Field Coach",
  content_curator: "Content Curator",
  quality_gate: "Quality Gate",
  strategist: "Strategist",
  talent_steward: "Talent Steward",
  practitioner: "Practitioner",
};

function initialsOf(name: string | null | undefined): string {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Shared pieces (desktop sidebar + mobile drawer)
// ---------------------------------------------------------------------------

function SidebarLink({
  to,
  label,
  expanded,
  active,
  icon,
  onClick,
}: {
  to: string;
  label: string;
  expanded: boolean;
  active: boolean;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={expanded ? undefined : label}
      aria-label={expanded ? undefined : label}
      className={cn(
        "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
        expanded ? "px-3 py-2.5" : "justify-center px-0 py-2.5",
        active
          ? "bg-neutral-900 text-white shadow-xs font-semibold"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
      )}
    >
      <span className="shrink-0 transition-transform duration-150 group-hover:scale-110">
        {icon}
      </span>
      {expanded && <span className="truncate whitespace-nowrap">{label}</span>}
    </Link>
  );
}

function IconButton({
  onClick,
  title,
  icon,
  className,
}: {
  onClick: () => void;
  title: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "rounded-lg p-2 text-neutral-500 transition-all hover:bg-neutral-100 hover:text-neutral-900 active:scale-95",
        className,
      )}
    >
      {icon}
    </button>
  );
}

function Avatar({ user }: { user: AuthUser | null }) {
  if (user?.image) {
    return (
      <img
        src={user.image}
        alt={user.name ?? "Profile picture"}
        className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover shadow-xs"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-700 shadow-xs">
      {initialsOf(user?.name)}
    </span>
  );
}

function IntegrationsCard({ expanded }: { expanded: boolean }) {
  if (!expanded) {
    return (
      <div className="px-2 pb-2">
        <Link
          to="/integrations"
          title="Integrations"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200/60 bg-teal-50/50 text-teal-700 transition-all hover:bg-teal-100/70 hover:shadow-xs"
        >
          <PlugsConnected size={19} weight="duotone" className="text-teal-600" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <Link
        to="/integrations"
        className="group flex items-center gap-3 overflow-hidden rounded-xl border border-neutral-200/70 bg-gradient-to-br from-neutral-50 to-neutral-100/50 p-2.5 transition-all hover:border-teal-300 hover:bg-teal-50/30 hover:shadow-xs"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-200/60 bg-white text-teal-600 shadow-xs transition-transform group-hover:scale-110">
          <PlugsConnected size={18} weight="duotone" className="text-teal-600" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-neutral-800 group-hover:text-neutral-950">
            Integrations
          </span>
          <span className="truncate text-[11px] font-medium text-teal-700/80">
            Voice AI & Telephony
          </span>
        </div>
      </Link>
    </div>
  );
}

function UserFooter({
  user,
  expanded,
  signOut,
}: {
  user: AuthUser | null;
  expanded: boolean;
  signOut: () => void;
}) {
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "";

  if (!expanded) {
    return (
      <div className="flex flex-col items-center gap-1 border-t border-neutral-100 p-2">
        <Avatar user={user} />
        <IconButton
          onClick={signOut}
          title="Sign out"
          icon={<SignOut size={18} weight="duotone" className="text-neutral-500 hover:text-rose-600" />}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-t border-neutral-100 p-3">
      <Avatar user={user} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold text-neutral-950">
          {user?.name ?? "—"}
        </p>
        <p className="truncate text-xs text-neutral-500">{roleLabel}</p>
      </div>
      <IconButton
        onClick={signOut}
        title="Sign out"
        icon={<SignOut size={18} weight="duotone" className="text-neutral-500 hover:text-rose-600" />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content-area loader (shown while a lazy page chunk loads)
// ---------------------------------------------------------------------------

function ContentLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-neutral-700">
        <Spinner size="md" className="text-neutral-700" />
        Loading&hellip;
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export function AppShell() {
  const { user, signOut } = useAuth();
  const {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    sidebarCollapsed,
    toggleSidebarCollapsed,
  } = useAppStore();
  const pathname = useRouterState().location.pathname;

  const navItems = [
    {
      to: "/",
      label: "Dashboard",
      icon: (active: boolean) => (
        <SquaresFour
          size={20}
          weight="duotone"
          className={active ? "text-indigo-400" : "text-neutral-500 group-hover:text-indigo-600"}
        />
      ),
    },
    {
      to: "/profile",
      label: "Profile",
      icon: (active: boolean) => (
        <UserCircle
          size={20}
          weight="duotone"
          className={active ? "text-neutral-300" : "text-neutral-500 group-hover:text-neutral-900"}
        />
      ),
    },
  ];
  if (user?.role === "content_curator" || user?.role === "architect") {
    navItems.push({
      to: "/courses",
      label: "Courses",
      icon: (active: boolean) => (
        <GraduationCap
          size={20}
          weight="duotone"
          className={active ? "text-emerald-400" : "text-neutral-500 group-hover:text-emerald-600"}
        />
      ),
    });
    navItems.push({
      to: "/schedule",
      label: "Schedule Calendar",
      icon: (active: boolean) => (
        <CalendarCheck
          size={20}
          weight="duotone"
          className={active ? "text-blue-400" : "text-neutral-500 group-hover:text-blue-600"}
        />
      ),
    });
    navItems.push({
      to: "/calls",
      label: "Call Logs",
      icon: (active: boolean) => (
        <Headset
          size={20}
          weight="duotone"
          className={active ? "text-sky-400" : "text-neutral-500 group-hover:text-sky-600"}
        />
      ),
    });
  }
  if (user?.role === "architect") {
    navItems.push({
      to: "/courses/approvals",
      label: "Approvals",
      icon: (active: boolean) => (
        <CheckSquareOffset
          size={20}
          weight="duotone"
          className={active ? "text-amber-400" : "text-neutral-500 group-hover:text-amber-600"}
        />
      ),
    });
  }
  if (user?.role && user.role !== "practitioner") {
    navItems.push({
      to: "/checkins",
      label: "Check-ins",
      icon: (active: boolean) => (
        <ChatCircleDots
          size={20}
          weight="duotone"
          className={active ? "text-purple-400" : "text-neutral-500 group-hover:text-purple-600"}
        />
      ),
    });
  }

  const isActive = (to: string) => {
    if (to === "/") return pathname === "/";
    if (to === "/courses") {
      return (
        pathname === "/courses" ||
        pathname === "/courses/new" ||
        /^\/courses\/[^/]+\/edit$/.test(pathname)
      );
    }
    if (to === "/schedule") {
      return pathname === "/schedule" || pathname === "/calendar";
    }
    return pathname === to;
  };

  const expanded = !sidebarCollapsed;

  const renderNav = (navExpanded: boolean, onNavigate?: () => void) =>
    navItems.map((item) => {
      const active = isActive(item.to);
      return (
        <SidebarLink
          key={item.to}
          to={item.to}
          label={item.label}
          expanded={navExpanded}
          active={active}
          icon={item.icon(active)}
          onClick={onNavigate}
        />
      );
    });

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-neutral-50 font-sans">
      {/* ── Desktop sidebar (collapsible icon rail) ── */}
      <motion.aside
        animate={{ width: expanded ? 256 : 64 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="z-30 hidden h-full shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white md:flex"
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-neutral-100",
            expanded ? "justify-between gap-2 px-3" : "justify-center px-0",
          )}
        >
          {expanded ? (
            <Link
              to="/"
              className="truncate px-2 font-serif text-lg font-medium tracking-normal text-neutral-950"
            >
              Agility OS
            </Link>
          ) : (
            <Link
              to="/"
              aria-label="Agility OS home"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 font-serif text-base font-medium text-neutral-950"
            >
              A
            </Link>
          )}
          {expanded && (
            <IconButton
              onClick={toggleSidebarCollapsed}
              title="Collapse sidebar"
              icon={<CaretDoubleLeft size={18} weight="bold" />}
            />
          )}
        </div>

        <nav className="flex flex-col gap-1 p-2">
          {renderNav(expanded)}
          {!expanded && (
            <IconButton
              onClick={toggleSidebarCollapsed}
              title="Expand sidebar"
              icon={<CaretDoubleRight size={18} weight="bold" />}
              className="mx-auto mt-1"
            />
          )}
        </nav>

        <div className="mt-auto">
          {user?.role === "architect" && (
            <IntegrationsCard expanded={expanded} />
          )}
          <UserFooter user={user} expanded={expanded} signOut={signOut} />
        </div>
      </motion.aside>

      {/* ── Content column ── */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link
            to="/"
            className="font-serif text-lg font-medium tracking-normal text-neutral-950"
          >
            Agility OS
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={sidebarOpen}
            onClick={toggleSidebar}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <List size={20} weight="bold" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <Suspense fallback={<ContentLoader />}>
            <Outlet />
          </Suspense>
        </main>

        <RouteLoadingOverlay />
      </div>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-[2px] md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white p-3 shadow-2xl md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              <div className="mb-4 flex h-12 items-center justify-between px-2">
                <span className="font-serif text-lg font-medium text-neutral-950">
                  Agility OS
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg border border-neutral-200 p-2 text-neutral-700 transition-colors hover:bg-neutral-100"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {renderNav(true, () => setSidebarOpen(false))}
              </nav>

              <div className="mt-auto">
                {user?.role === "architect" && (
                  <IntegrationsCard expanded={true} />
                )}
                <UserFooter
                  user={user}
                  expanded
                  signOut={signOut}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}