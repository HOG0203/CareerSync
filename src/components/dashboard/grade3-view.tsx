'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, GraduationCap, Building2 } from 'lucide-react';
import CompanyTypeChart from './company-type-chart';
import MajorEmploymentChart from './major-employment-chart';
import ClassFieldTrainingChart from './class-field-training-chart';
import MajorFieldTrainingChart from './major-field-training-chart';
import CertificateStatusChart from './certificate-status-chart';
import CareerAspirationChart from './career-aspiration-chart';
import CareerCourseChart from './career-course-chart';
import SpecificCourseChart from './specific-course-chart';
import { StudentEmploymentData } from '@/lib/types';

interface Grade3ViewProps {
  filteredData: StudentEmploymentData[];
  selectedMajor: string;
  employmentRate: number;
  employedStudents: number;
  excludingStudents: number;
  trainingStudents: number;
  majorCompanyStudents: number;
  grade: number;
}

export default function Grade3View({
  filteredData,
  selectedMajor,
  employmentRate,
  employedStudents,
  excludingStudents,
  trainingStudents,
  majorCompanyStudents,
  grade
}: Grade3ViewProps) {
  return (
    <div className="flex flex-col gap-4 lg:gap-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-blue-50/30 border-blue-100 shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-blue-900">총 학생 수</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-blue-900">{filteredData.length}명</div>
            <p className="text-[9px] sm:text-xs text-blue-700/70 mt-0.5">분석 대상</p>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-50/30 border-emerald-100 shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-emerald-900">전체 취업률</CardTitle>
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-900">{employmentRate.toFixed(1)}%</div>
            <p className="text-[9px] sm:text-xs text-emerald-700/70 mt-0.5">{employedStudents}명 확정</p>
          </CardContent>
        </Card>

        <Card className="bg-cyan-50/30 border-cyan-100 shadow-sm border-l-4 border-l-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-cyan-900">현장실습</CardTitle>
            <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-cyan-900">{trainingStudents}명</div>
            <p className="text-[9px] sm:text-xs text-cyan-700/70 mt-0.5">참여 인원</p>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50/30 border-indigo-100 shadow-sm border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-indigo-900">주요 기업</CardTitle>
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-indigo-900">{majorCompanyStudents}명</div>
            <p className="text-[9px] sm:text-xs text-indigo-700/70 mt-0.5">대/공기업/공직</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 overflow-hidden">
         <CareerAspirationChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />
         <CareerCourseChart data={filteredData} grade={grade} selectedMajor={selectedMajor} />
         <SpecificCourseChart data={filteredData} selectedMajor={selectedMajor} />
         <MajorEmploymentChart data={filteredData} selectedMajor={selectedMajor} />
         <CompanyTypeChart data={filteredData} selectedMajor={selectedMajor} />
         <CertificateStatusChart data={filteredData} selectedMajor={selectedMajor} />
      </div>
    </div>
  );
}
