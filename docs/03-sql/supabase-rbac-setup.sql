-- 1. Create a custom type for roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create profiles policies
-- Admin can see and update everything
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can see their own profile
CREATE POLICY "Users can see own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 5. Automatic Profile Creation Trigger
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Update student_employments RLS for Roles
-- First, drop the old public read policy
DROP POLICY IF EXISTS "Allow public read access" ON student_employments;

-- Policy: Admin can do everything
CREATE POLICY "Admins have full access to student data" ON student_employments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy: Teachers can read and update student data
CREATE POLICY "Teachers can view and update student data" ON student_employments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );

CREATE POLICY "Teachers can insert/update student data" ON student_employments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );

-- 7. Helper function to check if user is admin (for use in application logic)
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
