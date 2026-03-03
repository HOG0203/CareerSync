-- [데이터베이스 ID 구조 통일 마이그레이션]
-- students 테이블의 id와 student_employments의 id를 일치시켜 1:1 관계를 명확히 합니다.

-- 1. 기존 취업 테이블 삭제 (데이터는 이미 temp_old_data에 백업되어 있음)
DROP TABLE IF EXISTS public.student_employments CASCADE;

-- 2. 신규 취업 테이블 생성 (ID를 students.id 참조 PK로 설정)
CREATE TABLE public.student_employments (
    id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
    is_desiring_employment TEXT DEFAULT '예',
    employment_status TEXT,
    business_type TEXT,
    company TEXT,
    company_type TEXT,
    has_field_training TEXT DEFAULT 'X',
    start_date DATE,
    end_date DATE,
    training_stipend_status TEXT DEFAULT 'X',
    is_hiring_conversion TEXT DEFAULT 'X',
    conversion_date DATE,
    is_returned TEXT DEFAULT 'X',
    return_to_school_reason TEXT,
    remarks TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 데이터 재이관 (students.id를 PK로 직접 사용)
INSERT INTO public.student_employments (
    id, is_desiring_employment, employment_status, business_type,
    company, company_type, has_field_training, start_date, end_date,
    training_stipend_status, is_hiring_conversion, conversion_date,
    is_returned, return_to_school_reason, remarks
)
SELECT 
    s.id, t.is_desiring_employment, t.employment_status, t.business_type,
    t.company, t.company_type, t.has_field_training, t.start_date, t.end_date,
    t.training_stipend_status, t.is_hiring_conversion, t.conversion_date,
    t.is_returned, t.return_to_school_reason, t.remarks
FROM public.temp_old_data t
JOIN public.students s ON t.student_id = s.student_id;

-- 4. RLS 보안 정책 재설정
ALTER TABLE public.student_employments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.student_employments 
    FOR ALL 
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.student_employments IS '학생별 취업 정보 (ID가 students.id와 동일)';
