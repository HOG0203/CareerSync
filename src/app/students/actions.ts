'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions'

const normalizeDate = (dateStr: string | null | undefined): string | null => {
  if (!dateStr || dateStr.trim() === '') return null
  const match = dateStr.trim().match(/^[\d.\-\/]+/)
  if (!match) return null
  let datePart = match[0]
  let clean = datePart.replace(/[.\/]$/, '').replace(/[.\/]/g, '-')
  const parts = clean.split('-').filter(p => p !== '')
  if (parts.length === 3) {
    let year = parts[0]
    const month = parts[1].padStart(2, '0')
    const day = parts[2].padStart(2, '0')
    if (year.length === 2) year = '20' + year
    return `${year}-${month}-${day}`
  }
  return null
}

const BASIC_INFO_FIELDS = [
  'student_id', 'student_name', 'graduation_year', 'major', 'class_info', 
  'student_number', 'shoe_size', 'top_size', 'personal_remarks', 'certificates',
  'career_aspiration', 'military_status', 'special_notes', 'career_course', 'labor_education_status'
];

/**
 * 학적 이력 동기화
 */
async function syncAcademicHistory(supabase: any, studentUuid: string, info: any, targetAcademicYear?: number) {
  const settings = targetAcademicYear ? { baseYear: targetAcademicYear } : await getSystemSettings()
  const gradYear = info.graduation_year
  if (!gradYear) return

  const diff = gradYear - settings.baseYear;
  const grade = diff === 1 ? 3 : 
                diff === 2 ? 2 : 
                diff === 3 ? 1 : null;

  if (!grade) return;

  await supabase
    .from('student_academic_history')
    .upsert({
      student_id: studentUuid,
      grade,
      academic_year: settings.baseYear,
      major: info.major,
      class_info: info.class_info,
      student_number: info.student_number
    }, { onConflict: 'student_id, grade' })
}

async function getNextStudentId(supabase: any, graduationYear: number): Promise<string> {
  const yearPrefix = graduationYear.toString().slice(-2);
  const { data } = await supabase.from('students').select('student_id').ilike('student_id', `${yearPrefix}%`).order('student_id', { ascending: false }).limit(1);
  let nextSequence = 1;
  if (data && data.length > 0) {
    const lastId = data[0].student_id;
    const lastSequence = parseInt(lastId.slice(2));
    if (!isNaN(lastSequence)) nextSequence = lastSequence + 1;
  }
  return `${yearPrefix}${nextSequence.toString().padStart(3, '0')}`;
}

export async function uploadStudentsCSV(csvData: string) {
  const supabase = await createClient()
  const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== '')
  const dataRows = rows.slice(1)
  const settings = await getSystemSettings()

  for (const row of dataRows) {
    const values = row.split(',').map(v => {
      const trimmed = v.trim().replace(/^"|"$/g, '')
      return trimmed === '' ? null : trimmed 
    })
    const graduation_year = values[1] ? parseInt(values[1]) : null
    if (!graduation_year) continue
    const student_id = values[0] || await getNextStudentId(supabase, graduation_year)
    const { data: student, error: sError } = await supabase.from('students').upsert({
      student_id, graduation_year, major: values[2], class_info: values[3], student_number: values[4], student_name: values[5],
      career_aspiration: values[6], special_notes: values[7], career_course: values[8],
      certificates: values[14] ? values[14].split(';').map(c => c.trim()) : [],
      military_status: values[15], shoe_size: values[16], top_size: values[17], personal_remarks: values[28]
    }, { onConflict: 'student_id' }).select('id, graduation_year, major, class_info, student_number').single()
    if (sError || !student) continue;
    await supabase.from('student_employments').upsert({ id: student.id, is_desiring_employment: values[9] || '예', business_type: values[10] || '아니오', employment_status: values[11], company_type: values[12], company: values[13], remarks: values[27] }, { onConflict: 'id' })
    const startDate = normalizeDate(values[20]);
    const endDate = normalizeDate(values[21]);
    if (startDate || endDate) {
      await supabase.from('field_training_records').upsert({
        student_id: student.id, training_order: 1, company: values[19] || values[13] || '미지정', start_date: startDate, end_date: endDate, stipend_status: values[22] || 'X',
        hiring_status: values[23] === 'O' || values[23] === '예' || values[23] === '채용전환' ? '채용전환' : (values[25] === 'O' || values[25] === '예' || values[25] === '복교' ? '복교' : '진행중'),
        conversion_date: normalizeDate(values[24]), return_reason: values[26]
      }, { onConflict: 'student_id, training_order' })
    }
    await syncAcademicHistory(supabase, student.id, student, settings.baseYear)
  }
  revalidatePath('/students'); revalidatePath('/admin/students');
  return { success: true, count: dataRows.length }
}

export async function updateStudentField(id: string, field: string, value: any) {
  const supabase = await createClient(); const settings = await getSystemSettings()
  let finalValue = value;
  if (field === 'graduation_year') finalValue = value ? parseInt(value) : null;
  else if (value === '' || value === 'CLEARED' || (Array.isArray(value) && value.length === 0)) finalValue = null;
  const isBasicField = BASIC_INFO_FIELDS.includes(field);
  const { error } = await supabase.from(isBasicField ? 'students' : 'student_employments').update({ [field]: finalValue, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message };
  if (['major', 'class_info', 'student_number', 'graduation_year'].includes(field)) {
    const { data: student } = await supabase.from('students').select('*').eq('id', id).single();
    if (student) await syncAcademicHistory(supabase, id, student, settings.baseYear);
  }
  revalidatePath('/students'); revalidatePath('/admin/students'); revalidatePath('/class-management');
  return { success: true }
}

export async function bulkUpdateStudentData(updates: { id: string, field: string, value: any }[]) {
  const supabase = await createClient(); const settings = await getSystemSettings()
  for (const update of updates) {
    let fv = update.value;
    if (update.field === 'graduation_year') fv = update.value ? parseInt(update.value) : null;
    else if (update.value === '' || update.value === 'CLEARED' || (Array.isArray(update.value) && update.value.length === 0)) fv = null;
    await supabase.from(BASIC_INFO_FIELDS.includes(update.field) ? 'students' : 'student_employments').update({ [update.field]: fv, updated_at: new Date().toISOString() }).eq('id', update.id);
  }
  revalidatePath('/students'); revalidatePath('/admin/students'); revalidatePath('/class-management');
  return { success: true }
}

export async function createStudent(data: { graduation_year: number, major: string, class_info: string, student_number: string, student_name: string }) {
  const supabase = await createClient(); const settings = await getSystemSettings(); const student_id = await getNextStudentId(supabase, data.graduation_year)
  const { data: newStudent, error } = await supabase.from('students').insert([{ ...data, student_id }]).select().single()
  if (error || !newStudent) return { error: error?.message }
  await supabase.from('student_employments').insert([{ id: newStudent.id }])
  await syncAcademicHistory(supabase, newStudent.id, newStudent, settings.baseYear)
  revalidatePath('/admin/students'); revalidatePath('/students'); revalidatePath('/class-management');
  return { success: true }
}

export async function deleteStudents(ids: string[]) {
  const supabase = await createClient()
  await supabase.from('student_employments').delete().in('id', ids)
  const { error } = await supabase.from('students').delete().in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/admin/students'); revalidatePath('/students'); revalidatePath('/class-management');
  return { success: true }
}

export async function upsertFieldTrainingRecord(record: any) {
  const supabase = await createClient(); const { id, ...data } = record
  const sanitized = { ...data, start_date: data.start_date || null, end_date: data.end_date || null, conversion_date: data.conversion_date || null }
  const { data: upserted, error } = await supabase.from('field_training_records').upsert({ ...(id ? { id } : {}), ...sanitized, updated_at: new Date().toISOString() }).select().single()
  if (error) return { error: error.message }
  if (data.hiring_status === '채용전환') await supabase.from('student_employments').upsert({ id: data.student_id, company: data.company, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  revalidatePath('/students'); return { success: true, data: upserted }
}

export async function deleteFieldTrainingRecord(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('field_training_records').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/students'); return { success: true }
}

/**
 * [복구] 특정 학생의 모든 성적 데이터를 가져옵니다.
 */
export async function getStudentScoresById(studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('student_scores')
    .select('*')
    .eq('student_id', studentId)
    .order('academic_year', { ascending: false })
    .order('grade', { ascending: false })
    .order('semester', { ascending: false });

  if (error) {
    console.error('Error fetching student scores:', error);
    return [];
  }
  return data;
}

/**
 * [복구] 특정 학생의 석차 요약 정보를 계산합니다.
 */
export async function getStudentRankSummary(studentId: string, graduationYear: number) {
  const supabase = await createClient();
  
  // 1. 해당 졸업연도 전체 요약 정보 활용 (lib/data.ts 함수 호출)
  const { getYearlyRankingsSummary } = await import('@/lib/data');
  const rankings = await getYearlyRankingsSummary(graduationYear);
  
  return rankings[studentId] || null;
}
