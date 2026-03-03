-- Create the student_employments table
CREATE TABLE student_employments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL UNIQUE,
  graduation_year INTEGER NOT NULL,
  major TEXT NOT NULL,
  employment_status TEXT NOT NULL CHECK (employment_status IN ('취업', '미취업', '구직중')),
  company TEXT,
  role TEXT,
  industry TEXT,
  start_date DATE,
  salary INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert mock data
INSERT INTO student_employments (student_id, graduation_year, major, employment_status, company, role, industry, start_date, salary) VALUES
('S001', 2022, '컴퓨터 과학', '취업', '테크코프', '소프트웨어 엔지니어', '기술', '2022-07-01', 95000),
('S002', 2022, '경영학', '취업', '파이낸스잉크', '재무 분석가', '금융', '2022-08-15', 80000),
('S003', 2023, '마케팅', '취업', '애드글로벌', '마케팅 코디네이터', '광고', '2023-06-20', 60000),
('S004', 2023, '컴퓨터 과학', '취업', '이노베이트IO', '프론트엔드 개발자', '기술', '2023-07-10', 98000),
('S005', 2022, '그래픽 디자인', '취업', '크리에이티브마인즈', 'UI/UX 디자이너', '디자인', '2022-09-01', 75000),
('S006', 2024, '데이터 과학', '구직중', '', '', '', NULL, 0),
('S007', 2023, '경영학', '취업', '컨설트코', '주니어 컨설턴트', '컨설팅', '2023-08-01', 82000),
('S008', 2024, '컴퓨터 과학', '취업', '웹위버스', '풀스택 개발자', '기술', '2024-06-15', 105000),
('S009', 2022, '마케팅', '취업', '마켓메이커스', '디지털 전략가', '마케팅', '2022-07-20', 65000),
('S010', 2023, '데이터 과학', '취업', '데이터드리븐', '데이터 분석가', '분석', '2023-09-01', 90000),
('S011', 2024, '그래픽 디자인', '취업', '픽셀퍼펙트', '그래픽 디자이너', '디자인', '2024-07-01', 78000),
('S012', 2022, '컴퓨터 과학', '취업', '시큐어소프트', '사이버 보안 분석가', '기술', '2022-08-01', 110000),
('S013', 2024, '경영학', '구직중', '', '', '', NULL, 0),
('S014', 2023, '컴퓨터 과학', '취업', '클라우드웍스', '클라우드 엔지니어', '기술', '2023-07-15', 115000),
('S015', 2024, '마케팅', '취업', '소셜스피어', '소셜 미디어 관리자', '마케팅', '2024-06-25', 62000),
('S016', 2022, '데이터 과학', '취업', 'AI 솔루션즈', '머신러닝 엔지니어', '기술', '2022-10-01', 120000),
('S017', 2023, '그래픽 디자인', '미취업', '', '', '', NULL, 0),
('S018', 2024, '컴퓨터 과학', '취업', '이노베이트IO', '데브옵스 엔지니어', '기술', '2024-07-01', 112000),
('S019', 2023, '경영학', '취업', '파이낸스잉크', '투자 은행 분석가', '금융', '2023-07-01', 95000),
('S020', 2024, '데이터 과학', '취업', '헬스애널리틱스', '의료 데이터 과학자', '의료', '2024-08-01', 98000),
('S021', 2022, '마케팅', '취업', '리테일자이언트', '전자상거래 전문가', '소매', '2022-06-15', 70000),
('S022', 2023, '컴퓨터 과학', '취업', '게임개발사', '게임 개발자', '게임', '2023-09-10', 89000),
('S023', 2024, '그래픽 디자인', '구직중', '', '', '', NULL, 0),
('S024', 2022, '경영학', '취업', 'HR 솔루션즈', '인사 담당자', '인사', '2022-07-01', 72000),
('S025', 2023, '데이터 과학', '취업', '에코트랙', '환경 데이터 분석가', '환경', '2023-10-01', 85000);

-- Enable Row Level Security (RLS)
ALTER TABLE student_employments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (modify as needed for production)
CREATE POLICY "Allow public read access" ON student_employments FOR SELECT USING (true);
