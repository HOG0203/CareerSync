/** Shared route policy. Certification is intentionally available to teachers. */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  if (!role || !['admin', 'teacher', 'staff', 'student'].includes(role)) return false;
  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  if (role === 'student') return under('/student');
  if (under('/admin') && !under('/admin/certification')) return role === 'admin';
  return true;
}

export const STUDENT_FIELDS = [
  'student_id', 'student_name', 'phone_number', 'graduation_year', 'major', 'class_info',
  'student_number', 'shoe_size', 'top_size', 'personal_remarks', 'certificates',
  'career_aspiration', 'military_status', 'special_notes', 'career_course', 'labor_education_status',
  'middle_school', 'admission_rank_percentile', 'admission_type', 'desired_work_area', 'parents_opinion',
];
export const TRAINING_FIELDS = [
  'latest_training_company', 'start_date', 'end_date', 'training_stipend_status',
  'is_hiring_conversion', 'is_returned', 'return_reason',
];
const EMPLOYMENT_FIELDS = ['is_desiring_employment', 'employment_status', 'company_type', 'business_type', 'company', 'remarks'];
const ADMIN_FIELDS = ['student_id', 'graduation_year', 'major', 'class_info', 'student_number', 'employment_status', 'career_course'];

export function canEditStudentField(role: string, field: string): boolean {
  if (![...STUDENT_FIELDS, ...TRAINING_FIELDS, ...EMPLOYMENT_FIELDS].includes(field)) return false;
  if (role === 'admin') return true;
  return role === 'teacher' && !ADMIN_FIELDS.includes(field) && !TRAINING_FIELDS.includes(field);
}

export function isAssignedStudent(
  profile: { role: string; assigned_grade?: number | null; assigned_major?: string | null; assigned_class?: string | null },
  student: { graduation_year?: number | null; major?: string | null; class_info?: string | null },
  baseYear: number,
): boolean {
  if (profile.role === 'admin') return true;
  return profile.role === 'teacher' && !!profile.assigned_grade && !!profile.assigned_major && !!profile.assigned_class
    && student.graduation_year === baseYear + 4 - profile.assigned_grade
    && student.major === profile.assigned_major && student.class_info === profile.assigned_class;
}
