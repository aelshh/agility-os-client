import { useState, useEffect, useCallback } from "react";
import { Button, Spinner } from "../../components";
import {
  apiListWhatsAppChannels,
  apiDeleteWhatsAppChannel,
  apiSetDefaultWhatsAppChannel,
  formatChannelLabel,
  formatPhoneNumber,
  type WhatsAppChannel,
} from "../../api/whatsapp";
import { apiGetNumbers } from "../../api/telephony";
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
  Star,
  Phone,
  Copy,
  Check,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface WhatsAppChannelsCardProps {
  voiceAiConfigured: boolean;
}

export function WhatsAppChannelsCard({
  voiceAiConfigured,
}: WhatsAppChannelsCardProps) {
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    if (!voiceAiConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const [whatsappRes, numbersRes] = await Promise.allSettled([
        apiListWhatsAppChannels(),
        apiGetNumbers(),
      ]);

      let loadedChannels: WhatsAppChannel[] = [];
      let defaultId: string | null = null;

      if (whatsappRes.status === "fulfilled") {
        loadedChannels = whatsappRes.value.channels;
        defaultId = whatsappRes.value.defaultChannelId;
      }

      let workspaceNumbers: Array<{ id: string; e164: string }> = [];
      if (numbersRes.status === "fulfilled") {
        workspaceNumbers = numbersRes.value.numbers;
      }

      // If any channel has empty phone, enrich from workspace numbers
      if (loadedChannels.length > 0 && workspaceNumbers.length > 0) {
        loadedChannels = loadedChannels.map((ch, idx) => {
          if (ch.phone && ch.phone.trim().length > 0) return ch;
          const matchedNumber =
            workspaceNumbers.find((n) => n.id === ch.id)?.e164 ||
            workspaceNumbers[idx]?.e164 ||
            workspaceNumbers[0]?.e164 ||
            "";
          return {
            ...ch,
            phone: matchedNumber,
          };
        });
      }

      setChannels(loadedChannels);
      setDefaultChannelId(defaultId);
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

  const handleCopyPhone = (channel: WhatsAppChannel) => {
    const numberToCopy = channel.phone || channel.id;
    if (!numberToCopy) return;
    void navigator.clipboard.writeText(numberToCopy);
    setCopiedPhoneId(channel.id);
    toast.success(`Copied ${numberToCopy} to clipboard.`);
    setTimeout(() => {
      setCopiedPhoneId(null);
    }, 2000);
  };

  const handleSetDefault = async (channel: WhatsAppChannel) => {
    setSettingDefaultId(channel.id);
    try {
      await apiSetDefaultWhatsAppChannel(channel.id);
      setDefaultChannelId(channel.id);
      toast.success(`Default WhatsApp sender set to "${formatChannelLabel(channel)}".`);
    } catch (err) {
      toast.error(
        (err as Error).message || "Failed to set default WhatsApp channel.",
      );
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDisconnectChannel = async (channel: WhatsAppChannel) => {
    if (
      !window.confirm(
        `Are you sure you want to disconnect WhatsApp channel "${formatChannelLabel(channel)}"? Active reminder notifications will be paused.`,
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
  // If no explicit default is set but channels exist, the first is used implicitly by dispatch
  const effectiveDefaultId = defaultChannelId || channels[0]?.id;

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
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {channels.map((channel) => {
                const isDefault = channel.id === effectiveDefaultId;
                const formattedPhone = formatPhoneNumber(channel.phone);
                const displayPhone = formattedPhone || channel.phone;

                return (
                  <div
                    key={channel.id}
                    className={`flex flex-col justify-between gap-3.5 rounded-xl border p-4 transition-all ${
                      isDefault
                        ? "border-emerald-300 bg-emerald-50/30 shadow-xs"
                        : "border-neutral-200 bg-neutral-50/50 hover:border-neutral-300"
                    }`}
                  >
                    {/* Header Row: Icon, Channel Name & Quality / Default Badges */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isDefault
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          <WhatsappLogo className="h-5 w-5" weight="fill" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="truncate text-sm font-semibold text-neutral-900">
                              {channel.name || "WhatsApp Channel"}
                            </h4>
                            {isDefault && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                                <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" weight="fill" />
                                Default Sender
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-neutral-500">
                            Channel ID: <span className="font-mono">{channel.id}</span>
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-md bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        {channel.qualityRating || "Active"}
                      </span>
                    </div>

                    {/* Dedicated Phone Number Box */}
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200/80 bg-white px-3 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                          <Phone className="h-3.5 w-3.5" weight="bold" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                            WhatsApp Phone Number
                          </span>
                          <span className="font-mono text-sm font-semibold text-neutral-950 truncate block">
                            {displayPhone || "—"}
                          </span>
                        </div>
                      </div>

                      {displayPhone && (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(channel)}
                          title="Copy phone number"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          {copiedPhoneId === channel.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" weight="bold" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-wrap items-center justify-between border-t border-neutral-200/70 pt-3 text-xs text-neutral-500 gap-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-600" weight="fill" />
                        <span>Ready for dispatch</span>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {!isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={settingDefaultId === channel.id}
                            onClick={() => handleSetDefault(channel)}
                            className="h-7 px-2 text-xs text-neutral-700 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Star className="h-3.5 w-3.5 mr-1" />
                            Set Default
                          </Button>
                        )}
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
                );
              })}
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
        defaultChannelId={effectiveDefaultId}
      />
    </section>
  );
}
