'use server';

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import * as XLSX from 'xlsx';

// 자격증 현황 학생 데이터 타입
export interface StudentCertificateSummary {
  id: string;
  name: string;
  number: string;
  major: string;
  classInfo: string;
  certificates: string[];
}

/**
 * 특정 학년의 학생 자격증 현황 목록 조회
 */
export async function getCertificateSummaries(gradeNum: number) {
  const supabase = await createClient();
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;
  
  // 학년에 따른 졸업학년도 계산
  const targetGradYear = baseYear + (4 - gradeNum);

  const { data: students, error } = await supabase
    .from('students')
    .select('id, student_id, student_name, student_number, major, class_info, certificates')
    .eq('graduation_year', targetGradYear)
    .order('major', { ascending: true })
    .order('class_info', { ascending: true })
    .order('student_number', { ascending: true });

  if (error) {
    console.error('Error fetching certificates:', error);
    return [];
  }

  return (students || []).map((s: any) => ({
    id: s.id,
    name: s.student_name,
    number: s.student_number || '',
    major: s.major || '',
    classInfo: s.class_info || '',
    certificates: s.certificates || [],
  })) as StudentCertificateSummary[];
}

/**
 * [캐싱] 학년별 자격증 현황 목록을 학년별 동적 태그로 서버 메모리에 캐싱합니다.
 */
export async function getCachedCertificateSummaries(gradeNum: number) {
  return unstable_cache(
    async () => getCertificateSummaries(gradeNum),
    [`certificate-summaries-grade-${gradeNum}`],
    {
      revalidate: 3600,
      tags: [`cert-certificates-grade-${gradeNum}`, 'cert-certificates']
    }
  )();
}


/**
 * 개별 학생의 자격증 정보 직접 업데이트 (스프레드시트 셀 수정용)
 */
export async function updateStudentCertificates(studentId: string, certificates: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('students')
    .update({ 
      certificates,
      updated_at: new Date().toISOString()
    })
    .eq('id', studentId);

  if (error) {
    return { success: false, error: error.message };
  }

  [1, 2, 3].forEach(g => revalidateTag(`cert-certificates-grade-${g}`));
  revalidateTag('cert-certificates');
  revalidateTag('students');
  revalidatePath('/admin/certification/certificates');
  revalidatePath('/employment-status');
  revalidatePath('/students');
  return { success: true };
}



/**
 * 파싱된 자격증 데이터 레코드를 DB에 일괄 저장하는 공통 로직
 */
async function saveParsedCertificatesToDb(
  supabase: any,
  targetGradYear: number,
  majorName: string,
  className: string,
  parsedStudents: Record<string, string[]>
) {
  let successCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  // 대상 학과 및 학급의 학생들을 DB에서 먼저 조회
  const cleanMajor = majorName.replace(/과|공업계/g, '').trim();
  const cleanClass = className.replace(/반|학년/g, '').trim();

  const { data: dbStudents, error: dbError } = await supabase
    .from('students')
    .select('id, student_name, student_number, major, class_info, certificates')
    .eq('graduation_year', targetGradYear);

  if (dbError) {
    throw new Error(`학생 데이터 로딩 실패: ${dbError.message}`);
  }

  // 매칭 로직 실행 및 업데이트
  for (const [studentName, certs] of Object.entries(parsedStudents)) {
    // 성명, 반, 번호를 기준하여 일치하는 학생 찾기
    const matched = dbStudents.find((s: any) => {
      const sName = s.student_name.trim();
      const sMajor = (s.major || '').replace(/과|공업계/g, '').trim();
      const sClass = (s.class_info || '').replace(/반|학년/g, '').trim();
      
      // 이름이 같고, 반이 같을 경우 매칭 (동명이인은 드물고 과 정보도 비교)
      return sName === studentName.trim() && sClass === cleanClass && sMajor.includes(cleanMajor);
    });

    if (!matched) {
      errors.push(`[미매칭] ${className} ${studentName} 학생을 DB에서 찾을 수 없습니다.`);
      skippedCount++;
      continue;
    }

    // 기존 자격증 정보와 병합 (중복 제거)
    const existingCerts = matched.certificates || [];
    const mergedCerts = Array.from(new Set([...existingCerts, ...certs])).filter(Boolean);

    const { error: updateError } = await supabase
      .from('students')
      .update({
        certificates: mergedCerts,
        updated_at: new Date().toISOString()
      })
      .eq('id', matched.id);

    if (updateError) {
      errors.push(`[오류] ${studentName} 업데이트 실패: ${updateError.message}`);
      skippedCount++;
    } else {
      successCount++;
    }
  }

  return { successCount, skippedCount, errors };
}

function parseNeisCertificates(rawRows: any[][]) {
  // 1. 학과/학년/반 감지 (모든 행 탐색)
  let major = '';
  let grade = 0;
  let classInfo = '';
  let classRowIndex = -1;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    
    const classStr = row.find((cell: any) => typeof cell === 'string' && cell.includes('학년')) || '';
    const classMatch = classStr.match(/(?:공업계\s+)?([가-힣]+)\s+(\d)학년?\s+(\d+)반?/);
    if (classMatch) {
      major = classMatch[1].trim();
      grade = parseInt(classMatch[2]);
      classInfo = classMatch[3] + '반';
      classRowIndex = i;
      break;
    }
  }

  if (classRowIndex === -1) {
    throw new Error('엑셀 파일에서 학과 및 학년 반 정보를 감지할 수 없습니다. (예: 스마트전기과 3학년 1반)');
  }

  // 2. 헤더 행 감지 (번호/성명 헤더가 있는 행 찾기)
  let headerRowIndex = -1;
  for (let i = classRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const hasNumberHeader = row.some((cell: any) => typeof cell === 'string' && cell.replace(/\s+/g, '') === '번호');
    const hasNameHeader = row.some((cell: any) => typeof cell === 'string' && cell.replace(/\s+/g, '') === '성명');
    if (hasNumberHeader || hasNameHeader) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = classRowIndex + 1; // 폴백
  }

  // 3. 학생별 자격증 정보 수집 (헤더 행 다음부터 시작)
  const studentCerts: Record<string, string[]> = {};
  let currentNum = '';
  let currentName = '';

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const num = row[0];
    const name = row[1];
    const type = row[2]?.toString().trim();
    const certName = row[3]?.toString().trim();

    // 구분(row[2])이 '자격증'인 행만 처리하여 페이지 푸터나 구분행 필터링
    if (type !== '자격증') continue;

    // 번호가 명시되어 있고 숫자 형태이면 새 학생 시작
    const hasValidNumber = num !== null && num !== undefined && num !== '' && !isNaN(Number(num));
    if (hasValidNumber) {
      currentNum = num.toString().trim();
      currentName = name ? name.toString().trim() : '';
    }

    if (currentName && certName && certName !== '') {
      if (!studentCerts[currentName]) {
        studentCerts[currentName] = [];
      }
      
      // 중복 방지하며 자격증 이름 등록
      if (!studentCerts[currentName].includes(certName)) {
        studentCerts[currentName].push(certName);
      }
    }
  }

  return { major, grade, classInfo, studentCerts };
}



/**
 * 클라이언트에서 업로드하여 파싱한 엑셀 로우 데이터를 받아 저장
 */
export async function importUploadedCertificates(rawRows: any[][]) {
  const supabase = await createClient();
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  try {
    const { major, grade, classInfo, studentCerts } = parseNeisCertificates(rawRows);
    
    // 졸업학년도 계산
    const targetGradYear = baseYear + (4 - grade);

    const res = await saveParsedCertificatesToDb(
      supabase,
      targetGradYear,
      major,
      classInfo,
      studentCerts
    );

    revalidateTag(`cert-certificates-grade-${grade}`);
    revalidateTag('cert-certificates');
    revalidateTag('students');
    revalidatePath('/admin/certification/certificates');
    revalidatePath('/employment-status');
    revalidatePath('/students');



    return {
      success: true,
      major,
      grade,
      classInfo,
      successCount: res.successCount,
      skippedCount: res.skippedCount,
      errors: res.errors.length > 0 ? res.errors : null
    };

  } catch (e: any) {
    return {
      success: false,
      error: e.message
    };
  }
}
