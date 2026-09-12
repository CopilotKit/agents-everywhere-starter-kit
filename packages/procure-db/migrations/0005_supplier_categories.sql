CREATE TABLE supplier_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  category    TEXT NOT NULL,
  preferred   BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX supplier_categories_supplier_category_idx
  ON supplier_categories (supplier_id, category);
CREATE INDEX supplier_categories_category_idx ON supplier_categories (category);
