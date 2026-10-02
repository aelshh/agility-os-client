import { useState, useEffect, useCallback } from "react";
import { Button, Spinner } from "../../components";
import {
  apiListWhatsAppChannels,
  apiDeleteWhatsAppChannel,
  type WhatsAppChannel,
} from "../../api/whatsapp";
import { WhatsAppQrModal } from "./WhatsAppQrModal";
import { WhatsAppTestModal } from "./WhatsAppTestModal";
import {
  WhatsappLogo,
  QrCode,
  PaperPlaneTilt,
  Trash,
  ArrowsClockwise,
  CheckCircle,
  ChatCircleText,
  Sparkle,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface WhatsAppChannelsCardProps {
  voiceAiConfigured: boolean;
}

export function WhatsAppChannelsCard({
  voiceAiConfigured,
}: WhatsAppChannelsCardProps) {
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    if (!voiceAiConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiListWhatsAppChannels();
      setChannels(list);
    } catch (err) {
      setError(
        (err as Error).message ||
          "Failed to load connected WhatsApp channels. Please verify your Voice AI connection.",
      );
    } finally {
      setLoading(false);
    }
  }, [voiceAiConfigured]);

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  const handleDisconnectChannel = async (channel: WhatsAppChannel) => {
    if (
      !window.confirm(
        `Are you sure you want to disconnect WhatsApp channel "${channel.name}" (${channel.phone || channel.id})? Active reminder notifications will be paused.`,
      )
    ) {
      return;
    }

    setDisconnectingId(channel.id);
    try {
      await apiDeleteWhatsAppChannel(channel.id);
      toast.success("WhatsApp channel disconnected.");
      await fetchChannels();
    } catch (err) {
      toast.error(
        (err as Error).message || "Failed to disconnect WhatsApp channel.",
      );
    } finally {
      setDisconnectingId(null);
    }
  };

  const isConnected = channels.length > 0;

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Card Header */}
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <WhatsappLogo className="h-6 w-6" weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-base font-medium text-neutral-950">
                WhatsApp Messaging Hub
              </h2>
              {isConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Automated session reminders, post-call reports, and training cheat sheet dispatch.
            </p>
          </div>
        </div>

        {voiceAiConfigured && isConnected && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<PaperPlaneTilt className="h-4 w-4" />}
              onClick={() => setTestModalOpen(true)}
            >
              Send Test
            </Button>
            <Button
              size="sm"
              icon={<QrCode className="h-4 w-4" />}
              onClick={() => setQrModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Link Another Device
            </Button>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="px-5 py-5">
        {!voiceAiConfigured ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkle className="h-4 w-4 text-amber-600" />
              <span>Voice AI Integration Required</span>
            </div>
            <p className="leading-relaxed text-amber-800">
              Please connect your organization&apos;s Voice AI API key above before connecting a WhatsApp channel.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
            <Spinner size="sm" />
            <span>Loading WhatsApp channels...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchChannels}
              icon={<ArrowsClockwise className="h-4 w-4" />}
              className="w-fit"
            >
              Retry
            </Button>
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-3 shadow-xs">
              <WhatsappLogo className="h-8 w-8" weight="duotone" />
            </div>
            <h3 className="font-serif text-base font-semibold text-neutral-950">
              No WhatsApp Channel Connected
            </h3>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-neutral-600">
              Link any personal or business WhatsApp number in seconds using a QR scan. AgilityOS will use this number to send advance reminder notifications before deliberate practice calls and dispatch training deliverables to learners.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="sm"
                icon={<QrCode className="h-4 w-4" />}
                onClick={() => setQrModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                Connect WhatsApp (Scan QR)
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 transition-all hover:border-neutral-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <WhatsappLogo className="h-5 w-5" weight="fill" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-neutral-900">
                          {channel.name || "WhatsApp Channel"}
                        </h4>
                        <p className="truncate font-mono text-xs text-neutral-600">
                          {channel.phone || channel.id}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-md bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      {channel.qualityRating || "Active"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between border-t border-neutral-200/70 pt-3 text-xs text-neutral-500 gap-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-emerald-600" weight="fill" />
                      <span>Ready for dispatch</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTestModalOpen(true)}
                        className="h-7 px-2 text-xs text-neutral-700 hover:text-neutral-950"
                      >
                        <ChatCircleText className="h-3.5 w-3.5 mr-1" />
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={disconnectingId === channel.id}
                        onClick={() => handleDisconnectChannel(channel)}
                        className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash className="h-3.5 w-3.5 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
              <span>
                {channels.length} {channels.length === 1 ? "device" : "devices"} connected.
              </span>
              <button
                type="button"
                onClick={fetchChannels}
                className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900"
              >
                <ArrowsClockwise className="h-3.5 w-3.5" />
                Refresh status
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Pairing Modal */}
      <WhatsAppQrModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onConnected={fetchChannels}
      />

      {/* Test Message Modal */}
      <WhatsAppTestModal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        channels={channels}
      />
    </section>
  );
}
