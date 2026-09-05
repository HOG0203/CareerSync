-- student_academic_history 고유 제약 조건 수정
-- 기존: (student_id, grade) → 유급 학생의 이전 학년도 이력이 덮어써지는 버그
-- 변경: (student_id, academic_year) → 학년도별 1개 스냅샷 보장 (Time-Travel 정합성)

-- 1. 기존 제약 조건 삭제 (제약 이름이 다를 경우 아래 쿼리로 확인 후 교체)
--    SELECT constraint_name FROM information_schema.table_constraints
--    WHERE table_name = 'student_academic_history' AND constraint_type = 'UNIQUE';
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint
  FROM information_schema.table_constraints
  WHERE table_name = 'student_academic_history'
    AND constraint_type = 'UNIQUE'
    AND constraint_name ILIKE '%grade%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE student_academic_history DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped constraint: %', v_constraint;
  ELSE
    RAISE NOTICE '(student_id, grade) 단독 UNIQUE 제약 조건 없음 — 건너뜀';
  END IF;
END;
$$;

-- 2. 신규 제약 조건 추가: (student_id, academic_year)
ALTER TABLE student_academic_history
  ADD CONSTRAINT student_academic_history_student_id_academic_year_key
  UNIQUE (student_id, academic_year);
