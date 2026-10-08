import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { toast } from "sonner";

import type {
  Course,
  CourseDocument,
  CourseInput,
  CourseWhatsappResource,
  RubricCriterion,
  TelenowKbDocument,
  TelenowKnowledgeBase,
} from "../api/courses";
import {
  apiAddCourseKbTextDoc,
  apiAddCourseKbUrlDoc,
  apiCreateCourse,
  apiDeleteCourse,
  apiDeleteCourseKbDoc,
  apiGenerateFaqs,
  apiGenerateFaqsDraft,
  apiGenerateRubric,
  apiGenerateRubricDraft,
  apiGetCourse,
  apiGetCourseKnowledgeBase,
  apiPreviewCourseWhatsappMessage,
  apiSubmitCourse,
  apiUpdateCourse,
  apiUpdateCourseAudience,
  apiUploadCourseKbFileDoc,
} from "../api/courses";
import {
  apiCreateCourseSchedule,
  apiListCourseSchedules,
  apiUpdateCourseSchedule,
  type CourseSchedule,
  type CourseScheduleType,
} from "../api/schedules";
import {
  apiListWhatsAppChannels,
  formatChannelLabel,
  type WhatsAppChannel,
} from "../api/whatsapp";
import { TIMEZONES } from "../data/options";
import { Button, Spinner, Tabs, Modal } from "../components";
import { AudiencePicker } from "../features/courses/AudiencePicker";
import { RubricList } from "../features/courses/RubricList";
import { StatusBadge } from "../features/courses/StatusBadge";
import { VoiceSelector } from "../features/courses/VoiceSelector";
import {
  type ProcessedKbFile,
  processDataTransfer,
  processFileList,
} from "../features/courses/archiveExtractor";
import { apiGetNumbers, type WorkspacePhoneNumber } from "../api/telephony";
import { cn } from "../lib/cn";
import { pageVariants, fadeUp } from "../lib/animation";

import {
  ArrowLeft,
  BookOpen,
  CalendarPlus,
  CaretRight,
  ChatCenteredText,
  Check,
  CloudArrowUp,
  Database,
  FileText,
  FileZip,
  FloppyDisk,
  FolderOpen,
  GlobeSimple,
  LinkSimple,
  MicrophoneStage,
  PaperPlaneTilt,
  PhoneCall,
  SlidersHorizontal,
  Trash,
  Trophy,
  UsersThree,
  VideoCamera,
  WarningCircle,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import { IconBadge } from "../components/ui/IconBadge";

const labelClasses = "text-sm font-medium text-neutral-600";

const inputClasses =
  "w-full rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-500 outline-none transition-all focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

const textareaClasses = `${inputClasses} min-h-28 resize-y leading-relaxed`;

type EditableCriterion = RubricCriterion & { id: string };

const TEXT_DOC_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "log",
  "html",
  "xml",
  "yml",
  "yaml",
  "js",
  "ts",
  "jsx",
  "tsx",
]);

function isTextDoc(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_DOC_EXTS.has(ext) || file.type.startsWith("text/");
}

const EDITOR_TABS = ["basics", "knowledge", "voice", "questions", "rubric", "audience", "schedule"];

const DAYS_OF_WEEK_OPTIONS = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 0, label: "Sun", full: "Sunday" },
];

const ADVANCE_NOTICE_OPTIONS = [
  { value: 5, label: "5 minutes prior" },
  { value: 10, label: "10 minutes prior" },
  { value: 15, label: "15 minutes prior (Recommended)" },
  { value: 30, label: "30 minutes prior" },
  { value: 60, label: "1 hour prior" },
];

let rubricIdCounter = 0;
const nextRubricId = () => `rc-${rubricIdCounter++}`;

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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-base font-medium text-neutral-950">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return <WhatsappLogo className={className} weight="fill" aria-hidden="true" />;
}

export function CourseEditorPage() {
  const router = useRouter();
  const params = useParams({ strict: false });
  const courseId = params?.["courseId"];

  const isNew = !courseId;

  const [loaded, setLoaded] = useState<Course | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [activeTab, setActiveTab] = useState("basics");
  const tabIndex = EDITOR_TABS.indexOf(activeTab);
  const isLastTab = tabIndex === EDITOR_TABS.length - 1;

  const handleTabChange = (targetTab: string) => {
    const targetIdx = EDITOR_TABS.indexOf(targetTab);
    const voiceIdx = EDITOR_TABS.indexOf("voice");
    if (targetIdx > voiceIdx && (!voice || !voice.trim())) {
      setActiveTab("voice");
      toast.error("Please select an AI coach voice persona before proceeding.");
      return;
    }
    setActiveTab(targetTab);
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [knowledgeText, setKnowledgeText] = useState("");
  const [faqs, setFaqs] = useState<string[]>([]);
  const [documents, setDocuments] = useState<CourseDocument[]>([]);
  const [criteria, setCriteria] = useState<EditableCriterion[]>([]);
  const [maxDurationSec, setMaxDurationSec] = useState("120");
  const [callWindowStart, setCallWindowStart] = useState("");
  const [callWindowEnd, setCallWindowEnd] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [draftAudience, setDraftAudience] = useState<string[] | null>(null);
  const [savingAudience, setSavingAudience] = useState(false);

  // ── AI Coach Voice State ──
  const [voice, setVoice] = useState("");
  const [voiceProvider, setVoiceProvider] = useState("elevenlabs");

  // ── Phone Line State ──
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [assignPhoneModalOpen, setAssignPhoneModalOpen] = useState(false);
  const [workspaceNumbers, setWorkspaceNumbers] = useState<WorkspacePhoneNumber[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [pendingReassignNumber, setPendingReassignNumber] =
    useState<WorkspacePhoneNumber | null>(null);

  // ── Knowledge Base State ──
  const [kbInfo, setKbInfo] = useState<TelenowKnowledgeBase | null>(null);
  const [kbDocuments, setKbDocuments] = useState<TelenowKbDocument[]>([]);
  const [loadingKb, setLoadingKb] = useState(false);
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);

  // ── WhatsApp Deliverable Resources State ──
  const [whatsappResources, setWhatsappResources] = useState<CourseWhatsappResource[]>([]);
  const [whatsappChannels, setWhatsappChannels] = useState<WhatsAppChannel[]>([]);
  const [defaultWhatsappChannelId, setDefaultWhatsappChannelId] = useState<string | null>(null);
  const [whatsappChannelId, setWhatsappChannelId] = useState<string | null>(null);
  const [addVideoModalOpen, setAddVideoModalOpen] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoTrigger, setVideoTrigger] =
    useState<CourseWhatsappResource["deliveryTrigger"]>("during_call");
  const [videoCaption, setVideoCaption] = useState("");

  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [linkTrigger, setLinkTrigger] =
    useState<CourseWhatsappResource["deliveryTrigger"]>("during_call");
  const [linkCaption, setLinkCaption] = useState("");

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewResource, setPreviewResource] =
    useState<CourseWhatsappResource | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Course Schedule State ──
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleType, setScheduleType] = useState<CourseScheduleType>("recurring");
  const [scheduleStartDate, setScheduleStartDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [scheduleDaysOfWeek, setScheduleDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleWindowStart, setScheduleWindowStart] = useState("09:00");
  const [scheduleWindowEnd, setScheduleWindowEnd] = useState("18:00");
  const [scheduleTimezone, setScheduleTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  );
  const [scheduleNotifyWhatsapp, setScheduleNotifyWhatsapp] = useState(true);
  const [scheduleNotifyMinutes, setScheduleNotifyMinutes] = useState(15);
  const [scheduleCustomMessage, setScheduleCustomMessage] = useState("");
  const [existingSchedule, setExistingSchedule] = useState<CourseSchedule | null>(null);

  // Staged items for new course draft
  const [pendingFiles, setPendingFiles] = useState<ProcessedKbFile[]>([]);
  const [pendingTextDocs, setPendingTextDocs] = useState<
    Array<{ id: string; title: string; content: string }>
  >([]);
  const [pendingUrls, setPendingUrls] = useState<
    Array<{ id: string; url: string; title: string }>
  >([]);

  // Modals
  const [addTextModalOpen, setAddTextModalOpen] = useState(false);
  const [textDocTitle, setTextDocTitle] = useState("");
  const [textDocContent, setTextDocContent] = useState("");
  const [submittingTextDoc, setSubmittingTextDoc] = useState(false);

  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [urlAddress, setUrlAddress] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [submittingUrl, setSubmittingUrl] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const loadKb = async (targetCourseId: string) => {
    setLoadingKb(true);
    try {
      const res = await apiGetCourseKnowledgeBase(targetCourseId);
      setKbInfo(res.knowledgeBase);
      setKbDocuments(res.documents);
    } catch (err) {
      console.error("Failed to load course knowledge base", err);
    } finally {
      setLoadingKb(false);
    }
  };

  useEffect(() => {
    if (isNew || !courseId) return;
    let cancelled = false;
    apiGetCourse(courseId)
      .then((course) => {
        if (cancelled) return;
        setLoaded(course);
        setTitle(course.title);
        setDescription(course.description);
        setKnowledgeText(course.knowledgeText ?? "");
        setFaqs(Array.isArray(course.faqs) ? course.faqs : []);
        setDocuments(Array.isArray(course.docs) ? course.docs : []);
        setSelectedKbId(course.telenowKbId ?? null);
        setCriteria(
          course.scoringRubric.map((entry) => ({ ...entry, id: nextRubricId() })),
        );
        setMaxDurationSec(String(course.maxDurationSec));
        setCallWindowStart(course.callWindowStart || "");
        setCallWindowEnd(course.callWindowEnd || "");
        setIsMandatory(course.isMandatory);
        setExpiresAt(course.expiresAt ? course.expiresAt.slice(0, 16) : "");
        setAudienceIds(Array.isArray(course.audienceIds) ? course.audienceIds : []);
        setDraftAudience(null);
        if (Array.isArray(course.whatsappResources)) {
          setWhatsappResources(course.whatsappResources);
        }
        if (course.whatsappChannelId) setWhatsappChannelId(course.whatsappChannelId);
        if (course.voice) setVoice(course.voice);
        if (course.voiceProvider) setVoiceProvider(course.voiceProvider);
        if (course.phoneNumberId) setPhoneNumberId(course.phoneNumberId);
        if (course.phoneNumber) setPhoneNumber(course.phoneNumber);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't load this course.");
        void router.navigate({ to: "/courses" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    apiListWhatsAppChannels()
      .then((res) => {
        if (cancelled) return;
        setWhatsappChannels(res.channels);
        setDefaultWhatsappChannelId(res.defaultChannelId);
      })
      .catch((err) => {
        console.error("Failed to load WhatsApp channels for CourseEditor", err);
      });

    apiListCourseSchedules({ courseId })
      .then((scheds) => {
        if (cancelled) return;
        if (scheds && scheds.length > 0) {
          const sch = scheds[0];
          setExistingSchedule(sch);
          setEnableSchedule(true);
          setScheduleType(sch.scheduleType);
          setScheduleStartDate(sch.startDate || new Date().toISOString().slice(0, 10));
          setScheduleEndDate(sch.endDate || "");
          setScheduleDaysOfWeek(sch.daysOfWeek || [1, 2, 3, 4, 5]);
          setScheduleWindowStart(sch.timeWindowStart || "09:00");
          setScheduleWindowEnd(sch.timeWindowEnd || "18:00");
          setScheduleTimezone(
            sch.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
          );
          if (sch.whatsappChannelId) setWhatsappChannelId(sch.whatsappChannelId);
          setScheduleNotifyWhatsapp(sch.notifyWhatsappPrior ?? true);
          setScheduleNotifyMinutes(sch.notifyMinutesBefore ?? 15);
          setScheduleCustomMessage(sch.customMessage || "");
        }
      })
      .catch((err) => {
        console.error("Failed to load course schedule", err);
      });

    return () => {
      cancelled = true;
    };
  }, [isNew, courseId, router]);

  useEffect(() => {
    if (isNew) {
      apiListWhatsAppChannels()
        .then((res) => {
          setWhatsappChannels(res.channels);
          setDefaultWhatsappChannelId(res.defaultChannelId);
        })
        .catch((err) => {
          console.error("Failed to load WhatsApp channels for new course", err);
        });
    }
  }, [isNew]);

  useEffect(() => {
    if (isNew || !courseId) return;
    void loadKb(courseId);
  }, [isNew, courseId]);

  // Polling for documents being vectorized
  const hasPendingDocs = kbDocuments.some((d) => d.status === "pending");
  useEffect(() => {
    if (isNew || !courseId || !hasPendingDocs) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiGetCourseKnowledgeBase(courseId);
        setKbDocuments(res.documents);
        if (res.knowledgeBase) setKbInfo(res.knowledgeBase);
      } catch {
        // ignore polling errors
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isNew, courseId, hasPendingDocs]);

  const readOnly = useMemo(
    () =>
      !!loaded &&
      !isNew &&
      (loaded.status === "published" || loaded.status === "pending_review"),
    [loaded, isNew],
  );

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  const isPublished = loaded?.status === "published";
  const audienceDirty = isPublished && draftAudience !== null;
  const effectiveAudience =
    draftAudience !== null ? draftAudience : audienceIds;

  const hasKnowledge = isNew
    ? pendingFiles.length > 0 ||
      pendingTextDocs.length > 0 ||
      pendingUrls.length > 0 ||
      knowledgeText.trim().length > 0
    : kbDocuments.length > 0 ||
      documents.length > 0 ||
      knowledgeText.trim().length > 0;

  const canGenerate = hasKnowledge;

  const updateCriterion = (id: string, patch: Partial<EditableCriterion>) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const addCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      { id: nextRubricId(), name: "", weight: 0, description: "" },
    ]);
  };

  const removeCriterion = (id: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const distributeEvenly = () => {
    const n = criteria.length;
    if (n === 0) return;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    setCriteria((prev) =>
      prev.map((c, i) => ({
        ...c,
        weight: i < remainder ? base + 1 : base,
      })),
    );
  };

  const updateFaq = (index: number, value: string) => {
    setFaqs((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const addFaq = () => {
    setFaqs((prev) => [...prev, ""]);
  };

  const removeFaq = (index: number) => {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  };

  const moveFaq = (index: number, delta: -1 | 1) => {
    setFaqs((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const cleanFaqs = () => {
    const seen = new Set<string>();
    const cleaned = faqs
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .filter((q) => {
        const key = q.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    setFaqs(cleaned);
    return cleaned;
  };

  const runGenerateFaqs = async () => {
    if (!isNew && !courseId) return;
    setGenerating(true);
    try {
      let result: { faqs: string[]; message?: string };
      if (isNew) {
        const docsTexts: string[] = [];
        for (const t of pendingTextDocs) {
          docsTexts.push(`Title: ${t.title}\n${t.content}`);
        }
        for (const item of pendingFiles) {
          if (!isTextDoc(item.file)) continue;
          try {
            const text = await item.file.text();
            if (text.trim()) docsTexts.push(text);
          } catch {
            // unreadable file — skip its text for the draft
          }
        }
        if (knowledgeText.trim().length === 0 && docsTexts.length === 0) {
          toast.info(
            "Add some knowledge first — attach documents or notes to the knowledge base so questions can be generated.",
          );
          return;
        }
        result = await apiGenerateFaqsDraft({
          title: title.trim(),
          description: description.trim(),
          knowledgeText: knowledgeText.trim(),
          docsTexts,
        });
      } else if (courseId) {
        result = await apiGenerateFaqs(courseId);
      } else {
        return;
      }
      if (result.faqs.length > 0) {
        setFaqs(result.faqs);
        toast.success("Question suggestions added — review and edit them.");
      } else {
        toast.info(
          result.message ??
            "Add documents to the Knowledge Base first so questions can be generated.",
        );
      }
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't generate questions.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const runGenerateRubric = async () => {
    if (!isNew && !courseId) return;
    setGeneratingRubric(true);
    try {
      let result: { rubric: RubricCriterion[]; message?: string };
      if (isNew) {
        const docsTexts: string[] = [];
        for (const t of pendingTextDocs) {
          docsTexts.push(`Title: ${t.title}\n${t.content}`);
        }
        for (const item of pendingFiles) {
          if (!isTextDoc(item.file)) continue;
          try {
            const text = await item.file.text();
            if (text.trim()) docsTexts.push(text);
          } catch {
            // unreadable file — skip its text for the draft
          }
        }
        if (
          knowledgeText.trim().length === 0 &&
          docsTexts.length === 0 &&
          title.trim().length === 0
        ) {
          toast.info(
            "Add some knowledge first — attach documents or notes to the knowledge base so a scoring rubric can be generated.",
          );
          return;
        }
        result = await apiGenerateRubricDraft({
          title: title.trim(),
          description: description.trim(),
          knowledgeText: knowledgeText.trim(),
          docsTexts,
          faqs: cleanFaqs(),
        });
      } else if (courseId) {
        result = await apiGenerateRubric(courseId);
      } else {
        return;
      }
      if (result.rubric.length > 0) {
        setCriteria(
          result.rubric.map((entry) => ({
            ...entry,
            id: nextRubricId(),
          })),
        );
        toast.success("AI scoring rubric generated — review and customize weights.");
      } else {
        toast.info(
          result.message ??
            "Add documents to the Knowledge Base first so a scoring rubric can be generated.",
        );
      }
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't generate scoring rubric.",
      );
    } finally {
      setGeneratingRubric(false);
    }
  };

  // ── Knowledge Base Handlers ──
  const ingestKbFiles = async (
    processedFiles: ProcessedKbFile[],
    skippedCount: number,
    unsupportedTypes: string[],
  ) => {
    if (skippedCount > 0) {
      const typesStr =
        unsupportedTypes.length > 0 ? ` (${unsupportedTypes.join(", ")})` : "";
      toast.info(`Skipped ${skippedCount} non-document or system file(s)${typesStr}.`);
    }

    if (processedFiles.length === 0) {
      if (skippedCount > 0) {
        toast.error("No supported documents found in the selected folder/archive.");
      }
      return;
    }

    if (isNew || !courseId) {
      setPendingFiles((prev) => [...prev, ...processedFiles]);
      toast.success(`${processedFiles.length} document(s) staged for knowledge base.`);
      return;
    }

    setUploading(true);
    let uploadedCount = 0;
    try {
      for (const item of processedFiles) {
        const doc = await apiUploadCourseKbFileDoc(courseId, item.file, item.title);
        setKbDocuments((prev) => [doc, ...prev]);
        uploadedCount++;
      }
      toast.success(
        `${uploadedCount} document(s) uploaded — embedding into knowledge base...`,
      );
    } catch (err) {
      toast.error(
        `Uploaded ${uploadedCount}/${processedFiles.length} file(s). Error: ${(err as { message?: string })?.message ?? "Couldn't upload file."}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const pickKbFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const result = await processFileList(files);
      await ingestKbFiles(result.files, result.skippedCount, result.unsupportedTypes);
    } catch (err) {
      console.error("Failed to process files or archive", err);
      toast.error("Failed to read the selected files or archive.");
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    if (readOnly) return;

    try {
      const result = await processDataTransfer(e.dataTransfer);
      await ingestKbFiles(result.files, result.skippedCount, result.unsupportedTypes);
    } catch (err) {
      console.error("Failed to process dropped items", err);
      toast.error("Failed to process dropped files or folder.");
    }
  };

  const handleAddTextDoc = async (e: FormEvent) => {
    e.preventDefault();
    if (!textDocTitle.trim() || !textDocContent.trim()) {
      toast.error("Please provide both a title and content.");
      return;
    }

    if (isNew || !courseId) {
      setPendingTextDocs((prev) => [
        ...prev,
        {
          id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: textDocTitle.trim(),
          content: textDocContent.trim(),
        },
      ]);
      setTextDocTitle("");
      setTextDocContent("");
      setAddTextModalOpen(false);
      toast.success("Text note staged for knowledge base.");
      return;
    }

    setSubmittingTextDoc(true);
    try {
      const doc = await apiAddCourseKbTextDoc(
        courseId,
        textDocTitle.trim(),
        textDocContent.trim(),
      );
      setKbDocuments((prev) => [doc, ...prev]);
      setTextDocTitle("");
      setTextDocContent("");
      setAddTextModalOpen(false);
      toast.success("Text note embedded into Knowledge Base.");
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't add text note.",
      );
    } finally {
      setSubmittingTextDoc(false);
    }
  };

  const handleAddUrlDoc = async (e: FormEvent) => {
    e.preventDefault();
    if (!urlAddress.trim()) {
      toast.error("Please enter a valid URL.");
      return;
    }

    if (isNew || !courseId) {
      setPendingUrls((prev) => [
        ...prev,
        {
          id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: urlAddress.trim(),
          title: urlTitle.trim() || urlAddress.trim(),
        },
      ]);
      setUrlAddress("");
      setUrlTitle("");
      setAddUrlModalOpen(false);
      toast.success("Webpage staged for knowledge base.");
      return;
    }

    setSubmittingUrl(true);
    try {
      const doc = await apiAddCourseKbUrlDoc(
        courseId,
        urlAddress.trim(),
        urlTitle.trim() || undefined,
      );
      setKbDocuments((prev) => [doc, ...prev]);
      setUrlAddress("");
      setUrlTitle("");
      setAddUrlModalOpen(false);
      toast.success("Webpage ingested into Knowledge Base.");
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't ingest webpage.",
      );
    } finally {
      setSubmittingUrl(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!courseId) return;
    try {
      await apiDeleteCourseKbDoc(courseId, docId);
      setKbDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document removed from Knowledge Base.");
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't remove document.",
      );
    }
  };

  const uploadPendingKbItems = async (targetCourseId: string) => {
    for (const item of pendingFiles) {
      try {
        await apiUploadCourseKbFileDoc(targetCourseId, item.file, item.title);
      } catch (err) {
        console.error("Failed to upload file to KB", item.title, err);
      }
    }
    for (const textDoc of pendingTextDocs) {
      try {
        await apiAddCourseKbTextDoc(targetCourseId, textDoc.title, textDoc.content);
      } catch (err) {
        console.error("Failed to add text note to KB", textDoc.title, err);
      }
    }
    for (const urlDoc of pendingUrls) {
      try {
        await apiAddCourseKbUrlDoc(targetCourseId, urlDoc.url, urlDoc.title);
      } catch (err) {
        console.error("Failed to ingest URL to KB", urlDoc.url, err);
      }
    }
  };

  // ── WhatsApp Resource Handlers ──
  const handleAddVideoResource = (e: FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim() || !videoTitle.trim()) {
      toast.error("Please provide both a video title and URL.");
      return;
    }
    const newRes: CourseWhatsappResource = {
      id: `wa-vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "video",
      title: videoTitle.trim(),
      description: videoDesc.trim() || undefined,
      url: videoUrl.trim(),
      deliveryTrigger: videoTrigger,
      caption: videoCaption.trim() || undefined,
      enabled: true,
    };
    setWhatsappResources((prev) => [...prev, newRes]);
    setVideoTitle("");
    setVideoUrl("");
    setVideoDesc("");
    setVideoCaption("");
    setVideoTrigger("during_call");
    setAddVideoModalOpen(false);
    toast.success("WhatsApp video resource added.");
  };

  const handleAddLinkResource = (e: FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim() || !linkTitle.trim()) {
      toast.error("Please provide both a link title and valid URL.");
      return;
    }
    const newRes: CourseWhatsappResource = {
      id: `wa-lnk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "link",
      title: linkTitle.trim(),
      description: linkDesc.trim() || undefined,
      url: linkUrl.trim(),
      deliveryTrigger: linkTrigger,
      caption: linkCaption.trim() || undefined,
      enabled: true,
    };
    setWhatsappResources((prev) => [...prev, newRes]);
    setLinkTitle("");
    setLinkUrl("");
    setLinkDesc("");
    setLinkCaption("");
    setLinkTrigger("during_call");
    setAddLinkModalOpen(false);
    toast.success("WhatsApp web resource added.");
  };

  const handleToggleDocumentWhatsApp = (doc: { id: string; title: string; storageUrl?: string | null; sourceType?: string }) => {
    const existing = whatsappResources.find(
      (r) => r.documentId === doc.id || (r.title === doc.title && (r.type === "pdf" || r.type === "document")),
    );
    if (existing) {
      setWhatsappResources((prev) => prev.filter((r) => r.id !== existing.id));
      toast.info(`Removed "${doc.title}" from WhatsApp deliverables.`);
    } else {
      const isPdf = doc.title.toLowerCase().endsWith(".pdf") || doc.sourceType === "file" || doc.sourceType === "upload";
      const newRes: CourseWhatsappResource = {
        id: `wa-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: isPdf ? "pdf" : "document",
        title: doc.title,
        url: doc.storageUrl || "",
        documentId: doc.id,
        deliveryTrigger: "during_call",
        enabled: true,
      };
      setWhatsappResources((prev) => [...prev, newRes]);
      toast.success(`"${doc.title}" enabled for WhatsApp delivery.`);
    }
  };

  const handleRemoveWhatsappResource = (resId: string) => {
    setWhatsappResources((prev) => prev.filter((r) => r.id !== resId));
    toast.info("WhatsApp resource removed.");
  };

  const handleToggleWhatsappResourceActive = (resId: string) => {
    setWhatsappResources((prev) =>
      prev.map((r) => (r.id === resId ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  const handleUpdateWhatsappResourceTrigger = (
    resId: string,
    deliveryTrigger: CourseWhatsappResource["deliveryTrigger"],
  ) => {
    setWhatsappResources((prev) =>
      prev.map((r) => (r.id === resId ? { ...r, deliveryTrigger } : r)),
    );
  };

  const handleOpenPreviewWhatsapp = async (resource: CourseWhatsappResource) => {
    setPreviewResource(resource);
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    try {
      if (courseId) {
        const res = await apiPreviewCourseWhatsappMessage(courseId, {
          resource,
          courseTitle: title || undefined,
        });
        setPreviewText(res.message);
      } else {
        let text = `*Agility OS Training Resource*\n\n📚 *${title || "Course"}*\n\nHey there! Here is the learning resource for your practice session:`;
        if (resource.title) text += `\n\n📌 *${resource.title}*`;
        if (resource.description) text += `\n_${resource.description}_`;
        if (resource.caption) text += `\n\n💬 ${resource.caption}`;
        if (resource.url) text += `\n\n🔗 ${resource.url}`;
        setPreviewText(text);
      }
    } catch {
      let text = `*Agility OS Training Resource*\n\n📚 *${title || "Course"}*\n\nHere is your requested learning resource:\n\n📌 *${resource.title}*`;
      if (resource.url) text += `\n\n🔗 ${resource.url}`;
      setPreviewText(text);
    } finally {
      setPreviewLoading(false);
    }
  };

  const buildInput = (): { ok: boolean; input?: CourseInput; message?: string } => {
    const cleaned = criteria.map((c) => ({
      name: c.name.trim(),
      description: c.description?.trim() || undefined,
      weight: c.weight,
    }));

    for (const c of cleaned) {
      if (!c.name) {
        setActiveTab("rubric");
        return { ok: false, message: "Give every criterion a name." };
      }
      if (!Number.isInteger(c.weight) || c.weight < 1 || c.weight > 100) {
        setActiveTab("rubric");
        return {
          ok: false,
          message: "Weights must be whole numbers between 1 and 100.",
        };
      }
    }

    const total = cleaned.reduce((sum, c) => sum + c.weight, 0);
    if (cleaned.length > 0 && total !== 100) {
      setActiveTab("rubric");
      return {
        ok: false,
        message: `Weights must add up to 100 (currently ${total}%).`,
      };
    }

    if (!voice || !voice.trim()) {
      setActiveTab("voice");
      return {
        ok: false,
        message: "An AI Coach voice persona is compulsory. Please select a voice before saving.",
      };
    }

    if (!voiceProvider || !voiceProvider.trim()) {
      setActiveTab("voice");
      return {
        ok: false,
        message: "A TTS voice provider is required. Please select a provider before saving.",
      };
    }

    const input: CourseInput = {
      title: title.trim(),
      description: description.trim(),
      knowledgeText: knowledgeText.trim(),
      telenowKbId: selectedKbId ?? undefined,
      voice: voice.trim(),
      voiceProvider: voiceProvider.trim(),
      phoneNumberId: phoneNumberId || null,
      phoneNumber: phoneNumber || null,
      faqs: cleanFaqs(),
      scoringRubric: cleaned,
      maxDurationSec: Number.parseInt(maxDurationSec, 10) || 120,
      callWindowStart: callWindowStart.trim() || null,
      callWindowEnd: callWindowEnd.trim() || null,
      isMandatory,
    };
    if (expiresAt.trim()) input.expiresAt = new Date(expiresAt).toISOString();
    else input.expiresAt = null;
    input.audienceIds = audienceIds;
    input.whatsappChannelId = whatsappChannelId || null;
    input.whatsappResources = whatsappResources;
    return { ok: true, input };
  };

  const goBack = () => void router.navigate({ to: "/courses" });

  const syncSchedule = async (targetCourseId: string) => {
    if (!enableSchedule) return;
    const schedInput = {
      courseId: targetCourseId,
      title: `${title.trim() || "Course"} Practice Schedule`,
      scheduleType,
      startDate: scheduleStartDate || new Date().toISOString().slice(0, 10),
      endDate: scheduleEndDate.trim() || null,
      daysOfWeek: scheduleDaysOfWeek,
      timeWindowStart: scheduleWindowStart || "09:00",
      timeWindowEnd: scheduleWindowEnd || "18:00",
      timezone: scheduleTimezone || "Asia/Kolkata",
      whatsappChannelId: whatsappChannelId || null,
      notifyWhatsappPrior: scheduleNotifyWhatsapp,
      notifyMinutesBefore: scheduleNotifyMinutes,
      customMessage: scheduleCustomMessage.trim() || null,
      audienceType: "course_default" as const,
    };
    try {
      if (existingSchedule?.id) {
        await apiUpdateCourseSchedule(existingSchedule.id, schedInput);
      } else {
        await apiCreateCourseSchedule(schedInput);
      }
    } catch (schErr) {
      console.error("Failed to save schedule for course:", schErr);
      toast.error("Course saved, but schedule synchronization failed.");
    }
  };

  const runSave = async () => {
    if (readOnly) return;

    const built = buildInput();
    if (!built.ok || !built.input) {
      toast.error(built.message ?? "Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await apiCreateCourse(built.input);
        await uploadPendingKbItems(created.id);
        await syncSchedule(created.id);
        setPendingFiles([]);
        setPendingTextDocs([]);
        setPendingUrls([]);
        toast.success("Course created and schedule configured.");
      } else if (courseId) {
        await apiUpdateCourse(courseId, built.input);
        await syncSchedule(courseId);
        toast.success("Course saved.");
      }
      goBack();
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        "Couldn't save this course.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const runSubmit = async () => {
    if (readOnly) return;

    const built = buildInput();
    if (!built.ok || !built.input) {
      toast.error(built.message ?? "Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      if (isNew) {
        const created = await apiCreateCourse(built.input);
        await uploadPendingKbItems(created.id);
        await syncSchedule(created.id);
        setPendingFiles([]);
        setPendingTextDocs([]);
        setPendingUrls([]);
        await apiSubmitCourse(created.id);
      } else if (courseId) {
        if (
          loaded &&
          (loaded.status === "draft" || loaded.status === "rejected")
        ) {
          await apiUpdateCourse(courseId, built.input);
        }
        await syncSchedule(courseId);
        await apiSubmitCourse(courseId);
      }
      toast.success("Course submitted for review.");
      goBack();
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        "Couldn't submit this course.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSubmit();
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const runDelete = async () => {
    if (!courseId) return;
    setDeleting(true);
    try {
      await apiDeleteCourse(courseId);
      toast.success("Course deleted.");
      goBack();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Couldn't delete course.");
      setDeleting(false);
    }
  };

  const runSaveAudience = async () => {
    if (!courseId || !loaded || !audienceDirty || draftAudience === null) return;
    setSavingAudience(true);
    try {
      const result = await apiUpdateCourseAudience(courseId, draftAudience);
      setLoaded(result.course);
      setAudienceIds(
        Array.isArray(result.course.audienceIds) ? result.course.audienceIds : [],
      );
      setDraftAudience(null);
      const count = result.added;
      if (count === 0) {
        toast.success("Audience saved.");
      } else if (result.provisioned) {
        toast.success(
          `${count} practitioner${count === 1 ? "" : "s"} added — practice calls are being set up.`,
        );
      } else {
        toast.success(
          `${count} practitioner${count === 1 ? "" : "s"} added — saved, calls will start on the next provisioning run.`,
        );
      }
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        "Couldn't save the audience.";
      toast.error(message);
    } finally {
      setSavingAudience(false);
    }
  };

  const discardAudience = () => setDraftAudience(null);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-neutral-50">
        <Spinner size="md" className="text-neutral-700" />
      </div>
    );
  }

  return (
    <motion.div
      key="course-editor"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex min-h-screen flex-col items-center gap-8 bg-neutral-50 px-4 py-6 font-sans sm:px-6 lg:p-8"
    >
      <motion.div
        variants={fadeUp}
        className="flex w-full max-w-4xl items-start justify-between gap-4"
      >
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-normal text-neutral-950">
            {isNew ? "Create course" : loaded?.title ?? "Edit course"}
          </h1>
          <p className="mt-1 text-sm font-medium text-neutral-600">
            {isNew
              ? "Build a training course for your team — what they should know, and the questions a coach will ask them to check their understanding."
              : "Fine-tune the course before it's rolled out."}
          </p>
        </div>
        {loaded && <StatusBadge status={loaded.status} />}
      </motion.div>

      {readOnly && (
        <motion.div
          variants={fadeUp}
          className="w-full max-w-4xl rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm"
        >
          This course is{" "}
          <span className="font-semibold text-neutral-900">
            {loaded?.status === "published" ? "live" : "pending review"}
          </span>
          . Published and in-review courses are locked; no edits are allowed.
        </motion.div>
      )}

      {loaded?.status === "rejected" && loaded.reviewComment && (
        <motion.div
          variants={fadeUp}
          className="w-full max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700"
        >
          <span className="font-semibold">Why it was rejected:</span>{" "}
          {loaded.reviewComment}
          <span className="mt-1 block text-xs text-red-600/80">
            Fix the points above and submit it again.
          </span>
        </motion.div>
      )}

      <motion.form
        variants={fadeUp}
        onSubmit={handleFormSubmit}
        noValidate
        className="flex w-full max-w-4xl flex-col gap-4"
      >
        <Tabs
          items={[
            { id: "basics", label: "Basics", icon: SlidersHorizontal },
            {
              id: "knowledge",
              label: "Knowledge base",
              icon: Database,
              count: isNew
                ? pendingFiles.length + pendingTextDocs.length + pendingUrls.length
                : kbDocuments.length,
            },
            { id: "voice", label: "Coach voice", icon: MicrophoneStage },
            { id: "questions", label: "Practice questions", icon: ChatCenteredText, count: faqs.length },
            { id: "rubric", label: "Scoring rubric", icon: Trophy },
            { id: "audience", label: "Audience", icon: UsersThree, count: effectiveAudience.length },
            { id: "schedule", label: "Schedule", icon: CalendarPlus, count: enableSchedule ? 1 : undefined },
          ]}
          active={activeTab}
          onChange={handleTabChange}
        />

        {activeTab === "basics" && (
          <SectionCard title="Basics" description="What this course is and who it's for.">
            <Field label="Title">
              <input
                className={inputClasses}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New technology rollout: answering employee questions"
                disabled={readOnly}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                className={textareaClasses}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this training about, who is it for, and why does it matter?"
                disabled={readOnly}
                rows={3}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                />
                Mandatory
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClasses}>Expires (optional)</span>
                <input
                  type="datetime-local"
                  className={inputClasses}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={readOnly}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Max duration (seconds)">
                <input
                  type="number"
                  min={10}
                  max={3600}
                  className={inputClasses}
                  value={maxDurationSec}
                  onChange={(e) => setMaxDurationSec(e.target.value)}
                  disabled={readOnly}
                />
              </Field>
              <Field label="Calling Window Start (HH:MM)">
                <input
                  type="time"
                  className={inputClasses}
                  value={callWindowStart}
                  onChange={(e) => setCallWindowStart(e.target.value)}
                  disabled={readOnly}
                />
              </Field>
              <Field label="Calling Window End (HH:MM)">
                <input
                  type="time"
                  className={inputClasses}
                  value={callWindowEnd}
                  onChange={(e) => setCallWindowEnd(e.target.value)}
                  disabled={readOnly}
                />
              </Field>
            </div>
          </SectionCard>
        )}

        {activeTab === "knowledge" && (
          <SectionCard
            title="Knowledge Base"
            description="Upload documents, write notes, or import webpages for this course. Everything added here is automatically embedded into the course's dedicated Knowledge Base to ground the Voice AI Coach."
          >
            {/* Knowledge Base Overview */}
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
              <div className="flex items-start gap-3">
                <IconBadge
                  icon={Database}
                  variant="emerald"
                  size="lg"
                  weight="duotone"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-neutral-950">
                      {kbInfo?.name ||
                        kbInfo?.title ||
                        (title.trim()
                          ? `Knowledge Base: ${title.trim()}`
                          : "Course Knowledge Base")}
                    </h3>
                    <span className="inline-flex items-center rounded-md bg-emerald-100/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase">
                      AI Grounded
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {isNew
                      ? `${pendingFiles.length + pendingTextDocs.length + pendingUrls.length} resource(s) staged for this course`
                      : loadingKb
                        ? "Loading Knowledge Base…"
                        : `${kbDocuments.filter((d) => d.status === "embedded").length} embedded · ${kbDocuments.filter((d) => d.status === "pending").length} vectorizing · top 3 chunks queried per turn`}
                  </p>
                </div>
              </div>
            </div>

            {/* Drag & Drop Wrapper */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => void handleDrop(e)}
              className={`relative flex flex-col gap-4 rounded-2xl transition-all ${
                isDraggingOver
                  ? "bg-neutral-50/90 ring-2 ring-neutral-900 ring-offset-2 p-2 -m-2"
                  : ""
              }`}
            >
              {isDraggingOver && (
                <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500 bg-white/95 backdrop-blur-xs p-6 text-center shadow-lg">
                  <IconBadge
                    icon={CloudArrowUp}
                    variant="emerald"
                    size="xl"
                    weight="duotone"
                    className="mb-2"
                  />
                  <h4 className="mt-2 text-sm font-semibold text-neutral-950">
                    Drop files, folders, or ZIP archives here
                  </h4>
                  <p className="mt-1 text-xs text-neutral-500">
                    Documents will be extracted and embedded into the course Knowledge Base
                  </p>
                </div>
              )}

              {/* Ingestion Action Toolbar */}
              {!readOnly && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-y border-neutral-100 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.md,.csv,.markdown,.zip,application/zip"
                      className="hidden"
                      onChange={(e) => {
                        void pickKbFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      // @ts-expect-error webkitdirectory is standard across modern browsers
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void pickKbFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      loading={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3.5"
                    >
                      <FileZip className="h-4 w-4 shrink-0" weight="duotone" />
                      Upload document / ZIP
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={uploading}
                      onClick={() => folderInputRef.current?.click()}
                      className="h-9 px-3.5"
                    >
                      <FolderOpen className="h-4 w-4 shrink-0" weight="duotone" />
                      Upload folder
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddTextModalOpen(true)}
                      className="h-9 px-3.5"
                    >
                      <FileText className="h-4 w-4 shrink-0" weight="duotone" />
                      Add text note
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddUrlModalOpen(true)}
                      className="h-9 px-3.5"
                    >
                      <GlobeSimple className="h-4 w-4 shrink-0" weight="duotone" />
                      Import webpage
                    </Button>
                  </div>
                  <span className="text-xs text-neutral-400">
                    Supported: PDF, DOCX, TXT, MD, CSV, ZIP, Folders (up to 20MB per file)
                  </span>
                </div>
              )}

              {/* Document List */}
              <div className="flex flex-col gap-2">
                <span className={labelClasses}>Knowledge base documents</span>

                {kbDocuments.length === 0 &&
                pendingFiles.length === 0 &&
                pendingTextDocs.length === 0 &&
                pendingUrls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center">
                    <IconBadge
                      icon={BookOpen}
                      variant="emerald"
                      size="xl"
                      weight="duotone"
                      className="mb-1"
                    />
                    <h4 className="mt-3 text-sm font-semibold text-neutral-900">
                      Your knowledge base is empty
                    </h4>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-neutral-500">
                      Upload documents, folders, ZIP archives, write notes, or import URLs to feed
                      your Voice AI Coach with grounding data.
                    </p>
                    {!readOnly && (
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-9 px-3.5"
                        >
                          <FileZip className="h-4 w-4 shrink-0" weight="duotone" />
                          Upload document / ZIP
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => folderInputRef.current?.click()}
                          className="h-9 px-3.5"
                        >
                          <FolderOpen className="h-4 w-4 shrink-0" weight="duotone" />
                          Upload folder
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddTextModalOpen(true)}
                          className="h-9 px-3.5"
                        >
                          <FileText className="h-4 w-4 shrink-0" weight="duotone" />
                          Add text note
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                <ul className="flex flex-col gap-2.5">
                  {/* Saved Telenow KB Documents */}
                  {kbDocuments.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                          {(doc.sourceType === "file" || doc.sourceType === "upload") && <FileText className="h-4 w-4" weight="duotone" />}
                          {(doc.sourceType === "text" || doc.sourceType === "inline") && <FileText className="h-4 w-4" weight="duotone" />}
                          {doc.sourceType === "url" && <GlobeSimple className="h-4 w-4" weight="duotone" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            {doc.title || "Untitled Document"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                            <span className="capitalize">{doc.sourceType}</span>
                            {doc.fileSize && (
                              <>
                                <span>·</span>
                                <span>{formatBytes(doc.fileSize)}</span>
                              </>
                            )}
                            {doc.chunkCount ? (
                              <>
                                <span>·</span>
                                <span>{doc.chunkCount} chunks</span>
                              </>
                            ) : null}
                            {doc.sourceUri && doc.sourceType === "url" && (
                              <>
                                <span>·</span>
                                <a
                                  href={doc.sourceUri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="max-w-[200px] truncate text-indigo-600 hover:underline"
                                >
                                  {doc.sourceUri}
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:justify-end">
                        {/* WhatsApp Deliverable Badge / Toggle Button */}
                        {(() => {
                          const waRes = whatsappResources.find(
                            (r) => r.documentId === doc.id || (r.title === doc.title && (r.type === "pdf" || r.type === "document")),
                          );
                          if (waRes) {
                            return (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
                                <WhatsappLogo className="h-3.5 w-3.5 text-emerald-600 shrink-0" weight="fill" />
                                <span>WhatsApp: {waRes.deliveryTrigger.replace("_", " ")}</span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDocumentWhatsApp(doc)}
                                    className="ml-1 text-emerald-700 hover:text-red-600 transition-colors"
                                    title="Disable WhatsApp delivery for this doc"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </span>
                            );
                          }
                          if (!readOnly) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleToggleDocumentWhatsApp(doc)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800 transition-colors shadow-2xs"
                              >
                                <WhatsappLogo className="h-3.5 w-3.5 text-emerald-600 shrink-0" weight="fill" />
                                <span>Send via WhatsApp</span>
                              </button>
                            );
                          }
                          return null;
                        })()}

                        {/* Status Badges */}
                        {doc.status === "embedded" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            <Check className="h-3 w-3 text-emerald-600" weight="bold" />
                            Embedded
                          </span>
                        )}

                        {doc.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500" />
                            Vectorizing…
                          </span>
                        )}

                        {doc.status === "failed" && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
                            title={doc.errorMessage || doc.error || "Processing failed"}
                          >
                            <WarningCircle className="h-3.5 w-3.5 text-red-600" weight="duotone" />
                            Failed
                          </span>
                        )}

                        {!readOnly && (
                          <button type="button" onClick={() => void handleDeleteDoc(doc.id)} aria-label={`Remove ${doc.title}`} className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"><Trash className="h-4 w-4" weight="duotone" /></button>
                        )}
                      </div>
                    </li>
                  ))}

                  {/* Staged Draft Files */}
                  {pendingFiles.map((item, i) => (
                    <li
                      key={`pending-file-${item.relativePath}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600">
                          {item.relativePath.includes("/") ? <FolderOpen className="h-4 w-4" weight="duotone" /> : <FileText className="h-4 w-4" weight="duotone" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {item.title}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {item.relativePath !== item.file.name ? (
                              <span className="font-mono text-neutral-500 mr-1.5">
                                {item.relativePath} ·
                              </span>
                            ) : null}
                            File ({formatBytes(item.file.size)}) · Staged for save
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingFiles((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        aria-label={`Remove ${item.title}`}
                        className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      </button>
                    </li>
                  ))}

                  {/* Staged Draft Text Notes */}
                  {pendingTextDocs.map((item, i) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600"><FileText className="h-4 w-4" weight="duotone" /></div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {item.title}
                          </p>
                          <p className="text-xs text-neutral-400">
                            Text Note · Staged for save
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingTextDocs((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        aria-label={`Remove ${item.title}`}
                        className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      </button>
                    </li>
                  ))}

                  {/* Staged Draft URLs */}
                  {pendingUrls.map((item, i) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600"><GlobeSimple className="h-4 w-4" weight="duotone" /></div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {item.title}
                          </p>
                          <p className="max-w-[200px] truncate text-xs text-neutral-400">
                            Webpage ({item.url}) · Staged for save
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingUrls((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        aria-label={`Remove ${item.title}`}
                        className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </div>

            {/* ── WhatsApp Learning Deliverables Section ── */}
            <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <WhatsAppIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-950">
                        WhatsApp Deliverable Resources
                      </h3>
                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase">
                        Omnichannel Learning
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      Configure shareable videos (YouTube, Loom, Vimeo), cheat sheets, PDFs, and web links that can be sent directly to learners over WhatsApp during practice calls, immediately after session analysis, or upon course enrollment.
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" onClick={() => setAddVideoModalOpen(true)} className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white"><VideoCamera className="h-4 w-4 mr-1 shrink-0" weight="duotone" />Add Video Link</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAddLinkModalOpen(true)} className="h-9 px-3.5 border-emerald-300 text-emerald-900 hover:bg-emerald-50"><LinkSimple className="h-4 w-4 mr-1 shrink-0" weight="bold" />Add Web Link</Button>
                  </div>
                )}
              </div>

              {/* WhatsApp Sender Channel Selection */}
              <div className="flex flex-col gap-2 rounded-xl border border-emerald-200/90 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-semibold text-neutral-900">
                      WhatsApp Sender Line
                    </h4>
                    {whatsappChannels.length === 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        No lines connected
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                        {whatsappChannels.length} connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    Choose which mobile number and name will deliver WhatsApp resources and prior reminders for this course.
                  </p>
                </div>

                <div className="shrink-0">
                  {whatsappChannels.length > 0 ? (
                    <select
                      value={whatsappChannelId || ""}
                      onChange={(e) => setWhatsappChannelId(e.target.value || null)}
                      disabled={readOnly}
                      className="w-full sm:w-auto rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-900 outline-none focus:border-neutral-900 focus:bg-white"
                    >
                      <option value="">
                        {defaultWhatsappChannelId
                          ? `Use Default: ${formatChannelLabel(whatsappChannels.find((c) => c.id === defaultWhatsappChannelId) || { id: defaultWhatsappChannelId, name: "Default Sender", phone: "", status: "active" })}`
                          : "Use Organization Default"}
                      </option>
                      {whatsappChannels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatChannelLabel(c)} {c.id === defaultWhatsappChannelId ? "⭐ (Default)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">
                      Organization default will be used
                    </span>
                  )}
                </div>
              </div>

              {/* WhatsApp Resources List */}
              {whatsappResources.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-white/80 py-8 px-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <WhatsAppIcon className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-xs font-semibold text-neutral-900">
                    No WhatsApp deliverables configured yet
                  </h4>
                  <p className="mt-1 max-w-md text-xs text-neutral-500">
                    Add video walkthroughs or links above, or click "Send via WhatsApp" on any uploaded knowledge base document.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {whatsappResources.map((res) => (
                    <li
                      key={res.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border bg-white p-3.5 shadow-xs transition-all sm:flex-row sm:items-center sm:justify-between",
                        res.enabled ? "border-emerald-200" : "border-neutral-200 opacity-65",
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                            res.type === "video"
                              ? "bg-red-100 text-red-700"
                              : res.type === "pdf"
                                ? "bg-amber-100 text-amber-700"
                                : res.type === "link"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-emerald-100 text-emerald-700",
                          )}
                        >
                          {res.type === "video" && <VideoCamera className="h-4 w-4" weight="duotone" />}
                          {res.type === "pdf" && (
                            <span className="font-bold text-[10px]">PDF</span>
                          )}
                          {res.type === "link" && <LinkSimple className="h-4 w-4" weight="bold" />}
                          {res.type === "document" && <FileText className="h-4 w-4" weight="duotone" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-neutral-900 truncate">
                              {res.title}
                            </span>
                            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 uppercase">
                              {res.type}
                            </span>
                          </div>

                          {res.description && (
                            <p className="mt-0.5 text-xs text-neutral-500 truncate max-w-md">
                              {res.description}
                            </p>
                          )}

                          {res.url && (
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 block max-w-sm truncate text-xs text-indigo-600 hover:underline"
                            >
                              {res.url}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                        {/* Delivery Trigger Selector */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-neutral-500 font-medium">Trigger:</span>
                          <select
                            value={res.deliveryTrigger}
                            disabled={readOnly}
                            onChange={(e) =>
                              handleUpdateWhatsappResourceTrigger(
                                res.id,
                                e.target.value as CourseWhatsappResource["deliveryTrigger"],
                              )
                            }
                            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-800 outline-none focus:border-neutral-900"
                          >
                            <option value="during_call">In-Call (Live Share)</option>
                            <option value="post_call">Post-Call (Summary)</option>
                            <option value="on_enroll">On Enrollment</option>
                            <option value="manual">Manual Dispatch</option>
                          </select>
                        </div>

                        {/* Active Switch */}
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleToggleWhatsappResourceActive(res.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                            res.enabled
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              res.enabled ? "bg-emerald-600" : "bg-neutral-400",
                            )}
                          />
                          {res.enabled ? "Active" : "Paused"}
                        </button>

                        {/* Preview Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenPreviewWhatsapp(res)}
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-2xs"
                        >
                          Preview
                        </button>

                        {/* Delete Button */}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWhatsappResource(res.id)}
                            className="rounded-lg p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            aria-label={`Delete ${res.title}`}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
        )}

        {activeTab === "voice" && (
          <div className="flex flex-col gap-5">
            {/* Phone Line Assignment Card */}
            <SectionCard
              title="Assigned Inbound Phone Line"
              description="Assign a phone number from your organization's carrier pool so practitioners can dial directly from any phone to practice with this course coach."
            >
              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors",
                      phoneNumber
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-200 text-neutral-500",
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    {phoneNumber ? (
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-semibold text-neutral-950">
                            {phoneNumber}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Inbound line active
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          Learners can call this line directly to take this course with the AI coach. Outbound practice campaign calls will also display this caller ID.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          No dedicated phone line assigned
                        </p>
                        <p className="text-xs text-neutral-500">
                          Assign a line from your available numbers pool to activate direct inbound dial-in coaching.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant={phoneNumber ? "outline" : "primary"}
                      size="sm"
                      onClick={async () => {
                        setAssignPhoneModalOpen(true);
                        try {
                          setLoadingNumbers(true);
                          const res = await apiGetNumbers();
                          setWorkspaceNumbers(res.numbers);
                        } catch {
                          toast.error("Failed to load available phone numbers.");
                        } finally {
                          setLoadingNumbers(false);
                        }
                      }}
                      className="min-h-10"
                    >
                      {phoneNumber ? "Change line" : "Assign phone line"}
                    </Button>
                    {phoneNumber && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPhoneNumberId(null);
                          setPhoneNumber(null);
                        }}
                        className="min-h-10 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Coach Voice Selection Card */}
            <SectionCard
              title="Coach voice"
              description="Choose the voice persona your employees will hear when practicing with the AI coach. Audition any voice in the table below to select the right cadence and tone."
            >
              <VoiceSelector
                selectedVoiceId={voice}
                selectedProvider={voiceProvider}
                onSelectVoice={(voiceId, provider) => {
                  setVoice(voiceId);
                  setVoiceProvider(provider);
                }}
                readOnly={readOnly}
              />
            </SectionCard>
          </div>
        )}

        {activeTab === "questions" && (
        <SectionCard
          title="Practice questions"
          description="The questions a coach asks a learner during the practice call. Add your own, or generate a starting set from the Knowledge Base and edit it."
        >
          {faqs.length === 0 && !readOnly ? (
            <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
              No questions yet. Write your own below, or let us draft some from
              the Knowledge Base.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {faqs.map((question, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3"
                >
                  <textarea
                    className={`${inputClasses} min-h-0 bg-white`}
                    value={question}
                    onChange={(e) => updateFaq(index, e.target.value)}
                    placeholder={`Question ${index + 1} — e.g. "What should you do if a customer asks about returns?"`}
                    disabled={readOnly}
                    rows={2}
                  />
                  {!readOnly && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveFaq(index, -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-30"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M10 15V5M5 10l5-5 5 5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFaq(index, 1)}
                        disabled={index === faqs.length - 1}
                        aria-label="Move down"
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-30"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M10 5v10M5 10l5 5 5-5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFaq(index)}
                        aria-label="Remove question"
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addFaq}>
                Add question
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={generating}
                disabled={!canGenerate}
                onClick={() => void runGenerateFaqs()}
                title={
                  canGenerate
                    ? "Draft questions from the Knowledge Base"
                    : "Add Knowledge Base documents first"
                }
              >
                {generating ? "Generating…" : "Generate a starting set"}
              </Button>
              {!canGenerate && (
                <span className="text-xs text-neutral-500">
                  Add Knowledge Base documents to enable generation.
                </span>
              )}
            </div>
          )}
        </SectionCard>
        )}

        {activeTab === "rubric" && (
        <SectionCard
          title="Scoring rubric"
          description="Define how performance in this course is scored. Each criterion is judged, then weighted to form the final score."
        >
          {readOnly ? (
            <RubricList rubric={criteria} />
          ) : (
            <div className="flex flex-col gap-3">
              {criteria.map((criterion, index) => (
                <div
                  key={criterion.id}
                  className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <Field label="Criterion name">
                        <input
                          className={inputClasses}
                          value={criterion.name}
                          onChange={(e) =>
                            updateCriterion(criterion.id, { name: e.target.value })
                          }
                          placeholder="e.g. Clarity of explanation"
                        />
                      </Field>
                      <Field label="Weight">
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            className={cn(inputClasses, "pr-9")}
                            value={criterion.weight}
                            onChange={(e) =>
                              updateCriterion(criterion.id, {
                                weight: Number.parseInt(e.target.value, 10) || 0,
                              })
                            }
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
                            %
                          </span>
                        </div>
                      </Field>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCriterion(criterion.id)}
                      aria-label={`Remove criterion ${criterion.name || index}`}
                      className="mt-0.5 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="M5 5l10 10M15 5L5 15" />
                      </svg>
                    </button>
                  </div>
                  <Field label="Description (optional)">
                    <input
                      className={inputClasses}
                      value={criterion.description ?? ""}
                      onChange={(e) =>
                        updateCriterion(criterion.id, {
                          description: e.target.value,
                        })
                      }
                      placeholder="What does doing well on this criterion look like?"
                    />
                  </Field>
                </div>
              ))}

              {criteria.length === 0 && (
                <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
                  No criteria yet — you can publish without a rubric, or add
                  one to define how practice is scored.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
                  Add criterion
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={generatingRubric}
                  disabled={!canGenerate && title.trim().length === 0}
                  onClick={() => void runGenerateRubric()}
                  title={
                    canGenerate || title.trim().length > 0
                      ? "Draft scoring rubric from the Knowledge Base & course context"
                      : "Add course details or Knowledge Base documents first"
                  }
                >
                  {generatingRubric ? "Generating…" : "Auto-generate with AI"}
                </Button>
                {criteria.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={distributeEvenly}>
                    Distribute evenly
                  </Button>
                )}
                {!canGenerate && title.trim().length === 0 && (
                  <span className="text-xs text-neutral-500">
                    Add course details or Knowledge Base documents to enable generation.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    criteria.length === 0
                      ? "border-neutral-200 bg-neutral-100 text-neutral-600"
                      : totalWeight === 100
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  Total: {totalWeight}%
                </span>
                {criteria.length > 0 && totalWeight !== 100 && (
                  <p className="text-xs text-amber-700">
                    Weights must add up to 100 to submit.
                  </p>
                )}
              </div>
            </div>
          )}
        </SectionCard>
        )}

        {activeTab === "audience" && (
        <SectionCard
          title="Audience"
          description={
            isPublished
              ? "Update who receives practice calls for this live course. Newly added practitioners are dialed when no campaign has started yet."
              : "Pick the practitioners who practise this course. When it's approved, a coach call is scheduled for each selected practitioner."
          }
        >
          <AudiencePicker
            selected={effectiveAudience}
            onChange={isPublished ? setDraftAudience : setAudienceIds}
            disabled={readOnly && !isPublished}
          />

          {isPublished && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  loading={savingAudience}
                  disabled={!audienceDirty}
                  onClick={runSaveAudience}
                >
                  Save audience
                </Button>
                {audienceDirty && (
                  <Button variant="ghost" onClick={discardAudience}>
                    Discard
                  </Button>
                )}
              </div>

              {loaded?.provisioningError && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                  Last call setup failed: {loaded.provisioningError} An architect
                  can retry it from the course review page.
                </p>
              )}
              {loaded?.provisioningStatus === "completed" &&
                !loaded.provisioningError && (
                  <p className="text-xs leading-relaxed text-neutral-500">
                    Calls for this course are live. Newly added practitioners are
                    saved and will be dialed on the next provisioning run.
                  </p>
                )}
              {loaded?.provisioningStatus === "none" && (
                <p className="text-xs leading-relaxed text-neutral-500">
                  No calls have been started for this course yet — they kick off
                  as soon as you save a selection.
                </p>
              )}
            </div>
          )}

          {!readOnly && audienceIds.length === 0 && (
            <p className="text-xs leading-relaxed text-neutral-500">
              You can submit for review without an audience. Calls only start
              once at least one practitioner is selected here.
            </p>
          )}
        </SectionCard>
        )}

        {activeTab === "schedule" && (
          <SectionCard
            title="Practice Schedule"
            description="Configure automated practice calling windows and prior WhatsApp reminders for this course. Scheduled sessions appear directly on the Schedule & Calendar."
          >
            {/* Enable Schedule Toggle Card */}
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <IconBadge icon={CalendarPlus} variant="blue" size="lg" weight="duotone" />
                <div>
                  <h3 className="font-semibold text-neutral-950 text-sm">
                    Automated Practice Calling Schedule
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    When enabled, the Voice AI Coach will initiate practice calls to enrolled practitioners during the specified window.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={enableSchedule}
                  onChange={(e) => setEnableSchedule(e.target.checked)}
                  disabled={readOnly}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-950 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
              </label>
            </div>

            {enableSchedule && (
              <div className="space-y-6 pt-2">
                {/* Cadence Selection */}
                <div className="flex flex-col gap-2">
                  <span className={labelClasses}>Schedule Cadence</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setScheduleType("recurring")}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                        scheduleType === "recurring"
                          ? "border-neutral-900 bg-neutral-900/[0.03] ring-1 ring-neutral-900"
                          : "border-neutral-200 bg-white hover:border-neutral-300",
                      )}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-400 mt-0.5">
                        {scheduleType === "recurring" && (
                          <div className="h-2.5 w-2.5 rounded-full bg-neutral-950" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">Recurring Weekly</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          Runs on selected days every week (e.g. Mon–Fri, or custom days)
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setScheduleType("one_time")}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                        scheduleType === "one_time"
                          ? "border-neutral-900 bg-neutral-900/[0.03] ring-1 ring-neutral-900"
                          : "border-neutral-200 bg-white hover:border-neutral-300",
                      )}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-400 mt-0.5">
                        {scheduleType === "one_time" && (
                          <div className="h-2.5 w-2.5 rounded-full bg-neutral-950" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">One-Time Specific Date</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          Runs only on a single chosen date within the calling hours
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Days of Week (if recurring) */}
                {scheduleType === "recurring" && (
                  <div className="flex flex-col gap-2">
                    <span className={labelClasses}>Repeat on Days</span>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK_OPTIONS.map((day) => {
                        const isSelected = scheduleDaysOfWeek.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              if (isSelected) {
                                if (scheduleDaysOfWeek.length > 1) {
                                  setScheduleDaysOfWeek((prev) => prev.filter((d) => d !== day.id));
                                } else {
                                  toast.error("Please keep at least one day selected.");
                                }
                              } else {
                                setScheduleDaysOfWeek((prev) => [...prev, day.id].sort());
                              }
                            }}
                            className={cn(
                              "flex h-10 w-12 sm:w-14 items-center justify-center rounded-xl border text-xs font-semibold transition-all",
                              isSelected
                                ? "border-neutral-950 bg-neutral-950 text-white shadow-xs"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Date Bounds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={scheduleType === "recurring" ? "Start Date" : "Practice Date"}>
                    <input
                      type="date"
                      className={inputClasses}
                      value={scheduleStartDate}
                      onChange={(e) => setScheduleStartDate(e.target.value)}
                      disabled={readOnly}
                      required
                    />
                  </Field>

                  {scheduleType === "recurring" && (
                    <Field label="End Date (optional)">
                      <input
                        type="date"
                        className={inputClasses}
                        value={scheduleEndDate}
                        onChange={(e) => setScheduleEndDate(e.target.value)}
                        disabled={readOnly}
                        placeholder="Ongoing indefinitely"
                      />
                    </Field>
                  )}
                </div>

                {/* Calling Window & Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Calling Window Start">
                    <input
                      type="time"
                      className={inputClasses}
                      value={scheduleWindowStart}
                      onChange={(e) => setScheduleWindowStart(e.target.value)}
                      disabled={readOnly}
                      required
                    />
                  </Field>

                  <Field label="Calling Window End">
                    <input
                      type="time"
                      className={inputClasses}
                      value={scheduleWindowEnd}
                      onChange={(e) => setScheduleWindowEnd(e.target.value)}
                      disabled={readOnly}
                      required
                    />
                  </Field>

                  <Field label="Timezone">
                    <select
                      className={inputClasses}
                      value={scheduleTimezone}
                      onChange={(e) => setScheduleTimezone(e.target.value)}
                      disabled={readOnly}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* WhatsApp Notification Configuration */}
                <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <IconBadge icon={WhatsappLogo} variant="emerald" size="sm" weight="fill" />
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-950">
                          Advance WhatsApp Notification
                        </h4>
                        <p className="text-xs text-emerald-800/80">
                          Alert practitioners on WhatsApp ahead of the practice call window so they are prepared.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={scheduleNotifyWhatsapp}
                        onChange={(e) => setScheduleNotifyWhatsapp(e.target.checked)}
                        disabled={readOnly}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-neutral-300 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                    </label>
                  </div>

                  {scheduleNotifyWhatsapp && (
                    <div className="space-y-3 pt-2 border-t border-emerald-200/60">
                      {whatsappChannels.length > 0 && (
                        <Field label="Send Reminder From (WhatsApp Line)">
                          <select
                            className={inputClasses}
                            value={whatsappChannelId || ""}
                            onChange={(e) => setWhatsappChannelId(e.target.value || null)}
                            disabled={readOnly}
                          >
                            <option value="">
                              {defaultWhatsappChannelId
                                ? `Default: ${formatChannelLabel(whatsappChannels.find((c) => c.id === defaultWhatsappChannelId) || { id: defaultWhatsappChannelId, name: "Default Sender", phone: "", status: "active" })}`
                                : "Use Organization Default Line"}
                            </option>
                            {whatsappChannels.map((c) => (
                              <option key={c.id} value={c.id}>
                                {formatChannelLabel(c)} {c.id === defaultWhatsappChannelId ? "⭐ (Default)" : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}

                      <Field label="Send Reminder In Advance">
                        <select
                          className={inputClasses}
                          value={scheduleNotifyMinutes}
                          onChange={(e) => setScheduleNotifyMinutes(Number(e.target.value))}
                          disabled={readOnly}
                        >
                          {ADVANCE_NOTICE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Custom WhatsApp Message Note (optional)">
                        <input
                          type="text"
                          className={inputClasses}
                          value={scheduleCustomMessage}
                          onChange={(e) => setScheduleCustomMessage(e.target.value)}
                          placeholder="e.g. Please find a quiet place for your 2-minute practice call."
                          disabled={readOnly}
                        />
                      </Field>
                    </div>
                  )}
                </div>

                {/* Live Preview Summary */}
                <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-neutral-900">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    Calendar Sync Preview
                  </div>
                  <p className="text-neutral-600">
                    {scheduleType === "recurring" ? (
                      <>
                        Runs every{" "}
                        <strong className="text-neutral-900 font-semibold">
                          {scheduleDaysOfWeek
                            .map((d) => DAYS_OF_WEEK_OPTIONS.find((x) => x.id === d)?.label)
                            .join(", ")}
                        </strong>{" "}
                        between{" "}
                        <strong className="text-neutral-900 font-semibold">
                          {scheduleWindowStart} – {scheduleWindowEnd}
                        </strong>{" "}
                        ({scheduleTimezone}).
                      </>
                    ) : (
                      <>
                        Runs on{" "}
                        <strong className="text-neutral-900 font-semibold">
                          {scheduleStartDate}
                        </strong>{" "}
                        between{" "}
                        <strong className="text-neutral-900 font-semibold">
                          {scheduleWindowStart} – {scheduleWindowEnd}
                        </strong>{" "}
                        ({scheduleTimezone}).
                      </>
                    )}
                    {scheduleNotifyWhatsapp && (
                      <>
                        {" "}WhatsApp reminder is sent{" "}
                        <strong className="text-emerald-800 font-semibold">
                          {scheduleNotifyMinutes} minutes
                        </strong>{" "}
                        prior.
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Once saved or submitted, this practice session is automatically registered on the{" "}
                    <a
                      href="/schedule"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-900 font-semibold underline underline-offset-2"
                    >
                      Schedule Calendar
                    </a>{" "}
                    where you can view, trigger immediately, or reschedule at any time.
                  </p>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={goBack}>
                Cancel
              </Button>
              {courseId && (
                <Button 
                  variant="ghost" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50" 
                  onClick={() => { setDeleteConfirmOpen(true); setDeleteInput(""); }}
                >
                  Delete course
                </Button>
              )}
              {tabIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setActiveTab(EDITOR_TABS[tabIndex - 1])}
                >
                  Back
                </Button>
              )}
            </div>
            {isLastTab ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" loading={saving} onClick={runSave}><FloppyDisk className="h-4 w-4 mr-1.5 shrink-0" weight="duotone" />Save draft</Button>
                <Button loading={submitting} onClick={runSubmit}><PaperPlaneTilt className="h-4 w-4 mr-1.5 shrink-0" weight="duotone" />Save & submit for review</Button>
              </div>
            ) : (
              <Button onClick={() => handleTabChange(EDITOR_TABS[tabIndex + 1])}>Next <CaretRight className="h-4 w-4 ml-1.5 shrink-0" weight="bold" /></Button>
            )}
          </div>
        )}

        {readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={goBack}><ArrowLeft className="h-4 w-4 mr-1.5 shrink-0" weight="bold" />Back to courses</Button>
              {courseId && (
                <Button 
                  variant="ghost" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50" 
                  onClick={() => { setDeleteConfirmOpen(true); setDeleteInput(""); }}
                >
                  Delete course
                </Button>
              )}
            </div>
          </div>
        )}
      </motion.form>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        title="Delete Course"
        description="This action cannot be undone. This will permanently delete the course from the platform and Voice AI systems."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">
              Please type <strong>{title || "Untitled course"}</strong> to confirm.
            </label>
            <input
              type="text"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={title || "Untitled course"}
              disabled={deleting}
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
              onClick={runDelete}
              loading={deleting}
              disabled={deleteInput !== (title || "Untitled course")}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Text Note Modal ── */}
      <Modal
        open={addTextModalOpen}
        onClose={() => !submittingTextDoc && setAddTextModalOpen(false)}
        title="Add text note"
        description="Write or paste policy text, guides, or reference information to embed directly into the course Knowledge Base."
      >
        <form onSubmit={handleAddTextDoc} className="flex flex-col gap-4">
          <Field label="Document Title">
            <input
              type="text"
              className={inputClasses}
              value={textDocTitle}
              onChange={(e) => setTextDocTitle(e.target.value)}
              placeholder="e.g. Return Policy Guide"
              required
              disabled={submittingTextDoc}
            />
          </Field>
          <Field label="Content">
            <textarea
              className={`${textareaClasses} min-h-36`}
              value={textDocContent}
              onChange={(e) => setTextDocContent(e.target.value)}
              placeholder="Paste notes, detailed explanations, or bullet points..."
              required
              rows={5}
              disabled={submittingTextDoc}
            />
          </Field>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddTextModalOpen(false)}
              disabled={submittingTextDoc}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submittingTextDoc}>
              Add to Knowledge Base
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Import Webpage Modal ── */}
      <Modal
        open={addUrlModalOpen}
        onClose={() => !submittingUrl && setAddUrlModalOpen(false)}
        title="Import webpage"
        description="Ingest public documentation or article URLs. The content will be extracted and embedded into the course knowledge base."
      >
        <form onSubmit={handleAddUrlDoc} className="flex flex-col gap-4">
          <Field label="Webpage URL">
            <input
              type="url"
              className={inputClasses}
              value={urlAddress}
              onChange={(e) => setUrlAddress(e.target.value)}
              placeholder="https://example.com/docs/user-guide"
              required
              disabled={submittingUrl}
            />
          </Field>
          <Field label="Document Title (optional)">
            <input
              type="text"
              className={inputClasses}
              value={urlTitle}
              onChange={(e) => setUrlTitle(e.target.value)}
              placeholder="e.g. Online User Guide"
              disabled={submittingUrl}
            />
          </Field>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddUrlModalOpen(false)}
              disabled={submittingUrl}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submittingUrl}>
              Ingest Webpage
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Assign Phone Line Modal ── */}
      <Modal
        open={assignPhoneModalOpen}
        onClose={() => setAssignPhoneModalOpen(false)}
        title="Select Inbound Phone Line"
        description="Choose a phone line from your organization's carrier pool to assign to this course coach."
      >
        <div className="flex flex-col gap-4">
          {pendingReassignNumber ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-800">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-amber-950 text-sm">
                    Reassign {pendingReassignNumber.e164}?
                  </h4>
                  <p className="mt-1 leading-relaxed text-amber-900">
                    {pendingReassignNumber.assignedCourse ? (
                      <>
                        This number is currently bound to course{" "}
                        <strong className="font-semibold text-amber-950">
                          {pendingReassignNumber.assignedCourse.title}
                        </strong>
                        . Inbound calls to that course will cease once this course is published with this number.
                      </>
                    ) : (
                      <>
                        This number is currently bound in Telenow to an external agent{pendingReassignNumber.agentName ? ` "${pendingReassignNumber.agentName}"` : ""}. Reassigning will detach that agent from inbound calls and attach this course coach.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 border-t border-amber-200/60 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingReassignNumber(null)}
                >
                  Back to list
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setPhoneNumberId(pendingReassignNumber.id);
                    setPhoneNumber(pendingReassignNumber.e164);
                    setPendingReassignNumber(null);
                    setAssignPhoneModalOpen(false);
                    toast.info(`Selected ${pendingReassignNumber.e164}. Remember to save the course.`);
                  }}
                  className="bg-amber-900 text-white hover:bg-amber-950"
                >
                  Confirm Reassign
                </Button>
              </div>
            </div>
          ) : loadingNumbers ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" className="text-neutral-500" />
            </div>
          ) : workspaceNumbers.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              No numbers found in your carrier account. Connect or purchase a phone number in Integrations first.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {workspaceNumbers.map((num) => {
                const isSelected = phoneNumberId === num.id;
                const isThisCourse = Boolean(
                  num.assignedCourse && num.assignedCourse.id === courseId,
                );
                const isOtherCourse = Boolean(
                  num.assignedCourse && num.assignedCourse.id !== courseId,
                );
                const isExternalAgent = Boolean(
                  !num.assignedCourse && num.agentId,
                );
                const isMemberLocked = Boolean(num.allocatedToMemberId);
                const isAvailable =
                  !num.assignedCourse && !num.agentId && !num.allocatedToMemberId;

                return (
                  <div
                    key={num.id}
                    className={cn(
                      "flex flex-col gap-2 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between",
                      isSelected
                        ? "bg-neutral-900/[0.04]"
                        : isMemberLocked
                          ? "bg-neutral-50/60 opacity-75"
                          : "hover:bg-neutral-50",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
                          isSelected
                            ? "bg-neutral-900 text-white"
                            : isMemberLocked
                              ? "bg-rose-100 text-rose-700"
                              : isOtherCourse || isExternalAgent
                                ? "bg-amber-100 text-amber-700"
                                : "bg-neutral-100 text-neutral-600",
                        )}
                      >
                        <PhoneCall className="h-4 w-4" weight="duotone" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-semibold text-neutral-900">
                            {num.e164}
                          </span>
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 uppercase">
                            {num.country} · {num.numberType}
                          </span>
                          {isThisCourse && (
                            <span className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-800">
                              Current line
                            </span>
                          )}
                          {isOtherCourse && (
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              In use: {num.assignedCourse?.title}
                            </span>
                          )}
                          {isExternalAgent && (
                            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                              {num.agentName ? `Telenow Agent: ${num.agentName}` : "External Agent"}
                            </span>
                          )}
                          {isMemberLocked && (
                            <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                              Locked to Member
                            </span>
                          )}
                          {isAvailable && (
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Available
                            </span>
                          )}
                        </div>

                        {isMemberLocked ? (
                          <p className="mt-0.5 text-[11px] text-rose-600">
                            Held by a team member for inbound calls in Telenow. Inbound exclusivity prevents AI agent assignment.
                          </p>
                        ) : isOtherCourse ? (
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            Reassigning will detach this line from "{num.assignedCourse?.title}" and point calls to this course.
                          </p>
                        ) : isExternalAgent ? (
                          <p className="mt-0.5 text-[11px] text-indigo-700">
                            {num.agentName
                              ? `Currently assigned to external agent "${num.agentName}". Selecting will reassign carrier routing.`
                              : "Currently assigned to an external agent in Telenow. Selecting will reassign carrier routing."}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-neutral-500 capitalize">
                            Carrier: {num.provider} · Free to assign
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end pt-1 sm:pt-0">
                      {isMemberLocked ? (
                        <span className="rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-400 cursor-not-allowed">
                          Unavailable
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            isSelected
                              ? "primary"
                              : isOtherCourse || isExternalAgent
                                ? "outline"
                                : "secondary"
                          }
                          onClick={() => {
                            if (isOtherCourse || isExternalAgent) {
                              setPendingReassignNumber(num);
                            } else {
                              setPhoneNumberId(num.id);
                              setPhoneNumber(num.e164);
                              setAssignPhoneModalOpen(false);
                            }
                          }}
                          className={cn(
                            "h-8 px-3 text-xs font-semibold",
                            (isOtherCourse || isExternalAgent) &&
                              !isSelected &&
                              "border-amber-300 text-amber-900 hover:bg-amber-50",
                          )}
                        >
                          {isSelected
                            ? "Selected"
                            : isOtherCourse || isExternalAgent
                              ? "Reassign"
                              : "Select"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAssignPhoneModalOpen(false);
                setPendingReassignNumber(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Video Resource Modal ── */}
      <Modal
        open={addVideoModalOpen}
        onClose={() => setAddVideoModalOpen(false)}
        title="Add WhatsApp Video Resource"
        description="Configure a video walkthrough (YouTube, Loom, Vimeo) that the AI Voice Coach or platform can send directly to learners over WhatsApp."
      >
        <form onSubmit={handleAddVideoResource} className="flex flex-col gap-4">
          <Field label="Video URL">
            <input
              type="url"
              className={inputClasses}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://loom.com/share/..."
              required
            />
          </Field>
          <Field label="Resource Title">
            <input
              type="text"
              className={inputClasses}
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. Product Demo Walkthrough (3 mins)"
              required
            />
          </Field>
          <Field label="Description (optional)">
            <textarea
              className={`${textareaClasses} min-h-20`}
              value={videoDesc}
              onChange={(e) => setVideoDesc(e.target.value)}
              placeholder="What this video covers and why it helps..."
              rows={2}
            />
          </Field>
          <Field label="Delivery Trigger">
            <select
              value={videoTrigger}
              onChange={(e) =>
                setVideoTrigger(
                  e.target.value as CourseWhatsappResource["deliveryTrigger"],
                )
              }
              className={inputClasses}
            >
              <option value="during_call">
                In-Call Live Share (Coach prompts or learner asks during practice)
              </option>
              <option value="post_call">
                Post-Call Summary (Automated dispatch after call analysis)
              </option>
              <option value="on_enroll">
                On Enrollment (Immediate dispatch upon course assignment)
              </option>
              <option value="manual">Manual Dispatch (On-demand by manager/coach)</option>
            </select>
          </Field>
          <Field label="Custom WhatsApp Message Note (optional)">
            <input
              type="text"
              className={inputClasses}
              value={videoCaption}
              onChange={(e) => setVideoCaption(e.target.value)}
              placeholder="e.g. Watch this quick 3-minute video to master the pitch!"
            />
          </Field>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddVideoModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white">
              Add Video Resource
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Add Web Link Resource Modal ── */}
      <Modal
        open={addLinkModalOpen}
        onClose={() => setAddLinkModalOpen(false)}
        title="Add WhatsApp Web Resource"
        description="Add a reference link, cheat sheet, portal URL, or interactive guide to share with learners over WhatsApp."
      >
        <form onSubmit={handleAddLinkResource} className="flex flex-col gap-4">
          <Field label="Webpage or Document URL">
            <input
              type="url"
              className={inputClasses}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/pricing-cheat-sheet or https://docs.google.com/..."
              required
            />
          </Field>
          <Field label="Resource Title">
            <input
              type="text"
              className={inputClasses}
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="e.g. Pricing & Objection Cheat Sheet"
              required
            />
          </Field>
          <Field label="Description (optional)">
            <textarea
              className={`${textareaClasses} min-h-20`}
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="Summary of this reference guide..."
              rows={2}
            />
          </Field>
          <Field label="Delivery Trigger">
            <select
              value={linkTrigger}
              onChange={(e) =>
                setLinkTrigger(
                  e.target.value as CourseWhatsappResource["deliveryTrigger"],
                )
              }
              className={inputClasses}
            >
              <option value="during_call">
                In-Call Live Share (Coach prompts or learner asks during practice)
              </option>
              <option value="post_call">
                Post-Call Summary (Automated dispatch after call analysis)
              </option>
              <option value="on_enroll">
                On Enrollment (Immediate dispatch upon course assignment)
              </option>
              <option value="manual">Manual Dispatch (On-demand by manager/coach)</option>
            </select>
          </Field>
          <Field label="Custom WhatsApp Message Note (optional)">
            <input
              type="text"
              className={inputClasses}
              value={linkCaption}
              onChange={(e) => setLinkCaption(e.target.value)}
              placeholder="e.g. Keep this reference handy for handling pricing queries."
            />
          </Field>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddLinkModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white">
              Add Web Resource
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── WhatsApp Phone Simulator Preview Modal ── */}
      <Modal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="WhatsApp Message Preview"
        description="Live preview of how this learning resource appears on the learner's WhatsApp device."
      >
        <div className="flex flex-col gap-4">
          {/* Simulated WhatsApp Phone Screen */}
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-neutral-300 bg-[#EFEAE2] shadow-lg">
            {/* WhatsApp Header Bar */}
            <div className="flex items-center justify-between bg-[#075E54] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xs">
                  <WhatsAppIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-none truncate">
                    Agility Voice AI Coach
                  </p>
                  <p className="mt-0.5 text-[10px] text-emerald-100 font-medium">
                    online · official training bot
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-emerald-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
            </div>

            {/* WhatsApp Chat Canvas */}
            <div className="p-4 min-h-60 flex flex-col justify-end">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="md" className="text-emerald-700" />
                </div>
              ) : (
                <div className="relative max-w-[90%] self-start rounded-2xl rounded-tl-xs bg-white p-3.5 shadow-sm">
                  {/* Delivery Trigger Badge */}
                  {previewResource && (
                    <div className="mb-2 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 uppercase tracking-wider">
                      Trigger: {previewResource.deliveryTrigger.replace("_", " ")}
                    </div>
                  )}

                  {/* WhatsApp Formatted Message Body */}
                  <div className="text-xs leading-relaxed text-neutral-900 whitespace-pre-wrap font-sans">
                    {previewText || "Loading message preview..."}
                  </div>

                  {/* Resource Card Mockup */}
                  {previewResource?.url && (
                    <div className="mt-2.5 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {previewResource.type.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-neutral-950">
                            {previewResource.title}
                          </p>
                          <p className="truncate text-[10px] text-neutral-500 font-mono">
                            {previewResource.url}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message Timestamp and Blue Ticks */}
                  <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-neutral-400">
                    <span>Just now</span>
                    <span className="text-[#53bdeb] font-bold" title="Read by recipient">
                      ✓✓
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewModalOpen(false)}
            >
              Close Preview
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}