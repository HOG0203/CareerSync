-- students 테이블에 휴대전화번호 컬럼 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone_number TEXT;

COMMENT ON COLUMN public.students.phone_number IS '학생 휴대전화번호';
