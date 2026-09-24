import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@tanstack/react-router";

import { useAuth } from "../features/auth";
import { pageVariants, stagger, fadeUp } from "../lib/animation";
import { OrgTreeView } from "../features/org-tree/OrgTreeView";
import { apiGetOrgTree } from "../api/hrms";
import type { OrgTreeData } from "../api/hrms";

const ROLE_LABELS: Record<string, string> = {
  architect: "Architect",
  field_coach: "Field Coach",
  content_curator: "Content Curator",
  quality_gate: "Quality Gate",
  strategist: "Strategist",
  talent_steward: "Talent Steward",
  practitioner: "Practitioner",
};

/**
 * Small admin nudge: how many teammates still need an invite to the app.
 * Only rendered when the viewer is an admin AND eligible invitees exist.
 */
function TeammatesToInviteCard() {
  const { user } = useAuth();
  const [tree, setTree] = useState<OrgTreeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGetOrgTree()
      .then((data) => {
        if (cancelled) return;
        setTree(data);
      })
      .catch(() => {
        if (cancelled) return;
        setTree(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eligible = useMemo(() => {
    if (!tree?.viewerIsAdmin || !user) return 0;
    return tree.employees.filter(
      (e) =>
        e.userId &&
        e.userId !== user.id &&
        e.userStatus === "invited" &&
        e.email,
    ).length;
  }, [tree, user]);

  if (!tree?.viewerIsAdmin || eligible === 0) return null;

  return (
    <div className="w-full max-w-5xl">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {eligible} teammate{eligible === 1 ? "" : "s"} still to invite
          </p>
          <p className="text-xs text-neutral-600">
            Send them an email invite so they can set up their account and join
            the org tree.
          </p>
        </div>
        <svg
          className="h-5 w-5 shrink-0 text-amber-600"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="14" height="12" rx="2" />
          <path d="m3 6 7 5 7-5" />
        </svg>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      void router.navigate({ to: "/login" });
    }
  }, [loading, user, router]);

  if (!user) {
    return null;
  }

  const roleLabel = user.role ? (ROLE_LABELS[user.role] ?? user.role) : "";

  return (
    <motion.div
      key="dashboard"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-screen flex-col items-center justify-start gap-8 bg-neutral-50 px-4 py-6 font-sans sm:px-6 lg:p-8"
    >
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex flex-col items-center gap-4"
      >
        {user?.image && (
          <motion.img
            variants={fadeUp}
            src={user.image}
            alt={user.name ?? "Profile picture"}
            className="h-16 w-16 rounded-full border border-neutral-200 object-cover"
          />
        )}

        <motion.div
          variants={fadeUp}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700"
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
          {roleLabel}
        </motion.div>
      </motion.div>

      <motion.header
        variants={fadeUp}
        initial="initial"
        animate="animate"
        className="max-w-md text-center"
      >
        <h1 className="font-serif text-4xl font-medium tracking-normal text-neutral-950">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : " back"}
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-600">
          {user?.email}
        </p>
      </motion.header>

      <TeammatesToInviteCard />

      <motion.section
        variants={fadeUp}
        initial="initial"
        animate="animate"
        className="w-full max-w-5xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-medium text-neutral-950">
              Org tree
            </h2>
            <p className="text-xs text-neutral-500">
              Built from your HRMS employee directory. Click a node to expand
              it and open its details; drag to rearrange, scroll to zoom.
            </p>
          </div>
        </div>
        <div className="h-[420px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm sm:h-[540px]">
          <OrgTreeView />
        </div>
      </motion.section>
    </motion.div>
  );
}
