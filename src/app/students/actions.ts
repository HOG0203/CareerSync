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
  'career_aspiration', 'military_status', 'special_notes', 'career_course', 'labor_education_status',
  'middle_school', 'admission_rank_percentile', 'admission_type'
];

const FIELD_TRAINING_EDITABLE_FIELDS = [
  'latest_training_company',
  'start_date',
  'end_date',
  'training_stipend_status',
  'is_hiring_conversion',
  'is_returned',
  'return_reason'
];

async function updateStudentFieldTrainingRecord(
  supabase: any,
  studentId: string,
  field: string,
  value: any
) {
  let finalVal = value;
  if (value === '' || value === 'CLEARED' || (Array.isArray(value) && value.length === 0)) finalVal = null;

  // 최신 실습 기록 조회 (내림차순 정렬 1건)
  const { data: latestRecords } = await supabase
    .from('field_training_records')
    .select('*')
    .eq('student_id', studentId)
    .order('training_order', { ascending: false })
    .limit(1);

  const latest = latestRecords && latestRecords.length > 0 ? latestRecords[0] : null;

  if (latest) {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (field === 'latest_training_company') {
      updateData.company = finalVal || '';
    } else if (field === 'start_date') {
      updateData.start_date = normalizeDate(finalVal);
    } else if (field === 'end_date') {
      updateData.end_date = normalizeDate(finalVal);
    } else if (field === 'training_stipend_status') {
      updateData.stipend_status = finalVal || 'X';
    } else if (field === 'is_hiring_conversion') {
      if (finalVal && finalVal !== 'X') {
        updateData.hiring_status = '채용전환';
        updateData.conversion_date = normalizeDate(finalVal) || (finalVal === 'O' ? (latest.end_date || new Date().toISOString().slice(0, 10)) : finalVal);
        updateData.return_reason = null; // 복교사유 초기화
      } else {
        updateData.hiring_status = '진행중';
        updateData.conversion_date = null;
      }
    } else if (field === 'is_returned' || field === 'return_reason') {
      if (finalVal && finalVal !== 'X') {
        updateData.hiring_status = '복교';
        updateData.return_reason = finalVal;
        updateData.conversion_date = null; // 채용전환 초기화
      } else {
        updateData.hiring_status = '진행중';
        updateData.return_reason = null;
      }
    }

    // 수정 후 데이터가 모두 비어 있는지 확인 (실습처, 시작일, 종료일, 복교사유, 전환일 등이 모두 빈 값인 유령 데이터 방지)
    const merged = { ...latest, ...updateData };
    const hasCompany = Boolean(merged.company && String(merged.company).trim() !== '');
    const hasStartDate = Boolean(merged.start_date);
    const hasEndDate = Boolean(merged.end_date);
    const hasConversion = Boolean(merged.conversion_date || (merged.hiring_status === '채용전환'));
    const hasReturn = Boolean(merged.return_reason && String(merged.return_reason).trim() !== '');

    if (!hasCompany && !hasStartDate && !hasEndDate && !hasConversion && !hasReturn) {
      // 모든 주요 실습 데이터가 비워진 경우 유령 레코드 남기지 않고 삭제
      await supabase.from('field_training_records').delete().eq('id', latest.id);
      return { success: true };
    }

    const { error } = await supabase
      .from('field_training_records')
      .update(updateData)
      .eq('id', latest.id);

    if (error) return { success: false, error: error.message };

    // 채용전환 상태인 경우 취업처도 동기화
    const effectiveCompany = field === 'latest_training_company' && finalVal ? finalVal : latest.company;
    if ((updateData.hiring_status === '채용전환' || latest.hiring_status === '채용전환') && effectiveCompany) {
      await supabase.from('student_employments').upsert({ id: studentId, company: effectiveCompany, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    }

    return { success: true };
  } else {
    // 실습 이력이 없는 상태에서 빈 값/취소 커밋인 경우 1차 실습 레코드를 생성하지 않음
    const cleanStr = String(finalVal || '').trim();
    if (!finalVal || cleanStr === '' || cleanStr === 'X' || cleanStr === 'CLEARED' || cleanStr === '-') {
      return { success: true };
    }

    // 유효한 값이 입력된 경우에만 1차 실습으로 신규 등록
    const isConv = field === 'is_hiring_conversion' && finalVal && finalVal !== 'X';
    const isRet = (field === 'is_returned' || field === 'return_reason') && finalVal && finalVal !== 'X';

    const newRecord: any = {
      student_id: studentId,
      training_order: 1,
      company: field === 'latest_training_company' ? (finalVal || '') : '',
      start_date: field === 'start_date' ? normalizeDate(finalVal) : null,
      end_date: field === 'end_date' ? normalizeDate(finalVal) : null,
      stipend_status: field === 'training_stipend_status' ? (finalVal || 'X') : 'X',
      hiring_status: isRet ? '복교' : (isConv ? '채용전환' : '진행중'),
      conversion_date: isConv ? (normalizeDate(finalVal) || (finalVal === 'O' ? new Date().toISOString().slice(0, 10) : finalVal)) : null,
      return_reason: isRet ? finalVal : null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('field_training_records')
      .insert([newRecord]);

    if (error) return { success: false, error: error.message };

    if (isConv && newRecord.company) {
      await supabase.from('student_employments').upsert({ id: studentId, company: newRecord.company, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    }

    return { success: true };
  }
}

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

function buildAcademicHistoryRecord(studentUuid: string, info: any, baseYear: number, teachers: any[]) {
  const gradYear = info.graduation_year
  if (!gradYear) return null

  const diff = gradYear - baseYear;
  const grade = diff === 1 ? 3 : 
                diff === 2 ? 2 : 
                diff === 3 ? 1 : null;

  if (!grade) return null;

  let teacherName = null;
  if (info.major && info.class_info) {
    const cleanMajor = info.major.replace(/과|공업계/g, '').trim();
    const cleanClass = info.class_info.replace(/반|학년/g, '').trim();
    
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

  return {
    student_id: studentUuid,
    grade,
    academic_year: baseYear,
    major: info.major,
    class_info: info.class_info,
    student_number: info.student_number,
    teacher_name: teacherName
  };
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
    let middle_school: string | null = null;

    if (values.length >= 9) {
      // 9컬럼 서식: [0]학번, [1]성명, [2]기존학과, [3]기존반, [4]기존번호, [5]신규학과, [6]신규반, [7]신규번호, [8]출신중학교
      student_id = values[0];
      student_name = values[1];
      prev_major = values[2];
      prev_class = values[3];
      prev_number = values[4];
      next_major = values[5];
      next_class = values[6];
      next_number = values[7];
      middle_school = values[8]?.trim() || null;
    } else if (values.length === 8) {
      if (values[0] && values[0].length > 10) {
        student_id = values[0];
        student_name = values[1];
        prev_major = values[2];
        prev_class = values[3];
        prev_number = values[4];
        next_major = values[5];
        next_class = values[6];
        next_number = values[7];
      } else {
        student_name = values[0];
        prev_major = values[1];
        prev_class = values[2];
        prev_number = values[3];
        next_major = values[4];
        next_class = values[5];
        next_number = values[6];
        middle_school = values[7]?.trim() || null;
      }
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

    // 인적사항 및 출신중학교 업데이트
    const updatePayload: Record<string, any> = { 
      major: next_major,
      class_info: next_class,
      student_number: next_number,
      updated_at: new Date().toISOString()
    };
    if (middle_school !== null && middle_school !== undefined && middle_school.length > 0) {
      updatePayload.middle_school = middle_school;
    }

    const { error: updateError } = await supabase
      .from('students')
      .update(updatePayload)
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
  revalidateTag('middle-school-employment');
  revalidatePath('/class-management');
  revalidatePath('/admin/students');
  revalidatePath('/students');
  revalidatePath('/employment-status');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
  
  return { success: true, count: successCount, errors: errors.length > 0 ? errors : null }
}


/**
 * [취업·실습 종합 서식] 엑셀 CSV 업로드 (학번 불필요, 자동 매칭/채번, 출신중/입학성적 포함 지원)
 */
/**
 * [취업·실습 종합 서식] 엑셀 CSV 업로드 (학번 불필요, 자동 매칭/채번, 출신중/입학성적 포함 지원)
 */
export async function uploadStudentsCSV(csvData: string) {
  const supabase = createAdminClient()
  const parsedRows = parseCSVText(csvData);
  if (parsedRows.length <= 1) return { success: false, count: 0, error: '데이터 행이 없습니다.' };

  const headerRow = parsedRows[0].map(h => h.trim());
  const hasMiddleSchoolHeader = headerRow.some(h => h.includes('출신중'));

  const dataRows = parsedRows.slice(1);
  const settings = await getSystemSettings()

  // 1. 졸업연도 집합 추출
  const gradYearsSet = new Set<number>();
  for (const values of dataRows) {
    const rawGy = values[0] ? String(values[0]).replace(/[^0-9]/g, '') : '';
    const gy = rawGy ? parseInt(rawGy, 10) : null;
    if (gy) gradYearsSet.add(gy);
  }
  const gradYears = Array.from(gradYearsSet);
  if (gradYears.length === 0) return { success: false, count: 0, error: 'CSV 파일에서 유효한 졸업연도 데이터를 찾을 수 없습니다.' };

  // 2. 기존 학생 목록 미리 조회 (매칭용 Map 구축)
  const { data: existingStudents } = await supabase
    .from('students')
    .select('id, graduation_year, major, class_info, student_number')
    .in('graduation_year', gradYears);

  const studentMap = new Map<string, string>();
  if (existingStudents) {
    for (const s of existingStudents) {
      if (s.graduation_year && s.major && s.class_info && s.student_number) {
        const key = `${s.graduation_year}_${s.major}_${s.class_info}_${s.student_number}`;
        studentMap.set(key, s.id);
      }
    }
  }

  // 3. 담임교사 목록 미리 조회 (학적 이력 매칭용)
  const { data: teachers } = await supabase
    .from('profiles')
    .select('username, assigned_major, assigned_class, assigned_grade')
    .not('assigned_major', 'is', null);

  const studentPayloads: any[] = [];
  const employmentsPayloads: any[] = [];
  const fieldTrainingPayloads: any[] = [];
  const studentMetaList: any[] = [];

  for (const values of dataRows) {
    const rawGrad = values[0] ? String(values[0]).replace(/[^0-9]/g, '') : '';
    const graduation_year = rawGrad ? parseInt(rawGrad, 10) : null;
    if (!graduation_year) continue;

    const major = values[1] || null;
    const class_info = values[2] || null;
    const student_number = values[3] || null;
    const student_name = values[4] || null;

    const isExtended = values.length >= 31 || hasMiddleSchoolHeader;
    const offset = isExtended ? 2 : 0;

    const middle_school = isExtended ? (values[6]?.trim() || null) : null;
    const rawPercentile = isExtended ? (values[7]?.trim() || null) : null;
    const admission_rank_percentile = rawPercentile && !isNaN(parseFloat(rawPercentile)) ? parseFloat(rawPercentile) : null;

    const key = (major && class_info && student_number) ? `${graduation_year}_${major}_${class_info}_${student_number}` : null;
    let studentId = key ? studentMap.get(key) : undefined;
    const isNew = !studentId;

    if (!studentId) {
      studentId = crypto.randomUUID();
      if (key) studentMap.set(key, studentId);
    }

    const certificates = values[20 + offset] ? values[20 + offset].split(';').map(c => c.trim()).filter(Boolean) : [];

    const studentPayload: any = {
      id: studentId,
      graduation_year,
      major,
      class_info,
      student_number,
      student_name,
      phone_number: values[5] || null,
      career_aspiration: values[6 + offset] || null,
      special_notes: values[7 + offset] || null,
      career_course: values[8 + offset] || null,
      military_status: values[9 + offset] || null,
      desired_work_area: values[10 + offset] || null,
      parents_opinion: values[11 + offset] || null,
      shoe_size: values[12 + offset] || null,
      top_size: values[13 + offset] || null,
      personal_remarks: values[14 + offset] || null,
      certificates,
      updated_at: new Date().toISOString()
    };

    if (isNew) {
      studentPayload.student_id = crypto.randomUUID();
    }

    if (middle_school !== null && middle_school !== undefined) {
      studentPayload.middle_school = middle_school;
    }
    if (admission_rank_percentile !== null && admission_rank_percentile !== undefined) {
      studentPayload.admission_rank_percentile = admission_rank_percentile;
    }

    studentPayloads.push(studentPayload);
    studentMetaList.push({
      id: studentId,
      graduation_year,
      major,
      class_info,
      student_number
    });

    // 취업 정보 페이로드 (신규 학생이거나, CSV 행에 취업 데이터가 포함된 경우만 반영)
    if (isNew) {
      employmentsPayloads.push({
        id: studentId,
        is_desiring_employment: values[15 + offset] || '예',
        employment_status: values[16 + offset] || null, // 최종진로코스
        business_type: (values[17 + offset] && values[17 + offset] !== '아니오') ? values[17 + offset] : '미취업',  // 취업현황
        company_type: values[18 + offset] || null,
        company: values[19 + offset] || null,
        updated_at: new Date().toISOString()
      });
    } else {
      const empUpdate: any = { id: studentId, updated_at: new Date().toISOString() };
      let hasEmpField = false;
      if (values[15 + offset] !== undefined && values[15 + offset] !== '') {
        empUpdate.is_desiring_employment = values[15 + offset];
        hasEmpField = true;
      }
      if (values[16 + offset] !== undefined && values[16 + offset] !== '') {
        empUpdate.employment_status = values[16 + offset];
        hasEmpField = true;
      }
      if (values[17 + offset] !== undefined && values[17 + offset] !== '' && values[17 + offset] !== '아니오') {
        empUpdate.business_type = values[17 + offset];
        hasEmpField = true;
      }
      if (values[18 + offset] !== undefined && values[18 + offset] !== '') {
        empUpdate.company_type = values[18 + offset];
        hasEmpField = true;
      }
      if (values[19 + offset] !== undefined && values[19 + offset] !== '') {
        empUpdate.company = values[19 + offset];
        hasEmpField = true;
      }
      if (hasEmpField) {
        employmentsPayloads.push(empUpdate);
      }
    }

    // 실습 정보 페이로드
    const trainingCompany = values[21 + offset];
    const startDate = normalizeDate(values[22 + offset]);
    const endDate = normalizeDate(values[23 + offset]);
    if (trainingCompany || startDate || endDate) {
      const isConversion = values[25 + offset] === 'O' || values[25 + offset] === '예' || values[25 + offset] === '채용전환';
      const isReturned = values[27 + offset] === 'O' || values[27 + offset] === '예' || values[27 + offset] === '복교';

      fieldTrainingPayloads.push({
        student_id: studentId,
        training_order: 1,
        company: trainingCompany || values[19 + offset] || '미지정',
        start_date: startDate,
        end_date: endDate,
        stipend_status: values[24 + offset] || 'X',
        hiring_status: isConversion ? '채용전환' : (isReturned ? '복교' : '진행중'),
        conversion_date: normalizeDate(values[26 + offset]),
        return_reason: values[28 + offset] || null,
        updated_at: new Date().toISOString()
      });
    }
  }

  if (studentPayloads.length === 0) return { success: false, count: 0, error: '유효한 학생 데이터가 없습니다.' };

  // 4. Chunk 단위 Bulk Upsert (100개씩)
  const CHUNK_SIZE = 100;
  let successCount = 0;

  for (let i = 0; i < studentPayloads.length; i += CHUNK_SIZE) {
    const chunk = studentPayloads.slice(i, i + CHUNK_SIZE);
    let { error: uError } = await supabase
      .from('students')
      .upsert(chunk, { onConflict: 'id' });

    if (uError && (uError.message.includes('middle_school') || uError.message.includes('admission_rank_percentile'))) {
      const sanitizedChunk = chunk.map(p => {
        const copy = { ...p };
        delete copy.middle_school;
        delete copy.admission_rank_percentile;
        return copy;
      });
      const retry = await supabase
        .from('students')
        .upsert(sanitizedChunk, { onConflict: 'id' });
      uError = retry.error;
    }

    if (!uError) {
      successCount += chunk.length;
    } else {
      console.error('students upsert error:', uError);
      return { success: false, count: 0, error: `학생 정보 저장 중 오류: ${uError.message}` };
    }
  }

  // 5. student_employments Bulk Upsert
  for (let i = 0; i < employmentsPayloads.length; i += CHUNK_SIZE) {
    const chunk = employmentsPayloads.slice(i, i + CHUNK_SIZE);
    await supabase.from('student_employments').upsert(chunk, { onConflict: 'id' });
  }

  // 6. field_training_records Bulk Upsert
  if (fieldTrainingPayloads.length > 0) {
    for (let i = 0; i < fieldTrainingPayloads.length; i += CHUNK_SIZE) {
      const chunk = fieldTrainingPayloads.slice(i, i + CHUNK_SIZE);
      await supabase.from('field_training_records').upsert(chunk, { onConflict: 'student_id, training_order' });
    }
  }

  // 7. student_academic_history Bulk Upsert
  const academicHistories: any[] = [];
  for (const s of studentMetaList) {
    const history = buildAcademicHistoryRecord(s.id, s, settings.baseYear, teachers || []);
    if (history) academicHistories.push(history);
  }

  if (academicHistories.length > 0) {
    for (let i = 0; i < academicHistories.length; i += CHUNK_SIZE) {
      const chunk = academicHistories.slice(i, i + CHUNK_SIZE);
      await supabase.from('student_academic_history').upsert(chunk, { onConflict: 'student_id, grade' });
    }
  }

  revalidateTag('students');
  revalidateTag('student-accounts');
  revalidatePath('/students');
  revalidatePath('/admin/students');
  return { success: true, count: successCount }
}

/**
 * [학생 기본 명부 서식] 엑셀 CSV 업로드 (admin/students 전용, 학번 불필요, 출신중/입학성적 지원)
 */
export async function uploadBasicStudentsCSV(csvData: string) {
  const supabase = createAdminClient()
  const parsedRows = parseCSVText(csvData);
  if (parsedRows.length <= 1) return { success: false, count: 0, error: '데이터 행이 없습니다.' };

  const headerRow = parsedRows[0].map(h => h.trim());
  const msHeaderIdx = headerRow.findIndex(h => h.includes('출신중'));
  const rankHeaderIdx = headerRow.findIndex(h => h.includes('입학성적') || h.includes('석차백분율'));

  const dataRows = parsedRows.slice(1);
  const settings = await getSystemSettings()

  // 1. 졸업연도 집합 추출
  const gradYearsSet = new Set<number>();
  for (const values of dataRows) {
    const rawGy = values[0] ? String(values[0]).replace(/[^0-9]/g, '') : '';
    const gy = rawGy ? parseInt(rawGy, 10) : null;
    if (gy) gradYearsSet.add(gy);
  }
  const gradYears = Array.from(gradYearsSet);
  if (gradYears.length === 0) return { success: false, count: 0, error: 'CSV 파일에서 유효한 졸업연도 데이터를 찾을 수 없습니다.' };

  // 2. 기존 학생 목록 미리 조회 (매칭용 Map 구축)
  const { data: existingStudents } = await supabase
    .from('students')
    .select('id, graduation_year, major, class_info, student_number')
    .in('graduation_year', gradYears);

  const studentMap = new Map<string, string>();
  if (existingStudents) {
    for (const s of existingStudents) {
      if (s.graduation_year && s.major && s.class_info && s.student_number) {
        const key = `${s.graduation_year}_${s.major}_${s.class_info}_${s.student_number}`;
        studentMap.set(key, s.id);
      }
    }
  }

  // 3. 담임교사 목록 미리 조회 (학적 이력 매칭용)
  const { data: teachers } = await supabase
    .from('profiles')
    .select('username, assigned_major, assigned_class, assigned_grade')
    .not('assigned_major', 'is', null);

  const studentPayloads: any[] = [];
  const employmentsPayloads: any[] = [];
  const studentMetaList: any[] = [];

  for (const values of dataRows) {
    const rawGrad = values[0] ? String(values[0]).replace(/[^0-9]/g, '') : '';
    const graduation_year = rawGrad ? parseInt(rawGrad, 10) : null;
    if (!graduation_year) continue;

    const major = values[1] || null;
    const class_info = values[2] || null;
    const student_number = values[3] || null;
    const student_name = values[4] || null;
    const phone_number = values[5] || null;

    let middle_school: string | null = null;
    if (msHeaderIdx !== -1) {
      middle_school = values[msHeaderIdx]?.trim() || null;
    } else if (values.length >= 7) {
      middle_school = values[6]?.trim() || null;
    }

    let admission_rank_percentile: number | null = null;
    const rawRank = rankHeaderIdx !== -1 ? values[rankHeaderIdx]?.trim() : (values.length >= 8 ? values[7]?.trim() : null);
    if (rawRank) {
      const parsed = parseFloat(rawRank);
      if (!isNaN(parsed)) admission_rank_percentile = parsed;
    }

    const key = (major && class_info && student_number) ? `${graduation_year}_${major}_${class_info}_${student_number}` : null;
    let studentId = key ? studentMap.get(key) : undefined;
    const isNew = !studentId;

    if (!studentId) {
      studentId = crypto.randomUUID();
      if (key) studentMap.set(key, studentId);
    }

    const studentPayload: any = {
      id: studentId,
      graduation_year,
      major,
      class_info,
      student_number,
      student_name,
      phone_number,
      updated_at: new Date().toISOString()
    };

    if (isNew) {
      studentPayload.student_id = crypto.randomUUID();
    }

    if (middle_school !== null && middle_school !== undefined) {
      studentPayload.middle_school = middle_school;
    }
    if (admission_rank_percentile !== null && admission_rank_percentile !== undefined) {
      studentPayload.admission_rank_percentile = admission_rank_percentile;
    }

    studentPayloads.push(studentPayload);
    studentMetaList.push({
      id: studentId,
      graduation_year,
      major,
      class_info,
      student_number
    });

    // 신규 학생인 경우에만 기본 취업 정보 페이로드 생성 (기존 학생의 취업희망/취업현황 데이터 보존)
    if (isNew) {
      employmentsPayloads.push({
        id: studentId,
        is_desiring_employment: '예',
        business_type: '미취업',
        updated_at: new Date().toISOString()
      });
    }
  }

  if (studentPayloads.length === 0) return { success: false, count: 0, error: '유효한 학생 데이터가 없습니다.' };

  // 4. Chunk 단위 Bulk Upsert (100개씩)
  const CHUNK_SIZE = 100;
  let successCount = 0;

  for (let i = 0; i < studentPayloads.length; i += CHUNK_SIZE) {
    const chunk = studentPayloads.slice(i, i + CHUNK_SIZE);
    let { error: uError } = await supabase
      .from('students')
      .upsert(chunk, { onConflict: 'id' });

    if (uError && (uError.message.includes('middle_school') || uError.message.includes('admission_rank_percentile'))) {
      const sanitizedChunk = chunk.map(p => {
        const copy = { ...p };
        delete copy.middle_school;
        delete copy.admission_rank_percentile;
        return copy;
      });
      const retry = await supabase
        .from('students')
        .upsert(sanitizedChunk, { onConflict: 'id' });
      uError = retry.error;
    }

    if (!uError) {
      successCount += chunk.length;
    } else {
      console.error('students upsert error:', uError);
      return { success: false, count: 0, error: `학생 정보 저장 중 오류: ${uError.message}` };
    }
  }

  // 5. student_employments Bulk Upsert
  for (let i = 0; i < employmentsPayloads.length; i += CHUNK_SIZE) {
    const chunk = employmentsPayloads.slice(i, i + CHUNK_SIZE);
    await supabase.from('student_employments').upsert(chunk, { onConflict: 'id' });
  }

  // 6. student_academic_history Bulk Upsert
  const academicHistories: any[] = [];
  for (const s of studentMetaList) {
    const history = buildAcademicHistoryRecord(s.id, s, settings.baseYear, teachers || []);
    if (history) academicHistories.push(history);
  }

  if (academicHistories.length > 0) {
    for (let i = 0; i < academicHistories.length; i += CHUNK_SIZE) {
      const chunk = academicHistories.slice(i, i + CHUNK_SIZE);
      await supabase.from('student_academic_history').upsert(chunk, { onConflict: 'student_id, grade' });
    }
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

  // 현장실습/도제OJT 관련 필드 처리
  if (FIELD_TRAINING_EDITABLE_FIELDS.includes(field)) {
    const { data: studentInfo } = await supabase.from('students').select('student_name, student_number, class_info').eq('id', id).single();
    const studentLabel = studentInfo ? `${studentInfo.student_name} (${studentInfo.class_info ? `${studentInfo.class_info}반 ` : ''}${studentInfo.student_number ? `${studentInfo.student_number}번` : ''})` : `학생 (ID: ${id})`;

    const res = await updateStudentFieldTrainingRecord(supabase, id, field, value);
    if (!res.success) return res;

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
            new_value: value ?? '(빈값)', 
            old_value: '(실습이력)' 
          }
        });
      } catch (e) {}
    })();

    const { clearAssignedStudentDetailsCache } = await import('@/lib/data');
    await clearAssignedStudentDetailsCache();

    revalidateTag('students');
    revalidateTag('middle-school-employment');
    revalidatePath('/students'); 
    revalidatePath('/admin/students'); 
    revalidatePath('/class-management');
    revalidatePath('/employment-status');
    revalidatePath('/field-training');
    revalidatePath('/admission/middle-school-employment');
    revalidatePath('/share/admission/middle-school-employment');
    return { success: true };
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
  revalidateTag('middle-school-employment');
  revalidateTag('student-accounts');
  revalidatePath('/students');
  revalidatePath('/admin/students');
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/dashboard');
  revalidatePath('/field-training');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
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
  if (!updates || updates.length === 0) return { success: true };

  const supabase = createAdminClient();
  const studentsMap = new Map<string, Record<string, any>>();
  const employmentsMap = new Map<string, Record<string, any>>();
  const fieldTrainingUpdates: Array<{ id: string; field: string; value: any }> = [];

  for (const update of updates) {
    if (FIELD_TRAINING_EDITABLE_FIELDS.includes(update.field)) {
      fieldTrainingUpdates.push(update);
    } else {
      let fv = update.value;
      if (update.field === 'graduation_year') fv = update.value ? parseInt(update.value) : null;
      else if (update.value === '' || update.value === 'CLEARED' || (Array.isArray(update.value) && update.value.length === 0)) fv = null;

      const isStudentField = BASIC_INFO_FIELDS.includes(update.field);
      const targetMap = isStudentField ? studentsMap : employmentsMap;

      let record = targetMap.get(update.id);
      if (!record) {
        record = { id: update.id, updated_at: new Date().toISOString() };
        targetMap.set(update.id, record);
      }
      record[update.field] = fv;
    }
  }

  // Chunk 단위 Bulk Upsert (students)
  if (studentsMap.size > 0) {
    const studentRecords = Array.from(studentsMap.values());
    for (let i = 0; i < studentRecords.length; i += 100) {
      const chunk = studentRecords.slice(i, i + 100);
      await supabase.from('students').upsert(chunk, { onConflict: 'id' });
    }
  }

  // Chunk 단위 Bulk Upsert (student_employments)
  if (employmentsMap.size > 0) {
    const employmentRecords = Array.from(employmentsMap.values());
    for (let i = 0; i < employmentRecords.length; i += 100) {
      const chunk = employmentRecords.slice(i, i + 100);
      await supabase.from('student_employments').upsert(chunk, { onConflict: 'id' });
    }
  }

  // 현장실습 항목 업데이트
  for (const update of fieldTrainingUpdates) {
    await updateStudentFieldTrainingRecord(supabase, update.id, update.field, update.value);
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
  revalidateTag('middle-school-employment');
  revalidatePath('/students'); 
  revalidatePath('/admin/students'); 
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/labor-education');
  revalidatePath('/dashboard');
  revalidatePath('/field-training');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');

  return { success: true }
}

export async function createStudent(data: { graduation_year: number, major: string, class_info: string, student_number: string, student_name: string, middle_school?: string }) {
  const supabase = await createClient(); 
  const settings = await getSystemSettings();

  const insertPayload: Record<string, any> = {
    ...data,
    student_id: crypto.randomUUID(),
  };
  if (data.middle_school !== undefined) {
    insertPayload.middle_school = data.middle_school?.trim() || null;
  }

  const { data: newStudent, error } = await supabase
    .from('students')
    .insert([insertPayload])
    .select('id, graduation_year, major, class_info, student_number, middle_school')
    .single();

  if (error || !newStudent) return { error: error?.message || '학생 등록에 실패했습니다.' };

  await supabase.from('student_employments').insert([{ id: newStudent.id, is_desiring_employment: '예', business_type: '미취업' }]);
  await syncAcademicHistory(supabase, newStudent.id, newStudent, settings.baseYear);
  
  revalidateTag('students');
  revalidateTag('middle-school-employment');
  revalidateTag('student-accounts');
  revalidatePath('/admin/students'); 
  revalidatePath('/students'); 
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/labor-education');
  revalidatePath('/dashboard');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
  return { success: true }
}


export async function deleteStudents(ids: string[]) {
  const supabase = await createClient()
  await supabase.from('student_employments').delete().in('id', ids)
  const { error } = await supabase.from('students').delete().in('id', ids)
  if (error) return { error: error.message }

  const { clearAssignedStudentDetailsCache } = await import('@/lib/data');
  await clearAssignedStudentDetailsCache();

  revalidateTag('students');
  revalidateTag('middle-school-employment');
  revalidateTag('student-accounts');
  revalidatePath('/admin/students'); 
  revalidatePath('/students'); 
  revalidatePath('/class-management');
  revalidatePath('/employment-status');
  revalidatePath('/labor-education');
  revalidatePath('/dashboard');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
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
  revalidatePath('/employment-status');
  return { success: true }
}

/**
 * 특정 학생의 최신 실습 이력 전체 목록을 직접 DB에서 조회합니다.
 */
export async function getStudentFieldTrainings(studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('field_training_records')
    .select('*')
    .eq('student_id', studentId)
    .order('training_order', { ascending: false });

  if (error) {
    console.error('Failed to fetch student field trainings:', error);
    return [];
  }
  return data || [];
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

/**
 * 학생 CSV 데이터 미리보기 및 매칭 상태 검사
 */
export async function previewStudentCSV(csvData: string) {
  const supabase = createAdminClient()
  const parsedRows = parseCSVText(csvData);
  if (parsedRows.length <= 1) return { success: false, error: '데이터 행이 없습니다.' };

  const headerRow = parsedRows[0].map(h => h.trim());
  const msHeaderIdx = headerRow.findIndex(h => h.includes('출신중'));
  const rankHeaderIdx = headerRow.findIndex(h => h.includes('입학성적') || h.includes('석차백분율'));
  const hasMiddleSchoolHeader = headerRow.some(h => h.includes('출신중'));

  const dataRows = parsedRows.slice(1);

  // 1. 졸업연도 집합 추출
  const gradYearsSet = new Set<number>();
  for (const values of dataRows) {
    const rawGy = values[0] ? String(values[0]).replace(/[^0-9]/g, '') : '';
    const gy = rawGy ? parseInt(rawGy, 10) : null;
    if (gy) gradYearsSet.add(gy);
  }
  const gradYears = Array.from(gradYearsSet);
  if (gradYears.length === 0) return { success: false, error: '유효한 졸업연도 데이터가 없습니다.' };

  // 2. 기존 학생 목록 미리 조회
  const { data: existingStudents } = await supabase
    .from('students')
    .select('id, graduation_year, major, class_info, student_number')
    .in('graduation_year', gradYears);

  const studentMap = new Map<string, string>();
  if (existingStudents) {
    for (const s of existingStudents) {
      if (s.graduation_year && s.major && s.class_info && s.student_number) {
        const key = `${s.graduation_year}_${s.major}_${s.class_info}_${s.student_number}`;
        studentMap.set(key, s.id);
      }
    }
  }

  let newCount = 0;
  let updateCount = 0;
  const rows: Array<{
    status: 'new' | 'update';
    graduationYear: number;
    major: string;
    classInfo: string;
    studentNumber: string;
    name: string;
    phone: string;
    middleSchool?: string;
    admissionRank?: number;
  }> = [];

  for (const values of dataRows) {
    const rawGrad = values[0] ? String(values[0]).replace(/[^0-9]/g, '') : '';
    const graduation_year = rawGrad ? parseInt(rawGrad, 10) : null;
    if (!graduation_year) continue;

    const major = values[1] || '';
    const class_info = values[2] || '';
    const student_number = values[3] || '';
    const student_name = values[4] || '';
    const phone_number = values[5] || '';

    const isExtended = values.length >= 31 || hasMiddleSchoolHeader;
    let middle_school: string | undefined = undefined;
    let admission_rank_percentile: number | undefined = undefined;

    if (msHeaderIdx !== -1) {
      middle_school = values[msHeaderIdx]?.trim() || undefined;
    } else if (isExtended && values[6]) {
      middle_school = values[6]?.trim() || undefined;
    } else if (values.length >= 7 && !isExtended) {
      middle_school = values[6]?.trim() || undefined;
    }

    const rawRank = rankHeaderIdx !== -1 ? values[rankHeaderIdx]?.trim() : (isExtended ? values[7]?.trim() : (values.length >= 8 ? values[7]?.trim() : undefined));
    if (rawRank) {
      const parsed = parseFloat(rawRank);
      if (!isNaN(parsed)) admission_rank_percentile = parsed;
    }

    const key = (major && class_info && student_number) ? `${graduation_year}_${major}_${class_info}_${student_number}` : null;
    const exists = key ? studentMap.has(key) : false;

    if (exists) {
      updateCount++;
    } else {
      newCount++;
      if (key) studentMap.set(key, 'temp-new-id');
    }

    rows.push({
      status: exists ? 'update' : 'new',
      graduationYear: graduation_year,
      major,
      classInfo: class_info,
      studentNumber: student_number,
      name: student_name,
      phone: phone_number,
      middleSchool: middle_school,
      admissionRank: admission_rank_percentile
    });
  }

  return {
    success: true,
    totalCount: rows.length,
    newCount,
    updateCount,
    rows
  };
}
