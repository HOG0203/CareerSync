-- [기존 학생 데이터 학적 이력 마이그레이션]
-- 현재 student_employments에 있는 정보를 바탕으로 초기 이력 데이터를 생성합니다.

DO $$
DECLARE
    current_base_year INTEGER := 2026; -- 시스템 설정의 baseYear와 동일하게 설정
BEGIN
    INSERT INTO public.student_academic_history (
        student_id, 
        academic_year, 
        grade, 
        major, 
        class_info, 
        student_number
    )
    SELECT 
        id, 
        current_base_year,
        -- 학년 계산 로직 (졸업연도와 기준연도 차이 기반)
        CASE 
            WHEN graduation_year - current_base_year = 0 THEN 3
            WHEN graduation_year - current_base_year = 1 THEN 2
            WHEN graduation_year - current_base_year = 2 THEN 1
            ELSE 3 -- 기본값 3학년
        END,
        major,
        class_info,
        student_number
    FROM public.student_employments
    ON CONFLICT (student_id, grade) DO UPDATE 
    SET 
        major = EXCLUDED.major,
        class_info = EXCLUDED.class_info,
        student_number = EXCLUDED.student_number,
        academic_year = EXCLUDED.academic_year;
END $$;
