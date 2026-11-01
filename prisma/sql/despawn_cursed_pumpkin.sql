BEGIN;

-- Despawn Cursed Pumpkin (item ID 75107) from all user banks
UPDATE users
SET bank = (bank::jsonb - '75107')::json
WHERE (bank->>'75107') IS NOT NULL;

COMMIT;
