import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "@tanstack/react-router";

import { useAuth } from "../features/auth";
import { Button } from "../components";
import { pageVariants, stagger, fadeUp } from "../lib/animation";
import { OrgTreeView } from "../features/org-tree/OrgTreeView";

const ROLE_LABELS: Record<string, string> = {
  architect: "Architect",
  field_coach: "Field Coach",
  content_curator: "Content Curator",
  quality_gate: "Quality Gate",
  strategist: "Strategist",
  talent_steward: "Talent Steward",
  practitioner: "Practitioner",
};

export function DashboardPage() {
  const { user, loading, signOut } = useAuth();
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
      className="min-h-screen font-sans flex flex-col items-center justify-start gap-8 bg-neutral-50 p-8"
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
              Built from your HRMS employee directory. Click a node to collapse
              its subtree; drag to rearrange, scroll to zoom.
            </p>
          </div>
        </div>
        <div className="h-[540px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <OrgTreeView />
        </div>
      </motion.section>

      <Button
        variants={fadeUp}
        initial="initial"
        animate="animate"
        variant="outline"
        onClick={signOut}
        className="px-5"
      >
        Sign out
      </Button>
    </motion.div>
  );
}
