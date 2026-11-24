CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_groups_owner_id ON groups (owner_id);

CREATE TABLE IF NOT EXISTS group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('owner', 'recruiter', 'reviewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_group_members_group_id ON group_members (group_id);
CREATE INDEX IF NOT EXISTS ix_group_members_user_id ON group_members (user_id);
CREATE INDEX IF NOT EXISTS ix_group_members_user_role
    ON group_members (user_id, role);

ALTER TABLE groups
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS group_id INTEGER
    REFERENCES groups(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_jobs_group_id ON jobs (group_id);

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS assigned_reviewer_id INTEGER
    REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS review_recommendation VARCHAR(40);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'application_review_recommendation_check'
    ) THEN
        ALTER TABLE applications
            ADD CONSTRAINT application_review_recommendation_check
            CHECK (
                review_recommendation IS NULL
                OR review_recommendation IN (
                    'Recommend',
                    'Not Recommend',
                    'Need Further Consideration'
                )
            );
    END IF;
END
$$;

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS reviewed_by_id INTEGER
    REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_applications_assigned_reviewer_id
    ON applications (assigned_reviewer_id);
