-- [Fix] 기존 데이터가 있는 profiles 테이블에 username 컬럼을 안전하게 추가하는 스크립트

-- 1. username 컬럼을 NULL 허용 상태로 추가
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT;
  END IF;
END $$;

-- 2. 기존 데이터가 있다면 임시 username 부여 (예: 'user_' + id의 앞 8자리)
-- 이미 데이터가 채워져 있다면 이 단계는 무시됩니다.
UPDATE public.profiles 
SET username = 'user_' || SUBSTRING(id::text, 1, 8)
WHERE username IS NULL;

-- 3. 이제 모든 행에 데이터가 있으므로 NOT NULL 및 UNIQUE 제약 조건 적용
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

-- 4. UNIQUE 제약 조건 추가 (이미 존재할 수 있으므로 체크 후 추가)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_username_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
