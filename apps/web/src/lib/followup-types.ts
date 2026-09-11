export type WorkplaceTask = {
  id: string;
  title: string;
  description: string;
  url: string | null;
};
export type Proposal = {
  id: string;
  incidentId: string;
  title: string;
  description: string;
  workspaceId: string;
  identityName: string;
  expiresAt: number;
};
export type WorkplaceStatus =
  | { status: "unconfigured"; message: string }
  | {
      status: "connected";
      workspaceId: string;
      identityName: string;
      tasks: WorkplaceTask[];
    };
