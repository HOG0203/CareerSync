'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Award, Briefcase } from 'lucide-react';
import CareerAspirationChart from './career-aspiration-chart';
import CareerCourseChart from './career-course-chart';
import SpecificCourseChart from './specific-course-chart';
import MilitaryStatusChart from './military-status-chart';
import CertificateStatusChart from './certificate-status-chart';
import { StudentEmploymentData } from '@/lib/types';
import { DraggableChartGrid } from './draggable-chart-grid';

import { saveDashboardChartLayout } from '@/app/(dashboard)/admin/settings/actions';

interface LowerGradeViewProps {
  filteredData: StudentEmploymentData[];
  selectedMajor: string;
  grade: number;
  isAdmin?: boolean;
  initialOrder?: string[];
}

const DEFAULT_KEYS = ['aspiration', 'course', 'specific', 'military', 'certificate'];

export default function LowerGradeView({
  filteredData,
  selectedMajor,
  grade,
  isAdmin = false,
  initialOrder,
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
  const employmentDesireStudents = filteredData.filter(s => 
    s.career_aspiration === '취업'
  ).length;

  const certificateHolders = filteredData.filter(s => (s.certificates?.length || 0) > 0).length;

  const renderChart = (key: string) => {
    switch (key) {
      case 'aspiration':
        return <CareerAspirationChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />;
      case 'course':
        return <CareerCourseChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />;
      case 'specific':
        return <SpecificCourseChart data={filteredData} selectedMajor={selectedMajor} grade={grade} />;
      case 'military':
        return <MilitaryStatusChart data={filteredData} selectedMajor={selectedMajor} />;
      case 'certificate':
        return <CertificateStatusChart data={filteredData} selectedMajor={selectedMajor} />;
      default:
        return null;
    }
  };

  const handleSaveOrder = async (newOrder: string[]) => {
    await saveDashboardChartLayout('lowerGradeOrder', newOrder);
  };

  const decidedRate = totalStudents > 0 ? ((decidedCareerStudents / totalStudents) * 100).toFixed(1) : '0';
  const employmentRate = totalStudents > 0 ? ((employmentDesireStudents / totalStudents) * 100).toFixed(1) : '0';
  const certRate = totalStudents > 0 ? ((certificateHolders / totalStudents) * 100).toFixed(1) : '0';

  return (
    <div className="flex flex-col gap-5 lg:gap-6 animate-in fade-in duration-500">
      {/* 4종 핵심 KPI 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* 1. 총 학생 수 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white hover:border-indigo-200 transition-all overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">총 학생 수</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalStudents}</span>
                <span className="text-xs font-bold text-slate-500">명</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">분석 대상 인원</p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>
        
        {/* 2. 진로 결정 학생 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white hover:border-purple-200 transition-all overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">진로 결정 학생</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-purple-600">{decidedCareerStudents}</span>
                <span className="text-xs font-bold text-purple-600">명</span>
              </div>
              <p className="text-[11px] text-purple-600/80 font-bold">
                설정률 {decidedRate}%
              </p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        {/* 3. 취업 희망 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white hover:border-emerald-200 transition-all overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">취업 희망자</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">{employmentDesireStudents}</span>
                <span className="text-xs font-bold text-emerald-600">명</span>
              </div>
              <p className="text-[11px] text-emerald-600/80 font-bold">
                비율 {employmentRate}%
              </p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        {/* 4. 자격증 보유자 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white hover:border-blue-200 transition-all overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">자격증 보유자</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-blue-600">{certificateHolders}</span>
                <span className="text-xs font-bold text-blue-600">명</span>
              </div>
              <p className="text-[11px] text-blue-600/80 font-bold">
                취득률 {certRate}%
              </p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <Award className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5종 차트 그리드 */}
      <DraggableChartGrid
        storageKey="dashboard_chart_order_lower"
        defaultKeys={DEFAULT_KEYS}
        initialOrder={initialOrder}
        isAdmin={isAdmin}
        onSaveOrder={handleSaveOrder}
        renderChart={renderChart}
      />
    </div>
  );
}
