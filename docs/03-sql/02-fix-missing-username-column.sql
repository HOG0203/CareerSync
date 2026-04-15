-- [Fix] profiles 테이블에 username 컬럼이 없을 경우 추가하는 스크립트

-- 1. 만약 profiles 테이블이 아예 없다면 생성
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. profiles 테이블에 username 컬럼이 없는 경우에만 추가 (안전한 패치)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE NOT NULL;
  END IF;
END $$;

-- 3. 검색 성능 향상을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- 4. RLS 정책 재확인 (기존에 없었을 경우 대비)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone.') THEN
    CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
  END IF;
END $$;
