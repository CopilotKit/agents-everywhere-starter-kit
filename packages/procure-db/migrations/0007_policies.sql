CREATE TABLE policies (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  dept TEXT -- nullable; unused today, reserved for a future department-scoped policy
);
