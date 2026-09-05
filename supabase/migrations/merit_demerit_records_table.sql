-- 1. 새 테이블 생성
CREATE TABLE IF NOT EXISTS merit_demerit_records (
  id            TEXT        PRIMARY KEY,
  student_id    UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name  TEXT        NOT NULL DEFAULT '',
  student_number TEXT       NOT NULL DEFAULT '',
  major         TEXT        NOT NULL DEFAULT '',
  class_info    TEXT        NOT NULL DEFAULT '',
  grade         INTEGER     NOT NULL,
  academic_year INTEGER     NOT NULL,
  rule_id       TEXT        NOT NULL,
  rule_name     TEXT        NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('merit', 'demerit')),
  points        INTEGER     NOT NULL,
  date          DATE        NOT NULL,
  memo          TEXT                 DEFAULT '',
  granted_by    JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS merit_demerit_records_student_id_idx   ON merit_demerit_records(student_id);
CREATE INDEX IF NOT EXISTS merit_demerit_records_academic_year_idx ON merit_demerit_records(academic_year);

-- 3. RLS
ALTER TABLE merit_demerit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON merit_demerit_records
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "teacher_read_write" ON merit_demerit_records
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

-- 4. 기존 JSON 블롭 → 신규 테이블 데이터 마이그레이션
--    (system_settings.merit_demerit_records_store 에 기존 데이터가 있는 경우 실행)
DO $$
DECLARE
  store_json JSONB;
  student_id_key TEXT;
  record_arr JSONB;
  record_item JSONB;
BEGIN
  SELECT value INTO store_json
  FROM system_settings
  WHERE key = 'merit_demerit_records_store'
  LIMIT 1;

  IF store_json IS NULL THEN
    RAISE NOTICE '이전 상벌점 데이터 없음 — 마이그레이션 생략';
    RETURN;
  END IF;

  FOR student_id_key IN SELECT jsonb_object_keys(store_json) LOOP
    record_arr := store_json -> student_id_key;
    FOR record_item IN SELECT * FROM jsonb_array_elements(record_arr) LOOP
      INSERT INTO merit_demerit_records (
        id, student_id, student_name, student_number,
        major, class_info, grade, academic_year,
        rule_id, rule_name, type, points, date, memo,
        granted_by, created_at
      )
      VALUES (
        record_item->>'id',
        (record_item->>'student_id')::UUID,
        COALESCE(record_item->>'student_name', ''),
        COALESCE(record_item->>'student_number', ''),
        COALESCE(record_item->>'major', ''),
        COALESCE(record_item->>'class_info', ''),
        (record_item->>'grade')::INTEGER,
        (record_item->>'academic_year')::INTEGER,
        COALESCE(record_item->>'rule_id', ''),
        COALESCE(record_item->>'rule_name', ''),
        record_item->>'type',
        (record_item->>'points')::INTEGER,
        (record_item->>'date')::DATE,
        COALESCE(record_item->>'memo', ''),
        COALESCE(record_item->'granted_by', '{}'),
        COALESCE((record_item->>'created_at')::TIMESTAMPTZ, NOW())
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE '상벌점 데이터 마이그레이션 완료';
END;
$$;
