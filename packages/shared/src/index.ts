// Frozen API contract shared by @hydyar/api and @hydyar/web.
// Do not change shapes without updating both sides.

export type Role = "USER" | "ADMIN";

export interface UserDTO {
  id: string;
  email: string;
  username: string;
  role: Role;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  description?: string | null;
  language: string;
  updatedAt: string;
  fileCount?: number;
}

export interface ProjectFileDTO {
  path: string;
  content: string;
  language?: string | null;
}

export interface LearningDocMeta {
  lang: string;
  slug: string;
  title: string;
  level: string;
  orderIdx: number;
  summary?: string | null;
}

export interface LearningDocFull extends LearningDocMeta {
  content: string; // markdown
  related?: string | null;
}

export interface AppDocEntryDTO {
  id?: string;
  lang: string;
  category: string;
  component: string; // copyable
  rule: string; // detailed
  explanation: string;
  example: string;
  exampleNote?: string | null;
  orderIdx: number;
}

export interface ExecuteRequest {
  language: string; // javascript|typescript|python|lua|c|cpp|...
  code: string;
  files?: ProjectFileDTO[]; // optional multi-file; main entry = code
  stdin?: string;
}

export type ExecuteStatus = "queued" | "running" | "success" | "error" | "timeout" | "killed" | "unsupported";

export interface ExecuteResponse {
  runId: string;
  status: ExecuteStatus;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  runtime?: "local" | "server";
  message?: string; // human-readable, e.g. "queued: position 3" or limitation notice
}

export interface ForumPostDTO {
  id: string;
  title: string;
  content: string;
  codeSnippet?: string | null;
  language?: string | null;
  tags: string[];
  createdAt: string;
  editedAt?: string | null;
  author: { id: string; username: string; avatarUrl?: string | null };
  likeCount: number;
  commentCount: number;
  likedByMe?: boolean;
}

export interface CommentDTO {
  id: string;
  postId: string;
  parentId?: string | null;
  content: string;
  codeSnippet?: string | null;
  createdAt: string;
  author: { id: string; username: string };
  replies?: CommentDTO[];
}

export interface DocSuggestionDTO {
  id: string;
  kind: "LEARNING" | "APPLICATION";
  lang: string;
  title: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  feedback?: string | null;
  createdAt: string;
  author: { username: string };
}

export interface SearchResultItem {
  type: "learning-doc" | "app-doc" | "project" | "post" | "language";
  id: string;
  title: string;
  snippet: string;
  lang?: string;
  slug?: string;
  href: string; // frontend route to navigate to
}

export const SUPPORTED_LANGUAGES = [
  "javascript", "typescript", "python", "lua", "c", "cpp",
  "php", "html", "css", "sql", "java", "csharp", "go",
  "rust", "bash", "json", "markdown",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Runtime capability matrix (client reports what it can run locally;
// server only handles languages it actually has runtimes for).
export const SERVER_CAPABLE_LANGUAGES = ["javascript", "typescript", "python"] as const;
export const LOCAL_CAPABLE_LANGUAGES = ["javascript", "typescript", "html", "css", "lua", "sql", "json", "markdown"] as const;
