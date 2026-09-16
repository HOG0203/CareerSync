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
    <div className="flex flex-col gap-2.5 sm:gap-3 animate-in fade-in duration-500">
      {/* 4종 핵심 KPI 요약 카드 (class-management 스타일 통일) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        {/* 1. 총 학생 수 */}
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">총 학생 수</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{filteredData.length}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        
        {/* 2. 전체 취업률 */}
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                전체 취업률 <span className="text-[11px] sm:text-xs font-normal text-slate-400">({employedStudents}명 확정)</span>
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">
                {employmentRate.toFixed(1)}% {excludingStudents > 0 && <span className="text-xs font-bold text-slate-400">(제외 {excludingStudents}명)</span>}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Briefcase className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 3. 현장실습 / 도제OJT */}
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">현장실습 / 도제OJT</p>
              <p className="text-xl sm:text-2xl font-black text-purple-600 mt-0.5">{trainingStudents}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 4. 대·공기업·공직 취업 */}
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">대·공기업·공직 취업</p>
              <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{majorCompanyStudents}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Building2 className="h-5 w-5" />
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
