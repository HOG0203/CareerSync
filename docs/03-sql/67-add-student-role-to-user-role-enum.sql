-- ==============================================================================
-- user_role ENUM에 'student' 및 'staff' 값 추가
-- ==============================================================================

-- 1. ENUM 타입에 student 추가
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ENUM 타입에 staff 추가
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. RLS 정책 보완: 학생은 본인 profile 및 본인 학생 정보만 읽기 허용
DO $$ BEGIN
    -- profiles 본인 읽기 정책 확인
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can see own profile'
    ) THEN
        CREATE POLICY "Users can see own profile" ON profiles
            FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;
