'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ParsedAttendanceData {
  studentId?: string;
  studentName: string;
  studentNumber: string;
  gradeObtained: number;
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
}

/**
 * 엑셀 데이터의 학생 정보를 시스템 내 UUID와 매칭합니다. (매칭 로직 대폭 강화)
 */
export async function matchStudentsForAttendance(
  uniqueKeys: { major: string; classInfo: string; number: string; name: string }[],
  academicYear: number,
  currentGrade: number
) {
  const supabase = await createClient();
  const graduationYear = academicYear + (4 - currentGrade);

  // 해당 학년(기수)의 전체 학생 명단 확보
  const { data: students, error } = await supabase
    .from('students')
    .select('id, student_name, student_number, major, class_info, graduation_year')
    .eq('graduation_year', graduationYear);

  if (error) return { error: error.message };

  const matchMap: Record<string, { id: string; major: string; classInfo: string; gradYear: number }> = {};
  
  uniqueKeys.forEach(key => {
    // [정규화] 엑셀 데이터
    const targetName = key.name.replace(/\s+/g, '');
    const targetNum = parseInt(key.number).toString();
    const targetClass = key.classInfo.replace(/반|학년/g, '').trim();
    const targetMajor = key.major.replace(/과|공업계/g, '').trim();

    const match = students?.find(s => {
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

  return { matchMap };
}

/**
 * 출결 데이터를 DB에 일괄 저장(Upsert)합니다.
 */
export async function uploadStudentAttendance(
  data: ParsedAttendanceData[],
  baseAcademicYear: number,
  currentGradeAtUpload: number
) {
  const supabase = await createClient();
  
  const upsertData = data.filter(d => d.studentId).map(d => {
    // 실제 발생 연도 계산
    const actualYear = baseAcademicYear - (currentGradeAtUpload - d.gradeObtained);

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
  revalidatePath('/admin/grades/summary/attendance');
  return { success: true, count: upsertData.length };
}

export async function deleteAllStudentAttendance() {
  const supabase = await createClient();
  const { error } = await supabase.from('student_attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/grades/summary/attendance');
  return { success: true };
}

export async function getAllAttendanceRecords(academicYear: number, currentGrade: number) {
  const supabase = await createClient();
  const targetGraduationYear = academicYear + (4 - currentGrade);

  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('graduation_year', targetGraduationYear);

  if (!students || students.length === 0) return [];

  const studentIds = students.map(s => s.id);

  const { data, error } = await supabase
    .from('student_attendance')
    .select(`
      *,
      students (
        student_name,
        student_number,
        major,
        class_info,
        graduation_year
      )
    `)
    .in('student_id', studentIds)
    .order('grade', { ascending: true });

  if (error) return [];
  return data;
}
