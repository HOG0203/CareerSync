-- [데이터 삭제 무결성 및 연쇄 삭제 강화 SQL]
-- 학생 본체 삭제 시 모든 연관 데이터(이력, 상담)가 자동 삭제되도록 제약 조건을 정비합니다.

-- 1. 학적 이력 테이블 외래키 재설정
ALTER TABLE public.student_academic_history 
DROP CONSTRAINT IF EXISTS student_academic_history_student_id_fkey,
ADD CONSTRAINT student_academic_history_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.student_employments(id) 
    ON DELETE CASCADE;

-- 2. 상담 기록 테이블 외래키 재설정
ALTER TABLE public.student_counseling_logs 
DROP CONSTRAINT IF EXISTS student_counseling_logs_student_id_fkey,
ADD CONSTRAINT student_counseling_logs_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.student_employments(id) 
    ON DELETE CASCADE;

COMMENT ON TABLE public.student_academic_history IS '학생 삭제 시 자동으로 연쇄 삭제되는 학적 이력 테이블';
COMMENT ON TABLE public.student_counseling_logs IS '학생 삭제 시 자동으로 연쇄 삭제되는 상담 기록 테이블';
