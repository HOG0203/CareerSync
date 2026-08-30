'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/admin/admin-client.tsx
// 결보강 승인/관리 전용 클라이언트 페이지 (수업계/관리자 전용 콘솔)
// ==============================================================================

import * as React from 'react';
import { SubstituteApplication, ApplicationStatus } from '@/lib/substitute/types';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { 
  updateApplicationStatus, 
  saveAcademicCalendarConfig 
} from '../actions';
import { AcademicCalendarConfig, DEFAULT_ACADEMIC_CALENDAR_2026_2 } from '@/lib/substitute/event-types';
import { SubstituteStatsView } from '../substitute-stats-view';
import { SubstituteOfficialForm } from '../substitute-official-form';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AdminClientProps {
  initialApplications: SubstituteApplication[];
  timetableData: ParsedTimetableResult;
  initialCalendarConfig?: AcademicCalendarConfig;
  currentUserFullName?: string;
  currentUsername?: string;
}

export function AdminClient({
  initialApplications,
  timetableData,
  initialCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
  currentUserFullName = '수업계',
  currentUsername = 'admin',
}: AdminClientProps) {
  const [applications, setApplications] = React.useState<SubstituteApplication[]>(initialApplications);
  const [calendarConfig, setCalendarConfig] = React.useState<AcademicCalendarConfig>(initialCalendarConfig);
  const [viewingApps, setViewingApps] = React.useState<SubstituteApplication[] | null>(null);

  // 상태 변경 핸들러 (승인 / 반려 / 접수)
  const handleUpdateStatus = async (id: string, status: ApplicationStatus) => {
    const res = await updateApplicationStatus(id, status, currentUserFullName || '수업계');
    if (!res.success) {
      alert(res.error || '상태 변경에 실패했습니다.');
      return;
    }

    setApplications(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          status,
          approvedAt: status === 'approved' ? new Date().toISOString() : a.approvedAt,
          approvedBy: status === 'approved' ? (currentUserFullName || '수업계') : a.approvedBy,
        };
      }
      return a;
    }));

    if (viewingApps) {
      setViewingApps(prev => prev ? prev.map(a => a.id === id ? { ...a, status } : a) : null);
    }
  };

  // 학사일정 및 행사 설정 저장 핸들러
  const handleSaveCalendarConfig = async (newConfig: AcademicCalendarConfig) => {
    const res = await saveAcademicCalendarConfig(newConfig);
    if (!res.success || !res.data) {
      throw new Error(res.error || '학사일정 저장에 실패했습니다.');
    }
    setCalendarConfig(res.data);
  };

  // 공식 신청서 출력 뷰
  if (viewingApps && viewingApps.length > 0) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <SubstituteOfficialForm
          applications={viewingApps}
          onBack={() => setViewingApps(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full">
      {/* 수업계 전용 콘솔 뷰 */}
      <SubstituteStatsView
        applications={applications}
        timetableData={timetableData}
        calendarConfig={calendarConfig}
        onSaveCalendarConfig={handleSaveCalendarConfig}
        onUpdateStatus={handleUpdateStatus}
        onViewOfficialForm={(apps) => setViewingApps(Array.isArray(apps) ? apps : [apps])}
        currentUserFullName={currentUserFullName}
      />
    </div>
  );
}
