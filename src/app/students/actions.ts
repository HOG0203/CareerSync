'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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

import { parseCSVText } from '@/lib/student-utils';


export async function bulkPromoteFromExcel(csvData: string) {
  const supabase = await createClient()
  const parsedRows = parseCSVText(csvData);
  if (parsedRows.length <= 1) return { success: false, count: 0, errors: ['데이터 행이 없습니다.'] };
  
  const dataRows = parsedRows.slice(1);
  const settings = await getSystemSettings()

  let successCount = 0;
  let errors = [];

  for (const values of dataRows) {
    let student_id: string | null = null;
    let student_name: string | null = null;
    let prev_major: string | null = null;
    let prev_class: string | null = null;
    let prev_number: string | null = null;
    let next_major: string | null = null;
    let next_class: string | null = null;
    let next_number: string | null = null;

    if (values.length >= 8) {
      // 8컬럼 서식: [0]학번, [1]성명, [2]기존학과, [3]기존반, [4]기존번호, [5]신규학과, [6]신규반, [7]신규번호
      student_id = values[0];
      student_name = values[1];
      prev_major = values[2];
      prev_class = values[3];
      prev_number = values[4];
      next_major = values[5];
      next_class = values[6];
      next_number = values[7];
    } else {
      // 7컬럼 최신 서식: [0]성명, [1]기존학과, [2]기존반, [3]기존번호, [4]신규학과, [5]신규반, [6]신규번호
      student_name = values[0];
      prev_major = values[1];
      prev_class = values[2];
      prev_number = values[3];
      next_major = values[4];
      next_class = values[5];
      next_number = values[6];
    }

    if (!next_major || !next_class || !next_number) continue;

    // 학생 조회
    let student: any = null;

    if (student_id) {
      const { data } = await supabase
        .from('students')
        .select('id, graduation_year')
        .eq('student_id', student_id)
        .maybeSingle();
      student = data;
    }

    if (!student && prev_major && prev_class && prev_number) {
      const { data } = await supabase
        .from('students')
        .select('id, graduation_year')
        .eq('major', prev_major)
        .eq('class_info', prev_class)
        .eq('student_number', prev_number)
        .maybeSingle();
      student = data;
    }

    if (!student) {
      errors.push(`${student_name || student_id || '해당'} 학생을 찾을 수 없습니다.`);
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
      errors.push(`${student_name || student.id} 업데이트 실패: ${updateError.message}`);
    }
  }

  revalidateTag('students');
  revalidatePath('/class-management');
  revalidatePath('/admin/students');
  
  return { success: true, count: successCount, errors: errors.length > 0 ? errors : null }
}


/**
 * [취업·실습 종합 서식] 29개 컬럼 엑셀 CSV 업로드 (학번 불필요, 자동 매칭/채번)
 */
export async function uploadStudentsCSV(csvData: string) {
  const supabase = await createClient()
  const parsedRows = parseCSVText(csvData);
  if (parsedRows.length <= 1) return { success: false, count: 0, error: '데이터 행이 없습니다.' };

  const dataRows = parsedRows.slice(1);
  const settings = await getSystemSettings()
  let successCount = 0;

  for (const values of dataRows) {
    const graduation_year = values[0] ? parseInt(values[0]) : null
    if (!graduation_year) continue

    const major = values[1] || null;
    const class_info = values[2] || null;
    const student_number = values[3] || null;
    const student_name = values[4] || null;

    // 기존 학생 조회 (졸업연도 + 학과 + 반 + 번호 기반 매칭)
    let matchedStudentId: string | null = null;

    if (major && class_info && student_number) {
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('graduation_year', graduation_year)
        .eq('major', major)
        .eq('class_info', class_info)
        .eq('student_number', student_number)
        .maybeSingle();

      if (existing) {
        matchedStudentId = existing.id;
      }
    }

    const certificates = values[20] ? values[20].split(';').map(c => c.trim()).filter(Boolean) : [];

    const studentPayload: any = {
      graduation_year,
      major,
      class_info,
      student_number,
      student_name,
      phone_number: values[5] || null,
      career_aspiration: values[6] || null,
      special_notes: values[7] || null,
      career_course: values[8] || null,
      military_status: values[9] || null,
      desired_work_area: values[10] || null,
      parents_opinion: values[11] || null,
      shoe_size: values[12] || null,
      top_size: values[13] || null,
      personal_remarks: values[14] || null,
      certificates,
      updated_at: new Date().toISOString()
    };

    let student: any = null;

    if (matchedStudentId) {
      const { data: updated, error: uError } = await supabase
        .from('students')
        .update(studentPayload)
        .eq('id', matchedStudentId)
        .select('id, graduation_year, major, class_info, student_number')
        .single();
      if (!uError && updated) student = updated;
    } else {
      const { data: inserted, error: iError } = await supabase
        .from('students')
        .insert([{
          ...studentPayload,
          student_id: crypto.randomUUID(),
        }])
        .select('id, graduation_year, major, class_info, student_number')
        .single();
      if (!iError && inserted) student = inserted;
    }

    if (!student) continue;


    // 취업 정보 업서트
    await supabase.from('student_employments').upsert({
      id: student.id,
      is_desiring_employment: values[15] || '예',
      employment_status: values[16] || null, // 최종진로코스
      business_type: values[17] || '아니오',  // 취업현황
      company_type: values[18] || null,
      company: values[19] || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    // 실습 정보 업서트
    const trainingCompany = values[21];
    const startDate = normalizeDate(values[22]);
    const endDate = normalizeDate(values[23]);
    if (trainingCompany || startDate || endDate) {
      const isConversion = values[25] === 'O' || values[25] === '예' || values[25] === '채용전환';
      const isReturned = values[27] === 'O' || values[27] === '예' || values[27] === '복교';

      await supabase.from('field_training_records').upsert({
        student_id: student.id,
        training_order: 1,
        company: trainingCompany || values[19] || '미지정',
        start_date: startDate,
        end_date: endDate,
        stipend_status: values[24] || 'X',
        hiring_status: isConversion ? '채용전환' : (isReturned ? '복교' : '진행중'),
        conversion_date: normalizeDate(values[26]),
        return_reason: values[28] || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id, training_order' });
    }

    await syncAcademicHistory(supabase, student.id, student, settings.baseYear);
    successCount++;
  }

  revalidateTag('students');
  revalidateTag('student-accounts');
  revalidatePath('/students');
  revalidatePath('/admin/students');
  return { success: true, count: successCount }
}

/**
 * [학생 기본 명부 서식] 6개 간편 컬럼 엑셀 CSV 업로드 (admin/students 전용, 학번 불필요)
 */
export async function uploadBasicStudentsCSV(csvData: string) {
  const supabase = await createClient()
  const parsedRows = parseCSVText(csvData);
  if (parsedRows.length <= 1) return { success: false, count: 0, error: '데이터 행이 없습니다.' };

  const dataRows = parsedRows.slice(1);
  const settings = await getSystemSettings()
  let successCount = 0;

  for (const values of dataRows) {
    const graduation_year = values[0] ? parseInt(values[0]) : null
    if (!graduation_year) continue

    const major = values[1] || null;
    const class_info = values[2] || null;
    const student_number = values[3] || null;
    const student_name = values[4] || null;
    const phone_number = values[5] || null;

    // 기존 학생 매칭
    let matchedStudentId: string | null = null;

    if (major && class_info && student_number) {
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('graduation_year', graduation_year)
        .eq('major', major)
        .eq('class_info', class_info)
        .eq('student_number', student_number)
        .maybeSingle();

      if (existing) {
        matchedStudentId = existing.id;
      }
    }

    const studentPayload: any = {
      graduation_year,
      major,
      class_info,
      student_number,
      student_name,
      phone_number,
      updated_at: new Date().toISOString()
    };

    let student: any = null;

    if (matchedStudentId) {
      const { data: updated, error: uError } = await supabase
        .from('students')
        .update(studentPayload)
        .eq('id', matchedStudentId)
        .select('id, graduation_year, major, class_info, student_number')
        .single();
      if (!uError && updated) student = updated;
    } else {
      const { data: inserted, error: iError } = await supabase
        .from('students')
        .insert([studentPayload])
        .select('id, graduation_year, major, class_info, student_number')
        .single();
      if (!iError && inserted) student = inserted;
    }

    if (!student) continue;


    // 기본 취업 테이블 레코드 보장
    await supabase.from('student_employments').upsert({
      id: student.id,
      is_desiring_employment: '예',
      business_type: '미취업',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    await syncAcademicHistory(supabase, student.id, student, settings.baseYear);
    successCount++;
  }

  revalidateTag('students');
  revalidateTag('student-accounts');
  revalidatePath('/admin/students');
  revalidatePath('/students');
  return { success: true, count: successCount };
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

  // 휴대폰 번호 변경 시 커스텀 비밀번호 미설정 학생의 비밀번호 자동 동기화
  if (field === 'phone_number') {
    const { syncStudentPhonePassword } = await import('@/lib/student-accounts');
    await syncStudentPhonePassword(id, finalValue);
  }

  // 감사 로그 비동기 백그라운드 처리 (대기 시간 0초)
  void (async () => {
    try {
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
    } catch (logErr) {
      console.error('Failed to log student update action:', logErr);
    }
  })();

  // 학반 관리 인메모리 캐시 무효화
  const { clearAssignedStudentDetailsCache } = await import('@/lib/data');
  await clearAssignedStudentDetailsCache();

  revalidateTag('students');
  revalidateTag('student-accounts');
  return { success: true }
}


/**
 * 노동인권교육 이수 상태 전용 초고속 변경 액션 (0.1초 미만 응답)
 */
export async function updateLaborEducationStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('students')
    .update({ 
      labor_education_status: status, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  // 비동기 감사로그
  void (async () => {
    try {
      const { logAuditAction } = await import('@/lib/audit-logger');
      await logAuditAction({
        action_type: 'STUDENT_UPDATE',
        target_name: `노동인권교육 [${status}] 변경`,
        details: { student_id: id, field: 'labor_education_status', new_value: status }
      });
    } catch (e) {}
  })();

  revalidateTag('students');
  return { success: true };
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

  const { clearAssignedStudentDetailsCache } = await import('@/lib/data');
  await clearAssignedStudentDetailsCache();

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
  const supabase = await createClient(); 
  const settings = await getSystemSettings();

  const { data: newStudent, error } = await supabase
    .from('students')
    .insert([{
      ...data,
      student_id: crypto.randomUUID(),
    }])
    .select('id, graduation_year, major, class_info, student_number')
    .single();

  if (error || !newStudent) return { error: error?.message || '학생 등록에 실패했습니다.' };

  await supabase.from('student_employments').insert([{ id: newStudent.id, is_desiring_employment: '예', business_type: '미취업' }]);
  await syncAcademicHistory(supabase, newStudent.id, newStudent, settings.baseYear);
  
  revalidateTag('students');
  revalidateTag('student-accounts');
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
  
  // DB Check Constraint ('진행중', '채용전환', '복교') 호환 보장
  let dbHiringStatus = data.hiring_status;
  if (dbHiringStatus === '현장실습' || !dbHiringStatus) {
    dbHiringStatus = '진행중';
  }

  const sanitized = { 
    ...data, 
    hiring_status: dbHiringStatus,
    start_date: data.start_date || null, 
    end_date: data.end_date || null, 
    conversion_date: dbHiringStatus === '채용전환' ? (data.conversion_date || null) : null,
    return_reason: dbHiringStatus === '복교' ? (data.return_reason || null) : null
  }
  const { data: upserted, error } = await supabase.from('field_training_records').upsert({ ...(id ? { id } : {}), ...sanitized, updated_at: new Date().toISOString() }).select().single()
  if (error) return { error: error.message }
  if (dbHiringStatus === '채용전환') await supabase.from('student_employments').upsert({ id: data.student_id, company: data.company, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  revalidateTag('students');
  revalidatePath('/field-training');
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
  return { success: true }
}

/**
 * [복구] 특정 학생의 모든 성적 데이터를 가져옵니다.
 */
export async function getStudentScoresById(studentId: string) {
  const supabase = createAdminClient();
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
  // 1. 해당 졸업연도 전체 요약 정보 활용 (lib/data.ts 함수 호출)
  const { getYearlyRankingsSummary } = await import('@/lib/data');
  const rankings = await getYearlyRankingsSummary(graduationYear);
  
  return rankings[studentId] || null;
}
