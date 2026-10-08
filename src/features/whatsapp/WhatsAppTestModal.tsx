import { useState, useEffect, type FormEvent } from "react";
import { Modal, Button } from "../../components";
import {
  apiSendWhatsAppTest,
  formatChannelLabel,
  type WhatsAppChannel,
} from "../../api/whatsapp";
import { PaperPlaneTilt, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

interface WhatsAppTestModalProps {
  open: boolean;
  onClose: () => void;
  channels: WhatsAppChannel[];
  defaultChannelId?: string | null;
}

const TEMPLATE_OPTIONS = [
  {
    id: "channel_connection_test",
    label: "channel_connection_test (Channel Verification)",
    preview:
      "👋 Hello Team!\n\nYour WhatsApp channel for AgilityOS has been connected successfully to AgilityOS. You are now set up to receive automated practice reminders, coaching feedback, and learning deliverables.",
  },
  {
    id: "course_schedule_reminder",
    label: "course_schedule_reminder (Session Reminder)",
    preview:
      "Hi Alex, your practice session for Enterprise Objection Handling is scheduled for today!\n\n⏰ Active Window: 10:00 – 12:00 (UTC)\n📝 Note: Focus on objection handling.\n\nPlease be available to receive your coaching practice call or dial in directly. Good luck!",
  },
  {
    id: "course_learning_resource",
    label: "course_learning_resource (Training Deliverable)",
    preview:
      "Hi Sarah, here is your training resource for Cold Call Discovery Mastery:\n\n📌 Title: 5-Step Playbook\n📝 Overview: Review before your next client touchpoint.\n👉 Access Link: https://app.agilityos.ai\n\nPlease review this material to prepare for your upcoming client interactions.",
  },
  {
    id: "practice_call_feedback",
    label: "practice_call_feedback (Scorecard Debrief)",
    preview:
      "Hi David, great job completing your practice session for Financial Objections!\n\n⭐ Score: 88/100\n🗣️ Talk Ratio: 45% Rep / 55% AI\n💡 Top Coaching Tip: Acknowledge the budget constraint first.\n\nKeep up the deliberate practice habit!",
  },
];

export function WhatsAppTestModal({
  open,
  onClose,
  channels,
  defaultChannelId,
}: WhatsAppTestModalProps) {
  const [recipient, setRecipient] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    defaultChannelId || channels[0]?.id || "",
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>("channel_connection_test");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedChannelId(defaultChannelId || channels[0]?.id || "");
      setSelectedTemplate("channel_connection_test");
      setError(null);
    }
  }, [open, defaultChannelId, channels]);

  const currentTemplate =
    TEMPLATE_OPTIONS.find((t) => t.id === selectedTemplate) || TEMPLATE_OPTIONS[0];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) {
      setError("Please enter a recipient phone number with country code.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      await apiSendWhatsAppTest({
        to: recipient.trim(),
        channelId: selectedChannelId || undefined,
        template: selectedTemplate,
      });

      toast.success("Test message dispatched successfully over WhatsApp!");
      onClose();
    } catch (err) {
      setError(
        (err as Error).message ||
          "Failed to dispatch test message. Please verify the recipient number.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Test WhatsApp Message"
      description="Send an approved Meta template message to verify that your connected WhatsApp channel is active."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 py-1">
        {channels.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-600">
              Sending Channel
            </span>
            <select
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatChannelLabel(c)} {c.id === defaultChannelId ? "⭐ (Default)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-600">
            Recipient Phone Number
          </span>
          <input
            type="tel"
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
            placeholder="+1 555-0199 or +91 9876543210"
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setError(null);
            }}
          />
          <span className="text-[11px] text-neutral-500">
            Include country code (e.g. +1, +44, +91).
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-600">
            Select Approved Template
          </span>
          <select
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            {TEMPLATE_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600">Template Preview</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle className="h-3 w-3" weight="fill" />
              Meta Approved
            </span>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
            {currentTemplate?.preview}
          </div>
          <span className="text-[11px] text-neutral-500">
            Delivers outside the 24-hour window using pre-approved Meta WhatsApp templates.
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={sending}
            icon={<PaperPlaneTilt className="h-4 w-4" />}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Send Template Test
          </Button>
        </div>
      </form>
    </Modal>
  );
}
