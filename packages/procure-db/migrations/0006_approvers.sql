CREATE TABLE approvers (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  role    TEXT NOT NULL CHECK (role IN ('approver', 'finance_lead', 'owner'))
);
