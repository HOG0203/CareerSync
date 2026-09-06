-- ==============================================================================
-- 옥저인재인증제 전용 RDB 테이블 생성 및 기존 데이터 마이그레이션
-- ==============================================================================

-- 1. 신규 테이블 생성 (학생 1명당 1행, 외래키 연쇄삭제 지원)
CREATE TABLE IF NOT EXISTS public.student_cert_evaluations (
  student_id              UUID        PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year           INTEGER     NOT NULL,
  vocational_details      JSONB       NOT NULL DEFAULT '{}',
  vocational_grade_1      INTEGER,
  vocational_grade_2      INTEGER,
  vocational_grade_3      INTEGER,
  vocational_mock_grade   INTEGER,
  volunteer_school_hours  NUMERIC     NOT NULL DEFAULT 0,
  volunteer_outside_hours NUMERIC     NOT NULL DEFAULT 0,
  volunteer_meta          JSONB,
  employment_details      JSONB       NOT NULL DEFAULT '{}',
  arts_contest_details    JSONB       NOT NULL DEFAULT '{}',
  manual_overrides        JSONB,
  created_by              JSONB,
  updated_by              JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_cert_eval_academic_year ON public.student_cert_evaluations(academic_year);

-- 3. RLS (Row Level Security) 설정
ALTER TABLE public.student_cert_evaluations ENABLE ROW LEVEL SECURITY;

-- 관리자: 모든 권한 (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "admin_cert_eval_all" ON public.student_cert_evaluations;
CREATE POLICY "admin_cert_eval_all" ON public.student_cert_evaluations
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 교사: 조회 및 등록/수정 권한
DROP POLICY IF EXISTS "teacher_cert_eval_all" ON public.student_cert_evaluations;
CREATE POLICY "teacher_cert_eval_all" ON public.student_cert_evaluations
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

-- 4. 기존 system_settings.certification_evaluations_store 데이터 마이그레이션
DO $$
DECLARE
  store_json JSONB;
  student_id_text TEXT;
  student_uuid UUID;
  rec_json JSONB;
  migrated_count INTEGER := 0;
  base_year INTEGER := 2026;
BEGIN
  -- 1) 기존 JSON 블롭 로드
  SELECT value INTO store_json
  FROM public.system_settings
  WHERE key = 'certification_evaluations_store'
  LIMIT 1;

  IF store_json IS NULL THEN
    RAISE NOTICE '기존 인증제 평가 데이터(certification_evaluations_store) 없음 — 마이그레이션 생략';
    RETURN;
  END IF;

  -- 2) 학생별 JSON 순회 및 신규 테이블에 UPSERT
  FOR student_id_text IN SELECT jsonb_object_keys(store_json) LOOP
    BEGIN
      student_uuid := student_id_text::UUID;
    EXCEPTION WHEN OTHERS THEN
      -- UUID 형식이 아닌 키는 건너뜀
      CONTINUE;
    END;

    -- 학생 테이블에 실제로 존재하는 학생만 이관 (외래키 무결성 보장)
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = student_uuid) THEN
      CONTINUE;
    END IF;

    rec_json := store_json -> student_id_text;

    INSERT INTO public.student_cert_evaluations (
      student_id,
      academic_year,
      vocational_details,
      vocational_grade_1,
      vocational_grade_2,
      vocational_grade_3,
      vocational_mock_grade,
      volunteer_school_hours,
      volunteer_outside_hours,
      volunteer_meta,
      employment_details,
      arts_contest_details,
      manual_overrides,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (
      student_uuid,
      COALESCE((rec_json->>'academic_year')::INTEGER, base_year),
      COALESCE(rec_json->'vocational_details', '{}'::JSONB),
      (rec_json->>'vocational_grade_1')::INTEGER,
      (rec_json->>'vocational_grade_2')::INTEGER,
      (rec_json->>'vocational_grade_3')::INTEGER,
      (rec_json->>'vocational_mock_grade')::INTEGER,
      COALESCE((rec_json->>'volunteer_school_hours')::NUMERIC, 0),
      COALESCE((rec_json->>'volunteer_outside_hours')::NUMERIC, 0),
      rec_json->'volunteer_meta',
      COALESCE(rec_json->'employment_details', '{}'::JSONB),
      COALESCE(rec_json->'arts_contest_details', '{}'::JSONB),
      rec_json->'manual_overrides',
      rec_json->'created_by',
      rec_json->'updated_by',
      COALESCE((rec_json->'created_by'->>'at')::TIMESTAMPTZ, NOW()),
      NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
      vocational_details      = EXCLUDED.vocational_details,
      vocational_grade_1      = EXCLUDED.vocational_grade_1,
      vocational_grade_2      = EXCLUDED.vocational_grade_2,
      vocational_grade_3      = EXCLUDED.vocational_grade_3,
      vocational_mock_grade   = EXCLUDED.vocational_mock_grade,
      volunteer_school_hours  = EXCLUDED.volunteer_school_hours,
      volunteer_outside_hours = EXCLUDED.volunteer_outside_hours,
      volunteer_meta          = EXCLUDED.volunteer_meta,
      employment_details      = EXCLUDED.employment_details,
      arts_contest_details    = EXCLUDED.arts_contest_details,
      manual_overrides        = EXCLUDED.manual_overrides,
      updated_by              = EXCLUDED.updated_by,
      updated_at              = NOW();

    migrated_count := migrated_count + 1;
  END LOOP;

  RAISE NOTICE '인증제 평가 데이터 마이그레이션 완료: 총 % 명 이관됨', migrated_count;
END;
$$;
