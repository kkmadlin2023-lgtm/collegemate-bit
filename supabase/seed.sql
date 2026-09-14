-- ==============================================================================
-- CAMPUSMATE SEED DATA
-- Default roles, initial categories, and default system settings
-- ==============================================================================

-- 1. Insert standard roles
INSERT INTO public.roles (name, description) VALUES
  ('SUPER_ADMIN', 'Full system access, role management, and system settings control'),
  ('ADMIN', 'Administrative access to manage users, items, schedules, and categories'),
  ('MODERATOR', 'Moderation access to review lost/found items, claims, and flagged reports'),
  ('STUDENT', 'Standard student account with schedule, reminder, and lost/found access'),
  ('GUEST', 'Read-only visitor access')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

-- 2. Insert default categories
INSERT INTO public.categories (name, slug, description, icon, color, type, is_active) VALUES
  -- Schedule Categories
  ('Lecture', 'lecture', 'Standard academic classroom lecture', 'GraduationCap', '#4f46e5', 'SCHEDULE', true),
  ('Lab / Practical', 'lab-practical', 'Laboratory sessions and hands-on workshops', 'FlaskConical', '#0ea5e9', 'SCHEDULE', true),
  ('Tutorial / Seminar', 'tutorial-seminar', 'Small group discussion and seminar sessions', 'Users', '#8b5cf6', 'SCHEDULE', true),
  ('Study Session', 'study-session', 'Personal and group revision blocks', 'BookOpen', '#10b981', 'SCHEDULE', true),
  ('Extracurricular', 'extracurricular', 'Club meetings, sports and campus events', 'Trophy', '#f59e0b', 'SCHEDULE', true),

  -- Reminder Categories
  ('Assignment', 'assignment', 'Homework and project coursework deadlines', 'FileText', '#ef4444', 'REMINDER', true),
  ('Exam / Quiz', 'exam-quiz', 'Midterm, finals, and classroom quizzes', 'AlertCircle', '#dc2626', 'REMINDER', true),
  ('Personal', 'personal', 'Personal errands and campus tasks', 'CheckSquare', '#6366f1', 'REMINDER', true),
  ('Fee / Admin', 'fee-admin', 'Tuition, registration, and administrative due dates', 'CreditCard', '#059669', 'REMINDER', true),

  -- Lost & Found Categories
  ('Electronics', 'electronics', 'Phones, laptops, chargers, tablets, calculators', 'Smartphone', '#3b82f6', 'LOST_FOUND', true),
  ('ID Cards & Keys', 'id-cards-keys', 'Student ID cards, room keys, access fobs', 'Key', '#ec4899', 'LOST_FOUND', true),
  ('Bags & Wallets', 'bags-wallets', 'Backpacks, wallets, purses, pouches', 'Briefcase', '#84cc16', 'LOST_FOUND', true),
  ('Books & Notebooks', 'books-notebooks', 'Textbooks, course binders, spiral notebooks', 'Book', '#14b8a6', 'LOST_FOUND', true),
  ('Clothing & Bottles', 'clothing-bottles', 'Jackets, water bottles, umbrellas, glasses', 'Glasses', '#a855f7', 'LOST_FOUND', true),
  ('Other', 'other', 'Miscellaneous items', 'HelpCircle', '#64748b', 'LOST_FOUND', true)
ON CONFLICT (slug) DO NOTHING;

-- 3. Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('app_name', '"CampusMate"', 'Application title and display name'),
  ('auto_approve_lost_items', 'false', 'Whether lost item reports are approved automatically without admin moderation'),
  ('auto_approve_found_items', 'false', 'Whether found item reports are approved automatically without admin moderation'),
  ('allow_guest_browsing', 'true', 'Allow unauthenticated users to browse approved lost & found items'),
  ('academic_semester', '"Fall 2026"', 'Current active academic semester'),
  ('contact_support_email', '"support@campusmate.app"', 'Support contact email displayed to students')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
