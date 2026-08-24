import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { getCachedStudentAccountsStore } from '@/lib/student-accounts';
import { createAdminClient } from '@/lib/supabase/server';
import { StudentAccountsClient } from './student-accounts-client';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { getMajorOrderIndex } from '@/lib/student-utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '학생 계정 및 로그인 관리 | CareerSync',
};

export default async function StudentAccountsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
    redirect('/dashboard');
  }

  const isAdmin = profile.role === 'admin';
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear || 2026;

  const supabase = createAdminClient();

  // 해당 학사기준년도의 현재 1, 2, 3학년 졸업연도 배열 (예: 2026학년도 -> 3학년:2027, 2학년:2028, 1학년:2029)
  const activeGraduationYears = [baseYear + 1, baseYear + 2, baseYear + 3];

  // 1. 학생 목록 조회 (현재 1, 2, 3학년 재학생만 필터링)
  let query = supabase
    .from('students')
    .select('id, student_name, graduation_year, major, class_info, student_number, phone_number')
    .in('graduation_year', activeGraduationYears)
    .order('graduation_year', { ascending: false })
    .order('major', { ascending: true })
    .order('class_info', { ascending: true })
    .order('student_number', { ascending: true });

  // 담임 교사인 경우 자기 학년 / 학과 / 학반으로 엄격 제한
  if (!isAdmin && profile.assigned_grade) {
    const targetGradYear = baseYear + (4 - profile.assigned_grade);
    query = query.eq('graduation_year', targetGradYear);

    if (profile.assigned_major) {
      query = query.eq('major', profile.assigned_major);
    }

    if (profile.assigned_class) {
      query = query.eq('class_info', profile.assigned_class);
    }
  }



  const [studentsRes, accountsStore] = await Promise.all([
    query,
    getCachedStudentAccountsStore(),
  ]);

  const rawStudents = studentsRes.data || [];

  // 데이터 가공 및 학년 계산
  const studentRows = rawStudents.map((s) => {
    const grade = Math.max(1, Math.min(3, baseYear + 4 - (s.graduation_year || baseYear + 1)));
    const meta = accountsStore[s.id];

    return {
      id: s.id,
      student_name: s.student_name,
      graduation_year: s.graduation_year || baseYear + 1,
      grade,
      major: s.major || '',
      class_info: s.class_info || '',
      student_number: s.student_number || '',
      phone_number: s.phone_number || null,
      has_custom_password: !!meta?.is_custom_password,
      password_changed_at: meta?.password_changed_at || null,
      last_login_at: meta?.last_login_at || null,
      login_count: meta?.login_count || 0,
      last_reset_at: meta?.last_reset_at || null,
    };
  });


  // 학년(1->2->3) -> 학과(공식순서) -> 반(1->2->3...) -> 번호(1->2->...->10->11) -> 이름 자연어 숫자 정렬
  studentRows.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;

    const majorOrderA = getMajorOrderIndex(a.major);
    const majorOrderB = getMajorOrderIndex(b.major);
    if (majorOrderA !== majorOrderB) return majorOrderA - majorOrderB;
    if (a.major !== b.major) return a.major.localeCompare(b.major, 'ko');
    
    const classA = parseInt(a.class_info.replace(/[^0-9]/g, ''), 10) || 0;
    const classB = parseInt(b.class_info.replace(/[^0-9]/g, ''), 10) || 0;
    if (classA !== classB) return classA - classB;

    const numA = parseInt(a.student_number.replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt(b.student_number.replace(/[^0-9]/g, ''), 10) || 0;
    if (numA !== numB) return numA - numB;

    return a.student_name.localeCompare(b.student_name, 'ko');
  });



  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserCheck className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            학생 계정 및 로그인 관리
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            학생들의 <span className="text-blue-600 font-bold">로그인 접속 이력</span>과 <span className="text-blue-600 font-bold">비밀번호 상태</span>를 확인하고, 분실 시 초기화(휴대폰 뒷자리)를 지원합니다.
          </p>
        </div>
      </div>

      <StudentAccountsClient
        initialStudents={studentRows}
        baseYear={baseYear}
        isAdmin={isAdmin}
        teacherGrade={profile.assigned_grade}
        teacherMajor={profile.assigned_major}
        teacherClass={profile.assigned_class}
      />
    </div>
  );
}

