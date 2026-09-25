/**
 * Courses API layer.
 * The platform exposes course content as "drills" on the server; the client
 * speaks the user-facing "course" vocabulary.
 */

import type { AuthErrorPayload } from "../features/auth/auth-context";

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
  isMandatory: boolean;
  regionScope: string[];
  roleScope: string[];
  expiresAt: string | null;
  status: CourseStatus;
  telenowAgentId: string | null;
  telenowCampaignId: string | null;
  provisioningStatus: ProvisioningStatus;
  provisioningError: string | null;
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
  isMandatory: boolean;
  regionScope?: string[];
  roleScope?: string[];
  expiresAt?: string | null;
  audienceIds?: string[];
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

export type CourseEnrollment = {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  status: CourseEnrollmentStatus;
  score: number | null;
  calledAt: string | null;
  completedAt: string | null;
  recordingUrl: string | null;
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
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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
    await fetch(`/api/drills${query}`, { credentials: "include" }),
  );
  return data.courses;
}

export async function apiGetCourse(id: string): Promise<Course> {
  const data = await unwrap<{ course: Course }>(
    await fetch(`/api/drills/${encodeURIComponent(id)}`, {
      credentials: "include",
    }),
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
    await fetch(`/api/drills/${encodeURIComponent(id)}/enrollments`, {
      credentials: "include",
    }),
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
    await fetch(`/api/drills/${encodeURIComponent(courseId)}/documents`, {
      method: "POST",
      credentials: "include",
      body: form,
    }),
  );
  return data.document;
}

export async function apiDeleteCourseDocument(
  courseId: string,
  documentId: string,
): Promise<void> {
  const res = await fetch(
    `/api/drills/${encodeURIComponent(courseId)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE", credentials: "include" },
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