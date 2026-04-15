-- 모든 기존 학생의 졸업연도를 2026으로 일괄 업데이트
UPDATE public.student_employments
SET graduation_year = 2026;

-- 확인 쿼리
SELECT student_name, graduation_year FROM public.student_employments LIMIT 10;
