'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
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
  'student_id', 'student_name', 'phone_number', 'graduation_year', 'major', 'class_info', 
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

  let teacherName = null;
  if (info.major && info.class_info) {
    const cleanMajor = info.major.replace(/과|공업계/g, '').trim();
    const cleanClass = info.class_info.replace(/반|학년/g, '').trim();
    
    const { data: teachers } = await supabase
      .from('profiles')
      .select('username, assigned_major, assigned_class, assigned_grade')
      .not('assigned_major', 'is', null);
      
    if (teachers) {
      const matchedTeacher = teachers.find((t: any) => {
        const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
        const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
        const tGrade = t.assigned_grade;
        return tMajor === cleanMajor && tClass === cleanClass && (tGrade ? tGrade === grade : true);
      });
      if (matchedTeacher) teacherName = matchedTeacher.username;
    }
  }

  await supabase
    .from('student_academic_history')
    .upsert({
      student_id: studentUuid,
      grade,
      academic_year: settings.baseYear,
      major: info.major,
      class_info: info.class_info,
      student_number: info.student_number,
      teacher_name: teacherName
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

export async function bulkPromoteFromExcel(csvData: string) {
  const supabase = await createClient()
  const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== '')
  const dataRows = rows.slice(1)
  const settings = await getSystemSettings()

  let successCount = 0;
  let errors = [];

  for (const row of dataRows) {
    const values = row.split(',').map(v => {
      const trimmed = v.trim().replace(/^"|"$/g, '')
      return trimmed === '' ? null : trimmed 
    })
    
    // 엑셀 서식: [0]학번, [1]성명, [2]기존학과, [3]기존반, [4]기존번호, [5]신규학과, [6]신규반, [7]신규번호
    const student_id = values[0];
    const next_major = values[5];
    const next_class = values[6];
    const next_number = values[7];

    if (!student_id || !next_major || !next_class || !next_number) continue;

    // 학생 조회
    const { data: student } = await supabase
      .from('students')
      .select('id, graduation_year')
      .eq('student_id', student_id)
      .single();

    if (!student) {
      errors.push(`${student_id} 학생을 찾을 수 없습니다.`);
      continue;
    }

    // 인적사항 업데이트
    const { error: updateError } = await supabase
      .from('students')
      .update({ 
        major: next_major,
        class_info: next_class,
        student_number: next_number,
        updated_at: new Date().toISOString()
      })
      .eq('id', student.id);

    if (!updateError) {
      successCount++;
      await syncAcademicHistory(supabase, student.id, {
        major: next_major,
        class_info: next_class,
        student_number: next_number,
        graduation_year: student.graduation_year
      }, settings.baseYear);
    } else {
      errors.push(`${student_id} 업데이트 실패: ${updateError.message}`);
    }
  }

  revalidatePath('/class-management')
  revalidatePath('/employment-status')
  revalidatePath('/students')
  revalidatePath('/admin/students')
  revalidatePath('/dashboard')
  
  return { success: true, count: successCount, errors: errors.length > 0 ? errors : null }
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
      phone_number: values[6],
      career_aspiration: values[7], special_notes: values[8], career_course: values[9],
      certificates: values[15] ? values[15].split(';').map(c => c.trim()) : [],
      military_status: values[16], shoe_size: values[17], top_size: values[18], personal_remarks: values[29]
    }, { onConflict: 'student_id' }).select('id, graduation_year, major, class_info, student_number').single()
    if (sError || !student) continue;
    await supabase.from('student_employments').upsert({ id: student.id, is_desiring_employment: values[10] || '예', business_type: values[11] || '아니오', employment_status: values[12], company_type: values[13], company: values[14], remarks: values[28] }, { onConflict: 'id' })
    const startDate = normalizeDate(values[21]);
    const endDate = normalizeDate(values[22]);
    if (startDate || endDate) {
      await supabase.from('field_training_records').upsert({
        student_id: student.id, training_order: 1, company: values[20] || values[14] || '미지정', start_date: startDate, end_date: endDate, stipend_status: values[23] || 'X',
        hiring_status: values[24] === 'O' || values[24] === '예' || values[24] === '채용전환' ? '채용전환' : (values[26] === 'O' || values[26] === '예' || values[26] === '복교' ? '복교' : '진행중'),
        conversion_date: normalizeDate(values[25]), return_reason: values[27]
      }, { onConflict: 'student_id, training_order' })
    }
    await syncAcademicHistory(supabase, student.id, student, settings.baseYear)
  }
  revalidatePath('/students'); revalidatePath('/admin/students');
  return { success: true, count: dataRows.length }
}

export async function updateStudentField(id: string, field: string, value: any) {
  const supabase = await createClient(); const settings = await getSystemSettings()

  // employment_status(현재진로코스) 변경은 관리자만 가능
  if (field === 'employment_status') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '로그인이 필요합니다.' };
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return { success: false, error: '현재진로코스는 관리자만 변경할 수 있습니다.' };
  }

  let finalValue = value;
  if (field === 'graduation_year') finalValue = value ? parseInt(value) : null;
  else if (value === '' || value === 'CLEARED' || (Array.isArray(value) && value.length === 0)) finalValue = null;
  const isBasicField = BASIC_INFO_FIELDS.includes(field);
  const targetTable = isBasicField ? 'students' : 'student_employments';

  // 변경 전 기존 값 및 학생 정보 조회
  const [{ data: oldRecord }, { data: studentInfo }] = await Promise.all([
    supabase.from(targetTable).select(field).eq('id', id).single(),
    supabase.from('students').select('student_name, student_number, class_info').eq('id', id).single()
  ]);

  const oldValue = oldRecord ? (oldRecord as any)[field] : null;
  const studentLabel = studentInfo ? `${studentInfo.student_name} (${studentInfo.class_info ? `${studentInfo.class_info}반 ` : ''}${studentInfo.student_number ? `${studentInfo.student_number}번` : ''})` : `학생 (ID: ${id})`;

  const { error } = await supabase.from(targetTable).update({ [field]: finalValue, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { success: false, error: error.message };
  
  if (['major', 'class_info', 'student_number', 'graduation_year'].includes(field)) {
    const { data: student } = await supabase.from('students').select('*').eq('id', id).single();
    if (student) await syncAcademicHistory(supabase, id, student, settings.baseYear);
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'STUDENT_UPDATE',
    target_name: `${studentLabel} - [${field}]`,
    details: { 
      student_id: id, 
      student_name: studentInfo?.student_name,
      field, 
      old_value: oldValue ?? '(빈값)', 
      new_value: finalValue ?? '(빈값)' 
    }
  });

  revalidateTag('students');
  revalidatePath('/students'); 
  revalidatePath('/admin/students'); 
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/labor-education');
  revalidatePath('/dashboard');
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

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'STUDENT_BULK_UPDATE',
    target_name: `학생 데이터 ${updates.length}건 일괄 수정`,
    details: { count: updates.length }
  });

  revalidateTag('students');
  revalidatePath('/students'); 
  revalidatePath('/admin/students'); 
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/labor-education');
  revalidatePath('/dashboard');
  return { success: true }
}

export async function createStudent(data: { graduation_year: number, major: string, class_info: string, student_number: string, student_name: string }) {
  const supabase = await createClient(); const settings = await getSystemSettings(); const student_id = await getNextStudentId(supabase, data.graduation_year)
  const { data: newStudent, error } = await supabase.from('students').insert([{ ...data, student_id }]).select().single()
  if (error || !newStudent) return { error: error?.message }
  await supabase.from('student_employments').insert([{ id: newStudent.id }])
  await syncAcademicHistory(supabase, newStudent.id, newStudent, settings.baseYear)
  revalidatePath('/admin/students'); 
  revalidatePath('/students'); 
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/labor-education');
  revalidatePath('/dashboard');
  return { success: true }
}

export async function deleteStudents(ids: string[]) {
  const supabase = await createClient()
  await supabase.from('student_employments').delete().in('id', ids)
  const { error } = await supabase.from('students').delete().in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/admin/students'); 
  revalidatePath('/students'); 
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/labor-education');
  revalidatePath('/dashboard');
  return { success: true }
}

import { getCurrentUserProfile } from '@/lib/data'

export async function upsertFieldTrainingRecord(record: any) {
  const profile = await getCurrentUserProfile()
  if (profile?.role !== 'admin') {
    return { error: '현장실습 이력 입력 및 수정은 관리자 권한이 필요합니다.' }
  }

  const supabase = await createClient(); const { id, ...data } = record
  const sanitized = { ...data, start_date: data.start_date || null, end_date: data.end_date || null, conversion_date: data.conversion_date || null }
  const { data: upserted, error } = await supabase.from('field_training_records').upsert({ ...(id ? { id } : {}), ...sanitized, updated_at: new Date().toISOString() }).select().single()
  if (error) return { error: error.message }
  if (data.hiring_status === '채용전환') await supabase.from('student_employments').upsert({ id: data.student_id, company: data.company, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  revalidateTag('students');
  revalidatePath('/field-training');
  revalidatePath('/students');
  revalidatePath('/class-management');
  revalidatePath('/company-info');
  revalidatePath('/employment-status');
  return { success: true, data: upserted }
}

export async function deleteFieldTrainingRecord(id: string) {
  const profile = await getCurrentUserProfile()
  if (profile?.role !== 'admin') {
    return { error: '현장실습 이력 삭제는 관리자 권한이 필요합니다.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('field_training_records').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateTag('students');
  revalidatePath('/field-training');
  revalidatePath('/students');
  revalidatePath('/class-management');
  revalidatePath('/company-info');
  revalidatePath('/employment-status');
  return { success: true }
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
