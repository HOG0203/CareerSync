-- [students 테이블 누락 컬럼 추가]
-- 학반 관리 페이지에서 사용하는 진로희망 및 특이사항 컬럼이 분리 과정에서 누락되어 추가합니다.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS career_aspiration TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS special_notes TEXT;

COMMENT ON COLUMN public.students.career_aspiration IS '진로 희망';
COMMENT ON COLUMN public.students.special_notes IS '학생 특이사항 (청솔반, 도제 등)';
