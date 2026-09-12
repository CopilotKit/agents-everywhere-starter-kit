CREATE TABLE thresholds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id        UUID NOT NULL REFERENCES policies(id),
  tier_number      INTEGER NOT NULL,
  min_amount_cents INTEGER NOT NULL,
  max_amount_cents INTEGER, -- nullable: open-ended top tier
  required_role    TEXT NOT NULL CHECK (required_role IN ('approver', 'finance_lead', 'owner'))
);

CREATE UNIQUE INDEX thresholds_policy_tier_idx ON thresholds (policy_id, tier_number);

-- The flat, org-wide amount ladder: Tier 1 $0-$2,500 -> approver,
-- Tier 2 $2,500-$25,000 -> finance_lead, Tier 3 >$25,000 -> owner.
INSERT INTO policies (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'default');

INSERT INTO thresholds (policy_id, tier_number, min_amount_cents, max_amount_cents, required_role) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 0,       250000,  'approver'),
  ('00000000-0000-0000-0000-000000000001', 2, 250000,  2500000, 'finance_lead'),
  ('00000000-0000-0000-0000-000000000001', 3, 2500000, NULL,    'owner');
