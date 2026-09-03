'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/substitute-client.tsx
// 일반 교사 중심 결보강 및 수업 교체 관리 클라이언트 허브 (Teacher-First UX)
// ==============================================================================

import * as React from 'react';
import { SubstituteApplication, SubstituteType, ApplicationStatus } from '@/lib/substitute/types';
import { ParsedTimetableResult, TimetableSlot } from '@/lib/timetable/parser';
import { 
  saveSubstituteApplication, 
  updateApplicationStatus, 
  deleteSubstituteApplication,
  saveAcademicCalendarConfig
} from './actions';
import { AcademicCalendarConfig, DEFAULT_ACADEMIC_CALENDAR_2026_2 } from '@/lib/substitute/event-types';
import { getEventsForSlot } from '@/lib/substitute/event-helper';
import { InteractiveTeacherTimetable, SelectedSlotItem } from './interactive-teacher-timetable';
import { BatchExchangeDrawer } from './batch-exchange-drawer';
import { useSearchParams } from 'next/navigation';
import { SubstituteOfficialForm } from './substitute-official-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeftRight, 
  Sparkles, 
  Calendar, 
  FileText, 
  Printer, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  User,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateSemesterWeeksFromConfig, findCurrentWeekNum } from '@/lib/substitute/event-helper';

interface SubstituteClientProps {
  initialApplications: SubstituteApplication[];
  timetableData: ParsedTimetableResult;
  initialCalendarConfig?: AcademicCalendarConfig;
  currentUserFullName?: string;
  currentUsername?: string;
}

export function SubstituteClient({
  initialApplications,
  timetableData,
  initialCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
  currentUserFullName,
  currentUsername,
}: SubstituteClientProps) {
  const [applications, setApplications] = React.useState<SubstituteApplication[]>(initialApplications);
  const [calendarConfig, setCalendarConfig] = React.useState<AcademicCalendarConfig>(initialCalendarConfig);
  
  // 현재 선택된 교사명 (기본값: 로그인 교사 또는 첫 번째 교사)
  const defaultTeacherName = React.useMemo(() => {
    const match = timetableData.teachers.find(
      t => t.teacherName === currentUserFullName || t.teacherName === currentUsername
    );
    return match ? match.teacherName : (timetableData.teachers[0]?.teacherName || '');
  }, [timetableData.teachers, currentUserFullName, currentUsername]);

  const [selectedTeacherName, setSelectedTeacherName] = React.useState<string>(defaultTeacherName);

  // 학기 주차 목록 생성 (설정된 학사일정 기반 동적 계산)
  const semesterWeeks = React.useMemo(() => {
    return generateSemesterWeeksFromConfig(calendarConfig);
  }, [calendarConfig]);

  // 현재 주차 자동 계산 (오늘 날짜 및 주말 완벽 대응)
  const defaultWeekNum = React.useMemo(() => {
    return findCurrentWeekNum(semesterWeeks);
  }, [semesterWeeks]);

  const [selectedWeekNum, setSelectedWeekNum] = React.useState<number>(defaultWeekNum);

  React.useEffect(() => {
    setSelectedWeekNum(defaultWeekNum);
  }, [defaultWeekNum]);

  const handlePrevWeek = () => {
    if (selectedWeekNum > 1) {
      setSelectedWeekNum(prev => prev - 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeekNum < semesterWeeks.length) {
      setSelectedWeekNum(prev => prev + 1);
    }
  };

  // 통합 신청 서랍 상태 (1개 슬롯 및 다교시 슬롯 모두 동일 서랍과 통일된 로직 사용)
  const [batchSlots, setBatchSlots] = React.useState<SelectedSlotItem[]>([]);
  const [drawerInitialMode, setDrawerInitialMode] = React.useState<SubstituteType>('exchange');

  const handleOpenDrawer = (slots: SelectedSlotItem[], mode: 'exchange' | 'substitute' = 'exchange') => {
    setDrawerInitialMode(mode);
    setBatchSlots(slots);
  };

  // 공식 신청서 뷰 모달 (단일 또는 다중 일괄)
  const [viewingApps, setViewingApps] = React.useState<SubstituteApplication[] | null>(null);

  // 내 신청현황 다중 선택 상태 (제출 접수됨 / 승인됨 일괄 인쇄용)
  const [selectedAppIds, setSelectedAppIds] = React.useState<string[]>([]);

  // 하단 뷰 탭 ('myApps' = 내 신청현황, 'today' = 오늘 전체현황)
  const [bottomTab, setBottomTab] = React.useState<'myApps' | 'today'>('myApps');

  // 신청서 저장 핸들러
  const handleSaveApplication = async (app: SubstituteApplication) => {
    const res = await saveSubstituteApplication(app);
    if (!res.success || !res.data) {
      throw new Error(res.error || '저장에 실패했습니다.');
    }

    setApplications(prev => {
      const idx = prev.findIndex(a => a.id === res.data!.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = res.data!;
        return next;
      }
      return [res.data!, ...prev];
    });

    // 하단 탭을 '내 신청 현황'으로 자동 전환하여 방금 등록한 내역이 바로 보이게 함
    setBottomTab('myApps');
  };

  // 상태 변경 핸들러
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

  // 신청서 삭제 핸들러
  const handleDeleteApplication = async (id: string) => {
    if (!confirm('정말로 이 신청서를 삭제하시겠습니까?')) return;
    const res = await deleteSubstituteApplication(id);
    if (!res.success) {
      alert(res.error || '삭제에 실패했습니다.');
      return;
    }
    setApplications(prev => prev.filter(a => a.id !== id));
    setSelectedAppIds(prev => prev.filter(x => x !== id));
    if (viewingApps) {
      setViewingApps(prev => {
        const next = prev ? prev.filter(a => a.id !== id) : [];
        return next.length > 0 ? next : null;
      });
    }
  };

  // '내 신청' 필터
  const myApplications = React.useMemo(() => {
    return applications.filter(a => a.applicantTeacher === selectedTeacherName);
  }, [applications, selectedTeacherName]);

  // 다중 선택 토글 핸들러
  const toggleSelectApp = (id: string) => {
    setSelectedAppIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 제출/접수된 신청서 전체 선택 토글
  const printableApps = React.useMemo(() => {
    return myApplications.filter(a => a.status === 'submitted' || a.status === 'approved');
  }, [myApplications]);

  const handleToggleSelectAll = () => {
    if (selectedAppIds.length === printableApps.length && printableApps.length > 0) {
      setSelectedAppIds([]);
    } else {
      setSelectedAppIds(printableApps.map(a => a.id));
    }
  };

  // '오늘' 결보강 필터
  const todayStr = React.useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayItems = React.useMemo(() => {
    const list: {
      appId: string;
      appNumber: string;
      applicantTeacher: string;
      reason: string;
      item: SubstituteApplication['items'][0];
      status: string;
    }[] = [];

    applications.forEach(app => {
      if (app.status !== 'rejected') {
        app.items.forEach(it => {
          if (it.sourceDate === todayStr || it.targetDate === todayStr) {
            list.push({
              appId: app.id,
              appNumber: app.applicationNumber,
              applicantTeacher: app.applicantTeacher,
              reason: app.reason,
              item: it,
              status: app.status,
            });
          }
        });
      }
    });

    return list.sort((a, b) => a.item.sourcePeriod - b.item.sourcePeriod);
  }, [applications, todayStr]);

  const getItemSubjectName = (it: { sourceDate?: string; sourcePeriod?: number; classCode?: string; subjectName?: string; originalTeacher?: string }, applicantTeacher?: string) => {
    if (calendarConfig && it.sourceDate && it.sourcePeriod) {
      const evs = getEventsForSlot(it.sourceDate, it.sourcePeriod, it.classCode || '', applicantTeacher || it.originalTeacher || '', calendarConfig);
      if (evs.length > 0) {
        return `[행사] ${evs[0].title}`;
      }
    }
    return it.subjectName;
  };

  const getItemClassCode = (it: { sourceDate?: string; sourcePeriod?: number; classCode?: string; originalTeacher?: string }, applicantTeacher?: string) => {
    if (calendarConfig && it.sourceDate && it.sourcePeriod) {
      const evs = getEventsForSlot(it.sourceDate, it.sourcePeriod, it.classCode || '', applicantTeacher || it.originalTeacher || '', calendarConfig);
      if (evs.length > 0) {
        const teacherObj = timetableData.teachers.find(t => t.teacherName === (applicantTeacher || it.originalTeacher));
        if (teacherObj?.homeroomClass) {
          return teacherObj.homeroomClass;
        }
      }
    }
    return it.classCode || '';
  };

  // 5. 핵심 요약 통계 계산 (모든 훅은 조기 반환문 이전에 항상 실행되어야 함)
  const summaryStats = React.useMemo(() => {
    const myTotal = myApplications.length;
    const myApproved = myApplications.filter(a => a.status === 'approved').length;
    const mySubmitted = myApplications.filter(a => a.status === 'submitted').length;

    const todayTotal = todayItems.length;
    const todaySub = todayItems.filter(x => x.item.type === 'substitute').length;
    const todayExchange = todayItems.filter(x => x.item.type === 'exchange').length;

    const totalApproved = applications.filter(a => a.status === 'approved').length;
    const totalApps = applications.length;

    let totalExchangeItems = 0;
    applications.forEach(a => {
      if (a.status !== 'rejected') {
        a.items.forEach(it => {
          if (it.type === 'exchange') totalExchangeItems++;
        });
      }
    });

    return {
      myTotal,
      myApproved,
      mySubmitted,
      todayTotal,
      todaySub,
      todayExchange,
      totalApproved,
      totalApps,
      totalExchangeItems,
    };
  }, [myApplications, todayItems, applications]);

  // 공식 양식 보기 중인 경우 (단일 또는 다중)
  if (viewingApps && viewingApps.length > 0) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-none print:w-full print:block">
        <SubstituteOfficialForm
          applications={viewingApps}
          onBack={() => setViewingApps(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pt-1">
      {/* 1. 제목줄: 상단 타이틀 헤더 (표준 모던 스타일) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-2.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5 whitespace-nowrap">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
              <ArrowLeftRight className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <span>수업 결보강 & 교체 관리</span>
            <span className="text-[11px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
              {timetableData.academicYear}학년도 {timetableData.semester}학기
            </span>
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            시간표에서 변경할 수업을 클릭하여 스마트 공강 추천과 함께 수업 교체 및 결보강을 신속하게 처리합니다.
          </p>
        </div>

        {/* 상단 우측 관리자 바로가기 버튼 */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Link
            href="/teaching-support/substitute/admin"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
            <span>수업계 관리자</span>
          </Link>
        </div>
      </div>

      {/* 2. 통계: 핵심 요약 통계 카드 4종 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200">
        {/* 카드 1: 내 결보강 신청 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">내 결보강 신청</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-blue-600">{summaryStats.myTotal}</span>
                <span className="text-xs font-bold text-slate-400">건</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium">
                승인 <strong className="text-emerald-600">{summaryStats.myApproved}</strong> · 대기 <strong className="text-blue-600">{summaryStats.mySubmitted}</strong>
              </p>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 2: 오늘의 결보강 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">오늘의 결보강</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">{summaryStats.todayTotal}</span>
                <span className="text-xs font-bold text-slate-400">건</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium">
                보강 <strong className="text-amber-600">{summaryStats.todaySub}</strong> · 교체 <strong className="text-blue-600">{summaryStats.todayExchange}</strong>
              </p>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 3: 이번 학기 누적 승인 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">이번 학기 누적 승인</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-indigo-600">{summaryStats.totalApproved}</span>
                <span className="text-xs font-bold text-slate-400">건</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium">
                전체 신청 {summaryStats.totalApps}건 중 완료
              </p>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 4: 스마트 수업 맞교환 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">스마트 수업 맞교환</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-amber-600">{summaryStats.totalExchangeItems}</span>
                <span className="text-xs font-bold text-slate-400">건</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium">
                시수 결손 없는 상호 교환
              </p>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. 필터: 통합 필터 툴바 */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0">
        <CardContent className="p-3 sm:p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* 좌측: 교사 선택 & 주차 선택 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 교사 선택 */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
              <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-500 shrink-0">교사:</span>
              <Select value={selectedTeacherName} onValueChange={setSelectedTeacherName}>
                <SelectTrigger className="w-[140px] sm:w-[160px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                  {timetableData.teachers.map(t => (
                    <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium py-1.5">
                      <span className="font-bold text-slate-800">{t.teacherName}</span>
                      {t.homeroomClass && (
                        <span className="ml-1 text-[11px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                          {t.homeroomClass}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 주차 선택 네비게이션 */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl px-1.5 py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={selectedWeekNum <= 1}
                onClick={handlePrevWeek}
                className="h-6 w-6 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-0.5" />

              <Select
                value={String(selectedWeekNum)}
                onValueChange={val => setSelectedWeekNum(parseInt(val))}
              >
                <SelectTrigger className="h-7 border-none bg-transparent shadow-none focus:ring-0 text-xs font-bold text-slate-800 w-[180px] sm:w-[200px] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64 rounded-xl shadow-lg border-slate-200">
                  {semesterWeeks.map(w => (
                    <SelectItem key={w.weekNum} value={String(w.weekNum)} className="text-xs font-medium py-1.5">
                      <span className="font-bold text-slate-800">{w.shortLabel}</span>
                      <span className="ml-1 text-slate-400 font-mono text-[11px]">({w.dateRangeLabel})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={selectedWeekNum >= semesterWeeks.length}
                onClick={handleNextWeek}
                className="h-6 w-6 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* 내 시간표 바로가기 버튼 */}
            {selectedTeacherName !== defaultTeacherName && defaultTeacherName && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedTeacherName(defaultTeacherName)}
                className="h-8 px-2.5 text-xs font-bold text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 rounded-xl"
              >
                내 시간표 보기
              </Button>
            )}
          </div>

          {/* 우측 안내 팁 */}
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>시간표의 수업 슬롯을 클릭하여 결보강 또는 맞교환을 신청하세요</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. 내용: 주간 대화형 시간표 & 하단 신청내역 */}
      <InteractiveTeacherTimetable
        timetableData={timetableData}
        selectedTeacherName={selectedTeacherName}
        onSelectTeacherName={setSelectedTeacherName}
        onOpenDrawer={handleOpenDrawer}
        applications={applications}
        calendarConfig={calendarConfig}
        selectedWeekNum={selectedWeekNum}
        onSelectWeekNum={setSelectedWeekNum}
        hideTopControlBar={true}
      />

      {/* 3. 하단 신청 내역 및 오늘의 결보강 탭 영역 */}
      <div className="space-y-3 pt-1">
        {/* 세그먼트 탭 컨트롤 바 */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl">
            <button
              type="button"
              onClick={() => setBottomTab('myApps')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                bottomTab === 'myApps'
                  ? "bg-white text-blue-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>내 신청 현황</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                {myApplications.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBottomTab('today')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                bottomTab === 'today'
                  ? "bg-white text-emerald-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span>오늘의 결보강</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                {todayItems.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 hidden sm:block">
            ※ 승인 완료된 신청서는 A4 공식 서식으로 언제든지 인쇄할 수 있습니다.
          </div>
        </div>

        {bottomTab === 'myApps' && (
          <div className="space-y-3">
            {myApplications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-8 text-center text-slate-400 space-y-1">
                <p className="text-xs font-bold text-slate-600">
                  {selectedTeacherName} 선생님께서 신청하신 수업 교체 및 보강 내역이 없습니다.
                </p>
                <p className="text-[11px] text-slate-400">
                  위 시간표에서 변경할 수업 슬롯을 클릭하여 간편하게 신청하실 수 있습니다.
                </p>
              </div>
            ) : (
              <>
                {/* 상단 다중 선택 및 일괄 출력 툴바 */}
                {printableApps.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <label className="flex items-center gap-2 text-xs font-black text-slate-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedAppIds.length === printableApps.length && printableApps.length > 0}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>
                          {selectedAppIds.length === printableApps.length
                            ? '전체 선택 해제'
                            : `제출/접수된 신청서 전체 선택 (${printableApps.length}건)`}
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedAppIds.length > 0 && (
                        <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                          {selectedAppIds.length}건 선택됨
                        </span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (selectedAppIds.length === 0) {
                            alert('선택된 신청서가 없습니다. 출력할 신청서를 먼저 체크하여 선택해 주세요.');
                            return;
                          }
                          const selected = myApplications.filter(a => selectedAppIds.includes(a.id));
                          if (selected.length > 0) setViewingApps(selected);
                        }}
                        className="h-8 px-3.5 text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-2xs cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        일괄 A4 출력
                      </Button>
                      {selectedAppIds.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedAppIds([])}
                          className="h-8 px-3 text-xs font-bold border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 rounded-xl shadow-2xs cursor-pointer"
                        >
                          선택 해제
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 신청서 카드 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myApplications.map(app => {
                    const isSelected = selectedAppIds.includes(app.id);
                    const isRejected = app.status === 'rejected';
                    return (
                      <div
                        key={app.id}
                        onClick={() => toggleSelectApp(app.id)}
                        className={cn(
                          "p-3.5 sm:p-4 rounded-2xl border transition-all space-y-2.5 cursor-pointer select-none shadow-2xs",
                          isSelected
                            ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10"
                            : isRejected
                            ? "bg-rose-50/15 border-rose-200/80 hover:border-rose-300"
                            : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isRejected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelectApp(app.id)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                            <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {app.applicationNumber}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                              app.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : app.status === 'submitted'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {app.status === 'approved' ? '승인 완료' : app.status === 'submitted' ? '제출 접수됨' : '반려됨'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {!isRejected && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingApps([app])}
                                className="h-7 px-2.5 text-xs font-bold gap-1 border-slate-200/80 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                              >
                                <Printer className="h-3 w-3 text-slate-500" />
                                A4 출력
                              </Button>
                            )}
                            {app.status !== 'approved' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteApplication(app.id)}
                                title={isRejected ? "반려된 신청서 삭제" : "신청서 취소/삭제"}
                                className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400 px-1" title="승인 완료된 신청서는 삭제할 수 없습니다">
                                🔒
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 반려 안내 알림 배너 */}
                        {isRejected && (
                          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200/80 text-[11px] text-rose-800 font-medium">
                            <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                            <span>수업계에 의해 반려된 신청서입니다. 삭제 후 시간표에서 다시 신청해 주세요.</span>
                          </div>
                        )}

                        <div className="text-xs space-y-1">
                          <p className="text-slate-800">
                            <strong>사유:</strong> {app.reason}
                          </p>
                          <div className="space-y-1 pt-0.5">
                            {app.items.map(it => (
                              <div key={it.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-900">
                                  {it.sourceDate} {it.sourcePeriod}교시 {getItemClassCode(it, app.applicantTeacher)} ({getItemSubjectName(it, app.applicantTeacher)})
                                </span>
                                <span className="font-bold text-blue-700">
                                  ➔ {it.type === 'substitute' ? `보강: ${it.substituteTeacher} 선생님` : `교체: ${it.targetTeacher} 선생님`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {bottomTab === 'today' && (
          <div className="space-y-3">
            {todayItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-8 text-center text-slate-400 space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-70 mb-1" />
                <p className="text-xs font-bold text-slate-700">
                  오늘({todayStr})은 등록된 결강이나 수업 교체가 없습니다.
                </p>
                <p className="text-[11px] text-slate-400">모든 학급의 정규 시간표대로 수업이 진행됩니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {todayItems.map(({ appId, appNumber, applicantTeacher, reason, item }, idx) => (
                  <div key={`${appId}-${idx}`} className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md font-bold bg-slate-900 text-white text-[11px]">
                        {item.sourcePeriod}교시
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                        item.type === 'substitute' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {item.type === 'substitute' ? '수업보강' : '수업교체'}
                      </span>
                    </div>
                    <p className="font-black text-slate-900">
                      {getItemClassCode(item, applicantTeacher)} ({getItemSubjectName(item, applicantTeacher)}) - {applicantTeacher} 선생님
                    </p>
                    <p className="font-bold text-blue-700 bg-blue-50/70 p-2 rounded-xl border border-blue-100">
                      ➔ {item.type === 'substitute' ? `보강: ${item.substituteTeacher} 선생님` : `교체: ${item.targetTeacher} 선생님`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


      </div>

      {/* 4. 수업 교체 / 보강 통합 신청 서랍 (1개 수업 및 다교시 일괄 모두 동일 모달/동일 로직) */}
      {batchSlots.length > 0 && (
        <BatchExchangeDrawer
          selectedSlots={batchSlots}
          initialMode={drawerInitialMode}
          onClose={() => setBatchSlots([])}
          onSaveApplication={handleSaveApplication}
          timetableData={timetableData}
          existingApplications={applications}
          calendarConfig={calendarConfig}
          currentTeacherName={selectedTeacherName}
        />
      )}
    </div>
  );
}
