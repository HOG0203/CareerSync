-- [현장실습 다회차 기록 관리 및 최종 취업처 분리]

-- 1. field_training_records 테이블 생성
CREATE TABLE IF NOT EXISTS public.field_training_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    training_order INTEGER NOT NULL,
    company TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    stipend_status TEXT DEFAULT 'X',
    hiring_status TEXT CHECK (hiring_status IN ('진행중', '채용전환', '복교')),
    conversion_date DATE,
    return_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 기존 student_employments 데이터를 field_training_records로 이관 (1회차 데이터로 복사)
-- 실습 이력이 존재하는 행만 추출하여 이관
INSERT INTO public.field_training_records (
    student_id,
    training_order,
    company,
    start_date,
    end_date,
    stipend_status,
    hiring_status,
    conversion_date,
    return_reason
)
SELECT 
    id AS student_id,
    1 AS training_order,
    COALESCE(company, '미지정') AS company,
    start_date,
    end_date,
    COALESCE(training_stipend_status, 'X') AS stipend_status,
    CASE 
        WHEN is_hiring_conversion = 'O' THEN '채용전환'
        WHEN is_returned = 'O' THEN '복교'
        WHEN start_date IS NOT NULL THEN '진행중'
        ELSE NULL
    END AS hiring_status,
    conversion_date,
    return_to_school_reason AS return_reason
FROM public.student_employments
WHERE start_date IS NOT NULL OR end_date IS NOT NULL OR is_hiring_conversion = 'O' OR is_returned = 'O';

-- 3. student_employments에서 실습 관련 중복 컬럼 제거 (정리)
-- 주의: 이 작업은 실습 데이터가 field_training_records로 안전하게 복사된 후 수행해야 합니다.
ALTER TABLE public.student_employments 
DROP COLUMN IF EXISTS has_field_training,
DROP COLUMN IF EXISTS training_stipend_status,
DROP COLUMN IF EXISTS is_hiring_conversion,
DROP COLUMN IF EXISTS conversion_date,
DROP COLUMN IF EXISTS is_returned,
DROP COLUMN IF EXISTS return_to_school_reason,
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS end_date;

-- 4. RLS 보안 정책 설정
ALTER TABLE public.field_training_records ENABLE ROW LEVEL SECURITY;

-- 교사 및 관리자는 모든 실습 이력을 조회/수정 가능
CREATE POLICY "Enable all for authenticated users" 
ON public.field_training_records FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- 주석 추가
COMMENT ON TABLE public.field_training_records IS '학생별 현장실습 다회차 이력 관리 테이블';
COMMENT ON COLUMN public.field_training_records.training_order IS '현장실습 차수 (1, 2, 3...)';
COMMENT ON COLUMN public.field_training_records.hiring_status IS '실습 결과 (진행중, 채용전환, 복교)';
