import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { toast } from "sonner";

import type { Course, CourseDocument, CourseInput, RubricCriterion } from "../api/courses";
import {
  apiCreateCourse,
  apiDeleteCourseDocument,
  apiGenerateFaqs,
  apiGenerateFaqsDraft,
  apiGetCourse,
  apiSubmitCourse,
  apiUpdateCourse,
  apiUploadCourseDocument,
} from "../api/courses";
import { Button, Spinner, Tabs } from "../components";
import { RubricList } from "../features/courses/RubricList";
import { StatusBadge } from "../features/courses/StatusBadge";
import { cn } from "../lib/cn";
import { pageVariants, fadeUp } from "../lib/animation";

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

const EDITOR_TABS = ["basics", "material", "questions", "rubric"];

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
  const [activeTab, setActiveTab] = useState("basics");
  const tabIndex = EDITOR_TABS.indexOf(activeTab);
  const isLastTab = tabIndex === EDITOR_TABS.length - 1;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [knowledgeText, setKnowledgeText] = useState("");
  const [faqs, setFaqs] = useState<string[]>([]);
  const [documents, setDocuments] = useState<CourseDocument[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [criteria, setCriteria] = useState<EditableCriterion[]>([]);
  const [maxDurationSec, setMaxDurationSec] = useState("120");
  const [isMandatory, setIsMandatory] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setCriteria(
          course.scoringRubric.map((entry) => ({ ...entry, id: nextRubricId() })),
        );
        setMaxDurationSec(String(course.maxDurationSec));
        setIsMandatory(course.isMandatory);
        setExpiresAt(course.expiresAt ? course.expiresAt.slice(0, 16) : "");
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't load this course.");
        void router.navigate({ to: "/courses" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isNew, courseId, router]);

  const readOnly = useMemo(
    () =>
      !!loaded &&
      !isNew &&
      (loaded.status === "published" || loaded.status === "pending_review"),
    [loaded, isNew],
  );

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  const hasKnowledge =
    knowledgeText.trim().length > 0 || documents.length > 0 || pendingFiles.length > 0;

  const canGenerate = isNew
    ? knowledgeText.trim().length > 0 || pendingFiles.some(isTextDoc)
    : hasKnowledge;

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
        for (const file of pendingFiles) {
          if (!isTextDoc(file)) continue;
          try {
            const text = await file.text();
            if (text.trim()) docsTexts.push(text);
          } catch {
            // unreadable file — skip its text for the draft
          }
        }
        if (knowledgeText.trim().length === 0 && docsTexts.length === 0) {
          toast.info(
            "Add some knowledge first — paste notes or attach documents so questions can be generated.",
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
            "Add some knowledge first so questions can be generated.",
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

  const pickFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 20);
    if (isNew || !courseId) {
      setPendingFiles((prev) => [...prev, ...list]);
      return;
    }
    void uploadFiles(courseId, list);
  };

  const uploadFiles = async (targetCourseId: string, list: File[]) => {
    setUploading(true);
    try {
      const created: CourseDocument[] = [];
      for (const file of list) {
        const doc = await apiUploadCourseDocument(targetCourseId, file);
        created.push(doc);
      }
      setDocuments((prev) => [...prev, ...created]);
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't upload the file.",
      );
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (doc: CourseDocument) => {
    if (!courseId) return;
    try {
      await apiDeleteCourseDocument(courseId, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ?? "Couldn't remove the file.",
      );
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

    const input: CourseInput = {
      title: title.trim(),
      description: description.trim(),
      knowledgeText: knowledgeText.trim(),
      faqs: cleanFaqs(),
      scoringRubric: cleaned,
      maxDurationSec: Number.parseInt(maxDurationSec, 10) || 120,
      isMandatory,
    };
    if (expiresAt.trim()) input.expiresAt = new Date(expiresAt).toISOString();
    else input.expiresAt = null;
    return { ok: true, input };
  };

  const goBack = () => void router.navigate({ to: "/courses" });

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
        if (pendingFiles.length > 0) {
          await uploadFiles(created.id, pendingFiles);
          setPendingFiles([]);
        }
        toast.success("Course created.");
      } else if (courseId) {
        await apiUpdateCourse(courseId, built.input);
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
        if (pendingFiles.length > 0) {
          await uploadFiles(created.id, pendingFiles);
          setPendingFiles([]);
        }
        await apiSubmitCourse(created.id);
      } else if (courseId) {
        if (
          loaded &&
          (loaded.status === "draft" || loaded.status === "rejected")
        ) {
          await apiUpdateCourse(courseId, built.input);
        }
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-neutral-50">
        <Spinner size="md" className="text-neutral-700" />
      </div>
    );
  }

  const startUpload = () => fileInputRef.current?.click();

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
        className="flex w-full max-w-3xl items-start justify-between gap-4"
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
          className="w-full max-w-3xl rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm"
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
          className="w-full max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700"
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
        className="flex w-full max-w-3xl flex-col gap-4"
      >
        <Tabs
          items={[
            { id: "basics", label: "Basics" },
            {
              id: "material",
              label: "Course material",
              count: documents.length + pendingFiles.length,
            },
            { id: "questions", label: "Practice questions", count: faqs.length },
            { id: "rubric", label: "Scoring rubric" },
          ]}
          active={activeTab}
          onChange={setActiveTab}
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
        </SectionCard>
        )}

        {activeTab === "material" && (
        <SectionCard
          title="Course material"
          description="Share what the course is based on — paste notes or upload documents. This material is what the coach draws from during practice."
        >
          <Field label="Paste notes or reference content">
            <textarea
              className={`${textareaClasses} min-h-40`}
              value={knowledgeText}
              onChange={(e) => setKnowledgeText(e.target.value)}
              placeholder="Paste product details, process write-ups, policies — anything that defines what learners should know."
              disabled={readOnly}
              rows={6}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span className={labelClasses}>Uploaded documents</span>
            {documents.length === 0 && pendingFiles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
                No documents yet. Upload PDFs, Word docs, or text files (up to 10 MB each).
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {doc.originalName}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatBytes(doc.sizeBytes)}
                      </p>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => void removeDocument(doc)}
                        aria-label={`Remove ${doc.originalName}`}
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
                    )}
                  </li>
                ))}
                {pendingFiles.map((file, i) => (
                  <li
                    key={`pending-${file.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-neutral-400">
                        Will upload when you save
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingFiles((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
                      }
                      aria-label={`Remove ${file.name}`}
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
            {!readOnly && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.csv,.json,.pdf,.docx,.markdown"
                  className="hidden"
                  onChange={(e) => pickFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={uploading}
                  disabled={generating}
                  onClick={startUpload}
                >
                  {uploading ? "Uploading…" : "Upload documents"}
                </Button>
              </div>
            )}
          </div>
        </SectionCard>
        )}

        {activeTab === "questions" && (
        <SectionCard
          title="Practice questions"
          description="The questions a coach asks a learner during the practice call. Add your own, or generate a starting set from the course material above and edit it."
        >
          {faqs.length === 0 && !readOnly ? (
            <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
              No questions yet. Write your own below, or let us draft some from
              the course material.
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
                    ? "Draft questions from the course material"
                    : "Add course material first"
                }
              >
                {generating ? "Generating…" : "Generate a starting set"}
              </Button>
              {!canGenerate && (
                <span className="text-xs text-neutral-500">
                  Add course material to enable generation.
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
                <Button variant="outline" size="sm" onClick={addCriterion}>
                  Add criterion
                </Button>
                {criteria.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={distributeEvenly}>
                    Distribute evenly
                  </Button>
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

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={goBack}>
                Cancel
              </Button>
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
                <Button variant="outline" loading={saving} onClick={runSave}>
                  Save draft
                </Button>
                <Button loading={submitting} onClick={runSubmit}>
                  Save & submit for review
                </Button>
              </div>
            ) : (
              <Button onClick={() => setActiveTab(EDITOR_TABS[tabIndex + 1])}>
                Next
              </Button>
            )}
          </div>
        )}

        {readOnly && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={goBack}>
              Back to courses
            </Button>
          </div>
        )}
      </motion.form>
    </motion.div>
  );
}