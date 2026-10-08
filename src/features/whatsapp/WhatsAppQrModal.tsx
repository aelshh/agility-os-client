import { useState, useEffect, useRef } from "react";
import { Modal, Button, Spinner } from "../../components";
import {
  apiCreateWhatsAppSession,
  apiGetWhatsAppSession,
  apiDeleteWhatsAppSession,
  type WhatsAppSession,
} from "../../api/whatsapp";
import {
  QrCode,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  DeviceMobile,
  ShieldCheck,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface WhatsAppQrModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function WhatsAppQrModal({
  open,
  onClose,
  onConnected,
}: WhatsAppQrModalProps) {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string>("init");
  const [countdown, setCountdown] = useState<number>(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  // Clear polling & countdown intervals
  const stopTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startSession = async () => {
    stopTimers();
    setLoading(true);
    setError(null);
    setPollingStatus("init");
    setCountdown(60);

    try {
      const newSession = await apiCreateWhatsAppSession("AgilityOS Bot");
      setSession(newSession);
      activeSessionIdRef.current = newSession.sessionId;
      setPollingStatus(newSession.status || "qr_ready");

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            stopTimers();
            setPollingStatus("expired");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start status polling every 2 seconds
      timerRef.current = setInterval(async () => {
        if (!activeSessionIdRef.current) return;
        try {
          const pollRes = await apiGetWhatsAppSession(activeSessionIdRef.current);
          setPollingStatus(pollRes.status);

          if (pollRes.status === "connected") {
            stopTimers();
            toast.success("WhatsApp device connected successfully!");
            setTimeout(() => {
              onConnected();
              onClose();
            }, 1200);
          } else if (
            pollRes.status === "failed" ||
            pollRes.status === "expired"
          ) {
            stopTimers();
          }
        } catch {
          // Ignore transient polling network errors
        }
      }, 2000);
    } catch (err) {
      setError(
        (err as Error).message ||
          "Failed to initiate WhatsApp session. Please check your Voice AI connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void startSession();
    } else {
      stopTimers();
      if (activeSessionIdRef.current) {
        void apiDeleteWhatsAppSession(activeSessionIdRef.current).catch(() => {});
        activeSessionIdRef.current = null;
      }
      setSession(null);
      setError(null);
      setPollingStatus("init");
    }

    return () => {
      stopTimers();
      if (activeSessionIdRef.current) {
        void apiDeleteWhatsAppSession(activeSessionIdRef.current).catch(() => {});
      }
    };
  }, [open]);

  const formatQrSrc = (rawQr?: string | null): string | null => {
    if (!rawQr) return null;
    const trimmed = rawQr.trim();
    if (trimmed.startsWith("data:image/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    // Assume base64 png
    return `data:image/png;base64,${trimmed}`;
  };

  const qrImageSrc = formatQrSrc(session?.qr);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect WhatsApp Channel"
      description="Scan this QR code with WhatsApp on your phone to link your messaging channel."
    >
      <div className="flex flex-col items-center gap-5 py-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-neutral-600">
              Generating secure WhatsApp QR session...
            </p>
          </div>
        ) : error ? (
          <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <WarningCircle className="h-8 w-8 text-red-500" weight="fill" />
            <p className="text-xs font-medium text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={startSession}
              icon={<ArrowsClockwise className="h-4 w-4" />}
            >
              Retry Connection
            </Button>
          </div>
        ) : pollingStatus === "connected" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-bounce">
              <CheckCircle className="h-10 w-10" weight="fill" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Device Linked Successfully!
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Your WhatsApp channel is now ready to send reminders and learning materials.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* QR Code Container */}
            <div className="relative flex aspect-square w-full max-w-[240px] items-center justify-center overflow-hidden rounded-2xl border-2 border-neutral-200 bg-white p-3 shadow-inner sm:max-w-[260px]">
              {pollingStatus === "expired" ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/90 p-4 text-center backdrop-blur-xs">
                  <WarningCircle className="h-8 w-8 text-amber-500" weight="fill" />
                  <span className="text-xs font-semibold text-neutral-800">
                    QR Code Expired
                  </span>
                  <p className="text-[11px] text-neutral-500">
                    Pairing codes expire after 60s for device security.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startSession}
                    icon={<ArrowsClockwise className="h-4 w-4" />}
                    className="mt-1"
                  >
                    Refresh Code
                  </Button>
                </div>
              ) : pollingStatus === "connecting" ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/95 p-4 text-center backdrop-blur-xs">
                  <Spinner size="md" />
                  <span className="text-xs font-semibold text-neutral-800">
                    Pairing with device...
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Finalizing secure WhatsApp channel setup.
                  </span>
                </div>
              ) : null}

              {qrImageSrc ? (
                <img
                  src={qrImageSrc}
                  alt="WhatsApp QR Code"
                  className="h-full w-full object-contain transition-all"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <QrCode className="h-14 w-14" weight="duotone" />
                  <span className="text-xs">Waiting for carrier QR...</span>
                </div>
              )}
            </div>

            {/* Countdown / Refresh hint */}
            {pollingStatus !== "expired" && pollingStatus !== "connecting" && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Code active for {countdown}s</span>
                <button
                  type="button"
                  onClick={startSession}
                  className="ml-2 inline-flex items-center gap-1 font-medium text-neutral-700 hover:text-neutral-950 underline underline-offset-2"
                >
                  <ArrowsClockwise className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="w-full rounded-xl border border-neutral-100 bg-neutral-50/80 p-3.5 text-xs text-neutral-700">
              <div className="mb-2 flex items-center gap-1.5 font-semibold text-neutral-900">
                <DeviceMobile className="h-4 w-4 text-neutral-600" />
                <span>How to link your WhatsApp:</span>
              </div>
              <ol className="list-inside list-decimal space-y-1 text-neutral-600">
                <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
                <li>
                  Go to <strong>Settings</strong> (iPhone) or tap <strong>Menu ⋮</strong> (Android).
                </li>
                <li>
                  Tap <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong>.
                </li>
                <li>Point your camera at this QR code to confirm linking.</li>
              </ol>
            </div>

            {/* Security Note */}
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" weight="bold" />
              <span>
                End-to-end encrypted session. You can unlink this device anytime from your phone or AgilityOS.
              </span>
            </div>
          </>
        )}

        <div className="mt-2 flex w-full justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {pollingStatus === "connected" ? "Close" : "Cancel"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
