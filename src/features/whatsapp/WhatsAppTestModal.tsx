import { useState, type FormEvent } from "react";
import { Modal, Button } from "../../components";
import { apiSendWhatsAppTest, type WhatsAppChannel } from "../../api/whatsapp";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";

interface WhatsAppTestModalProps {
  open: boolean;
  onClose: () => void;
  channels: WhatsAppChannel[];
}

export function WhatsAppTestModal({
  open,
  onClose,
  channels,
}: WhatsAppTestModalProps) {
  const [recipient, setRecipient] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    channels[0]?.id ?? "",
  );
  const [customMessage, setCustomMessage] = useState(
    "👋 Hello from AgilityOS! Your WhatsApp channel is connected and ready to deliver coaching reminders and learning materials.",
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) {
      setError("Please enter a recipient phone number with country code.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await apiSendWhatsAppTest({
        to: recipient.trim(),
        channelId: selectedChannelId || undefined,
        message: customMessage.trim(),
      });

      toast.success(
        `Test message sent successfully! (${res.wamid || "Delivered"})`,
      );
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
      description="Send a verification message to confirm that your connected WhatsApp channel is active."
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
                  {c.name} ({c.phone || c.id})
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
          <span className="text-sm font-medium text-neutral-600">Message Preview</span>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10 resize-none"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
          />
        </label>

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
            Send Test Message
          </Button>
        </div>
      </form>
    </Modal>
  );
}
