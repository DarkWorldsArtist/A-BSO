BEGIN;

UPDATE users
SET bank = bank - '75107'
WHERE bank ? '75107';

COMMIT;
