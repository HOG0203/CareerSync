import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { getCachedMeritDemeritRecordsStore } from '@/app/(dashboard)/merit-demerit/actions';
import { StudentMeritClient } from './student-merit-client';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '상벌점 내역 조회 | CareerSync',
};

export default async function StudentMeritPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect('/login');
  }

  const { studentId: queryStudentId } = await searchParams;
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  const supabase = createAdminClient();
  let targetStudentId = queryStudentId;

  // 학생 본인이 접속한 경우
  if (profile.role === 'student' || !targetStudentId) {
    if (profile.username.startsWith('std_')) {
      const rawStdId = profile.username.replace('std_', '');
      const { data: stdMatch } = await supabase
        .from('students')
        .select('id')
        .ilike('id', `${rawStdId}%`)
        .maybeSingle();

      if (stdMatch) {
        targetStudentId = stdMatch.id;
      }
    }

    if (!targetStudentId) {
      const { data: matched } = await supabase
        .from('students')
        .select('id')
        .eq('student_name', profile.full_name)
        .order('created_at', { ascending: false })
        .limit(1);

      if (matched && matched.length > 0) {
        targetStudentId = matched[0].id;
      }
    }
  }

  if (!targetStudentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-md">
          <h2 className="text-base font-bold text-amber-900 mb-1">학생 정보를 불러올 수 없습니다</h2>
          <p className="text-xs text-amber-700 leading-relaxed">
            학적 데이터와 연결되지 않은 계정입니다. 담임선생님 또는 관리자에게 문의해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // 학생 기본 정보 및 상벌점 스토어 병렬 조회
  const [studentRes, store] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year')
      .eq('id', targetStudentId)
      .maybeSingle(),
    getCachedMeritDemeritRecordsStore()
  ]);

  const studentData = studentRes.data;
  if (!studentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl max-w-md">
          <h2 className="text-base font-bold text-red-900 mb-1">학생 정보를 찾을 수 없습니다</h2>
          <p className="text-xs text-red-700 leading-relaxed">
            해당 학생의 정보가 데이터베이스에 존재하지 않습니다.
          </p>
        </div>
      </div>
    );
  }

  // 학년 계산
  const gradYear = studentData.graduation_year || (baseYear + 1);
  const diff = gradYear - baseYear;
  const grade = diff === 1 ? 3 : diff === 2 ? 2 : diff === 3 ? 1 : 3;

  const studentInfo = {
    id: studentData.id,
    student_name: studentData.student_name,
    student_number: studentData.student_number || '',
    major: studentData.major || '',
    class_info: studentData.class_info || '',
    grade
  };

  const records = store[targetStudentId] || [];

  return (
    <StudentMeritClient
      student={studentInfo}
      records={records}
      baseYear={baseYear}
    />
  );
}
