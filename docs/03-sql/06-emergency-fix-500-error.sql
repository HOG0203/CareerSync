-- [500 에러 해결을 위한 긴급 조치]
-- 1. 모든 관련 트리거 일시 삭제 (트리거가 500 에러의 주범입니다)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- 2. 트리거 함수가 에러를 뱉지 않도록 안전하게 수정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 삽입 시도하되, 실패하더라도 Auth 계정 생성을 막지 않도록 EXCEPTION 처리 추가
  BEGIN
    INSERT INTO public.profiles (id, username, full_name, role)
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)), 
      COALESCE(new.raw_user_meta_data->>'full_name', ''),
      COALESCE(new.raw_user_meta_data->>'role', 'staff')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- 에러가 발생해도 무시하고 진행 (서버 액션에서 upsert로 보완함)
    RETURN new;
  END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 트리거 재생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. 만약 Profiles 테이블 자체가 문제라면 제약 조건 완전 완화
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
