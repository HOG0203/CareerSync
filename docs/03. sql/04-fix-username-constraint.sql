-- 1. username 컬럼의 NOT NULL 제약 조건 제거
-- 트리거가 실행될 때 username이 즉시 전달되지 않아 발생하는 'NOT NULL' 위반 오류를 방지합니다.
-- 실제 값은 서버 액션의 upsert 과정을 통해 안전하게 저장됩니다.
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;

-- 2. 트리거 함수 보강
-- 메타데이터에 username이 없을 경우를 대비하여 기본값을 생성하도록 로직을 개선합니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)), 
    new.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
