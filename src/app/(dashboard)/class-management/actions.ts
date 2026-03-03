'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSystemSettings } from '@/app/admin/settings/actions'

/**
 * 학적 이력 동기화 (내부 함수 - 학사학년도 공식 적용)
 */
async function syncAcademicHistory(studentUuid: string, info: any) {
  const supabase = await createClient()
  const settings = await getSystemSettings()
  
  // 학년 계산 공식: Grade = 4 - (GraduationYear - AcademicYear)
  const gradYear = info.graduation_year
  const diff = gradYear - settings.baseYear;
  const grade = diff === 1 ? 3 : 
                diff === 2 ? 2 : 
                diff === 3 ? 1 : null;

  if (!grade) return

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

/**
 * 학생 인적사항 개별 수정 (students 테이블 대상)
 */
export async function updatePersonalDetail(id: string, field: string, value: any) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('students')
    .update({ [field]: value === '' ? null : value })
    .eq('id', id)

  if (error) return { error: error.message }

  // 소속 정보 변경 시 이력 동기화
  if (['major', 'class_info', 'student_number'].includes(field)) {
    const { data: student } = await supabase.from('students').select('*').eq('id', id).single()
    if (student) await syncAcademicHistory(id, student)
  }

  revalidatePath('/class-management')
  return { success: true }
}

/**
 * 학생 인적사항 일괄 수정 (students 테이블 대상)
 */
export async function bulkUpdatePersonalDetails(updates: { id: string, field: string, value: any }[]) {
  const supabase = await createClient()

  for (const update of updates) {
    await supabase
      .from('students')
      .update({ [update.field]: update.value === '' ? null : update.value })
      .eq('id', update.id)
  }

  // 이력 동기화
  const studentIds = Array.from(new Set(updates.map(u => u.id)))
  for (const sid of studentIds) {
    const { data: student } = await supabase.from('students').select('*').eq('id', sid).single()
    if (student) await syncAcademicHistory(sid, student)
  }

  revalidatePath('/class-management')
  return { success: true }
}

/**
 * 학생 진급 처리 (students 테이블의 소속 정보 업데이트)
 */
export async function promoteStudents(updates: { 
  id: string, 
  next_major: string,
  next_class: string,
  next_number: string,
  student_name: string
}[]) {
  const supabase = await createClient()

  // 현재 학생들의 졸업연도 정보를 가져옵니다.
  const { data: students } = await supabase
    .from('students')
    .select('id, graduation_year')
    .in('id', updates.map(u => u.id))

  const updatePromises = updates.map(async (u) => {
    const student = students?.find(s => s.id === u.id)
    if (!student) return { error: 'Student not found' }

    // 1. 인적사항 업데이트
    const { error: updateError } = await supabase
      .from('students')
      .update({ 
        major: u.next_major,
        class_info: u.next_class,
        student_number: u.next_number
      })
      .eq('id', u.id)

    if (updateError) throw updateError;

    // 2. 신규 소속에 따른 학적 이력 기록
    await syncAcademicHistory(u.id, {
      major: u.next_major,
      class_info: u.next_class,
      student_number: u.next_number,
      graduation_year: student.graduation_year
    })

    return { success: true }
  })

  try {
    await Promise.all(updatePromises)
  } catch (error: any) {
    return { error: error.message }
  }

  revalidatePath('/class-management')
  revalidatePath('/students')
  revalidatePath('/admin/students')
  revalidatePath('/dashboard')
  
  return { success: true }
}

/**
 * 상담 내역 조회 (UUID 기준)
 */
export async function getCounselingLogs(studentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_counseling_logs')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Counseling logs fetch error:', error.message);
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

/**
 * 학적 이력 조회 (UUID 기준)
 */
export async function getAcademicHistory(studentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_academic_history')
    .select('*')
    .eq('student_id', studentId)
    .order('academic_year', { ascending: false })

  if (error) {
    console.error('Academic history fetch error:', error.message);
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

/**
 * 상담 일지 저장 (UUID 기준)
 */
export async function addCounselingLog(studentId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()

  const { error } = await supabase
    .from('student_counseling_logs')
    .insert({
      student_id: studentId,
      content,
      author_id: user.id,
      author_name: profile?.username || '알 수 없는 교사'
    })

  if (error) return { error: error.message }

  revalidatePath('/class-management')
  return { success: true }
}

/**
 * 상담 일지 수정
 */
export async function updateCounselingLog(logId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  const { data: log } = await supabase.from('student_counseling_logs').select('author_id').eq('id', logId).single()
  if (log?.author_id !== user.id) return { error: '본인이 작성한 상담 일지만 수정할 수 있습니다.' }

  const { error } = await supabase
    .from('student_counseling_logs')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', logId)

  if (error) return { error: error.message }

  revalidatePath('/class-management')
  return { success: true }
}

/**
 * 상담 일지 삭제
 */
export async function deleteCounselingLog(logId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증되지 않은 사용자입니다.' }

  const { data: log } = await supabase.from('student_counseling_logs').select('author_id').eq('id', logId).single()
  if (log?.author_id !== user.id) return { error: '본인이 작성한 상담 일지만 삭제할 수 있습니다.' }

  const { error } = await supabase
    .from('student_counseling_logs')
    .delete()
    .eq('id', logId)

  if (error) return { error: error.message }

  revalidatePath('/class-management')
  return { success: true }
}
