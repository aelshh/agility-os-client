import { useEffect, useMemo, useRef, useState } from "react";
import type { VoiceOption } from "../../api/courses";
import { apiGetVoices } from "../../api/courses";
import { cn } from "../../lib/cn";
import { Spinner } from "../../components";

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
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">("all");
  const [accentFilter, setAccentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGetVoices(selectedProvider)
      .then((data) => {
        if (cancelled) return;
        setVoices(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as { message?: string })?.message ?? "Failed to load voices.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProvider]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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
    return voices.find((v) => v.id === selectedVoiceId) ?? null;
  }, [voices, selectedVoiceId]);

  const togglePreview = (voice: VoiceOption, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!voice.previewUrl) return;

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
    });

    audio.onended = () => {
      setPlayingVoiceId(null);
    };

    audio.onerror = () => {
      setPlayingVoiceId(null);
    };
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Selected Voice Banner */}
      {selectedVoice && (
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Active AI Coach:
                </span>
                <h3 className="truncate text-base font-semibold text-neutral-950">
                  {selectedVoice.displayName}
                </h3>
                <span className="inline-flex items-center rounded-md bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Selected
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600">
                <span className="font-medium capitalize">{selectedVoice.gender}</span>
                {selectedVoice.accent && <span> · {selectedVoice.accent}</span>}
                {selectedVoice.description && (
                  <span className="text-neutral-500"> — {selectedVoice.description}</span>
                )}
              </p>
            </div>
          </div>

          {selectedVoice.previewUrl && (
            <button
              type="button"
              onClick={(e) => togglePreview(selectedVoice, e)}
              className={cn(
                "flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition-all",
                playingVoiceId === selectedVoice.id
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-100 shadow-sm",
              )}
            >
              {playingVoiceId === selectedVoice.id ? (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <rect x="5" y="4" width="3" height="12" rx="1" />
                    <rect x="12" y="4" width="3" height="12" rx="1" />
                  </svg>
                  <span>Playing Sample</span>
                  <span className="flex items-center gap-0.5 ml-1">
                    <span className="h-2 w-0.5 animate-pulse rounded-full bg-white" />
                    <span className="h-3.5 w-0.5 animate-pulse rounded-full bg-white [animation-delay:150ms]" />
                    <span className="h-2 w-0.5 animate-pulse rounded-full bg-white [animation-delay:300ms]" />
                  </span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M6.3 3.8A1 1 0 005 4.7v10.6a1 1 0 001.3.9l10-5.3a1 1 0 000-1.8l-10-5.3z" />
                  </svg>
                  <span>Play Sample</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Gender Filter Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setGenderFilter("all")}
              className={cn(
                "min-h-9 min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                genderFilter === "all"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
            >
              All Voices ({voices.length})
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter("female")}
              className={cn(
                "min-h-9 min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                genderFilter === "female"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
            >
              Female
            </button>
            <button
              type="button"
              onClick={() => setGenderFilter("male")}
              className={cn(
                "min-h-9 min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                genderFilter === "male"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
            >
              Male
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-0 sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, tone, or style…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-3.5 py-2 pl-9 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
            />
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M17.5 17.5l-3.5-3.5m1-4a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"
              />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600"
                aria-label="Clear search"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Accent Filter Pills */}
        {accents.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-neutral-400">Accent:</span>
            <button
              type="button"
              onClick={() => setAccentFilter("all")}
              className={cn(
                "min-h-7 rounded-full px-2.5 text-[11px] font-medium transition-all",
                accentFilter === "all"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
              )}
            >
              All Accents
            </button>
            {accents.map((acc) => (
              <button
                key={acc}
                type="button"
                onClick={() => setAccentFilter(acc)}
                className={cn(
                  "min-h-7 rounded-full px-2.5 text-[11px] font-medium transition-all",
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
      </div>

      {/* Tabular Form (Table View) */}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/50 py-12">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" className="text-neutral-500" />
            <p className="text-xs font-medium text-neutral-500">Loading AI coach voices…</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error}
        </div>
      ) : filteredVoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
          <p className="text-sm font-medium text-neutral-700">No voices match your filters.</p>
          <p className="mt-1 text-xs text-neutral-400">
            Try resetting your search query or gender and accent filters.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Coach Name
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Gender
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Accent
                  </th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">
                    Style & Personality
                  </th>
                  <th scope="col" className="px-3 py-3 text-center">
                    Audition
                  </th>
                  <th scope="col" className="px-4 py-3 text-right sm:px-5">
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
                      onClick={() => {
                        if (!readOnly) {
                          onSelectVoice(voice.id, voice.provider);
                        }
                      }}
                      className={cn(
                        "group cursor-pointer transition-colors",
                        readOnly && "cursor-default",
                        isSelected
                          ? "bg-neutral-900/[0.04] font-medium"
                          : "hover:bg-neutral-50/80",
                      )}
                    >
                      {/* Name & Selected Badge */}
                      <td className="px-4 py-3.5 sm:px-5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                              isSelected
                                ? "bg-neutral-900 text-white"
                                : "bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200",
                            )}
                          >
                            {voice.displayName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "truncate text-sm",
                                  isSelected
                                    ? "font-semibold text-neutral-950"
                                    : "text-neutral-900",
                                )}
                              >
                                {voice.displayName}
                              </span>
                              {isSelected && (
                                <span className="inline-flex shrink-0 items-center rounded bg-neutral-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                  Selected
                                </span>
                              )}
                            </div>
                            {voice.description && (
                              <p className="line-clamp-1 text-xs text-neutral-500 md:hidden">
                                {voice.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Gender */}
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 capitalize">
                          {voice.gender}
                        </span>
                      </td>

                      {/* Accent */}
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          {voice.accent ?? "Standard"}
                        </span>
                      </td>

                      {/* Persona & Style (visible on md+) */}
                      <td className="hidden px-4 py-3.5 text-xs text-neutral-600 md:table-cell">
                        {voice.description ? (
                          <span className="line-clamp-2 leading-relaxed">
                            {voice.description}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Clear & natural</span>
                        )}
                      </td>

                      {/* Audition Button */}
                      <td className="px-3 py-3.5 text-center">
                        {voice.previewUrl ? (
                          <button
                            type="button"
                            onClick={(e) => togglePreview(voice, e)}
                            title={isPlaying ? "Pause sample" : "Listen to sample"}
                            className={cn(
                              "inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                              isPlaying
                                ? "bg-neutral-900 text-white shadow-sm"
                                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                            )}
                          >
                            {isPlaying ? (
                              <>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                  <rect x="5" y="4" width="3" height="12" rx="1" />
                                  <rect x="12" y="4" width="3" height="12" rx="1" />
                                </svg>
                                <span className="hidden sm:inline text-[11px]">Playing</span>
                                <span className="flex items-center gap-0.5 ml-0.5">
                                  <span className="h-2 w-0.5 animate-pulse rounded-full bg-white" />
                                  <span className="h-3 w-0.5 animate-pulse rounded-full bg-white [animation-delay:150ms]" />
                                  <span className="h-2 w-0.5 animate-pulse rounded-full bg-white [animation-delay:300ms]" />
                                </span>
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                  <path d="M6.3 3.8A1 1 0 005 4.7v10.6a1 1 0 001.3.9l10-5.3a1 1 0 000-1.8l-10-5.3z" />
                                </svg>
                                <span className="hidden sm:inline text-[11px]">Play</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Select Action */}
                      <td className="px-4 py-3.5 text-right sm:px-5">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!readOnly) {
                              onSelectVoice(voice.id, voice.provider);
                            }
                          }}
                          className={cn(
                            "inline-flex min-h-9 items-center justify-center rounded-xl px-3 py-1 text-xs font-semibold transition-all",
                            isSelected
                              ? "bg-neutral-900 text-white shadow-sm"
                              : "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50",
                            readOnly && "cursor-default opacity-80",
                          )}
                        >
                          {isSelected ? (
                            <span className="flex items-center gap-1">
                              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                              </svg>
                              <span>Selected</span>
                            </span>
                          ) : (
                            "Choose"
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
