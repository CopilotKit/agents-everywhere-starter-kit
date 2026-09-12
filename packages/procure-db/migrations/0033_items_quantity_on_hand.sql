ALTER TABLE items
  ADD COLUMN quantity_on_hand NUMERIC(12,3) NOT NULL DEFAULT 0
    CHECK (quantity_on_hand >= 0);

-- Receipts recorded before this column existed count toward stock too.
UPDATE items i
SET quantity_on_hand = r.total
FROM (SELECT item_id, sum(quantity_received) AS total FROM receipts GROUP BY item_id) r
WHERE r.item_id = i.id;
