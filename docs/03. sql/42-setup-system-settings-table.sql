-- 시스템 설정을 위한 테이블 생성
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 삽입 (기준년도)
INSERT INTO system_settings (key, value)
VALUES ('base_year', '{"year": 2026}')
ON CONFLICT (key) DO NOTHING;

-- 마스터 자격증 목록을 위한 테이블 생성
CREATE TABLE IF NOT EXISTS master_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    levels JSONB DEFAULT '[]'::jsonb, -- 급수 목록 추가
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 자격증 데이터 삽입
INSERT INTO master_certificates (name, levels)
VALUES 
    ('컴퓨터활용능력', '["1급", "2급"]'),
    ('전기기능사', '[]'),
    ('승강기기능사', '[]')
ON CONFLICT (name) DO NOTHING;

-- RLS 설정
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_certificates ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 읽기 가능
CREATE POLICY "Anyone can view system settings"
ON system_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can view master certificates"
ON master_certificates FOR SELECT
TO authenticated
USING (true);

-- 관리자만 수정 가능 (role = 'admin')
CREATE POLICY "Admins can update system settings"
ON system_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admins can manage master certificates"
ON master_certificates FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);
