export type ToolErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NO_ACTIVE_REMINDER"
  | "CONFLICT"
  | "UNAVAILABLE";

export type ToolFailure = {
  ok: false;
  code: ToolErrorCode;
  message: string;
};

export type MemoryRecord = {
  id: string;
  userId: string;
  content: string;
  sourceMessageId: string;
  createdAt: string;
};

export type MemorySearchHit = Pick<
  MemoryRecord,
  "id" | "content" | "createdAt"
> & {
  score: number;
};

export type ReminderStatus = "pending" | "sent" | "completed" | "failed";

export type ReminderRecord = {
  id: string;
  userId: string;
  title: string;
  scheduledAt: string;
  status: ReminderStatus;
  context: string;
  sourceMemoryIds: string[];
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type SaveMemoryRequest = {
  userId: string;
  content: string;
  sourceMessageId: string;
};

export type SearchMemoryRequest = {
  userId: string;
  query: string;
};

export type CreateReminderRequest = {
  userId: string;
  title: string;
  scheduledAt: string;
  context: string;
  sourceMemoryIds: string[];
  sourceMessageId: string;
};

export type CompleteReminderRequest = {
  userId: string;
  reminderId: string;
};

export type SaveMemoryResult =
  | { ok: true; memory: MemoryRecord }
  | ToolFailure;

export type SearchMemoryResult =
  | { ok: true; memories: MemorySearchHit[] }
  | ToolFailure;

export type CreateReminderResult =
  | { ok: true; reminder: ReminderRecord }
  | ToolFailure;

export type CompleteReminderResult =
  | { ok: true; reminder: ReminderRecord }
  | ToolFailure;

export interface MemoryService {
  save(input: SaveMemoryRequest): Promise<SaveMemoryResult>;
  search(input: SearchMemoryRequest): Promise<SearchMemoryResult>;
}

export interface ReminderService {
  create(input: CreateReminderRequest): Promise<CreateReminderResult>;
  complete(input: CompleteReminderRequest): Promise<CompleteReminderResult>;
}

export type AcordateServices = {
  memories: MemoryService;
  reminders: ReminderService;
};
