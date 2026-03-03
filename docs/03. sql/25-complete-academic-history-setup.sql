-- [학적 이력 시스템 통합 설치 스크립트]
-- 1. 테이블 생성 -> 2. RLS 설정 -> 3. 초기 데이터 마이그레이션 순으로 진행합니다.

-- 1. 학적 이력 영구 기록 테이블 생성
CREATE TABLE IF NOT EXISTS public.student_academic_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.student_employments(id) ON DELETE CASCADE,
    academic_year INTEGER NOT NULL,
    grade INTEGER NOT NULL CHECK (grade IN (1, 2, 3)),
    major TEXT NOT NULL,
    class_info TEXT NOT NULL,
    student_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(student_id, grade)
);

-- 2. RLS 보안 정책 설정
ALTER TABLE public.student_academic_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authorized users" ON public.student_academic_history;
CREATE POLICY "Enable read access for authorized users" ON public.student_academic_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN student_employments s ON s.major = p.assigned_major AND s.class_info = p.assigned_class
            WHERE p.id = auth.uid() AND s.id = student_academic_history.student_id
        )
        OR 
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Enable insert/update for authenticated users" ON public.student_academic_history;
CREATE POLICY "Enable insert/update for authenticated users" ON public.student_academic_history
    FOR ALL
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3. 기존 데이터 초기 마이그레이션 실행
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
        CASE 
            WHEN graduation_year - current_base_year = 0 THEN 3
            WHEN graduation_year - current_base_year = 1 THEN 2
            WHEN graduation_year - current_base_year = 2 THEN 1
            ELSE 3
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

COMMENT ON TABLE public.student_academic_history IS '학생 학년별 학적 변동 이력 (통합 설치)';
