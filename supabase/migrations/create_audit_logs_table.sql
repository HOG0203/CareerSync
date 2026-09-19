-- ==============================================================================
-- 1. 감사 로그(Audit Logs) 및 활동 이력 전용 고속 RDB 테이블 생성
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          TEXT        PRIMARY KEY,
  actor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name  TEXT        NOT NULL,
  action_type TEXT        NOT NULL,
  target_name TEXT        NOT NULL,
  details     JSONB       DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 성능 최적화 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

-- RLS (Row Level Security) 설정
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 관리자(admin): 전체 조회 및 생성 권한
DROP POLICY IF EXISTS "admin_audit_logs_all" ON public.audit_logs;
CREATE POLICY "admin_audit_logs_all" ON public.audit_logs
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 모든 인증된 사용자: 본인 활동 로그 INSERT 권한 (PAGE_VIEW 등)
DROP POLICY IF EXISTS "authenticated_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "authenticated_insert_audit_logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ==============================================================================
-- 2. 기존 system_settings.audit_logs_store (285KB JSON) 데이터 안전 이관 (1회성)
-- ==============================================================================

DO $$
DECLARE
  store_json JSONB;
  log_row JSONB;
  migrated_count INTEGER := 0;
BEGIN
  SELECT value->'logs' INTO store_json
  FROM public.system_settings
  WHERE key = 'audit_logs_store'
  LIMIT 1;

  IF store_json IS NULL OR jsonb_array_length(store_json) = 0 THEN
    RAISE NOTICE '기존 활동 로그 데이터(audit_logs_store) 없음 — 마이그레이션 생략';
    RETURN;
  END IF;

  FOR log_row IN SELECT * FROM jsonb_array_elements(store_json) LOOP
    INSERT INTO public.audit_logs (
      id,
      actor_id,
      actor_name,
      action_type,
      target_name,
      details,
      created_at
    )
    VALUES (
      COALESCE(log_row->>'id', 'audit_' || floor(random()*10000000)::text),
      (CASE 
        WHEN log_row->>'actor_id' IS NOT NULL AND log_row->>'actor_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN (log_row->>'actor_id')::UUID 
        ELSE NULL 
      END),
      COALESCE(log_row->>'actor_name', '시스템 관리자'),
      COALESCE(log_row->>'action_type', 'PAGE_VIEW'),
      COALESCE(log_row->>'target_name', '페이지 조회'),
      COALESCE(log_row->'details', '{}'::JSONB),
      COALESCE((log_row->>'created_at')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (id) DO NOTHING;

    migrated_count := migrated_count + 1;
  END LOOP;

  RAISE NOTICE '활동 로그 데이터 마이그레이션 완료: 총 % 건 이관됨', migrated_count;
END;
$$;
