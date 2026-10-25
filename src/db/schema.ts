import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const lectureStatus = pgEnum("lecture_status", ["uploaded", "processing", "ready", "failed"]);
export const sourceType = pgEnum("lecture_source_type", ["recording", "audio", "video", "link", "document"]);
export const materialType = pgEnum("study_material_type", ["flashcards", "quiz", "summary"]);
export const eventType = pgEnum("timetable_event_type", ["lecture", "lab", "seminar", "study", "review", "exam", "personal"]);
export const groupVisibility = pgEnum("group_visibility", ["public", "private"]);
export const groupRole = pgEnum("group_role", ["owner", "moderator", "member"]);
export const resourceVisibility = pgEnum("resource_visibility", ["private", "group"]);
export const generationStatus = pgEnum("generation_status", ["queued", "processing", "completed", "failed"]);
export const generationTask = pgEnum("generation_task", ["summary", "flashcards", "quiz", "question"]);
export const studyTaskStatus = pgEnum("study_task_status", ["todo", "in_progress", "completed", "cancelled"]);
export const studyTaskPriority = pgEnum("study_task_priority", ["low", "normal", "high"]);
export const studySessionStatus = pgEnum("study_session_status", ["scheduled", "cancelled", "completed"]);

export const universities = pgTable("universities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  website: text("website"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("universities_name_country_idx").on(table.name, table.countryCode),
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  degree: text("degree"),
  university: text("university"),
  universityId: uuid("university_id").references(() => universities.id, { onDelete: "set null" }),
  countryCode: text("country_code"),
  countryName: text("country_name"),
  programme: text("programme"),
  academicLevel: text("academic_level"),
  currentSemester: text("current_semester"),
  timezone: text("timezone").default("UTC").notNull(),
  avatarUrl: text("avatar_url"),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  onboardingStep: smallint("onboarding_step").default(0).notNull(),
  workspaceTourCompleted: boolean("workspace_tour_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courseCatalog = pgTable("course_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  universityId: uuid("university_id").notNull().references(() => universities.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  department: text("department"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("course_catalog_university_code_idx").on(table.universityId, table.code),
  index("course_catalog_university_title_idx").on(table.universityId, table.title),
]);

export const studentCourses = pgTable("student_courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  courseId: uuid("course_id").notNull().references(() => courseCatalog.id, { onDelete: "cascade" }),
  semester: text("semester"),
  academicYear: text("academic_year"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("student_courses_user_course_term_idx").on(
    table.userId,
    table.courseId,
    sql`coalesce(${table.semester}, '')`,
    sql`coalesce(${table.academicYear}, '')`,
  ),
  index("student_courses_user_id_idx").on(table.userId),
]);

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  code: text("code").notNull(),
  color: text("color").default("#7259e8").notNull(),
  term: text("term"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("courses_user_id_idx").on(table.userId),
  uniqueIndex("courses_user_code_idx").on(table.userId, table.code),
]);

export const lectures = pgTable("lectures", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  sourceType: sourceType("source_type").notNull(),
  sourceUrl: text("source_url"),
  storagePath: text("storage_path"),
  mimeType: text("mime_type"),
  durationSeconds: integer("duration_seconds"),
  language: text("language"),
  status: lectureStatus("status").default("uploaded").notNull(),
  transcript: text("transcript"),
  transcriptSegments: jsonb("transcript_segments").$type<Array<{ start: number; end: number; text: string; speaker?: string }>>(),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("lectures_user_id_idx").on(table.userId),
  index("lectures_course_id_idx").on(table.courseId),
  index("lectures_status_idx").on(table.status),
]);

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  lectureId: uuid("lecture_id").notNull().references(() => lectures.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: jsonb("content").$type<{
    overview: string;
    sections: Array<{ heading: string; body: string; points?: string[] }>;
    keyTerms: Array<{ term: string; definition: string }>;
    takeaways: string[];
  }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("notes_lecture_id_idx").on(table.lectureId),
  index("notes_user_id_idx").on(table.userId),
]);

export const studyMaterials = pgTable("study_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  type: materialType("type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  mastery: real("mastery").default(0).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("study_materials_user_id_idx").on(table.userId),
  index("study_materials_note_id_idx").on(table.noteId),
  index("study_materials_due_at_idx").on(table.dueAt),
]);

export const timetableEvents = pgTable("timetable_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  type: eventType("type").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  generated: boolean("generated").default(false).notNull(),
  sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("timetable_events_user_start_idx").on(table.userId, table.startsAt),
]);

export const studyPreferences = pgTable("study_preferences", {
  userId: uuid("user_id").primaryKey(),
  pace: text("pace").default("balanced").notNull(),
  sessionMinutes: integer("session_minutes").default(45).notNull(),
  breakMinutes: integer("break_minutes").default(10).notNull(),
  dailyLimitMinutes: integer("daily_limit_minutes").default(150).notNull(),
  preferredTimes: jsonb("preferred_times").$type<string[]>().default(["afternoon"]).notNull(),
  studyDays: jsonb("study_days").$type<number[]>().default([1, 2, 3, 4, 5]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatThreads = pgTable("chat_threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("chat_threads_user_id_idx").on(table.userId)]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  threadId: uuid("thread_id").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations").$type<Array<{ lectureId?: string; noteId?: string; label: string; timestamp?: number }>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("chat_messages_thread_id_idx").on(table.threadId)]);

export const studyGroups = pgTable("study_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  visibility: groupVisibility("visibility").default("private").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("study_groups_creator_id_idx").on(table.creatorId),
  index("study_groups_course_id_idx").on(table.courseId),
  index("study_groups_visibility_idx").on(table.visibility),
]);

export const groupMembers = pgTable("group_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => studyGroups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  role: groupRole("role").default("member").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("group_members_group_user_idx").on(table.groupId, table.userId),
  index("group_members_user_id_idx").on(table.userId),
]);

export const groupInvites = pgTable("group_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => studyGroups.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").default(0).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("group_invites_token_hash_idx").on(table.tokenHash),
  index("group_invites_group_id_idx").on(table.groupId),
]);

export const groupMessages = pgTable("group_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => studyGroups.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull(),
  body: text("body").notNull(),
  resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("group_messages_group_created_idx").on(table.groupId, table.createdAt),
  index("group_messages_sender_id_idx").on(table.senderId),
]);

export const studySessions = pgTable("study_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => studyGroups.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").notNull(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: studySessionStatus("status").default("scheduled").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("study_sessions_group_start_idx").on(table.groupId, table.startsAt),
  index("study_sessions_creator_id_idx").on(table.creatorId),
]);

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  sharedGroupId: uuid("shared_group_id").references(() => studyGroups.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  resourceType: text("resource_type").notNull(),
  storagePath: text("storage_path"),
  content: jsonb("content").$type<Record<string, unknown>>(),
  visibility: resourceVisibility("visibility").default("private").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("resources_owner_id_idx").on(table.ownerId),
  index("resources_course_id_idx").on(table.courseId),
  index("resources_shared_group_id_idx").on(table.sharedGroupId),
  uniqueIndex("resources_storage_path_idx").on(table.storagePath),
]);

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  lectureId: uuid("lecture_id").references(() => lectures.id, { onDelete: "set null" }),
  resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "set null" }),
  task: generationTask("task").notNull(),
  status: generationStatus("status").default("queued").notNull(),
  inputMetadata: jsonb("input_metadata").$type<Record<string, unknown>>(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  model: text("model"),
  usageMetadata: jsonb("usage_metadata").$type<Record<string, unknown>>(),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ai_generations_owner_created_idx").on(table.ownerId, table.createdAt),
  index("ai_generations_status_idx").on(table.status),
]);

export const flashcards = pgTable("flashcards", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  generationId: uuid("generation_id").references(() => aiGenerations.id, { onDelete: "set null" }),
  lectureId: uuid("lecture_id").references(() => lectures.id, { onDelete: "set null" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("flashcards_owner_id_idx").on(table.ownerId),
  index("flashcards_course_id_idx").on(table.courseId),
]);

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  generationId: uuid("generation_id").references(() => aiGenerations.id, { onDelete: "set null" }),
  lectureId: uuid("lecture_id").references(() => lectures.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  questions: jsonb("questions").$type<Array<{
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("quizzes_owner_id_idx").on(table.ownerId),
  index("quizzes_course_id_idx").on(table.courseId),
]);

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  answers: jsonb("answers").$type<number[]>().notNull(),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("quiz_attempts_quiz_user_idx").on(table.quizId, table.userId),
  index("quiz_attempts_user_completed_idx").on(table.userId, table.completedAt),
]);

export const studyTasks = pgTable("study_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: studyTaskStatus("status").default("todo").notNull(),
  priority: studyTaskPriority("priority").default("normal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("study_tasks_owner_due_idx").on(table.ownerId, table.dueAt),
  index("study_tasks_course_id_idx").on(table.courseId),
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("notifications_user_created_idx").on(table.userId, table.createdAt),
]);

export const studentReviews = pgTable("student_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  university: text("university"),
  rating: smallint("rating").notNull(),
  review: text("review").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("student_reviews_rating_check", sql`${table.rating} between 1 and 5`),
  check("student_reviews_display_name_check", sql`char_length(${table.displayName}) between 2 and 100`),
  check("student_reviews_university_check", sql`${table.university} is null or char_length(${table.university}) between 2 and 160`),
  check("student_reviews_review_check", sql`char_length(${table.review}) between 10 and 600`),
  index("student_reviews_created_at_idx").on(table.createdAt),
]);
