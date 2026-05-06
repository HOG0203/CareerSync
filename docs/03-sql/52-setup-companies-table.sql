-- 52. 기업 상세 정보 관리를 위한 companies 테이블 생성
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- 기업체명 (연동 키)
  location TEXT,                      -- 소재지
  industry TEXT,                      -- 업종
  company_type TEXT,                  -- 기업형태
  job_description TEXT,               -- 직무
  salary TEXT,                        -- 급여
  bonus TEXT,                         -- 상여
  working_hours TEXT,                 -- 근무시간
  employment_type TEXT,               -- 고용형태
  welfare TEXT,                       -- 복리후생
  required_major TEXT,                -- 전공
  required_certificates TEXT,         -- 자격증
  etc TEXT,                           -- 기타
  strengths TEXT,                     -- 기업의 특장점
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 검색 성능 향상을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);

-- RLS 설정
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 조회 가능
CREATE POLICY "Allow authenticated users to view companies" ON public.companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- 관리자만 수정 가능
CREATE POLICY "Allow admins to manage companies" ON public.companies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
