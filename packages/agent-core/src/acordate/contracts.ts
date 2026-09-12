export type ServiceError = {
  code: string;
  message: string;
};

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServiceError };

export type MemoryRecord = {
  id: string;
  content: string;
  createdAt: string;
  sourceMessageId?: string;
};

export type ReminderStatus = "pending" | "completed";

export type ReminderRecord = {
  id: string;
  title: string;
  dueAt: string;
  timezone: string;
  context?: string;
  memoryIds: string[];
  status: ReminderStatus;
  createdAt: string;
  completedAt?: string;
};

export type SaveMemoryRequest = {
  userId: string;
  content: string;
  sourceMessageId?: string;
};

export type SearchMemoryRequest = {
  userId: string;
  query: string;
  limit: number;
};

export type CreateReminderRequest = {
  userId: string;
  title: string;
  dueAt: string;
  timezone: string;
  context?: string;
  memoryIds: string[];
};

export type CompleteReminderRequest = {
  userId: string;
  reminderId: string;
};

export interface MemoryService {
  save(input: SaveMemoryRequest): Promise<ServiceResult<MemoryRecord>>;
  search(
    input: SearchMemoryRequest,
  ): Promise<ServiceResult<MemoryRecord[]>>;
}

export interface ReminderService {
  create(
    input: CreateReminderRequest,
  ): Promise<ServiceResult<ReminderRecord>>;
  complete(
    input: CompleteReminderRequest,
  ): Promise<ServiceResult<ReminderRecord>>;
}

export type AcordateServices = {
  memories: MemoryService;
  reminders: ReminderService;
};
