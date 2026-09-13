import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useRouter } from "@tanstack/react-router";

import { Button } from "../components";
import { apiAcceptInvite, apiGetInvite } from "../api/auth";
import type { InvitePrefill } from "../api/auth";
import type { AuthErrorPayload } from "../features/auth";
import { useAuth } from "../features/auth";
import { EASE, slideUp } from "../lib/animation";

const labelClasses = "text-sm font-medium text-neutral-700";

const inputClasses =
  "w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-500 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

/** Human-readable role display names. */
const ROLE_LABELS: Record<string, string> = {
  architect: "Architect (Admin)",
  field_coach: "Field Coach",
  content_curator: "Content Curator",
  quality_gate: "Quality Gate",
  strategist: "Strategist",
  talent_steward: "Talent Steward",
  practitioner: "Practitioner",
};

type PageState = "loading" | "ready" | "invalid" | "expired" | "accepted";

export function InviteAcceptPage() {
  const { token } = useParams({ from: "/accept/$token" });
  const router = useRouter();
  const { setUser } = useAuth();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [prefill, setPrefill] = useState<InvitePrefill | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Load invite details on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!token) {
      setPageState("invalid");
      return;
    }

    apiGetInvite(token)
      .then((data) => {
        setPrefill(data);
        setPageState("ready");
      })
      .catch((err: AuthErrorPayload) => {
        const msg = err?.message ?? "";
        if (msg.toLowerCase().includes("expired")) {
          setPageState("expired");
        } else if (msg.toLowerCase().includes("already been used")) {
          setPageState("accepted");
        } else {
          setPageState("invalid");
        }
        setErrorMsg(msg || "This invite link is invalid.");
      });
  }, [token]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const errs: Record<string, string | undefined> = {};
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (password !== passwordConfirm)
      errs.passwordConfirm = "Passwords don't match.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);

    try {
      const activatedUser = await apiAcceptInvite(token!, password);
      setUser(activatedUser);
      void router.invalidate();
      void router.navigate({ to: "/" });
    } catch (err) {
      const payload = err as AuthErrorPayload;

      if (payload?.errors) {
        const flat: Record<string, string | undefined> = {};
        for (const [key, messages] of Object.entries(payload.errors)) {
          flat[key] = messages?.[0];
        }
        setFieldErrors(flat);
      }

      setErrorMsg(
        payload?.message ?? "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-sm text-neutral-700 font-medium"
        >
          Validating your invite…
        </motion.div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <StatusCard
        icon="⏱️"
        title="Invite expired"
        message="This link expired after 72 hours. Ask your admin to send a new invite."
      />
    );
  }

  if (pageState === "accepted") {
    return (
      <StatusCard
        icon="✅"
        title="Already activated"
        message="This invite has already been used. Sign in to continue."
        action={
          <Button onClick={() => void router.navigate({ to: "/login" })}>
            Go to sign in
          </Button>
        }
      />
    );
  }

  if (pageState === "invalid") {
    return (
      <StatusCard
        icon="🚫"
        title="Invalid invite"
        message={errorMsg ?? "This invite link is not valid."}
      />
    );
  }

  // pageState === "ready"
  const roleLabel = prefill?.role
    ? (ROLE_LABELS[prefill.role] ?? prefill.role)
    : "";

  return (
    <div className="min-h-screen font-sans flex flex-col items-center justify-center bg-neutral-50 p-6 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl shadow-neutral-900/5 sm:p-10"
      >
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
            Agility OS
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium tracking-normal text-neutral-950">
            {prefill?.name
              ? `Welcome, ${prefill.name.split(" ")[0]}`
              : "Activate your account"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            You've been invited to{" "}
            <strong className="font-semibold text-neutral-900">
              {prefill?.org.name}
            </strong>{" "}
            as{" "}
            <strong className="font-semibold text-neutral-900">
              {roleLabel}
            </strong>
            .
          </p>
        </header>

        {/* Prefill info badge */}
        {prefill?.email && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span className="text-sm font-medium text-neutral-600">
              Signing in as
            </span>
            <span className="ml-auto text-sm font-semibold text-neutral-950">
              {prefill.email}
            </span>
          </div>
        )}

        {/* Password form */}
        <form onSubmit={handleSubmit} noValidate>
          <motion.div
            variants={slideUp}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-5"
          >
            <label className="flex flex-col gap-1.5">
              <span className={labelClasses}>Create password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className={inputClasses}
              />
              {fieldErrors.password && (
                <span
                  className="text-xs font-medium text-red-600 mt-0.5"
                  role="alert"
                >
                  {fieldErrors.password}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClasses}>Confirm password</span>
              <input
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                className={inputClasses}
              />
              {fieldErrors.passwordConfirm && (
                <span
                  className="text-xs font-medium text-red-600 mt-0.5"
                  role="alert"
                >
                  {fieldErrors.passwordConfirm}
                </span>
              )}
            </label>

            {/* Global error */}
            <AnimatePresence initial={false}>
              {errorMsg && (
                <motion.div
                  key={errorMsg}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700"
                  role="alert"
                >
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" loading={submitting} className="mt-1 w-full">
              Activate account
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status card (expired / invalid / already accepted)
// ---------------------------------------------------------------------------

function StatusCard({
  icon,
  title,
  message,
  action,
}: {
  icon: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen font-sans flex flex-col items-center justify-center bg-neutral-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-10 shadow-xl shadow-neutral-900/5 text-center"
      >
        <p className="text-4xl mb-4" role="img" aria-label={title}>
          {icon}
        </p>
        <h1 className="font-serif text-2xl font-medium tracking-normal text-neutral-950 mb-2">
          {title}
        </h1>
        <p className="text-sm text-neutral-600 leading-relaxed mb-6">
          {message}
        </p>
        {action}
      </motion.div>
    </div>
  );
}
