import {
  MagnifyingGlass,
  Play,
  Pause,
  Check,
  X,
  WarningCircle,
  Gear,
  SpeakerHigh,
  Sparkle,
  Lightning,
  Globe,
  Buildings,
  SquaresFour,
  ListBullets,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { VoiceOption } from "../../api/courses";
import { apiGetVoices } from "../../api/courses";
import { cn } from "../../lib/cn";
import { Spinner } from "../../components";

export type TtsProviderCategory =
  | "all"
  | "featured"
  | "speed"
  | "regional"
  | "enterprise";

export type TtsProviderOption = {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  speedHint?: string;
  category: "featured" | "speed" | "regional" | "enterprise";
};

export const TTS_PROVIDERS: TtsProviderOption[] = [
  {
    id: "telenow",
    name: "Telenow TTS",
    tagline: "Native neural streaming engine & voice cloning (OmniVoice)",
    badge: "Native",
    speedHint: "~180ms",
    category: "featured",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    tagline: "High-fidelity conversational voices & rich library",
    badge: "Popular",
    speedHint: "~250ms",
    category: "featured",
  },
  {
    id: "google",
    name: "Google Gemini TTS",
    tagline: "Directed expressive conversational voices (Gemini 3.1)",
    badge: "Gemini",
    speedHint: "~200ms",
    category: "featured",
  },
  {
    id: "sarvam",
    name: "Sarvam AI",
    tagline: "Indic languages & regional Indian accents (Bulbul v2/v3)",
    badge: "Indic",
    speedHint: "~220ms",
    category: "regional",
  },
  {
    id: "cartesia",
    name: "Cartesia",
    tagline: "Ultra low-latency streaming conversational speech",
    badge: "⚡ <150ms",
    speedHint: "~120ms",
    category: "speed",
  },
  {
    id: "openai",
    name: "OpenAI TTS",
    tagline: "Clear, versatile conversational catalog voices",
    badge: "Versatile",
    speedHint: "~280ms",
    category: "featured",
  },
  {
    id: "smallest",
    name: "Smallest.ai",
    tagline: "Lightning-fast low-latency neural synthesis (Lightning)",
    badge: "⚡ <100ms",
    speedHint: "~90ms",
    category: "speed",
  },
  {
    id: "rime",
    name: "Rime",
    tagline: "Expressive realistic conversational voices with deep catalogs",
    badge: "Expressive",
    speedHint: "~200ms",
    category: "speed",
  },
  {
    id: "lmnt",
    name: "LMNT (Aurora)",
    tagline: "Multilingual natural voice synthesis across languages",
    badge: "Multilingual",
    speedHint: "~210ms",
    category: "regional",
  },
  {
    id: "polly",
    name: "Amazon Polly",
    tagline: "Amazon AWS Neural voice engine & robust global locales",
    badge: "AWS",
    speedHint: "~240ms",
    category: "enterprise",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    tagline: "Grok conversational character voices and custom tones",
    badge: "xAI",
    speedHint: "~250ms",
    category: "featured",
  },
  {
    id: "soniox",
    name: "Soniox",
    tagline: "Multilingual low-latency neural voice synthesis",
    badge: "Neural",
    speedHint: "~190ms",
    category: "regional",
  },
  {
    id: "hume",
    name: "Hume (Octave)",
    tagline: "Empathic speech with nuanced emotional tones",
    badge: "Empathic",
    speedHint: "~180ms",
    category: "speed",
  },
  {
    id: "unrealspeech",
    name: "UnrealSpeech",
    tagline: "High-speed cost-effective neural voice generation",
    badge: "Fast",
    speedHint: "~160ms",
    category: "speed",
  },
];

const CATEGORIES: Array<{
  id: TtsProviderCategory;
  label: string;
  count: number;
  icon: typeof Sparkle;
}> = [
  { id: "all", label: "All (14)", count: 14, icon: Globe },
  { id: "featured", label: "Featured (5)", count: 5, icon: Sparkle },
  { id: "speed", label: "Ultra-Fast (5)", count: 5, icon: Lightning },
  { id: "regional", label: "Indic & Regional (3)", count: 3, icon: Globe },
  { id: "enterprise", label: "Enterprise & Cloud (1)", count: 1, icon: Buildings },
];

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-blue-600 text-white",
  "from-purple-500 to-indigo-600 text-white",
  "from-emerald-500 to-teal-600 text-white",
  "from-rose-500 to-pink-600 text-white",
  "from-amber-500 to-orange-600 text-white",
  "from-cyan-500 to-blue-600 text-white",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

interface VoiceSelectorProps {
  selectedVoiceId: string;
  selectedProvider?: string;
  onSelectVoice: (voiceId: string, provider: string) => void;
  readOnly?: boolean;
}

export function VoiceSelector({
  selectedVoiceId,
  selectedProvider = "elevenlabs",
  onSelectVoice,
  readOnly = false,
}: VoiceSelectorProps) {
  const [currentProvider, setCurrentProvider] = useState<string>(
    selectedProvider || "elevenlabs",
  );
  const [activeCategory, setActiveCategory] =
    useState<TtsProviderCategory>("all");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotConfigured, setIsNotConfigured] = useState(false);
  const [activeSelectedVoice, setActiveSelectedVoice] =
    useState<VoiceOption | null>(null);

  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">(
    "all",
  );
  const [accentFilter, setAccentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevSelectedProviderRef = useRef(selectedProvider);
  const voicesCacheRef = useRef<Record<string, VoiceOption[]>>({});

  // Sync provider if parent updates it from the outside
  useEffect(() => {
    if (
      selectedProvider &&
      selectedProvider !== prevSelectedProviderRef.current
    ) {
      prevSelectedProviderRef.current = selectedProvider;
      setCurrentProvider(selectedProvider);
    }
  }, [selectedProvider]);

  // Sync activeSelectedVoice when selectedVoiceId changes or voices change
  useEffect(() => {
    if (selectedVoiceId && voices.length > 0) {
      const match = voices.find((v) => v.id === selectedVoiceId);
      if (match) {
        setActiveSelectedVoice(match);
      }
    }
  }, [selectedVoiceId, voices]);

  // Load voices whenever currentProvider changes
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setIsNotConfigured(false);
    setSearch("");
    setAccentFilter("all");
    setGenderFilter("all");

    // Fast path: use cache if available
    if (voicesCacheRef.current[currentProvider]) {
      setVoices(voicesCacheRef.current[currentProvider]);
      setLoading(false);
      return;
    }

    setLoading(true);

    apiGetVoices(currentProvider)
      .then((data) => {
        if (cancelled) return;
        voicesCacheRef.current[currentProvider] = data;
        setVoices(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          (err as { message?: string; code?: string })?.message ??
          "Failed to load voices.";
        const code = (err as { code?: string })?.code;
        if (
          code === "TELENOW_NOT_CONFIGURED" ||
          msg.toLowerCase().includes("not configured") ||
          msg.toLowerCase().includes("api key")
        ) {
          setIsNotConfigured(true);
        }
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentProvider]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const visibleProviders = useMemo(() => {
    if (activeCategory === "all") return TTS_PROVIDERS;
    return TTS_PROVIDERS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const accents = useMemo(() => {
    const set = new Set<string>();
    voices.forEach((v) => {
      if (v.accent) set.add(v.accent);
    });
    return Array.from(set).sort();
  }, [voices]);

  const filteredVoices = useMemo(() => {
    return voices.filter((v) => {
      if (genderFilter !== "all" && v.gender !== genderFilter) {
        return false;
      }
      if (accentFilter !== "all" && v.accent !== accentFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = v.displayName.toLowerCase().includes(q);
        const matchesDesc = v.description?.toLowerCase().includes(q) ?? false;
        const matchesAccent = v.accent?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesDesc && !matchesAccent) {
          return false;
        }
      }
      return true;
    });
  }, [voices, genderFilter, accentFilter, search]);

  const selectedVoice = useMemo(() => {
    const match = voices.find((v) => v.id === selectedVoiceId);
    if (match) return match;
    if (activeSelectedVoice && activeSelectedVoice.id === selectedVoiceId) {
      return activeSelectedVoice;
    }
    return null;
  }, [voices, selectedVoiceId, activeSelectedVoice]);

  const activeProviderMeta = useMemo(() => {
    return (
      TTS_PROVIDERS.find((p) => p.id === currentProvider) ?? {
        id: currentProvider,
        name: currentProvider,
        tagline: "Custom voice synthesis engine",
        badge: "Custom",
        category: "enterprise" as const,
      }
    );
  }, [currentProvider]);

  const togglePreview = (voice: VoiceOption, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!voice.previewUrl) {
      toast.info("No audio sample preview provided for this voice.");
      return;
    }

    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voice.id);

    audio.play().catch(() => {
      setPlayingVoiceId(null);
      toast.error("Unable to play voice sample.");
    });

    audio.onended = () => {
      setPlayingVoiceId(null);
    };

    audio.onerror = () => {
      setPlayingVoiceId(null);
      toast.error("Audio stream error.");
    };
  };

  const handleProviderChange = (providerId: string) => {
    if (readOnly) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoiceId(null);
    setCurrentProvider(providerId);
  };

  const handleSelectVoice = (voice: VoiceOption) => {
    if (readOnly) return;
    const provider = voice.provider || currentProvider;
    setActiveSelectedVoice(voice);
    prevSelectedProviderRef.current = provider;
    onSelectVoice(voice.id, provider);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. COMPACT ACTIVE COACH SUMMARY BANNER */}
      {selectedVoice ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-900/15 bg-neutral-950 px-4 py-3 text-white shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold shadow-xs ring-1 ring-white/20",
                getAvatarGradient(selectedVoice.displayName),
              )}
            >
              {selectedVoice.displayName.charAt(0)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30 uppercase tracking-wide">
                  <Check size={11} weight="bold" />
                  Active Coach
                </span>
                <span className="truncate text-sm font-bold text-white">
                  {selectedVoice.displayName}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-200 capitalize">
                  {selectedVoice.provider || currentProvider}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-300 capitalize">
                  {selectedVoice.gender}
                </span>
                {selectedVoice.accent && (
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
                    {selectedVoice.accent}
                  </span>
                )}
              </div>
              {selectedVoice.description && (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-400">
                  {selectedVoice.description}
                </p>
              )}
            </div>
          </div>

          {/* Inline Audition button */}
          {selectedVoice.previewUrl && (
            <button
              type="button"
              onClick={(e) => togglePreview(selectedVoice, e)}
              className={cn(
                "flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-all self-start sm:self-auto",
                playingVoiceId === selectedVoice.id
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "bg-white/10 text-white hover:bg-white/20 border border-white/10",
              )}
            >
              {playingVoiceId === selectedVoice.id ? (
                <>
                  <Pause className="h-3.5 w-3.5" weight="fill" />
                  <span>Auditioning</span>
                  <span className="flex items-center gap-0.5 ml-0.5">
                    <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-neutral-950" />
                    <span className="h-3.5 w-0.5 animate-pulse rounded-full bg-neutral-950 [animation-delay:150ms]" />
                    <span className="h-2 w-0.5 animate-pulse rounded-full bg-neutral-950 [animation-delay:300ms]" />
                  </span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" weight="fill" />
                  <span>Audition Sample</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : !isNotConfigured ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-amber-900 shadow-2xs">
          <WarningCircle size={18} weight="fill" className="shrink-0 text-amber-600" />
          <span className="text-xs font-semibold">
            Coach voice persona required. Choose an AI persona below to proceed.
          </span>
        </div>
      ) : null}

      {/* 2. TELENOW NOT CONFIGURED BANNER */}
      {isNotConfigured ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-6 text-center">
          <WarningCircle size={28} weight="duotone" className="text-amber-700" />
          <h4 className="mt-2 text-sm font-bold text-neutral-950">
            Telenow Voice AI Not Connected
          </h4>
          <p className="mt-1 max-w-sm text-xs text-neutral-600">
            Your organisation requires a Telenow API key configured in Integrations to audition and provision live coach voices.
          </p>
          <Link
            to="/integrations"
            className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-neutral-800"
          >
            <Gear size={14} weight="bold" />
            <span>Configure in Integrations</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-sm">
          {/* 3. COMPACT INTEGRATED PROVIDER STRIP & CATEGORY TABS */}
          <div className="flex flex-col gap-2.5 border-b border-neutral-100 pb-3">
            {/* Top row: Engine Label + Category Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Voice Engine:
                </span>
                <span className="text-xs font-bold text-neutral-950">
                  {activeProviderMeta.name}
                </span>
                <span className="rounded-md bg-neutral-100 px-1.5 py-0.2 text-[10px] font-bold text-neutral-700 uppercase">
                  {activeProviderMeta.badge}
                </span>
              </div>

              {/* Category Pills (Wrapping & Compact) */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-neutral-100 p-0.5">
                {CATEGORIES.map((cat) => {
                  const isCatActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all",
                        isCatActive
                          ? "bg-white text-neutral-950 shadow-xs"
                          : "text-neutral-600 hover:text-neutral-900",
                      )}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horizontal Scrollable / Wrapping Provider Chips */}
            <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1">
              {visibleProviders.map((prov) => {
                const isProvActive = currentProvider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => handleProviderChange(prov.id)}
                    className={cn(
                      "inline-flex min-h-7 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-left transition-all text-xs font-semibold",
                      isProvActive
                        ? "border-neutral-950 bg-neutral-950 text-white shadow-xs"
                        : "border-neutral-200 bg-neutral-50/70 text-neutral-700 hover:border-neutral-300 hover:bg-white",
                      readOnly && "cursor-default opacity-80",
                    )}
                  >
                    {prov.id === "telenow" && (
                      <Sparkle
                        size={12}
                        weight="fill"
                        className={isProvActive ? "text-amber-300" : "text-neutral-900"}
                      />
                    )}
                    <span className="truncate">{prov.name}</span>
                    <span
                      className={cn(
                        "rounded px-1 py-0.2 text-[9px] font-bold uppercase",
                        isProvActive ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-600",
                      )}
                    >
                      {prov.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. COMPACT DISCOVERY CONTROLS ROW */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search coach, accent, tone…"
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-3 py-1.5 pl-8 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
              />
              <MagnifyingGlass
                className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400"
                weight="bold"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" weight="bold" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Gender segmented tabs */}
              <div className="flex items-center gap-0.5 rounded-xl bg-neutral-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setGenderFilter("all")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    genderFilter === "all"
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  All ({voices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter("female")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    genderFilter === "female"
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  Female
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter("male")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    genderFilter === "male"
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  Male
                </button>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-0.5 rounded-xl bg-neutral-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  title="Card view"
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all",
                    viewMode === "cards"
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  <SquaresFour size={14} weight="bold" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="List view"
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all",
                    viewMode === "list"
                      ? "bg-white text-neutral-950 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  <ListBullets size={14} weight="bold" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>
          </div>

          {/* Accent tags if multiple exist */}
          {accents.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Accent:
              </span>
              <button
                type="button"
                onClick={() => setAccentFilter("all")}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all",
                  accentFilter === "all"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                )}
              >
                All
              </button>
              {accents.map((acc) => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setAccentFilter(acc)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all",
                    accentFilter === acc
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                  )}
                >
                  {acc}
                </button>
              ))}
            </div>
          )}

          {/* 5. CONTAINED SCROLLABLE VOICE CATALOG (CARDS OR LIST) */}
          <div className="max-h-[440px] sm:max-h-[500px] overflow-y-auto pr-1 rounded-xl border border-neutral-100 bg-neutral-50/40 p-2 sm:p-2.5">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center py-10">
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="sm" className="text-neutral-600" />
                  <p className="text-xs font-semibold text-neutral-500">
                    Loading voices from {activeProviderMeta.name}…
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700">
                <WarningCircle size={22} className="mx-auto text-red-500 mb-1" />
                <p className="font-bold">Failed to load voices from {activeProviderMeta.name}</p>
                <p className="mt-0.5 text-neutral-600">{error}</p>
              </div>
            ) : filteredVoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <SpeakerHigh size={20} weight="duotone" className="text-neutral-400" />
                <p className="mt-2 text-xs font-bold text-neutral-900">
                  No voices matching your filters
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Try adjusting search terms or accent selections.
                </p>
                {(search || genderFilter !== "all" || accentFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setGenderFilter("all");
                      setAccentFilter("all");
                    }}
                    className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-neutral-800"
                  >
                    <ArrowsClockwise size={12} weight="bold" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            ) : viewMode === "cards" ? (
              /* COMPACT CARDS VIEW */
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVoices.map((voice) => {
                  const isSelected = selectedVoiceId === voice.id;
                  const isPlaying = playingVoiceId === voice.id;

                  return (
                    <div
                      key={voice.id}
                      onClick={() => handleSelectVoice(voice)}
                      className={cn(
                        "group relative flex flex-col justify-between rounded-2xl border p-3 transition-all cursor-pointer",
                        isSelected
                          ? "border-neutral-950 bg-white ring-2 ring-neutral-950 shadow-sm"
                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/80 shadow-2xs",
                        readOnly && "cursor-default",
                      )}
                    >
                      <div>
                        {/* Card Top: Avatar, Name, Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-2xs",
                                getAvatarGradient(voice.displayName),
                              )}
                            >
                              {voice.displayName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="truncate text-xs font-bold text-neutral-950">
                                {voice.displayName}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span className="rounded bg-neutral-100 px-1 py-0.2 text-[9px] font-semibold text-neutral-700 capitalize">
                                  {voice.gender}
                                </span>
                                {voice.accent && (
                                  <span className="rounded bg-neutral-100 px-1 py-0.2 text-[9px] font-semibold text-neutral-600">
                                    {voice.accent}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-neutral-950 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                              <Check size={9} weight="bold" />
                              Chosen
                            </span>
                          )}
                        </div>

                        {/* Card Description */}
                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-neutral-600 min-h-[1.75rem]">
                          {voice.description || "Clear and natural conversational AI persona."}
                        </p>
                      </div>

                      {/* Card Footer: Audition & Select Actions */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
                        {voice.previewUrl ? (
                          <button
                            type="button"
                            onClick={(e) => togglePreview(voice, e)}
                            className={cn(
                              "inline-flex min-h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-all",
                              isPlaying
                                ? "bg-neutral-900 text-white"
                                : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200",
                            )}
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="h-3 w-3" weight="fill" />
                                <span>Auditioning</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" weight="fill" />
                                <span>Audition</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-400">No audio preview</span>
                        )}

                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectVoice(voice);
                          }}
                          className={cn(
                            "inline-flex min-h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition-all",
                            isSelected
                              ? "bg-neutral-900 text-white"
                              : "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-900 hover:bg-neutral-50",
                            readOnly && "cursor-default opacity-80",
                          )}
                        >
                          {isSelected ? (
                            <>
                              <Check size={11} weight="bold" />
                              <span>Selected</span>
                            </>
                          ) : (
                            <span>Choose</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* COMPACT LIST VIEW */
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                      <th scope="col" className="px-3 py-2 sm:px-4">
                        Coach Persona
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Gender
                      </th>
                      <th scope="col" className="px-2 py-2">
                        Accent
                      </th>
                      <th scope="col" className="hidden px-3 py-2 md:table-cell">
                        Style
                      </th>
                      <th scope="col" className="px-2 py-2 text-center">
                        Audition
                      </th>
                      <th scope="col" className="px-3 py-2 text-right sm:px-4">
                        Select
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredVoices.map((voice) => {
                      const isSelected = selectedVoiceId === voice.id;
                      const isPlaying = playingVoiceId === voice.id;

                      return (
                        <tr
                          key={voice.id}
                          onClick={() => handleSelectVoice(voice)}
                          className={cn(
                            "group cursor-pointer transition-colors",
                            readOnly && "cursor-default",
                            isSelected
                              ? "bg-neutral-900/[0.04] font-medium"
                              : "hover:bg-neutral-50/80",
                          )}
                        >
                          <td className="px-3 py-2 sm:px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold shadow-2xs",
                                  getAvatarGradient(voice.displayName),
                                )}
                              >
                                {voice.displayName.charAt(0)}
                              </div>
                              <span
                                className={cn(
                                  "truncate text-xs",
                                  isSelected ? "font-bold text-neutral-950" : "font-semibold text-neutral-900",
                                )}
                              >
                                {voice.displayName}
                              </span>
                            </div>
                          </td>

                          <td className="px-2 py-2">
                            <span className="capitalize text-[11px] text-neutral-600">
                              {voice.gender}
                            </span>
                          </td>

                          <td className="px-2 py-2">
                            <span className="text-[11px] text-neutral-600">
                              {voice.accent ?? "Standard"}
                            </span>
                          </td>

                          <td className="hidden px-3 py-2 text-[11px] text-neutral-500 md:table-cell">
                            <span className="line-clamp-1">{voice.description || "Clear & natural"}</span>
                          </td>

                          <td className="px-2 py-2 text-center">
                            {voice.previewUrl ? (
                              <button
                                type="button"
                                onClick={(e) => togglePreview(voice, e)}
                                className={cn(
                                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all",
                                  isPlaying
                                    ? "bg-neutral-900 text-white"
                                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                                )}
                              >
                                {isPlaying ? (
                                  <Pause className="h-3 w-3" weight="fill" />
                                ) : (
                                  <Play className="h-3 w-3" weight="fill" />
                                )}
                              </button>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>

                          <td className="px-3 py-2 text-right sm:px-4">
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectVoice(voice);
                              }}
                              className={cn(
                                "inline-flex h-6 items-center justify-center rounded-lg px-2 text-[11px] font-bold transition-all",
                                isSelected
                                  ? "bg-neutral-900 text-white"
                                  : "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900",
                                readOnly && "cursor-default opacity-80",
                              )}
                            >
                              {isSelected ? "Chosen" : "Choose"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
