-- moneten – Grundschema (Phase 1 und 2)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard', 'wg')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  paid_by TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  spent_on TEXT NOT NULL,
  split_mode TEXT NOT NULL CHECK (split_mode IN ('equal', 'exact', 'shares')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE expense_shares (
  expense_id TEXT NOT NULL REFERENCES group_expenses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  share_cents INTEGER NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);

CREATE TABLE settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  from_user TEXT NOT NULL REFERENCES users(id),
  to_user TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  settled_on TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE personal_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  counts_toward_month INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE personal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  category_id TEXT NOT NULL REFERENCES personal_categories(id),
  spent_on TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE recurring_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('income', 'fixed')),
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  start_month TEXT NOT NULL,
  end_month TEXT
);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  budget_start_month TEXT,
  carryover_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_expenses_group ON group_expenses(group_id);
CREATE INDEX idx_expense_shares_user ON expense_shares(user_id);
CREATE INDEX idx_settlements_group ON settlements(group_id);
CREATE INDEX idx_personal_entries_user ON personal_entries(user_id, spent_on);
CREATE INDEX idx_personal_categories_user ON personal_categories(user_id);
CREATE INDEX idx_recurring_items_user ON recurring_items(user_id);
