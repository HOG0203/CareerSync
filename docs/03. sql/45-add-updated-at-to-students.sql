-- [students 테이블 관리 이력 컬럼 및 자동 업데이트 함수 추가]

-- 1. handle_updated_at 함수가 없는 경우 생성
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. students 테이블에 updated_at 컬럼 추가
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. 트리거 설정
DROP TRIGGER IF EXISTS set_students_updated_at ON public.students;
CREATE TRIGGER set_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. 기존 데이터에 현재 시간 반영
UPDATE public.students SET updated_at = NOW() WHERE updated_at IS NULL;
