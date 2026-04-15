-- graduation_year 컬럼에 기본값(현재 연도) 설정 및 제약 조건 완화
ALTER TABLE public.student_employments ALTER COLUMN graduation_year SET DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- 만약 기존 로직과의 호환성을 위해 NULL을 허용하고 싶다면 아래 주석 해제
-- ALTER TABLE public.student_employments ALTER COLUMN graduation_year DROP NOT NULL;
