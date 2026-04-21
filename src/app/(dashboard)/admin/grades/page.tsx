import { Metadata } from 'next';
import { GradeImportClient } from './grade-import-client';
import { getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';
import { GraduationCap } from 'lucide-react';

export const metadata: Metadata = {
  title: '성적 관리 및 일괄 입력 | CareerSync',
};

export default async function GradesPage() {
  const profile = await getCurrentUserProfile();

  // 관리자만 접근 가능
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <GraduationCap className="h-7 w-7 lg:h-8 lg:w-8 text-indigo-600 shrink-0" />
          성적 관리 및 일괄 입력
        </h2>
        <p className="text-muted-foreground text-xs lg:text-sm font-medium leading-relaxed">
          성취도별 점수 가중치를 설정하고, 엑셀 파일을 업로드하여 학생들의 성적을 일괄 등록합니다.
        </p>
      </div>

      <div className="flex-1 min-h-0 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <GradeImportClient />
      </div>
    </div>
  );
}
