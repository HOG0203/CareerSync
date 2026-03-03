-- [상담 기록 및 학적 이력 외래키 관계 최종 정립]
-- 테이블 분리 후 UUID 참조 관계가 어긋난 부분을 바로잡습니다.

-- 1. 상담 기록 테이블(student_counseling_logs) 수정
-- 기존 제약 조건 삭제
ALTER TABLE public.student_counseling_logs 
DROP CONSTRAINT IF EXISTS student_counseling_logs_student_id_fkey;

-- 데이터 타입이 UUID인지 확인하고, 만약 TEXT였다면 UUID로 변경 (필요 시)
-- ALTER TABLE public.student_counseling_logs 
-- ALTER COLUMN student_id TYPE UUID USING student_id::UUID;

-- students 테이블의 id(UUID)를 올바르게 참조하도록 제약 조건 재생성
ALTER TABLE public.student_counseling_logs
ADD CONSTRAINT student_counseling_logs_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


-- 2. 학적 이력 테이블(student_academic_history) 수정
ALTER TABLE public.student_academic_history 
DROP CONSTRAINT IF EXISTS student_academic_history_student_id_fkey;

ALTER TABLE public.student_academic_history
ADD CONSTRAINT student_academic_history_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 3. RLS 정책 재확인 (상담 기록)
ALTER TABLE public.student_counseling_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.student_counseling_logs;
CREATE POLICY "Enable all for authenticated users" ON public.student_counseling_logs 
    FOR ALL 
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON CONSTRAINT student_counseling_logs_student_id_fkey ON public.student_counseling_logs IS '학생 마스터 테이블(students)의 UUID 참조';
