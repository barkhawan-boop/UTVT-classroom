PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stages (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, department_id TEXT NOT NULL REFERENCES departments(id), stage_id TEXT NOT NULL REFERENCES stages(id), code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, UNIQUE(department_id,stage_id,name));
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')), department_id TEXT REFERENCES departments(id), stage_id TEXT REFERENCES stages(id), hold_marks INTEGER NOT NULL DEFAULT 0 CHECK(hold_marks IN(0,1)), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN(0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS enrollments (student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(student_id,class_id));
CREATE TABLE IF NOT EXISTS curricula (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, lesson_count INTEGER NOT NULL CHECK(lesson_count BETWEEN 1 AND 500), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES users(id), class_id TEXT NOT NULL REFERENCES classes(id), curriculum_id TEXT NOT NULL REFERENCES curricula(id), lessons_per_week INTEGER NOT NULL CHECK(lessons_per_week BETWEEN 1 AND 40), created_at TEXT NOT NULL, UNIQUE(class_id,curriculum_id));
CREATE TABLE IF NOT EXISTS timetable (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE, day TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, room TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), lesson_number INTEGER NOT NULL CHECK(lesson_number BETWEEN 1 AND 500), title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN('pending','published','returned')), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT);
CREATE TABLE IF NOT EXISTS marks (submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES users(id), score REAL NOT NULL CHECK(score>=0), max_score REAL NOT NULL CHECK(max_score>0 AND score<=max_score), PRIMARY KEY(submission_id,student_id));
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), title TEXT NOT NULL, file_name TEXT NOT NULL, file_key TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL, mime TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_documents_assignment ON documents(assignment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_timetable_assignment ON timetable(assignment_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at);


