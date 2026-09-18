-- ==============================================================================
-- 옥저인재인증제 등급별 상품 및 인증상 수령 대장 RDB 테이블
-- ==============================================================================

-- 1. 신규 테이블 생성 (학생별 수령 이력 영구 보존 및 스냅샷 지원)
CREATE TABLE IF NOT EXISTS public.student_cert_rewards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reward_type     TEXT        NOT NULL CHECK (reward_type IN ('prize', 'certificate_award')),
  academic_year   INTEGER     NOT NULL,
  semester        INTEGER     NOT NULL CHECK (semester IN (1, 2)),
  certified_score NUMERIC(5, 1) NOT NULL,
  certified_rank  TEXT        NOT NULL,
  item_name       TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'awarded' CHECK (status IN ('awarded', 'cancelled')),
  awarded_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  awarded_by      TEXT,
  remarks         TEXT,
  snapshot_data   JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_cert_rewards_student ON public.student_cert_rewards(student_id);
CREATE INDEX IF NOT EXISTS idx_cert_rewards_year_sem ON public.student_cert_rewards(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_cert_rewards_type ON public.student_cert_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_cert_rewards_status ON public.student_cert_rewards(status);

-- 3. RLS (Row Level Security) 설정
ALTER TABLE public.student_cert_rewards ENABLE ROW LEVEL SECURITY;

-- 관리자: 모든 권한 (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "admin_cert_rewards_all" ON public.student_cert_rewards;
CREATE POLICY "admin_cert_rewards_all" ON public.student_cert_rewards
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 교사: 조회 및 등록/수정 권한
DROP POLICY IF EXISTS "teacher_cert_rewards_all" ON public.student_cert_rewards;
CREATE POLICY "teacher_cert_rewards_all" ON public.student_cert_rewards
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

-- 학생: 본인 수령 이력 조회 권한
DROP POLICY IF EXISTS "student_cert_rewards_select" ON public.student_cert_rewards;
CREATE POLICY "student_cert_rewards_select" ON public.student_cert_rewards
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- 4. 기존 system_settings.certification_rewards_store 데이터 마이그레이션 (존재할 경우)
DO $$
DECLARE
  store_json JSONB;
  reward_row JSONB;
  migrated_count INTEGER := 0;
BEGIN
  SELECT value INTO store_json
  FROM public.system_settings
  WHERE key = 'certification_rewards_store'
  LIMIT 1;

  IF store_json IS NULL THEN
    RAISE NOTICE '기존 상품 수령 데이터(certification_rewards_store) 없음 — 마이그레이션 생략';
    RETURN;
  END IF;

  FOR reward_row IN SELECT * FROM jsonb_array_elements(store_json) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = (reward_row->>'student_id')::UUID) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.student_cert_rewards (
      id,
      student_id,
      reward_type,
      academic_year,
      semester,
      certified_score,
      certified_rank,
      item_name,
      status,
      awarded_date,
      awarded_by,
      remarks,
      snapshot_data,
      created_at,
      updated_at
    )
    VALUES (
      COALESCE((reward_row->>'id')::UUID, gen_random_uuid()),
      (reward_row->>'student_id')::UUID,
      COALESCE(reward_row->>'reward_type', 'prize'),
      COALESCE((reward_row->>'academic_year')::INTEGER, 2026),
      COALESCE((reward_row->>'semester')::INTEGER, 1),
      COALESCE((reward_row->>'certified_score')::NUMERIC, 0),
      COALESCE(reward_row->>'certified_rank', 'D'),
      COALESCE(reward_row->>'item_name', '상품'),
      COALESCE(reward_row->>'status', 'awarded'),
      COALESCE((reward_row->>'awarded_date')::DATE, CURRENT_DATE),
      reward_row->>'awarded_by',
      reward_row->>'remarks',
      COALESCE(reward_row->'snapshot_data', '{}'::JSONB),
      COALESCE((reward_row->>'created_at')::TIMESTAMPTZ, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    migrated_count := migrated_count + 1;
  END LOOP;

  RAISE NOTICE '상품 수령 데이터 마이그레이션 완료: 총 % 건 이관됨', migrated_count;
END;
$$;
