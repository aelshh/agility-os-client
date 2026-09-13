import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button, Divider, OtpInput } from "../components";
import { useAuth } from "../features/auth";
import type { AuthErrorPayload } from "../features/auth";
import { apiResendOtp, apiVerifyOtp } from "../api/auth";
import { EASE, slideUp } from "../lib/animation";
import { isWorkEmail, WORK_EMAIL_MESSAGE } from "../lib/workEmail";

const labelClasses = "text-sm font-medium text-neutral-700";

const inputClasses =
  "w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-500 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

const GOOGLE_ICON = (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
    />
  </svg>
);

// Error messages from the OAuth redirect query param
const OAUTH_ERRORS: Record<string, string> = {
  state_mismatch:
    "The sign-in session expired or was interrupted. Please try again.",
  token_error: "Google Sign-In could not be completed. Please try again.",
  userinfo_error:
    "Could not retrieve your profile from Google. Please try again.",
  missing_claims:
    "Your Google account is missing required information. Please try a different account.",
  no_account:
    "No account found for this email. Create your workspace, then sign in with Google.",
  account_conflict:
    "An account with this email already exists. Try signing in with your email and password.",
  deactivated: "This account has been deactivated. Please contact your admin.",
  session_error: "Failed to create your session. Please try again.",
  error: "Something went wrong with Google Sign-In. Please try again.",
};

export function LoginPage() {
  const { signIn, setUser } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [submitting, setSubmitting] = useState(false);

  // Inline email-OTP verification (unverified account)
  const [showOtp, setShowOtp] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");

  // Show OAuth error as toast on mount, then clean the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("auth");

    if (authCode) {
      const message = OAUTH_ERRORS[authCode] ?? OAUTH_ERRORS.error;
      toast.error(message);
      // Clean the query param from the URL without navigation
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Client-side work-email check
  function validateEmail(value: string): string | undefined {
    if (!value) return undefined;
    if (!isWorkEmail(value)) return WORK_EMAIL_MESSAGE;
    return undefined;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      return;
    }

    setSubmitting(true);

    try {
      await signIn(email, password);
      void router.navigate({ to: "/" });
    } catch (err) {
      const payload = err as AuthErrorPayload;

      if (payload?.requiresVerification) {
        setVerifyEmail(payload.email ?? email);
        setShowOtp(true);
        return;
      }

      if (payload?.errors) {
        const flat: Record<string, string | undefined> = {};
        for (const [key, messages] of Object.entries(payload.errors)) {
          flat[key] = messages?.[0];
        }
        setFieldErrors(flat);
      }

      setError(payload?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(_email: string, otp: string) {
    const user = await apiVerifyOtp(_email, otp);
    setUser(user);
    void router.invalidate();
    void router.navigate({ to: "/" });
  }

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
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            {showOtp
              ? "Verify your email to finish signing in."
              : "Sign in with your work email to continue."}
          </p>
        </header>

        {showOtp && verifyEmail ? (
          <motion.div
            key="otp"
            variants={slideUp}
            initial="initial"
            animate="animate"
            className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3"
          >
            <p className="text-xs font-medium text-neutral-600">
              We've sent a 6-digit code to{" "}
              <span className="font-bold text-neutral-950">{verifyEmail}</span>.
              Enter it below to verify your account.
            </p>
            <OtpInput
              email={verifyEmail}
              onVerify={handleVerify}
              onResend={apiResendOtp}
              onCancel={() => {
                setShowOtp(false);
                setError(null);
              }}
            />
          </motion.div>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              <motion.div
                key="login"
                variants={slideUp}
                initial="initial"
                animate="animate"
                className="flex flex-col gap-5"
              >
                <label className="flex flex-col gap-1.5">
                  <span className={labelClasses}>Work email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className={inputClasses}
                  />
                  {fieldErrors.email && (
                    <span
                      className="text-xs font-medium text-red-600"
                      role="alert"
                    >
                      {fieldErrors.email}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClasses}>Password</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className={inputClasses}
                  />
                  {fieldErrors.password && (
                    <span
                      className="text-xs font-medium text-red-600"
                      role="alert"
                    >
                      {fieldErrors.password}
                    </span>
                  )}
                </label>

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

                <Button
                  type="submit"
                  loading={submitting}
                  className="mt-1 w-full"
                >
                  Sign in
                </Button>
              </motion.div>
            </form>

            {/* Divider */}
            <div className="my-7">
              <Divider />
            </div>

{/* Google OAuth — sign in only (existing work-email accounts).
            Account creation is manual-only via the OTP signup flow. */}
        <Button
          href="/api/auth/google"
          variant="outline"
          className="w-full"
          icon={GOOGLE_ICON}
        >
          Sign in with Google
        </Button>

            {/* Org setup link */}
            <p className="mt-8 text-center text-sm text-neutral-600">
              Setting up a new workspace?{" "}
              <Button
                variant="link"
                onClick={() => void router.navigate({ to: "/signup" })}
              >
                Create your org
              </Button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
