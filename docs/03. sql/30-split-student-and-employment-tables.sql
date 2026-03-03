-- [데이터베이스 물리적 분리 마이그레이션 - 수정 버전]
-- 1. 신규 students 테이블 생성 (기본 인적사항)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL UNIQUE, -- 학번
    student_name TEXT NOT NULL,
    graduation_year INTEGER NOT NULL,
    major TEXT NOT NULL,
    class_info TEXT,
    student_number TEXT,
    shoe_size TEXT,
    top_size TEXT,
    personal_remarks TEXT,
    certificates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 기존 student_employments 데이터를 백업할 임시 테이블 생성 (안전장치)
DROP TABLE IF EXISTS public.temp_old_data;
CREATE TABLE public.temp_old_data AS SELECT * FROM public.student_employments;

-- 3. students 테이블에 기존 데이터 이관 (타입 캐스팅 오류 수정)
INSERT INTO public.students (
    student_id, student_name, graduation_year, major, class_info, 
    student_number, shoe_size, top_size, personal_remarks, certificates, created_at
)
SELECT 
    student_id, student_name, graduation_year, major, class_info, 
    student_number, shoe_size, top_size, personal_remarks, 
    CASE 
        WHEN certificates IS NULL OR certificates = '' THEN '[]'::jsonb
        WHEN certificates LIKE '[%' THEN certificates::jsonb
        ELSE jsonb_build_array(certificates)
    END, 
    created_at
FROM public.temp_old_data
ON CONFLICT (student_id) DO NOTHING;

-- 4. 기존 student_employments 테이블 구조 변경을 위해 삭제 후 재생성
DROP TABLE IF EXISTS public.student_employments CASCADE;

CREATE TABLE public.student_employments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_ref_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE UNIQUE,
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

-- 5. 취업 정보 데이터 이관 (students 테이블의 ID와 매칭)
INSERT INTO public.student_employments (
    student_ref_id, is_desiring_employment, employment_status, business_type,
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

-- 6. 보안 정책 (RLS) 설정
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_employments ENABLE ROW LEVEL SECURITY;

-- students 정책
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.students;
CREATE POLICY "Enable all for authenticated users" ON public.students FOR ALL USING (auth.uid() IS NOT NULL);

-- student_employments 정책
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.student_employments;
CREATE POLICY "Enable all for authenticated users" ON public.student_employments FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.students IS '학생 기본 인적사항 마스터 테이블';
COMMENT ON TABLE public.student_employments IS '학생별 취업 및 현장실습 현황 테이블 (students와 1:1)';
