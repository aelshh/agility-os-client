import { motion } from "framer-motion";
import { useState } from "react";
import type { FormEvent } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button, Dropdown, Modal } from "../components";
import { COUNTRIES } from "../data/countries";
import { LANGUAGES } from "../data/options";
import { useAuth } from "../features/auth";
import type { AuthErrorPayload } from "../features/auth";
import type { ProfileData } from "../api/profile";
import { apiChangePassword, apiUpdateProfile } from "../api/profile";
import { pageVariants, fadeUp, EASE } from "../lib/animation";

const ROLE_LABELS: Record<string, string> = {
  architect: "Architect",
  field_coach: "Field Coach",
  content_curator: "Content Curator",
  quality_gate: "Quality Gate",
  strategist: "Strategist",
  talent_steward: "Talent Steward",
  practitioner: "Practitioner",
};

const SOURCE_LABELS: Record<string, string> = {
  hrms: "HRMS",
  csv: "CSV import",
  manual: "Manual",
};

const SIGN_IN_LABELS: Record<string, string> = {
  password: "Email & password",
  google: "Google",
};

const labelClasses = "text-sm font-medium text-neutral-600";

const inputClasses =
  "w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-500 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

type FieldErrors = Record<string, string | undefined>;

interface EditForm {
  name: string;
  phone: string;
  languagePref: string;
  region: string;
  image: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

// ---------------------------------------------------------------------------
// Small building blocks
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
        <span className="mt-0.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
        <h2 className="font-serif text-base font-medium text-neutral-950">
          {title}
        </h2>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-right text-sm font-medium text-neutral-950">
        {value ?? "—"}
      </span>
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// ProfilePage
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const { setUser } = useAuth();

  const loaded = useLoaderData({ from: "/protected/profile" });
  const [data, setData] = useState<ProfileData>(loaded);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    name: "",
    phone: "",
    languagePref: "en",
    region: "",
    image: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    newPasswordConfirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const user = data.user;
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "";
  const orgName = data?.org?.name;
  const canEditPassword = data?.signInMethod === "password";

  function startEditing() {
    if (!user) return;
    setForm({
      name: user.name ?? "",
      phone: user.phone ?? "",
      languagePref: user.languagePref ?? "en",
      region: user.region ?? "",
      image: user.image ?? "",
    });
    setFieldErrors({});
    setError(null);
    setEditing(true);
  }

  function set(field: keyof EditForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateForm(): FieldErrors {
    const errs: FieldErrors = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    const phone = form.phone.trim();
    if (phone && (phone.length < 7 || phone.length > 20)) {
      errs.phone = "Phone number must be between 7 and 20 characters.";
    }
    return errs;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updated = await apiUpdateProfile({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        languagePref: form.languagePref,
        region: form.region || null,
        image: form.image.trim() || null,
      });
      setUser(updated);
      setData((prev) => ({ ...prev, user: updated }));
      setEditing(false);
      toast.success("Profile updated.");
    } catch (err) {
      const payload = err as AuthErrorPayload;
      if (payload?.errors) {
        const flat: FieldErrors = {};
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

  function openPasswordModal() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      newPasswordConfirm: "",
    });
    setPasswordErrors({});
    setPasswordError(null);
    setPasswordOpen(true);
  }

  function setPasswordField(field: keyof PasswordForm, value: string) {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: FieldErrors = {};
    if (!passwordForm.currentPassword) {
      errs.currentPassword = "Current password is required.";
    }
    if (passwordForm.newPassword.length < 8) {
      errs.newPassword = "Password must be at least 8 characters.";
    }
    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) {
      errs.newPasswordConfirm = "Passwords don't match.";
    }
    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }

    setPasswordSubmitting(true);
    setPasswordError(null);

    try {
      await apiChangePassword(passwordForm);
      setPasswordOpen(false);
      toast.success("Password updated.");
    } catch (err) {
      const payload = err as AuthErrorPayload;
      if (payload?.errors) {
        const flat: FieldErrors = {};
        for (const [key, messages] of Object.entries(payload.errors)) {
          flat[key] = messages?.[0];
        }
        setPasswordErrors(flat);
      }
      setPasswordError(
        payload?.message ?? "Something went wrong. Please try again.",
      );
    } finally {
      setPasswordSubmitting(false);
    }
  }

  const employee = data.employee;
  const hireDate = employee ? formatDate(employee.hireDate) : null;
  const memberSince = formatDate(user.createdAt);

  return (
    <motion.div
      key="profile"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-10 sm:px-6"
    >
      {/* ── Identity card ── */}
      <motion.div
        variants={fadeUp}
        className="flex w-full flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-6 py-8 text-center shadow-sm sm:flex-row sm:text-left"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name ?? "Profile picture"}
            className="h-20 w-20 shrink-0 rounded-full border border-neutral-200 object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 font-serif text-2xl text-neutral-700">
            {initialsOf(user.name ?? "?")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
              {user.name ?? "—"}
            </h1>
            {data.isAdmin && (
              <span className="rounded-full border border-neutral-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-900">
                Admin
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-600">
            {roleLabel}
          </p>
          <p className="mt-0.5 text-sm text-neutral-500">
            {orgName ?? "No organisation"}
          </p>
        </div>
      </motion.div>

      {/* ── Contact & preferences ── */}
      <motion.div variants={fadeUp} className="w-full">
        <Card
          title="Contact & preferences"
          action={
            !editing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                Edit
              </Button>
            )
          }
        >
          {editing ? (
            <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
              <Field label="Full name" error={fieldErrors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  className={inputClasses}
                />
              </Field>

              <Field label="Phone" error={fieldErrors.phone}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                  className={inputClasses}
                />
              </Field>

              <Field label="Language" error={fieldErrors.languagePref}>
                <Dropdown
                  value={form.languagePref}
                  onChange={(v) => set("languagePref", v)}
                  options={LANGUAGES}
                  searchable
                  searchPlaceholder="Search language…"
                  placeholder="Select a language"
                  ariaLabel="Language"
                />
              </Field>

              <Field label="Region" error={fieldErrors.region}>
                <Dropdown
                  value={form.region}
                  onChange={(v) => set("region", v)}
                  options={COUNTRIES}
                  searchable
                  searchPlaceholder="Search country…"
                  placeholder="Select a country"
                  emptyMessage="No matching country found."
                  ariaLabel="Region"
                />
              </Field>

              <Field label="Profile picture (URL)" error={fieldErrors.image}>
                <input
                  type="url"
                  value={form.image}
                  onChange={(e) => set("image", e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  className={inputClasses}
                />
              </Field>

              {form.image.trim() && (
                <img
                  src={form.image}
                  alt="Profile picture preview"
                  className="h-16 w-16 rounded-full border border-neutral-200 object-cover"
                />
              )}

              <AnimatedError message={error} />

              <div className="mt-1 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  Save changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-neutral-100">
              <InfoRow
                label="Email"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span className="break-all">{user.email ?? "—"}</span>
                    {user.emailVerified && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Verified
                      </span>
                    )}
                  </span>
                }
              />
              <InfoRow label="Phone" value={user.phone} />
              <InfoRow
                label="Language"
                value={
                  LANGUAGES.find((l) => l.value === user.languagePref)
                    ?.label ?? user.languagePref
                }
              />
              <InfoRow
                label="Region"
                value={
                  COUNTRIES.find((c) => c.value === user.region)?.label ??
                  user.region
                }
              />
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Account ── */}
      <motion.div variants={fadeUp} className="w-full">
        <Card title="Account">
          <div className="divide-y divide-neutral-100">
            <InfoRow label="Role" value={roleLabel} />
            <InfoRow
              label="Sign-in method"
              value={
                data.signInMethod
                  ? (SIGN_IN_LABELS[data.signInMethod] ?? data.signInMethod)
                  : "—"
              }
            />
            <InfoRow label="Member since" value={memberSince} />
            {user.source && (
              <InfoRow
                label="Added via"
                value={SOURCE_LABELS[user.source] ?? user.source}
              />
            )}
          </div>

          {canEditPassword && (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <Button variant="outline" size="sm" onClick={openPasswordModal}>
                Change password
              </Button>
            </div>
          )}

          {data.signInMethod === "google" && (
            <p className="mt-4 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
              This account signs in with Google and doesn't use a password.
            </p>
          )}
        </Card>
      </motion.div>

      {/* ── HRMS record (read-only) ── */}
      <motion.div variants={fadeUp} className="w-full">
        <Card title="HRMS record">
          {employee ? (
            <>
              <div className="divide-y divide-neutral-100">
                <InfoRow label="Designation" value={employee.designation} />
                <InfoRow label="Department" value={employee.department} />
                <InfoRow label="Team" value={data.team?.name} />
                <InfoRow
                  label="Manager"
                  value={data.manager?.name ?? data.manager?.email}
                />
                <InfoRow label="Region (HRMS)" value={employee.region} />
                <InfoRow label="Hire date" value={hireDate} />
                <InfoRow
                  label="Classification"
                  value={employee.isSales ? "Sales role" : "Non-sales role"}
                />
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Managed by HRMS and kept in sync. Contact your admin to update
                this information.
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              No HRMS record linked to this account yet.
            </p>
          )}
        </Card>
      </motion.div>

      {/* ── Change password modal ── */}
      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change password"
        description="Enter your current password, then choose a new one (at least 8 characters)."
      >
        <form onSubmit={handlePasswordSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Current password" error={passwordErrors.currentPassword}>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordField("currentPassword", e.target.value)}
              autoComplete="current-password"
              className={inputClasses}
            />
          </Field>

          <Field label="New password" error={passwordErrors.newPassword}>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordField("newPassword", e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className={inputClasses}
            />
          </Field>

          <Field
            label="Confirm new password"
            error={passwordErrors.newPasswordConfirm}
          >
            <input
              type="password"
              value={passwordForm.newPasswordConfirm}
              onChange={(e) =>
                setPasswordField("newPasswordConfirm", e.target.value)
              }
              placeholder="Repeat new password"
              autoComplete="new-password"
              className={inputClasses}
            />
          </Field>

          <AnimatedError message={passwordError} />

          <div className="mt-1 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPasswordOpen(false)}
              disabled={passwordSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={passwordSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}

function AnimatedError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700"
      role="alert"
    >
      {message}
    </motion.div>
  );
}