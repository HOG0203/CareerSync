'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSystemSettings } from '../admin/settings/actions'

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
  'student_number', 'shoe_size', 'top_size', 'personal_remarks', 'certificates'
];

/**
 * 학적 이력 동기화
 * 학년 계산 공식: Grade = 4 - (GraduationYear - AcademicYear)
 */
async function syncAcademicHistory(supabase: any, studentUuid: string, info: any, targetAcademicYear?: number) {
  const settings = targetAcademicYear ? { baseYear: targetAcademicYear } : await getSystemSettings()
  const gradYear = info.graduation_year
  if (!gradYear) return

  // 공식: 4 - (졸업연도 - 학사학년도)
  // 예: 2027(GY) 졸업생의 2026(AY) 학년은? 4 - (2027 - 2026) = 3학년
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

    // 1. students 테이블 UPSERT
    const { data: student, error: sError } = await supabase
      .from('students')
      .upsert({
        student_id,
        graduation_year,
        major: values[2],
        class_info: values[3],
        student_number: values[4],
        student_name: values[5]
      }, { onConflict: 'student_id' })
      .select('id, graduation_year, major, class_info, student_number')
      .single()

    if (sError || !student) continue;

    // 2. student_employments 테이블 UPSERT
    await supabase.from('student_employments').upsert({
      id: student.id,
      is_desiring_employment: values[6] || '예',
      employment_status: values[7],
      company_type: values[8],
      business_type: values[9],
      company: values[10],
      has_field_training: values[11] || 'X',
      start_date: normalizeDate(values[12]),
      end_date: normalizeDate(values[13]),
      training_stipend_status: values[14] || 'X',
      is_hiring_conversion: values[15] || 'X',
      conversion_date: normalizeDate(values[16]),
      is_returned: values[17] || 'X',
      return_to_school_reason: values[18],
      remarks: values[19]
    }, { onConflict: 'id' })

    // 3. 이력 동기화 (현재 시스템 학사학년도 기준으로 기록)
    await syncAcademicHistory(supabase, student.id, student, settings.baseYear)
  }

  revalidatePath('/students')
  revalidatePath('/admin/students')
  return { success: true, count: dataRows.length }
}

export async function updateStudentField(id: string, field: string, value: any) {
  const supabase = await createClient()
  const finalValue = (field === 'graduation_year') ? (value ? parseInt(value) : null) : (value === '' ? null : value)
  const settings = await getSystemSettings()

  const isBasicField = BASIC_INFO_FIELDS.includes(field);
  const targetTable = isBasicField ? 'students' : 'student_employments';

  const { error } = await supabase
    .from(targetTable)
    .upsert({ 
      id: id,
      [field]: finalValue,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

  if (error) return { error: error.message }

  // 소속 정보 변경 시 이력 동기화 (현재 시스템 학사학년도 기준)
  if (['major', 'class_info', 'student_number', 'graduation_year'].includes(field)) {
    const { data: student } = await supabase.from('students').select('*').eq('id', id).single();
    if (student) await syncAcademicHistory(supabase, id, student, settings.baseYear);
  }

  return { success: true }
}

export async function bulkUpdateStudentData(updates: { id: string, field: string, value: any }[]) {
  const supabase = await createClient()
  const settings = await getSystemSettings()
  
  for (const update of updates) {
    const finalValue = (update.field === 'graduation_year') ? (update.value ? parseInt(update.value) : null) : (update.value === '' ? null : update.value)
    const isBasicField = BASIC_INFO_FIELDS.includes(update.field);
    const targetTable = isBasicField ? 'students' : 'student_employments';

    await supabase.from(targetTable).upsert({
      id: update.id,
      [update.field]: finalValue,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  }

  const criticalFields = ['major', 'class_info', 'student_number', 'graduation_year']
  if (updates.some(u => criticalFields.includes(u.field))) {
    const studentIds = Array.from(new Set(updates.map(u => u.id)))
    for (const sid of studentIds) {
      const { data: student } = await supabase.from('students').select('*').eq('id', sid).single();
      if (student) await syncAcademicHistory(supabase, sid, student, settings.baseYear);
    }
  }

  revalidatePath('/students')
  revalidatePath('/admin/students')
  return { success: true }
}

export async function createStudent(data: {
  graduation_year: number,
  major: string,
  class_info: string,
  student_number: string,
  student_name: string
}) {
  const supabase = await createClient()
  const settings = await getSystemSettings()
  const student_id = await getNextStudentId(supabase, data.graduation_year)

  const { data: newStudent, error: sError } = await supabase
    .from('students')
    .insert([{ ...data, student_id }])
    .select().single()

  if (sError || !newStudent) return { error: sError?.message }

  await supabase.from('student_employments').insert([{ id: newStudent.id }])
  // 현재 시스템 학사학년도 기준으로 이력 생성
  await syncAcademicHistory(supabase, newStudent.id, newStudent, settings.baseYear)

  revalidatePath('/admin/students')
  revalidatePath('/students')
  revalidatePath('/class-management')
  return { success: true }
}

export async function deleteStudents(ids: string[]) {
  const supabase = await createClient()
  await supabase.from('student_employments').delete().in('id', ids)
  const { error } = await supabase.from('students').delete().in('id', ids)
  if (error) return { error: error.message }

  revalidatePath('/admin/students')
  revalidatePath('/students')
  revalidatePath('/class-management')
  return { success: true }
}
