import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "../features/auth";
import { Button, Modal } from "../components";
import { PlugsConnected } from "@phosphor-icons/react";
import { IconBadge } from "../components/ui/IconBadge";
import { pageVariants, fadeUp } from "../lib/animation";
import {
  apiGetTelenowStatus,
  apiSaveTelenowKey,
  apiDisconnectTelenow,
  type TelenowIntegrationStatus,
} from "../api/telenow";
import { PhoneNumbersTable } from "../features/telephony/PhoneNumbersTable";
import { WhatsAppChannelsCard } from "../features/whatsapp";
const labelClasses = "text-sm font-medium text-neutral-600";
const inputClasses =
  "w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-500 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

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

export function IntegrationsPage() {
  const { user } = useAuth();
  const [telenowStatus, setTelenowStatus] = useState<TelenowIntegrationStatus | null>(null);
  const [telenowLoading, setTelenowLoading] = useState(false);
  const [telenowModalOpen, setTelenowModalOpen] = useState(false);
  const [telenowApiKeyInput, setTelenowApiKeyInput] = useState("");
  const [telenowSaving, setTelenowSaving] = useState(false);
  const [telenowError, setTelenowError] = useState<string | null>(null);
  const [telenowDisconnecting, setTelenowDisconnecting] = useState(false);

  useEffect(() => {
    if (user?.role === "architect") {
      setTelenowLoading(true);
      apiGetTelenowStatus()
        .then((status) => setTelenowStatus(status))
        .catch((err) => console.error("Failed to load Telenow status:", err))
        .finally(() => setTelenowLoading(false));
    }
  }, [user?.role]);

  async function handleTelenowSave(e: FormEvent) {
    e.preventDefault();
    if (!telenowApiKeyInput.trim()) {
      setTelenowError("API key cannot be empty.");
      return;
    }
    setTelenowSaving(true);
    setTelenowError(null);
    try {
      const res = await apiSaveTelenowKey(telenowApiKeyInput.trim());
      setTelenowStatus(res);
      toast.success("Voice AI connected successfully!");
      setTelenowModalOpen(false);
      setTelenowApiKeyInput("");
    } catch (err) {
      setTelenowError((err as Error).message || "Failed to connect API key.");
    } finally {
      setTelenowSaving(false);
    }
  }

  async function handleTelenowDisconnect() {
    if (
      !window.confirm(
        "Are you sure you want to disconnect Voice AI? Courses and daily check-ins cannot be run without an active integration.",
      )
    ) {
      return;
    }
    setTelenowDisconnecting(true);
    try {
      await apiDisconnectTelenow();
      setTelenowStatus({
        configured: false,
        maskedKey: null,
        telenowOrgId: null,
        connectedAt: null,
        webhookRegistered: false,
      });
      toast.success("Voice AI integration disconnected.");
    } catch (err) {
      toast.error((err as Error).message || "Failed to disconnect.");
    } finally {
      setTelenowDisconnecting(false);
    }
  }

  if (user?.role !== "architect") {
    return <div className="p-8 text-neutral-600">Access denied.</div>;
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-screen flex-col items-center gap-8 bg-neutral-50 px-4 py-6 font-sans sm:px-6 lg:p-8"
    >
      <motion.div
        variants={fadeUp}
        className="flex w-full max-w-4xl flex-col items-start gap-4 sm:flex-row sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-3.5">
            <IconBadge icon={PlugsConnected} variant="teal" size="lg" weight="duotone" />
            <div>
              <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
                Integrations
              </h1>
              <p className="mt-1 text-sm font-medium text-neutral-600">
                Connected telephony, AI engine, and HRMS directory services.
              </p>
            </div>
          </div>
          <p className="mt-1 text-sm font-medium text-neutral-600">
            Manage your organization's external telephony and service connections.
          </p>
        </div>
      </motion.div>

      <div className="w-full max-w-4xl flex flex-col gap-6">
        <motion.div variants={fadeUp} className="w-full">
          <Card
            title="Voice AI Integration"
            action={
              telenowStatus?.configured ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTelenowApiKeyInput("");
                      setTelenowError(null);
                      setTelenowModalOpen(true);
                    }}
                  >
                    Update key
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={telenowDisconnecting}
                    onClick={handleTelenowDisconnect}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setTelenowApiKeyInput("");
                    setTelenowError(null);
                    setTelenowModalOpen(true);
                  }}
                >
                  Connect Voice AI
                </Button>
              )
            }
          >
            {telenowLoading ? (
              <p className="py-2 text-sm text-neutral-500">Loading integration status...</p>
            ) : telenowStatus?.configured ? (
              <div className="divide-y divide-neutral-100">
                <InfoRow
                  label="Status"
                  value={
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Connected
                    </span>
                  }
                />
                <InfoRow
                  label="API key"
                  value={
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800">
                      {telenowStatus.maskedKey}
                    </code>
                  }
                />
                <InfoRow label="Workspace ID" value={telenowStatus.telenowOrgId} />
                <InfoRow
                  label="Connected at"
                  value={formatDate(telenowStatus.connectedAt)}
                />
                <InfoRow
                  label="Webhook endpoint"
                  value={
                    telenowStatus.webhookRegistered ? (
                      <span className="text-xs font-medium text-emerald-600">
                        Registered & active
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600">
                        Pending registration
                      </span>
                    )
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4 py-1">
                <p className="text-sm leading-relaxed text-neutral-600">
                  Voice AI powers voice deliberate practice drills, AI roleplay personas, and automated daily check-in calls. Connect your organization&apos;s Voice AI API key to activate telephony calling for your practitioners.
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/80 p-3 text-xs text-amber-800">
                  <span className="shrink-0 font-semibold">Required:</span>
                  <span>Courses and daily check-ins require an active Voice AI connection before they can be provisioned or run.</span>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="w-full">
          <WhatsAppChannelsCard
            voiceAiConfigured={Boolean(telenowStatus?.configured)}
          />
        </motion.div>

        {telenowStatus?.configured && (
          <motion.div variants={fadeUp} className="w-full">
            <Card title="Phone Lines & Course Assignment">
              <PhoneNumbersTable />
            </Card>
          </motion.div>
        )}
      </div>

      <Modal
        open={telenowModalOpen}
        onClose={() => setTelenowModalOpen(false)}
        title={telenowStatus?.configured ? "Update Voice AI key" : "Connect Voice AI"}
        description="Enter your organization's Voice AI API key to enable live phone coaching and check-ins."
      >
        <form onSubmit={handleTelenowSave} noValidate className="flex flex-col gap-4">
          <Field label="Voice AI API key" error={telenowError ?? undefined}>
            <input
              type="password"
              className={inputClasses}
              value={telenowApiKeyInput}
              onChange={(e) => {
                setTelenowApiKeyInput(e.target.value);
                setTelenowError(null);
              }}
              placeholder="vai_live_..."
              autoComplete="off"
            />
          </Field>

          <p className="text-xs text-neutral-500">
            Keys are encrypted with AES-256-GCM at rest. When connected, AgilityOS automatically verifies credentials with the Voice AI carrier and registers a secure webhook endpoint for call events.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTelenowModalOpen(false)}
              disabled={telenowSaving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={telenowSaving}>
              {telenowStatus?.configured ? "Save & update key" : "Validate & connect"}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
