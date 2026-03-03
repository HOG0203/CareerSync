-- 1. Create profiles table to store username
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Function to handle new user signup (Optional: if you want to auto-create profile)
-- Note: This requires the username to be passed in metadata or handled via a custom signup flow.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for new user signup
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Index for faster username lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
