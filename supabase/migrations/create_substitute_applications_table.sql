-- ==============================================================================
-- 결보강 및 수업교체(substitute_applications) 전용 RDB 테이블 생성 및 데이터 마이그레이션
-- ==============================================================================

-- 1. 신규 테이블 생성 (신청서 1건당 1행으로 분리)
CREATE TABLE IF NOT EXISTS public.substitute_applications (
  id                  TEXT        PRIMARY KEY,
  application_number  TEXT        NOT NULL DEFAULT '',
  academic_year       INTEGER     NOT NULL DEFAULT 2026,
  semester            INTEGER     NOT NULL DEFAULT 2,
  applicant_teacher   TEXT        NOT NULL DEFAULT '',
  reason              TEXT        NOT NULL DEFAULT '',
  period_start        TEXT        NOT NULL DEFAULT '',
  period_end          TEXT        NOT NULL DEFAULT '',
  application_date    TEXT        NOT NULL DEFAULT '',
  status              TEXT        NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  items               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  approved_by         TEXT
);

-- 2. 검색 및 필터링 성능 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_sub_apps_year_sem ON public.substitute_applications(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_sub_apps_teacher  ON public.substitute_applications(applicant_teacher);
CREATE INDEX IF NOT EXISTS idx_sub_apps_status   ON public.substitute_applications(status);
CREATE INDEX IF NOT EXISTS idx_sub_apps_created  ON public.substitute_applications(created_at DESC);

-- 3. RLS (Row Level Security) 설정
ALTER TABLE public.substitute_applications ENABLE ROW LEVEL SECURITY;

-- 관리자: 전체 읽기/쓰기/삭제 권한
DROP POLICY IF EXISTS "substitute_apps_admin_all" ON public.substitute_applications;
CREATE POLICY "substitute_apps_admin_all" ON public.substitute_applications
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 교사: 전체 신청서 조회 및 신청/수정 권한
DROP POLICY IF EXISTS "substitute_apps_teacher_all" ON public.substitute_applications;
CREATE POLICY "substitute_apps_teacher_all" ON public.substitute_applications
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

-- 4. 기존 system_settings 데이터 자동 마이그레이션
DO $$
DECLARE
  setting_row RECORD;
  app_arr JSONB;
  app_item JSONB;
  migrated_count INTEGER := 0;
BEGIN
  -- substitute_applications_% 패턴의 모든 학기별 JSON 키 순회
  FOR setting_row IN 
    SELECT key, value 
    FROM public.system_settings 
    WHERE key LIKE 'substitute_applications_%'
  LOOP
    app_arr := setting_row.value;
    IF jsonb_typeof(app_arr) = 'array' THEN
      FOR app_item IN SELECT * FROM jsonb_array_elements(app_arr) LOOP
        INSERT INTO public.substitute_applications (
          id,
          application_number,
          academic_year,
          semester,
          applicant_teacher,
          reason,
          period_start,
          period_end,
          application_date,
          status,
          items,
          created_at,
          updated_at,
          submitted_at,
          approved_at,
          approved_by
        )
        VALUES (
          app_item->>'id',
          COALESCE(app_item->>'applicationNumber', ''),
          COALESCE((app_item->>'academicYear')::INTEGER, 2026),
          COALESCE((app_item->>'semester')::INTEGER, 2),
          COALESCE(app_item->>'applicantTeacher', ''),
          COALESCE(app_item->>'reason', ''),
          COALESCE(app_item->>'periodStart', ''),
          COALESCE(app_item->>'periodEnd', ''),
          COALESCE(app_item->>'applicationDate', ''),
          COALESCE(app_item->>'status', 'submitted'),
          COALESCE(app_item->'items', '[]'::jsonb),
          COALESCE((app_item->>'createdAt')::TIMESTAMPTZ, NOW()),
          COALESCE((app_item->>'updatedAt')::TIMESTAMPTZ, NOW()),
          CASE WHEN app_item->>'submittedAt' IS NOT NULL THEN (app_item->>'submittedAt')::TIMESTAMPTZ ELSE NULL END,
          CASE WHEN app_item->>'approvedAt' IS NOT NULL THEN (app_item->>'approvedAt')::TIMESTAMPTZ ELSE NULL END,
          app_item->>'approvedBy'
        )
        ON CONFLICT (id) DO UPDATE SET
          application_number = EXCLUDED.application_number,
          academic_year      = EXCLUDED.academic_year,
          semester           = EXCLUDED.semester,
          applicant_teacher  = EXCLUDED.applicant_teacher,
          reason             = EXCLUDED.reason,
          period_start       = EXCLUDED.period_start,
          period_end         = EXCLUDED.period_end,
          application_date   = EXCLUDED.application_date,
          status             = EXCLUDED.status,
          items              = EXCLUDED.items,
          updated_at         = EXCLUDED.updated_at,
          submitted_at       = EXCLUDED.submitted_at,
          approved_at        = EXCLUDED.approved_at,
          approved_by        = EXCLUDED.approved_by;

        migrated_count := migrated_count + 1;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE '결보강 신청서 %건 마이그레이션 완료', migrated_count;
END;
$$;
