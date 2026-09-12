-- Procurebot web surface: needed-by dates on requisitions, human-readable PO
-- numbers with email delivery status, and quotes that may arrive as form
-- fields without a document.
ALTER TABLE requisitions ADD COLUMN needed_by DATE;

CREATE SEQUENCE po_number_seq START 1001;
ALTER TABLE pos
  ADD COLUMN po_number TEXT NOT NULL UNIQUE
    DEFAULT ('PO-' || lpad(nextval('po_number_seq')::text, 6, '0'));
ALTER TABLE pos ADD COLUMN emailed_at TIMESTAMPTZ;
ALTER TABLE pos ADD COLUMN email_error TEXT;

ALTER TABLE quotes ALTER COLUMN raw_document_ref DROP NOT NULL;
