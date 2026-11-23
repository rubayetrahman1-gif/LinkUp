CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    details JSON,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_target_user_id ON audit_logs (target_user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action_created_at
    ON audit_logs (action, created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_ip_created_at
    ON audit_logs (ip_address, created_at);
