-- students 테이블에 career_course 컬럼 추가
ALTER TABLE students ADD COLUMN IF NOT EXISTS career_course TEXT;

-- profiles 테이블에도 필요하다면 추가 (사용자 역할에 따라 연동될 수 있음)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_course TEXT;

-- 컬럼 설명 추가
COMMENT ON COLUMN students.career_course IS '희망 진로코스 (청솔반, 취업맞춤반, 도제반 등)';
COMMENT ON COLUMN profiles.career_course IS '희망 진로코스 (청솔반, 취업맞춤반, 도제반 등)';

-- RLS 정책 확인 (기존 정책이 모든 컬럼을 허용한다면 별도 수정 불필요)
-- 만약 특정 컬럼만 허용한다면 정책 업데이트가 필요할 수 있습니다.
