import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";

import { Button, Dropdown, OtpInput } from "../components";
import { apiBootstrapOrg, apiPreverifyOtp, apiSendOtpEmail } from "../api/auth";
import { COUNTRIES } from "../data/countries";
import { LANGUAGES, TIMEZONES } from "../data/options";
import { useAuth } from "../features/auth";
import type { AuthErrorPayload } from "../features/auth";
import { EASE, slideUp } from "../lib/animation";
import { isWorkEmail, WORK_EMAIL_MESSAGE } from "../lib/workEmail";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const labelClasses = "text-sm font-medium text-neutral-600";

const inputClasses =
  "w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-500 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldErrors = Record<string, string | undefined>;

type VerifyStatus = "idle" | "sending" | "awaiting_otp" | "verified";

interface FormState {
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  orgName: string;
  orgTimezone: string;
  orgLanguage: string;
  defaultRegion: string;
}

const INITIAL_FORM: FormState = {
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
  adminPasswordConfirm: "",
  orgName: "",
  orgTimezone: "Asia/Kolkata",
  orgLanguage: "en",
  defaultRegion: "",
};

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.span
          key={i}
          animate={{
            width: i === step ? 20 : 6,
            backgroundColor: i <= step ? "#0a0a0a" : "#d4d4d4",
          }}
          transition={{ duration: 0.3, ease: EASE }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClasses}>{label}</span>
      {children}
      {error && (
        <span className="text-xs font-medium text-red-600 mt-0.5" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const STEP_TITLES = [
  {
    title: "Your account",
    sub: "Set up your architect account and verify your work email.",
  },
  {
    title: "Organisation",
    sub: "Configure your tenant settings — name, timezone and language.",
  },
  {
    title: "Review & launch",
    sub: "Double-check everything before we create your workspace.",
  },
];

const TOTAL_STEPS = 3;

const CHECK_ICON = (
  <svg
    className="h-3.5 w-3.5"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
      clipRule="evenodd"
    />
  </svg>
);

export function OrgBootstrapPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Email verification (step 0) — required before continuing.
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const verifiedEmail = form.adminEmail.toLowerCase().trim();

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function resetVerification() {
    setVerifyStatus("idle");
    setVerifyToken(null);
    setVerifyError(null);
  }

  // ---------------------------------------------------------------------------
  // Email verification (step 0)
  // ---------------------------------------------------------------------------

  async function handleVerifyEmail() {
    setVerifyError(null);

    const email = form.adminEmail.trim().toLowerCase();
    if (!email) {
      setFieldErrors((prev) => ({ ...prev, adminEmail: "Email is required." }));
      return;
    }
    if (!isWorkEmail(email)) {
      setFieldErrors((prev) => ({ ...prev, adminEmail: WORK_EMAIL_MESSAGE }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, adminEmail: undefined }));
    setVerifyStatus("sending");

    try {
      await apiSendOtpEmail(email);
      setVerifyStatus("awaiting_otp");
    } catch (err) {
      setVerifyStatus("idle");
      const payload = err as AuthErrorPayload;
      setVerifyError(
        payload?.message ??
          "Failed to send the verification code. Please try again.",
      );
    }
  }

  async function handleOtpVerify(email: string, otp: string) {
    const res = await apiPreverifyOtp(email, otp);
    setVerifyToken(res.token);
    setVerifyStatus("verified");
  }

  // ---------------------------------------------------------------------------
  // Validation per step
  // ---------------------------------------------------------------------------

  function validateStep0(): FieldErrors {
    const errs: FieldErrors = {};
    if (!form.adminName.trim()) errs.adminName = "Name is required.";
    if (!form.adminEmail.trim()) {
      errs.adminEmail = "Email is required.";
    } else if (!isWorkEmail(form.adminEmail)) {
      errs.adminEmail = WORK_EMAIL_MESSAGE;
    }
    if (!form.adminPassword) {
      errs.adminPassword = "Password is required.";
    } else if (form.adminPassword.length < 8) {
      errs.adminPassword = "Password must be at least 8 characters.";
    }
    if (form.adminPassword !== form.adminPasswordConfirm) {
      errs.adminPasswordConfirm = "Passwords don't match.";
    }
    if (!errs.adminEmail && verifyStatus !== "verified") {
      errs.adminEmail = "Please verify your work email to continue.";
    }
    return errs;
  }

  function validateStep1(): FieldErrors {
    const errs: FieldErrors = {};
    if (!form.orgName.trim()) errs.orgName = "Organisation name is required.";
    if (!form.orgTimezone) errs.orgTimezone = "Timezone is required.";
    if (!form.defaultRegion.trim())
      errs.defaultRegion = "Default region is required.";
    return errs;
  }

  function nextStep() {
    setError(null);
    let errs: FieldErrors = {};

    if (step === 0) errs = validateStep0();
    if (step === 1) errs = validateStep1();

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function prevStep() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step < TOTAL_STEPS - 1) {
      nextStep();
      return;
    }

    if (verifyStatus !== "verified" || !verifyToken) {
      setStep(0);
      setFieldErrors({
        adminEmail: "Please verify your work email to continue.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiBootstrapOrg({
        adminName: form.adminName.trim(),
        adminEmail: verifiedEmail,
        adminPhone: form.adminPhone.trim() || undefined,
        adminPassword: form.adminPassword,
        orgName: form.orgName.trim(),
        orgTimezone: form.orgTimezone,
        orgLanguage: form.orgLanguage,
        defaultRegion: form.defaultRegion.trim(),
        emailVerificationToken: verifyToken,
      });

      setUser(res.user);
      void router.invalidate();
      void router.navigate({ to: "/connect-hrms" });
    } catch (err) {
      const payload = err as AuthErrorPayload;

      // Email grant expired/used/rejected mid-flow → re-verify.
      if (payload?.message?.toLowerCase().includes("verification")) {
        resetVerification();
        setStep(0);
      }

      if (payload?.errors) {
        const flat: FieldErrors = {};
        for (const [key, messages] of Object.entries(payload.errors)) {
          flat[key] = messages?.[0];
        }
        setFieldErrors(flat);

        // If admin field errors exist from server, switch to step 0
        if (
          flat.adminEmail ||
          flat.adminPassword ||
          flat.adminName ||
          flat.adminPhone
        ) {
          setStep(0);
        } else if (
          flat.orgName ||
          flat.orgTimezone ||
          flat.orgLanguage ||
          flat.defaultRegion
        ) {
          setStep(1);
        }
      }

      setError(payload?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const verified = verifyStatus === "verified";
  const verifyBtnLabel =
    verifyStatus === "sending" ? "Sending…" : "Verify email";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen font-sans flex flex-col items-center justify-center bg-neutral-50 p-6 overflow-x-hidden">
      <motion.div
        data-dropdown-bound
        initial={{ opacity: 0, y: 12, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/5 sm:p-8"
      >
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
              Agility OS
            </p>
            <StepDots step={step} total={TOTAL_STEPS} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <h1 className="mt-4 font-serif text-3xl font-medium tracking-normal text-neutral-950">
                {STEP_TITLES[step]!.title}
              </h1>
              <p className="mt-2 text-xs text-neutral-500">
                {STEP_TITLES[step]!.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              variants={slideUp}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col gap-4"
            >
              {/* ── Step 0: Account ── */}
              {step === 0 && (
                <>
                  <Field label="Full name" error={fieldErrors.adminName}>
                    <input
                      type="text"
                      value={form.adminName}
                      onChange={(e) => set("adminName", e.target.value)}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      className={inputClasses}
                    />
                  </Field>

                  <Field label="Work email" error={fieldErrors.adminEmail}>
                    <input
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => {
                        set("adminEmail", e.target.value);
                        if (verifyStatus !== "idle") resetVerification();
                      }}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className={inputClasses}
                    />

                    <AnimatePresence mode="popLayout" initial={false}>
                      {verifyStatus === "awaiting_otp" ? (
                        <motion.div
                          key="otp-card"
                          layout
                          initial={{ opacity: 0, y: -12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{
                            opacity: 0,
                            y: -12,
                            scale: 0.98,
                            transition: { duration: 0.22, ease: EASE },
                          }}
                          transition={{ duration: 0.35, ease: EASE }}
                          className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 space-y-2 mt-1"
                        >
                          <OtpInput
                            email={verifiedEmail}
                            onVerify={handleOtpVerify}
                            onResend={apiSendOtpEmail}
                            compact
                          />
                          <div className="text-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={resetVerification}
                            >
                              Cancel
                            </Button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="verify-btn"
                          layout
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{
                            opacity: 0,
                            y: 12,
                            scale: 0.98,
                            transition: { duration: 0.22, ease: EASE },
                          }}
                          transition={{ duration: 0.35, ease: EASE }}
                          className="mt-1 flex justify-start"
                        >
                          {verified ? (
                            <span
                              className="flex items-center gap-1.5 text-xs font-medium text-green-700"
                              role="status"
                            >
                              {CHECK_ICON}
                              {form.adminEmail.trim().toLowerCase()} is
                              verified.
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-fit"
                              loading={verifyStatus === "sending"}
                              onClick={() => void handleVerifyEmail()}
                            >
                              {verifyBtnLabel}
                            </Button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {verifyError && (
                      <span
                        className="text-xs font-medium text-red-600"
                        role="alert"
                      >
                        {verifyError}
                      </span>
                    )}
                  </Field>

                  <Field label="Password" error={fieldErrors.adminPassword}>
                    <input
                      type="password"
                      value={form.adminPassword}
                      onChange={(e) => set("adminPassword", e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className={inputClasses}
                    />
                  </Field>

                  <Field
                    label="Confirm password"
                    error={fieldErrors.adminPasswordConfirm}
                  >
                    <input
                      type="password"
                      value={form.adminPasswordConfirm}
                      onChange={(e) =>
                        set("adminPasswordConfirm", e.target.value)
                      }
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      className={inputClasses}
                    />
                  </Field>
                </>
              )}

              {/* ── Step 1: Org ── */}
              {step === 1 && (
                <>
                  <Field label="Organisation name" error={fieldErrors.orgName}>
                    <input
                      type="text"
                      value={form.orgName}
                      onChange={(e) => set("orgName", e.target.value)}
                      placeholder="Acme Corp"
                      className={inputClasses}
                    />
                  </Field>

                  <Field
                    label="Phone (optional)"
                    error={fieldErrors.adminPhone}
                  >
                    <input
                      type="tel"
                      value={form.adminPhone}
                      onChange={(e) => set("adminPhone", e.target.value)}
                      placeholder="+91 98765 43210"
                      autoComplete="tel"
                      className={inputClasses}
                    />
                  </Field>

                  <Field label="Timezone" error={fieldErrors.orgTimezone}>
                    <Dropdown
                      value={form.orgTimezone}
                      onChange={(v) => set("orgTimezone", v)}
                      options={TIMEZONES}
                      searchable
                      searchPlaceholder="Search timezone…"
                      placeholder="Select a timezone"
                      ariaLabel="Timezone"
                    />
                  </Field>

                  <Field
                    label="Default language"
                    error={fieldErrors.orgLanguage}
                  >
                    <Dropdown
                      value={form.orgLanguage}
                      onChange={(v) => set("orgLanguage", v)}
                      options={LANGUAGES}
                      searchable
                      searchPlaceholder="Search language…"
                      placeholder="Select a language"
                      ariaLabel="Default language"
                    />
                  </Field>

                  <Field
                    label="Default region"
                    error={fieldErrors.defaultRegion}
                  >
                    <Dropdown
                      value={form.defaultRegion}
                      onChange={(v) => set("defaultRegion", v)}
                      options={COUNTRIES}
                      searchable
                      searchPlaceholder="Search country…"
                      placeholder="Select a country"
                      emptyMessage="No matching country found."
                      ariaLabel="Default region"
                    />
                  </Field>
                </>
              )}

              {/* ── Step 2: Review ── */}
              {step === 2 && (
                <div className="space-y-3 text-sm">
                  <ReviewSection title="Account">
                    <ReviewRow label="Name" value={form.adminName} />
                    <ReviewRow label="Email" value={form.adminEmail} />
                    {form.adminPhone && (
                      <ReviewRow label="Phone" value={form.adminPhone} />
                    )}
                    <ReviewRow label="Role" value="Architect (tenant owner)" />
                  </ReviewSection>

                  <ReviewSection title="Organisation">
                    <ReviewRow label="Name" value={form.orgName} />
                    <ReviewRow label="Timezone" value={form.orgTimezone} />
                    <ReviewRow
                      label="Language"
                      value={
                        LANGUAGES.find((l) => l.value === form.orgLanguage)
                          ?.label ?? form.orgLanguage
                      }
                    />
                    <ReviewRow
                      label="Default region"
                      value={
                        COUNTRIES.find((c) => c.value === form.defaultRegion)
                          ?.label ?? form.defaultRegion
                      }
                    />
                  </ReviewSection>
                </div>
              )}

              {/* Global error */}
              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    key={error}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700"
                    role="alert"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Nav buttons */}
              <div className="flex gap-2 mt-1">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-4"
                    onClick={prevStep}
                    disabled={submitting}
                  >
                    Back
                  </Button>
                )}

                <Button
                  type="submit"
                  loading={submitting}
                  className={step > 0 ? "flex-1" : "w-full"}
                >
                  {step < TOTAL_STEPS - 1 ? "Continue" : "Create workspace"}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </form>

        {/* Login link */}
        <div className="mt-6 border-t border-neutral-200 pt-5 text-center">
          <p className="text-sm text-neutral-500">
            Already have an account?{" "}
            <Button
              variant="link"
              onClick={() => void router.navigate({ to: "/login" })}
            >
              Sign in
            </Button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2.5">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-600">{label}</span>
      <span className="font-medium text-neutral-950 text-right">{value}</span>
    </div>
  );
}
