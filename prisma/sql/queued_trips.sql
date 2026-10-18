CREATE TABLE IF NOT EXISTS queued_trip (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(19) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id INTEGER REFERENCES activity(id) ON DELETE SET NULL,
    activity_type activity_type_enum NOT NULL,
    data JSON NOT NULL,
    channel_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS queued_trip_user_id_created_at_idx ON queued_trip (user_id, created_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS queued_trips_daily_date VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS queued_trips_daily_count INTEGER NOT NULL DEFAULT 0;

ALTER TYPE command_name_enum ADD VALUE IF NOT EXISTS 'queue';
