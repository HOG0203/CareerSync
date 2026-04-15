-- [학생 취업 현황 테이블 스키마 확장]
-- 기존 student_employments 테이블에 누락된 18개 표준 항목 컬럼을 추가합니다.

ALTER TABLE public.student_employments 
ADD COLUMN IF NOT EXISTS company_type TEXT,                -- 기업구분
ADD COLUMN IF NOT EXISTS business_type TEXT,               -- 사업구분
ADD COLUMN IF NOT EXISTS class_info TEXT,                  -- 학반
ADD COLUMN IF NOT EXISTS student_number TEXT,              -- 번호
ADD COLUMN IF NOT EXISTS student_name TEXT,                -- 학생명
ADD COLUMN IF NOT EXISTS is_desiring_employment TEXT,      -- 취업희망유무
ADD COLUMN IF NOT EXISTS has_field_training TEXT,          -- 현장실습 유무
ADD COLUMN IF NOT EXISTS end_date DATE,                    -- 현장실습 종료일
ADD COLUMN IF NOT EXISTS is_hiring_conversion TEXT,        -- 채용전환 유무
ADD COLUMN IF NOT EXISTS conversion_date DATE,             -- 채용전환일
ADD COLUMN IF NOT EXISTS training_stipend_status TEXT,     -- 현장실습 지원금 신청현황
ADD COLUMN IF NOT EXISTS remarks TEXT,                     -- 비고
ADD COLUMN IF NOT EXISTS return_to_school_reason TEXT;     -- 복교사유

-- 기존 컬럼 주석 추가 (관리 편의성)
COMMENT ON COLUMN public.student_employments.employment_status IS '취업구분';
COMMENT ON COLUMN public.student_employments.major IS '학과';
COMMENT ON COLUMN public.student_employments.company IS '회사명';
COMMENT ON COLUMN public.student_employments.start_date IS '현장실습 시작일';
