-- [통합 복구 SQL] profiles 테이블 구조 및 트리거 완전 수정

-- 1. 필수 컬럼(role, username) 추가 및 제약 조건 완화
-- 이미 컬럼이 있다면 오류 없이 넘어갑니다.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'staff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. username 중복 오류 및 NOT NULL 오류 방지를 위해 제약 조건 조정
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;
DROP INDEX IF EXISTS idx_profiles_username;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- 3. 트리거 함수 완전 재작성
-- 이 함수는 Auth 계정 생성 시 최소한의 데이터만 안전하게 생성합니다.
-- 상세 데이터(아이디, 역할 등)는 서버 액션(actions.ts)에서 upsert로 처리합니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)), 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 트리거 재활성화 (기존 트리거가 있다면 삭제 후 재생성)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
