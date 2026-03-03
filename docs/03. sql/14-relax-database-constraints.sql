-- student_employments 테이블의 필수 입력 제약 조건 해제
-- id와 student_id(고유 식별자)를 제외한 모든 컬럼에 NULL 허용

ALTER TABLE public.student_employments ALTER COLUMN graduation_year DROP NOT NULL;
ALTER TABLE public.student_employments ALTER COLUMN major DROP NOT NULL;
ALTER TABLE public.student_employments ALTER COLUMN employment_status DROP NOT NULL;

-- 기존 데이터가 없을 때를 대비한 기본값 제거 (원하는 대로 저장되도록)
ALTER TABLE public.student_employments ALTER COLUMN graduation_year DROP DEFAULT;
