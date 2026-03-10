'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Award, Briefcase } from 'lucide-react';
import CareerAspirationChart from './career-aspiration-chart';
import CareerCourseChart from './career-course-chart';
import MilitaryStatusChart from './military-status-chart';
import CertificateStatusChart from './certificate-status-chart';
import { StudentEmploymentData } from '@/lib/types';

interface LowerGradeViewProps {
  filteredData: StudentEmploymentData[];
  selectedMajor: string;
  grade: number;
}

export default function LowerGradeView({
  filteredData,
  selectedMajor,
  grade
}: LowerGradeViewProps) {
  // 요약 통계 계산
  const totalStudents = filteredData.length;
  
  // 진로 결정 학생 (미정, 진로탐색중 제외)
  const decidedCareerStudents = filteredData.filter(s => 
    s.career_aspiration && 
    s.career_aspiration !== '미정' && 
    s.career_aspiration !== '진로탐색중' &&
    s.career_aspiration !== '미설정' &&
    s.career_aspiration !== '진로미결정'
  ).length;

  // 취업 희망 학생 계산 로직
  const employmentDesireStudents = filteredData.filter(s => {
    const aspiration = s.career_aspiration;
    if (!aspiration || aspiration === '미정' || aspiration === '진로탐색중' || aspiration === '미설정' || aspiration === '진로미결정') return false;

    if (grade === 2) {
      return !['군특성화', '기술사관', '진학'].includes(aspiration);
    } else if (grade === 1) {
      return !['진학희망'].includes(aspiration);
    }
    return false;
  }).length;

  const certificateHolders = filteredData.filter(s => (s.certificates?.length || 0) > 0).length;

  return (
    <div className="flex flex-col gap-4 lg:gap-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-slate-50/50 border-slate-200 shadow-sm border-l-4 border-l-slate-400">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-slate-900">총 학생 수</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-slate-900">{totalStudents}명</div>
            <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5">분석 대상 인원</p>
          </CardContent>
        </Card>
        
        <Card className="bg-indigo-50/30 border-indigo-100 shadow-sm border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-indigo-900">진로 결정</CardTitle>
            <Target className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-indigo-900">{decidedCareerStudents}명</div>
            <p className="text-[9px] sm:text-xs text-indigo-700/70 mt-0.5">희망 경로 설정</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/30 border-emerald-100 shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-emerald-900">취업 희망</CardTitle>
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-900">{employmentDesireStudents}명</div>
            <p className="text-[9px] sm:text-xs text-emerald-700/70 mt-0.5">취업 지향 학생</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/30 border-blue-100 shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-blue-900">자격증 보유</CardTitle>
            <Award className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-blue-900">{certificateHolders}명</div>
            <p className="text-[9px] sm:text-xs text-blue-700/70 mt-0.5">1개 이상 취득자</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 섹션 - selectedMajor 전달 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 overflow-hidden">
         <CareerAspirationChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />
         <CareerCourseChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 overflow-hidden">
         <MilitaryStatusChart data={filteredData} selectedMajor={selectedMajor} />
         <CertificateStatusChart 
           data={filteredData} 
           selectedMajor={selectedMajor} 
         />
      </div>
    </div>
  );
}
