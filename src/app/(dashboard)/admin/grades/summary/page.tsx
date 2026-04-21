import { Metadata } from 'next';
import { getAllStudentScores, getAchievementScores, getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';
import { GradeSummaryClient } from './grade-summary-client';
import { LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: '성적 총괄 현황 | CareerSync',
};

export default async function GradeSummaryPage() {
  const profile = await getCurrentUserProfile();

  // 관리자만 접근 가능
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const scores = await getAllStudentScores();
  const weights = await getAchievementScores();

  // 중복 데이터 정밀 체크 (DB 레벨 전수 조사)
  const duplicateGroups: Record<string, any> = {};
  const seen = new Map<string, number>();
  
  scores.forEach(s => {
    const key = `${s.student_id}_${s.academic_year}_${s.grade}_${s.semester}_${s.subject}`;
    const currentCount = (seen.get(key) || 0) + 1;
    seen.set(key, currentCount);
    
    if (currentCount > 1) {
      duplicateGroups[key] = {
        name: s.students?.student_name,
        number: s.students?.student_number,
        major: s.students?.major,
        classInfo: s.students?.class_info,
        subject: s.subject,
        year: s.academic_year,
        grade: s.grade,
        sem: s.semester,
        count: currentCount
      };
    }
  });

  const duplicateList = Object.values(duplicateGroups);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7 lg:h-8 lg:w-8 text-indigo-600 shrink-0" />
          성적 총괄 현황
        </h2>
        <p className="text-muted-foreground text-xs lg:text-sm font-medium leading-relaxed">
          DB에 저장된 모든 학생의 성적을 100점 만점으로 환산하여 석차와 함께 조회합니다.
        </p>
      </div>

      <div className="flex-1 min-h-0 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <GradeSummaryClient 
          initialScores={scores as any} 
          weights={weights} 
          allDuplicates={duplicateList} 
        />
      </div>
    </div>
  );
}
