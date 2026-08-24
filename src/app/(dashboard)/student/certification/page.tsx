import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { getStudentSingleEvaluation } from '@/app/(dashboard)/admin/certification/actions';
import { StudentCertificationView } from './student-certification-view';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '종합평가표 | CareerSync',
};


export default async function StudentCertificationPage({
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
    // 1. 프로필의 full_name 및 학과/반 정보로 매칭
    let query = supabase.from('students').select('id');
    
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

  const evaluation = await getStudentSingleEvaluation(targetStudentId);

  if (!evaluation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl max-w-md">
          <h2 className="text-base font-bold text-red-900 mb-1">평가 데이터를 산출할 수 없습니다</h2>
          <p className="text-xs text-red-700 leading-relaxed">
            해당 학생의 옥저인증제 데이터가 아직 준비되지 않았습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StudentCertificationView
      evaluation={evaluation}
      baseYear={baseYear}
    />
  );
}
