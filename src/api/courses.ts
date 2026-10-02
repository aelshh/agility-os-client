/**
 * Courses API layer.
 * The platform exposes course content as "drills" on the server; the client
 * speaks the user-facing "course" vocabulary.
 */

import type { AuthErrorPayload } from "../features/auth/auth-context";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CourseStatus = "draft" | "pending_review" | "published" | "rejected";

export type ProvisioningStatus = "none" | "provisioning" | "completed" | "failed";

export type RubricCriterion = {
  name: string;
  weight: number;
  description?: string;
};

export type CourseDeliverySummary = {
  selected: number;
  called: number;
  completed: number;
  scored: number;
  avgScore: number | null;
};

export type CourseDocument = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type TelenowKbDocument = {
  id: string;
  kbId?: string;
  title: string;
  sourceType: "inline" | "upload" | "url" | "file" | "text";
  sourceUri: string | null;
  fileSize?: number | null;
  chunkCount?: number | null;
  body?: string;
  status: "pending" | "embedded" | "failed";
  error?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type TelenowKnowledgeBase = {
  id: string;
  name?: string;
  title?: string;
  description?: string | null;
  embeddingModel?: string;
  documentCount?: number;
  createdAt?: string;
};

export type VoiceOption = {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  gender: "female" | "male" | "neutral";
  accent?: string;
  language?: string;
  description?: string;
  previewUrl?: string;
};

export type CourseWhatsappResource = {
  id: string;
  title: string;
  type: "video" | "pdf" | "link" | "document" | "text";
  url?: string;
  documentId?: string;
  s3Key?: string;
  fileName?: string;
  fileSize?: number;
  description?: string;
  caption?: string;
  deliveryTrigger: "during_call" | "post_call" | "on_enroll" | "manual";
  enabled: boolean;
  createdAt?: string;
};

export type Course = {
  id: string;
  orgId: string;
  title: string;
  description: string;
  knowledgeText: string;
  docs: CourseDocument[];
  faqs: string[];
  personaName: string | null;
  personaPrompt: string | null;
  personaGeneratedAt: string | null;
  scoringRubric: RubricCriterion[];
  maxDurationSec: number;
  callWindowStart: string | null;
  callWindowEnd: string | null;
  isMandatory: boolean;
  regionScope: string[];
  roleScope: string[];
  expiresAt: string | null;
  status: CourseStatus;
  voice: string;
  voiceProvider: string;
  telenowKbId: string | null;
  telenowAgentId: string | null;
  telenowCampaignId: string | null;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  provisioningStatus: ProvisioningStatus;
  provisioningError: string | null;
  whatsappResources: CourseWhatsappResource[];
  audienceIds: string[];
  delivery: CourseDeliverySummary;
  createdBy: string;
  createdByName: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseInput = {
  title: string;
  description: string;
  knowledgeText?: string;
  faqs?: string[];
  scoringRubric: RubricCriterion[];
  maxDurationSec: number;
  callWindowStart?: string | null;
  callWindowEnd?: string | null;
  isMandatory: boolean;
  regionScope?: string[];
  roleScope?: string[];
  expiresAt?: string | null;
  audienceIds?: string[];
  voice?: string;
  voiceProvider?: string;
  telenowKbId?: string | null;
  phoneNumberId?: string | null;
  phoneNumber?: string | null;
  whatsappResources?: CourseWhatsappResource[];
};

export type CourseEnrollmentStatus =
  | "pending"
  | "queued"
  | "calling"
  | "answered"
  | "no_answer"
  | "completed"
  | "failed"
  | "skipped";

export type TalkRatio = {
  agentWords: number;
  customerWords: number;
  agentTurns: number;
  customerTurns: number;
};

export type QACriterionResult = {
  key: string;
  met: boolean;
  evidence: string;
};

export type CoachingTip = {
  issue: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
};

export type TranscriptTurn = {
  role: "agent" | "customer" | "user" | "assistant" | string;
  text: string;
  at?: string;
};

export type LatencyMetrics = {
  avgResponseMs?: number;
  sttMs?: number;
  llmMs?: number;
  ttsMs?: number;
};

export type CourseEnrollment = {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  userRegion?: string | null;
  status: CourseEnrollmentStatus;
  score: number | null;
  durationSecs?: number | null;
  calledAt: string | null;
  completedAt: string | null;
  recordingUrl: string | null;
  transcriptUrl?: string | null;
  transcript?: TranscriptTurn[] | null;
  summary?: string | null;
  sentiment?: string | null;
  sentimentScore?: number | null;
  talkRatio?: TalkRatio | null;
  qaScorecard?: QACriterionResult[] | null;
  coachingTips?: CoachingTip[] | null;
  actionItems?: string[] | null;
  objections?: string[] | null;
  topics?: string[] | null;
  latencyMetrics?: LatencyMetrics | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}));
}

function jsonRequest(
  url: string,
  method: string,
  body: unknown,
): Promise<Response> {
  return apiFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function unwrap<T>(res: Response): Promise<T> {
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as T;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function apiListCourses(
  status?: CourseStatus,
): Promise<Course[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await unwrap<{ courses: Course[] }>(
    await apiFetch(`/api/drills${query}`),
  );
  return data.courses;
}

export async function apiGetCourse(id: string): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await apiFetch(`/api/drills/${encodeURIComponent(id)}`),
  );
  return data.course;
}

export async function apiCreateCourse(input: CourseInput): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await jsonRequest("/api/drills", "POST", input),
  );
  return data.course;
}

export async function apiUpdateCourse(
  id: string,
  input: Partial<CourseInput>,
): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await jsonRequest(`/api/drills/${encodeURIComponent(id)}`, "PUT", input),
  );
  return data.course;
}

export async function apiDeleteCourse(id: string): Promise<void> {
  const res = await apiFetch(`/api/drills/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw data;
  }
}

export async function apiSubmitCourse(id: string): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(id)}/submit`,
      "POST",
      {},
    ),
  );
  return data.course;
}

export async function apiApproveCourse(id: string): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(id)}/approve`,
      "POST",
      {},
    ),
  );
  return data.course;
}

export async function apiRejectCourse(
  id: string,
  comment: string,
): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(id)}/reject`,
      "POST",
      { comment },
    ),
  );
  return data.course;
}

export async function apiGetCourseEnrollments(
  id: string,
): Promise<CourseEnrollment[]> {
  const data = await unwrap<{ enrollments: CourseEnrollment[] }>(
    await apiFetch(`/api/drills/${encodeURIComponent(id)}/enrollments`),
  );
  return data.enrollments;
}

export async function apiProvisionCourse(id: string): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(id)}/provision`,
      "POST",
      {},
    ),
  );
  return data.course;
}

export type UpdateAudienceResult = {
  course: Course;
  added: number;
  provisioned: boolean | null;
};

export async function apiUpdateCourseAudience(
  id: string,
  audienceIds: string[],
): Promise<UpdateAudienceResult> {
  return unwrap<UpdateAudienceResult>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(id)}/audience`,
      "PUT",
      { audienceIds },
    ),
  );
}

// ---------------------------------------------------------------------------
// Knowledge-dump documents
// ---------------------------------------------------------------------------

export async function apiUploadCourseDocument(
  courseId: string,
  file: File,
): Promise<CourseDocument> {
  const form = new FormData();
  form.append("file", file);
  const data = await unwrap<{ document: CourseDocument }>(
    await apiFetch(`/api/drills/${encodeURIComponent(courseId)}/documents`, {
      method: "POST",
      body: form,
    }),
  );
  return data.document;
}

export async function apiDeleteCourseDocument(
  courseId: string,
  documentId: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/drills/${encodeURIComponent(courseId)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw (await parseJson(res)) as AuthErrorPayload;
}

export async function apiGenerateFaqs(
  courseId: string,
): Promise<{ faqs: string[]; message?: string }> {
  const res = await jsonRequest(
    `/api/drills/${encodeURIComponent(courseId)}/generate-faqs`,
    "POST",
    {},
  );
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as { faqs: string[]; message?: string };
}

export async function apiGenerateFaqsDraft(draft: {
  title: string;
  description: string;
  knowledgeText: string;
  docsTexts: string[];
}): Promise<{ faqs: string[]; message?: string }> {
  const res = await jsonRequest("/api/ai/generate-faqs", "POST", draft);
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as { faqs: string[]; message?: string };
}

export async function apiGenerateRubric(
  courseId: string,
): Promise<{ rubric: RubricCriterion[]; message?: string }> {
  const res = await jsonRequest(
    `/api/drills/${encodeURIComponent(courseId)}/generate-rubric`,
    "POST",
    {},
  );
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as { rubric: RubricCriterion[]; message?: string };
}

export async function apiGenerateRubricDraft(draft: {
  title: string;
  description: string;
  knowledgeText: string;
  docsTexts: string[];
  faqs?: string[];
}): Promise<{ rubric: RubricCriterion[]; message?: string }> {
  const res = await jsonRequest("/api/ai/generate-rubric", "POST", draft);
  const data = await parseJson(res);
  if (!res.ok) throw data as AuthErrorPayload;
  return data as { rubric: RubricCriterion[]; message?: string };
}

// ---------------------------------------------------------------------------
// Telenow Knowledge Base API
// ---------------------------------------------------------------------------

export async function apiListOrgKnowledgeBases(): Promise<{
  knowledgeBases: TelenowKnowledgeBase[];
  total: number;
}> {
  return unwrap<{ knowledgeBases: TelenowKnowledgeBase[]; total: number }>(
    await apiFetch("/api/drills/knowledge-bases"),
  );
}

export async function apiCreateOrgKnowledgeBase(
  nameOrPayload: string | { title?: string; name?: string; description?: string },
  description?: string,
): Promise<{ knowledgeBase: TelenowKnowledgeBase }> {
  const payload =
    typeof nameOrPayload === "string"
      ? { title: nameOrPayload, name: nameOrPayload, description }
      : {
          title: nameOrPayload.title ?? nameOrPayload.name,
          name: nameOrPayload.name ?? nameOrPayload.title,
          description: nameOrPayload.description,
        };
  return unwrap<{ knowledgeBase: TelenowKnowledgeBase }>(
    await jsonRequest("/api/drills/knowledge-bases", "POST", payload),
  );
}

export async function apiGetCourseKnowledgeBase(courseId: string): Promise<{
  knowledgeBase: TelenowKnowledgeBase | null;
  documents: TelenowKbDocument[];
}> {
  return unwrap<{
    knowledgeBase: TelenowKnowledgeBase | null;
    documents: TelenowKbDocument[];
  }>(
    await apiFetch(`/api/drills/${encodeURIComponent(courseId)}/knowledge-base`),
  );
}

export async function apiAddCourseKbTextDoc(
  courseId: string,
  title: string,
  body: string,
): Promise<TelenowKbDocument> {
  const data = await unwrap<{ document: TelenowKbDocument }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(courseId)}/knowledge-base/documents/text`,
      "POST",
      { title, body },
    ),
  );
  return data.document;
}

export async function apiUploadCourseKbFileDoc(
  courseId: string,
  file: File,
  title?: string,
): Promise<TelenowKbDocument> {
  const form = new FormData();
  form.append("file", file);
  if (title?.trim()) form.append("title", title.trim());
  const data = await unwrap<{ document: TelenowKbDocument }>(
    await apiFetch(
      `/api/drills/${encodeURIComponent(courseId)}/knowledge-base/documents/upload`,
      {
        method: "POST",
        body: form,
      },
    ),
  );
  return data.document;
}

export async function apiAddCourseKbUrlDoc(
  courseId: string,
  url: string,
  title?: string,
): Promise<TelenowKbDocument> {
  const data = await unwrap<{ document: TelenowKbDocument }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(courseId)}/knowledge-base/documents/url`,
      "POST",
      { url, title },
    ),
  );
  return data.document;
}

export async function apiDeleteCourseKbDoc(
  courseId: string,
  docId: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/drills/${encodeURIComponent(courseId)}/knowledge-base/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw (await parseJson(res)) as AuthErrorPayload;
}

export async function apiGetVoices(provider = "elevenlabs"): Promise<VoiceOption[]> {
  const res = await apiFetch(
    `/api/drills/voices?provider=${encodeURIComponent(provider)}`,
    {
      headers: { Accept: "application/json" },
    },
  );
  if (!res.ok) {
    const error = (await parseJson(res)) as AuthErrorPayload;
    throw new Error(error.message ?? "Failed to load voices.");
  }
  const data = (await parseJson(res)) as { voices?: VoiceOption[] };
  return Array.isArray(data.voices) ? data.voices : [];
}

export async function apiSendCourseWhatsappResource(
  courseId: string,
  payload: { resourceId: string; targetUserId?: string; targetPhone?: string },
): Promise<{ success: boolean; wamid?: string }> {
  return await unwrap<{ success: boolean; wamid?: string }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(courseId)}/whatsapp-resources/send`,
      "POST",
      payload,
    ),
  );
}

export async function apiPreviewCourseWhatsappMessage(
  courseId: string,
  payload: {
    resource: Partial<CourseWhatsappResource>;
    courseTitle?: string;
    userName?: string;
  },
): Promise<{ message: string }> {
  return await unwrap<{ message: string }>(
    await jsonRequest(
      `/api/drills/${encodeURIComponent(courseId)}/whatsapp-resources/preview`,
      "POST",
      payload,
    ),
  );
}