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
// Icons
// ---------------------------------------------------------------------------

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

function ProfileIcon() {
  return (
    <Icon>
      <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </Icon>
  );
}

function SignOutIcon() {
  return (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  );
}

function CollapseIcon() {
  return (
    <Icon>
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </Icon>
  );
}

function ExpandIcon() {
  return (
    <Icon>
      <path d="m13 17 5-5-5-5" />
      <path d="m6 17 5-5-5-5" />
    </Icon>
  );
}

function HamburgerIcon() {
  return (
    <Icon>
      <path d="M3 5h14M3 10h14M3 15h14" />
    </Icon>
  );
}

function CloseIcon() {
  return (
    <Icon>
      <path d="m6 6 8 8M14 6l-8 8" />
    </Icon>
  );
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
        "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
        expanded ? "px-3 py-2.5" : "justify-center px-0 py-2.5",
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
      )}
    >
      {icon}
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
        "rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
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
        className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-700">
      {initialsOf(user?.name)}
    </span>
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
          icon={<SignOutIcon />}
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
        icon={<SignOutIcon />}
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
    { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
    { to: "/profile", label: "Profile", icon: <ProfileIcon /> },
  ];

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const expanded = !sidebarCollapsed;

  const renderNav = (navExpanded: boolean, onNavigate?: () => void) =>
    navItems.map((item) => (
      <SidebarLink
        key={item.to}
        to={item.to}
        label={item.label}
        expanded={navExpanded}
        active={isActive(item.to)}
        icon={item.icon}
        onClick={onNavigate}
      />
    ));

  return (
    <div className="min-h-screen bg-neutral-50 font-sans md:flex">
      {/* ── Desktop sidebar (collapsible icon rail) ── */}
      <motion.aside
        animate={{ width: expanded ? 256 : 64 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="sticky top-0 z-30 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white md:flex"
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
              icon={<CollapseIcon />}
            />
          )}
        </div>

        <nav className="flex flex-col gap-1 p-2">
          {renderNav(expanded)}
          {!expanded && (
            <IconButton
              onClick={toggleSidebarCollapsed}
              title="Expand sidebar"
              icon={<ExpandIcon />}
              className="mx-auto"
            />
          )}
        </nav>

        <div className="mt-auto">
          <UserFooter user={user} expanded={expanded} signOut={signOut} />
        </div>
      </motion.aside>

      {/* ── Content column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur md:hidden">
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
            <HamburgerIcon />
          </button>
        </div>

        <main className="flex-1">
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
                  <CloseIcon />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {renderNav(true, () => setSidebarOpen(false))}
              </nav>

              <div className="mt-auto">
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