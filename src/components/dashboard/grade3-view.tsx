'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, GraduationCap, Building2 } from 'lucide-react';
import CompanyTypeChart from './company-type-chart';
import MajorEmploymentChart from './major-employment-chart';
import CertificateStatusChart from './certificate-status-chart';
import CareerAspirationChart from './career-aspiration-chart';
import CareerCourseChart from './career-course-chart';
import SpecificCourseChart from './specific-course-chart';
import { StudentEmploymentData } from '@/lib/types';
import { DraggableChartGrid } from './draggable-chart-grid';

import { saveDashboardChartLayout } from '@/app/(dashboard)/admin/settings/actions';

interface Grade3ViewProps {
  filteredData: StudentEmploymentData[];
  selectedMajor: string;
  employmentRate: number;
  employedStudents: number;
  excludingStudents: number;
  trainingStudents: number;
  majorCompanyStudents: number;
  grade: number;
  isAdmin?: boolean;
  initialOrder?: string[];
}

const DEFAULT_KEYS = ['aspiration', 'course', 'specific', 'employment', 'company', 'certificate'];

export default function Grade3View({
  filteredData,
  selectedMajor,
  employmentRate,
  employedStudents,
  excludingStudents,
  trainingStudents,
  majorCompanyStudents,
  grade,
  isAdmin = false,
  initialOrder,
}: Grade3ViewProps) {
  const renderChart = (key: string) => {
    switch (key) {
      case 'aspiration':
        return <CareerAspirationChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />;
      case 'course':
        return <CareerCourseChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />;
      case 'specific':
        return <SpecificCourseChart data={filteredData} selectedMajor={selectedMajor} grade={grade} />;
      case 'employment':
        return <MajorEmploymentChart data={filteredData} selectedMajor={selectedMajor} />;
      case 'company':
        return <CompanyTypeChart data={filteredData} selectedMajor={selectedMajor} />;
      case 'certificate':
        return <CertificateStatusChart data={filteredData} selectedMajor={selectedMajor} />;
      default:
        return null;
    }
  };

  const handleSaveOrder = async (newOrder: string[]) => {
    await saveDashboardChartLayout('grade3Order', newOrder);
  };

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
                <span className="text-2xl sm:text-3xl font-black text-slate-900">{filteredData.length}</span>
                <span className="text-xs font-bold text-slate-500">명</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">분석 대상 인원</p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>
        
        {/* 2. 전체 취업률 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white hover:border-emerald-200 transition-all overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">전체 취업률</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">{employmentRate.toFixed(1)}</span>
                <span className="text-xs font-bold text-emerald-600">%</span>
              </div>
              <p className="text-[11px] text-emerald-600/80 font-bold">
                {employedStudents}명 확정 {excludingStudents > 0 && `(제외 ${excludingStudents}명)`}
              </p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        {/* 3. 현장실습 / 도제OJT */}
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white hover:border-purple-200 transition-all overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">현장실습 / 도제OJT</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-purple-600">{trainingStudents}</span>
                <span className="text-xs font-bold text-purple-600">명</span>
              </div>
              <p className="text-[11px] text-purple-600/80 font-bold">실습 참여 및 파견</p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        {/* 4. 대·공기업·공직 취업 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-xs bg-white hover:border-amber-200 transition-all overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">대·공기업·공직 취업</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-amber-600">{majorCompanyStudents}</span>
                <span className="text-xs font-bold text-amber-600">명</span>
              </div>
              <p className="text-[11px] text-amber-600/80 font-bold">대기업/공기업/공무원</p>
            </div>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100/80 flex items-center justify-center shrink-0 shadow-3xs">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6종 차트 그리드 */}
      <DraggableChartGrid
        storageKey="dashboard_chart_order_grade3"
        defaultKeys={DEFAULT_KEYS}
        initialOrder={initialOrder}
        isAdmin={isAdmin}
        onSaveOrder={handleSaveOrder}
        renderChart={renderChart}
      />
    </div>
  );
}
