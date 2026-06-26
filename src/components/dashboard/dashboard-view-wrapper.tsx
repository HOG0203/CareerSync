'use client';

import * as React from 'react';
import Grade3View from './grade3-view';
import LowerGradeView from './lower-grade-view';
import { DashboardLoadingSkeleton } from './loading-skeleton';
import { StudentEmploymentData } from '@/lib/types';

interface DashboardViewWrapperProps {
  filteredData: StudentEmploymentData[];
  selectedMajor: string;
  employmentRate: number;
  employedStudents: number;
  excludingStudents: number;
  trainingStudents: number;
  majorCompanyStudents: number;
  grade: number;
}

export default function DashboardViewWrapper({
  filteredData,
  selectedMajor,
  employmentRate,
  employedStudents,
  excludingStudents,
  trainingStudents,
  majorCompanyStudents,
  grade,
}: DashboardViewWrapperProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const handleLoading = () => setIsLoading(true);
    window.addEventListener('dashboard-loading', handleLoading);
    return () => {
      window.removeEventListener('dashboard-loading', handleLoading);
    };
  }, []);

  React.useEffect(() => {
    setIsLoading(false);
  }, [filteredData]);

  if (isLoading) {
    return <DashboardLoadingSkeleton />;
  }

  if (grade === 3) {
    return (
      <Grade3View 
        filteredData={filteredData}
        selectedMajor={selectedMajor}
        employmentRate={employmentRate}
        employedStudents={employedStudents}
        excludingStudents={excludingStudents}
        trainingStudents={trainingStudents}
        majorCompanyStudents={majorCompanyStudents}
        grade={grade}
      />
    );
  }

  return (
    <LowerGradeView 
      filteredData={filteredData}
      selectedMajor={selectedMajor}
      grade={grade}
    />
  );
}
