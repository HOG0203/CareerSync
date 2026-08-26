'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

export interface ParsedAttendanceData {
  studentId?: string;
  studentName: string;
  studentNumber: string;
  gradeObtained: number;
  semester?: number;
  schoolDays: number;
  absentDisease: number;
  absentUnexcused: number;
  absentOther: number;
  lateDisease: number;
  lateUnexcused: number;
  lateOther: number;
  earlyDisease: number;
  earlyUnexcused: number;
  earlyOther: number;
  outDisease: number;
  outUnexcused: number;
  outOther: number;
  remarks: string;
  major: string;
  classInfo: string;
  currentGrade: number;
}

/**
 * 엑셀 데이터의 학생 정보를 시스템 내 UUID와 매칭합니다. (매칭 로직 대폭 강화)
 */
export async function matchStudentsForAttendance(
  uniqueKeys: { major: string; classInfo: string; number: string; name: string; currentGrade: number }[],
  academicYear: number
) {
  const supabase = await createClient();
  const matchMap: Record<string, { id: string; major: string; classInfo: string; gradYear: number }> = {};

  // 학년별로 키 그룹화하여 Supabase 쿼리 최소화 및 분기 처리
  const keysByGrade: Record<number, typeof uniqueKeys> = {};
  uniqueKeys.forEach(key => {
    if (!keysByGrade[key.currentGrade]) {
      keysByGrade[key.currentGrade] = [];
    }
    keysByGrade[key.currentGrade].push(key);
  });

  for (const gradeStr of Object.keys(keysByGrade)) {
    const currentGrade = parseInt(gradeStr);
    const graduationYear = academicYear + (4 - currentGrade);

    // 해당 학년(기수)의 전체 학생 명단 확보
    const { data: students, error } = await supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year')
      .eq('graduation_year', graduationYear);

    if (error || !students) continue;

    keysByGrade[currentGrade].forEach(key => {
      // [정규화] 엑셀 데이터
      const targetName = key.name.replace(/\s+/g, '');
      const targetNum = parseInt(key.number).toString();
      const targetClass = key.classInfo.replace(/반|학년/g, '').trim();
      const targetMajor = key.major.replace(/과|공업계/g, '').trim();

      const match = students.find(s => {
        // [정규화] DB 데이터
        const dbName = (s.student_name || '').replace(/\s+/g, '');
        const dbNum = parseInt(s.student_number || '0').toString();
        const dbClass = (s.class_info || '').replace(/반|학년/g, '').trim();
        const dbMajor = (s.major || '').replace(/과|공업계/g, '').trim();

        // 이름과 번호는 필수 일치, 학과와 반은 포함 관계 확인
        const nameMatch = dbName === targetName;
        const numMatch = dbNum === targetNum;
        const classMatch = dbClass === targetClass || dbClass.includes(targetClass) || targetClass.includes(dbClass);
        const majorMatch = dbMajor === targetMajor || dbMajor.includes(targetMajor) || targetMajor.includes(dbMajor);

        return nameMatch && numMatch && classMatch && majorMatch;
      });

      if (match) {
        matchMap[`${key.major}_${key.classInfo}_${key.number}_${key.name}`] = {
          id: match.id,
          major: match.major,
          classInfo: match.class_info,
          gradYear: match.graduation_year
        };
      }
    });
  }

  return { matchMap };
}

/**
 * 출결 데이터를 DB에 일괄 저장(Upsert)합니다.
 */
export async function uploadStudentAttendance(
  data: ParsedAttendanceData[],
  baseAcademicYear: number
) {
  const supabase = await createClient();
  
  const upsertData = data.filter(d => d.studentId).map(d => {
    // 실제 발생 연도 계산 (개별 학생의 업로드 시점 학년 d.currentGrade 기준 적용)
    const actualYear = baseAcademicYear - (d.currentGrade - d.gradeObtained);

    return {
      student_id: d.studentId,
      academic_year: actualYear,
      grade: d.gradeObtained,
      semester: 1, 
      school_days: d.schoolDays,
      absent_disease: d.absentDisease,
      absent_unexcused: d.absentUnexcused,
      absent_other: d.absentOther,
      late_disease: d.lateDisease,
      late_unexcused: d.lateUnexcused,
      late_other: d.lateOther,
      early_disease: d.earlyDisease,
      early_unexcused: d.earlyUnexcused,
      early_other: d.earlyOther,
      out_disease: d.outDisease,
      out_unexcused: d.outUnexcused,
      out_other: d.outOther,
      remarks: d.remarks,
      updated_at: new Date().toISOString()
    };
  });

  if (upsertData.length === 0) return { error: "매칭된 학생이 없어 저장할 데이터가 없습니다." };

  const { error } = await supabase
    .from('student_attendance')
    .upsert(upsertData, { onConflict: 'student_id, academic_year, grade, semester' });

  if (error) return { error: error.message };
  
  // 업로드된 데이터에 포함된 학년들만 핀포인트 캐시 비우기
  const affectedGrades = Array.from(new Set(data.map(d => d.currentGrade).filter(Boolean)));
  affectedGrades.forEach(g => {
    revalidateTag(`cert-attendance-grade-${g}`);
    clearAttendanceCache(g);
  });
  revalidateTag('cert-attendance');
  revalidatePath('/admin/certification/attendance');
  return { success: true, count: upsertData.length };
}

export async function deleteAllStudentAttendance() {
  const supabase = await createClient();
  const { error } = await supabase.from('student_attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return { success: false, error: error.message };
  [1, 2, 3].forEach(g => {
    revalidateTag(`cert-attendance-grade-${g}`);
    clearAttendanceCache(g);
  });
  revalidateTag('cert-attendance');
  revalidatePath('/admin/certification/attendance');
  return { success: true };
}

// 출결 현황 서버 인메모리 캐시 (0ms 초고속 응답용, 5분 TTL)
const attendanceMemoryCache: Record<string, { data: any[]; timestamp: number }> = {};
const ATTENDANCE_CACHE_TTL_MS = 5 * 60 * 1000;

export async function clearAttendanceCache(gradeNum?: number) {
  if (gradeNum) {
    Object.keys(attendanceMemoryCache).forEach(k => {
      if (k.endsWith(`-${gradeNum}`)) delete attendanceMemoryCache[k];
    });
  } else {
    Object.keys(attendanceMemoryCache).forEach(k => delete attendanceMemoryCache[k]);
  }
}

export async function getAllAttendanceRecords(academicYear: number, currentGrade: number, forceFresh: boolean = false) {
  const cacheKey = `${academicYear}-${currentGrade}`;
  const now = Date.now();
  const cached = attendanceMemoryCache[cacheKey];
  if (!forceFresh && cached && (now - cached.timestamp < ATTENDANCE_CACHE_TTL_MS)) {
    return cached.data;
  }

  const supabase = createAdminClient();
  const targetGraduationYear = academicYear + (4 - currentGrade);

  // 1. [1-Shot 초고속 병렬화] 학생 명부와 3개년 출결 레코드를 필요한 컬럼만 추출하여 초고속 동시 병렬 패칭
  const [studentsRes, attendanceRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year')
      .eq('graduation_year', targetGraduationYear)
      .order('major', { ascending: true })
      .order('class_info', { ascending: true })
      .order('student_number', { ascending: true }),
    supabase
      .from('student_attendance')
      .select('id, student_id, academic_year, grade, semester, school_days, absent_unexcused, late_unexcused, early_unexcused, out_unexcused, absent_disease, late_disease, early_disease, out_disease, absent_other, late_other, early_other, out_other, remarks, students!inner(graduation_year)')
      .eq('students.graduation_year', targetGraduationYear)
      .order('grade', { ascending: true })
      .range(0, 5000)
  ]);

  const students = studentsRes.data;
  if (!students || students.length === 0) return [];

  // 학생 맵 생성
  const studentMap: Record<string, any> = {};
  students.forEach(s => {
    studentMap[s.id] = {
      student_name: s.student_name,
      student_number: s.student_number,
      major: s.major,
      class_info: s.class_info,
      graduation_year: s.graduation_year
    };
  });

  // 출결 데이터에 학생 정보 바인딩
  const combinedData = (attendanceRes.data || []).map(r => ({
    ...r,
    students: studentMap[r.student_id] || null
  }));

  attendanceMemoryCache[cacheKey] = { data: combinedData, timestamp: now };
  return combinedData;
}

/**
 * [캐싱 최적화] 학년별 전교생 출결 기록 Next.js 글로벌 영구 캐시 조회 (Vercel 전역 0.01초 공유)
 */
const attendanceCacheMap = new Map<string, ReturnType<typeof unstable_cache>>();

export async function getCachedAllAttendanceRecords(academicYear: number, currentGrade: number) {
  const cacheKey = `${academicYear}-${currentGrade}`;
  if (!attendanceCacheMap.has(cacheKey)) {
    const cachedFn = unstable_cache(
      async () => getAllAttendanceRecords(academicYear, currentGrade),
      [`attendance-records-${cacheKey}`],
      {
        revalidate: 86400,
        tags: [`cert-attendance-grade-${currentGrade}`, 'cert-attendance', 'students']
      }
    );
    attendanceCacheMap.set(cacheKey, cachedFn);
  }
  return attendanceCacheMap.get(cacheKey)!();
}
