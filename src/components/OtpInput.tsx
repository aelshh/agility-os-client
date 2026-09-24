import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "./Button";
import type { AuthErrorPayload } from "../features/auth";
import { EASE } from "../lib/animation";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 60;

const otpInputClasses =
  "h-14 min-w-0 max-w-12 flex-1 text-center text-lg font-semibold rounded-xl border border-neutral-300 bg-neutral-50/70 text-neutral-950 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

const otpInputCompactClasses =
  "h-11 min-w-0 max-w-9 flex-1 text-center text-base font-semibold rounded-lg border border-neutral-300 bg-neutral-50/70 text-neutral-950 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

type OtpInputProps = {
  email: string;
  /** Called with the completed code. Rejects with AuthErrorPayload on failure;
   * resolves on success — the parent decides what success means. */
  onVerify: (email: string, otp: string) => Promise<unknown>;
  /** Issues a fresh code. */
  onResend: (email: string) => Promise<void>;
  onCancel?: () => void;
  /** Compact sizing for embed inside forms/cards. */
  compact?: boolean;
};

export function OtpInput({
  email,
  onVerify,
  onResend,
  onCancel,
  compact = false,
}: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Parent sends a fresh code right before mounting us, so begin the resend
  // countdown immediately — the UI never lets the user request twice in a row.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submittingRef = useRef(false);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const focusInput = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  }, []);

  async function verifyCode(code: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await onVerify(email, code);
    } catch (err) {
      const payload = err as AuthErrorPayload;
      setError(
        payload?.message ?? "Something went wrong. Please try again.",
      );
      setDigits(Array(OTP_LENGTH).fill(""));
      focusInput(0);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const handleChange = useCallback(
    (index: number, value: string) => {
      setError(null);

      // Handle paste (multi-char)
      if (value.length > 1) {
        const pasted = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
        const next = [...digits];
        let lastFilled = index;
        for (let i = 0; i < pasted.length && index + i < OTP_LENGTH; i++) {
          next[index + i] = pasted[i];
          lastFilled = index + i;
        }
        setDigits(next);
        focusInput(Math.min(lastFilled + 1, OTP_LENGTH - 1));

        if (next.every((d) => d !== "")) {
          void verifyCode(next.join(""));
        }
        return;
      }

      // Single digit
      const digit = value.replace(/\D/g, "").slice(-1);
      const next = [...digits];
      next[index] = digit;
      setDigits(next);

      if (digit && index < OTP_LENGTH - 1) {
        focusInput(index + 1);
      }

      // Auto-submit when last digit entered
      if (digit && index === OTP_LENGTH - 1 && next.every((d) => d !== "")) {
        void verifyCode(next.join(""));
      }
    },
    [digits, focusInput],
  );

  const handleKeyDown = useCallback(
    (index: number, key: string) => {
      if (key === "Backspace" && !digits[index] && index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        focusInput(index - 1);
      }
    },
    [digits, focusInput],
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await onResend(email);
      toast.success("A new code has been sent.");
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      toast.error("Failed to resend code. Try again later.");
    } finally {
      setResending(false);
    }
  }, [email, cooldown, resending, onResend]);

  return (
    <div className={`flex flex-col ${compact ? "gap-3" : "gap-5"}`}>
      <div className={`flex justify-center ${compact ? "gap-1.5" : "gap-2.5"}`}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH - i}
            value={digits[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e.key)}
            onFocus={(e) => e.target.select()}
            disabled={submitting}
            className={compact ? otpInputCompactClasses : otpInputClasses}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      {/* Error */}
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            key={error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
            className={
              compact
                ? "rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-xs font-medium text-red-700"
                : "rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700"
            }
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="button"
        size={compact ? "sm" : undefined}
        loading={submitting}
        disabled={digits.some((d) => !d)}
        onClick={() => void verifyCode(digits.join(""))}
        className="w-full"
      >
        Verify
      </Button>

      {/* Resend */}
      <p
        className={`text-center text-neutral-600 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        Didn't receive the code?{" "}
        <span className="inline-block w-24 text-left">
          {cooldown > 0 || resending ? (
            <span className="font-medium tabular-nums text-neutral-400">
              {resending ? "Resending…" : `Resend in ${cooldown}s`}
            </span>
          ) : (
            <Button
              variant="link"
              loading={resending}
              onClick={() => void handleResend()}
            >
              Resend code
            </Button>
          )}
        </span>
      </p>

      {/* Cancel */}
      {onCancel && (
        <p
          className={`text-center text-neutral-600 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          <Button variant="link" onClick={onCancel}>
            Back to sign in
          </Button>
        </p>
      )}
    </div>
  );
}