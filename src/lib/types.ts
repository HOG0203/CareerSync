export type StudentEmploymentData = {
  id: string;
  student_id: string;
  student_name: string;
  graduation_year?: number;
  major?: string;
  class_info?: string;
  student_number?: string;
  is_desiring_employment?: string;
  employment_status?: string;
  company_type?: string;
  business_type?: string;
  company?: string;
  has_field_training?: string;
  latest_training_company?: string;
  start_date?: string;
  end_date?: string;
  training_stipend_status?: string;
  is_hiring_conversion?: string;
  conversion_date?: string;
  is_returned?: string;
  return_to_school_reason?: string;
  remarks?: string;
  certificates?: string[];
  career_aspiration?: string;
  military_status?: string;
  shoe_size?: string;
  top_size?: string;
  personal_remarks?: string;
  career_course?: string;
  labor_education_status?: string;
};

export type FieldTrainingRecord = {
  id: string;
  student_id: string;
  training_order: number;
  company: string;
  start_date?: string;
  end_date?: string;
  stipend_status?: 'O' | 'X';
  hiring_status?: '진행중' | '채용전환' | '복교';
  conversion_date?: string;
  return_reason?: string;
  updated_at?: string;
};

export const MAJOR_SORT_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '자동차기계과',
  '스마트공간과',
  '건설과',
  '스마트공간건축과',
  '스마트전기과',
  '전기과',
  '바이오화학과',
  '스마트융합섬유과',
  '섬유소재과',
];
