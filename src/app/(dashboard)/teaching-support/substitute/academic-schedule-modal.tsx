'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/academic-schedule-modal.tsx
// 학사일정 관리 모달 (1학기·2학기 통합 기간 설정, 방학/휴업일, 학교/학년 행사)
// ==============================================================================

import * as React from 'react';
import { 
  AcademicCalendarConfig, 
  SchoolEvent, 
  VacationPeriod, 
  EventTargetScope,
  getDefaultAcademicCalendarConfig 
} from '@/lib/substitute/event-types';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { getDayOfWeekFromDate } from '@/lib/substitute/validator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  CalendarDays, 
  Sparkles, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Clock, 
  User, 
  Users, 
  MapPin, 
  FileText, 
  Palmtree, 
  GraduationCap,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface AcademicScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AcademicCalendarConfig;
  onSave: (newConfig: AcademicCalendarConfig) => Promise<void>;
  timetableData: ParsedTimetableResult;
}

export function AcademicScheduleModal({
  isOpen,
  onClose,
  config,
  onSave,
  timetableData,
}: AcademicScheduleModalProps) {
  const [activeTab, setActiveTab] = React.useState<'periods' | 'events' | 'vacations'>('periods');
  
  // 1학기 / 2학기 기간 상태
  const [sem1Start, setSem1Start] = React.useState<string>(config?.semesters?.[1]?.startDate || '2026-03-02');
  const [sem1End, setSem1End] = React.useState<string>(config?.semesters?.[1]?.endDate || '2026-08-17');
  const [sem2Start, setSem2Start] = React.useState<string>(config?.semesters?.[2]?.startDate || config?.startDate || '2026-08-18');
  const [sem2End, setSem2End] = React.useState<string>(config?.semesters?.[2]?.endDate || config?.endDate || '2027-02-28');

  // 현재 활성 학기 (기본값: 시간표 학기 또는 2)
  const [activeSemester, setActiveSemester] = React.useState<number>(config?.semester || timetableData?.semester || 2);

  // 행사 및 방학 리스트 상태
  const [events, setEvents] = React.useState<SchoolEvent[]>(config?.events || []);
  const [vacations, setVacations] = React.useState<VacationPeriod[]>(config?.vacations || []);

  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // 신규 행사 입력 폼 상태 (기본값 없이 깔끔하게 공란 시작)
  const [newEventTitle, setNewEventTitle] = React.useState<string>('');
  const [newEventDate, setNewEventDate] = React.useState<string>('');
  const [newEventPeriods, setNewEventPeriods] = React.useState<number[]>([]);
  const [newEventScope, setNewEventScope] = React.useState<EventTargetScope>('grade');
  const [newEventGrade, setNewEventGrade] = React.useState<number>(1);
  const [newEventInChargeTeachers, setNewEventInChargeTeachers] = React.useState<string[]>([]);
  const [newEventLocation, setNewEventLocation] = React.useState<string>('');
  const [newEventDescription, setNewEventDescription] = React.useState<string>('');

  // 신규 방학/휴업일 입력 폼 상태
  const [newVacName, setNewVacName] = React.useState<string>('');
  const [newVacStart, setNewVacStart] = React.useState<string>('');
  const [newVacEnd, setNewVacEnd] = React.useState<string>('');
  const [newVacType, setNewVacType] = React.useState<'vacation' | 'holiday' | 'discretionary'>('vacation');

  React.useEffect(() => {
    if (config) {
      setSem1Start(config.semesters?.[1]?.startDate || '2026-03-02');
      setSem1End(config.semesters?.[1]?.endDate || '2026-08-17');
      setSem2Start(config.semesters?.[2]?.startDate || config.startDate || '2026-08-18');
      setSem2End(config.semesters?.[2]?.endDate || config.endDate || '2027-02-28');
      setActiveSemester(config.semester || timetableData?.semester || 2);
      setEvents(config.events || []);
      setVacations(config.vacations || []);
    }
  }, [config, timetableData]);

  if (!isOpen) return null;

  // 학급 코드에서 정확한 학년 추출 (예: "축11" -> 1, "건21" -> 2, "도31" -> 3, "1-1" -> 1)
  const getTeacherHomeroomGrade = (homeroom?: string): number | null => {
    if (!homeroom) return null;
    const match = homeroom.match(/\d/);
    return match ? parseInt(match[0], 10) : null;
  };

  // 담임교사 일괄 자동 배정 핸들러
  const handleAutoAssignHomeroomTeachers = () => {
    const targetTeachers = timetableData.teachers.filter(t => {
      if (!t.homeroomClass) return false;
      const grade = getTeacherHomeroomGrade(t.homeroomClass);
      if (newEventScope === 'grade') {
        return grade === newEventGrade;
      }
      return grade !== null; // 전교생인 경우 전체 담임교사
    }).map(t => t.teacherName);

    if (targetTeachers.length === 0) {
      alert('해당 학년의 담임교사 정보를 찾을 수 없습니다.');
      return;
    }

    setNewEventInChargeTeachers(targetTeachers);
  };

  // 개별 담당 교사 추가/제거
  const handleToggleInChargeTeacher = (teacherName: string) => {
    setNewEventInChargeTeachers(prev => 
      prev.includes(teacherName) ? prev.filter(t => t !== teacherName) : [...prev, teacherName]
    );
  };

  // 행사 추가 핸들러
  const handleAddEvent = () => {
    if (!newEventTitle.trim()) {
      alert('행사명을 입력해 주세요.');
      return;
    }
    if (!newEventDate) {
      alert('행사 날짜를 선택해 주세요.');
      return;
    }
    if (newEventPeriods.length === 0) {
      alert('해당 교시를 최소 1개 이상 선택해 주세요.');
      return;
    }

    const day = getDayOfWeekFromDate(newEventDate) || '월';
    const newEvent: SchoolEvent = {
      id: `ev-${Date.now()}`,
      title: newEventTitle.trim(),
      date: newEventDate,
      day,
      periods: [...newEventPeriods].sort((a, b) => a - b),
      targetScope: newEventScope,
      targetGrades: newEventScope === 'grade' ? [newEventGrade] : (newEventScope === 'all' ? [1, 2, 3] : []),
      inChargeTeachers: newEventInChargeTeachers,
      location: newEventLocation.trim() || undefined,
      description: newEventDescription.trim() || undefined,
    };

    setEvents(prev => [...prev, newEvent]);
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventPeriods([]);
    setNewEventInChargeTeachers([]);
    setNewEventLocation('');
    setNewEventDescription('');
  };

  // 행사 삭제 핸들러
  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // 방학/휴업일 추가 핸들러
  const handleAddVacation = () => {
    if (!newVacName.trim() || !newVacStart || !newVacEnd) {
      alert('방학/휴업일 명칭과 시작일, 종료일을 모두 입력해 주세요.');
      return;
    }

    const newVac: VacationPeriod = {
      id: `vac-${Date.now()}`,
      name: newVacName.trim(),
      startDate: newVacStart,
      endDate: newVacEnd,
      type: newVacType,
    };

    setVacations(prev => [...prev, newVac]);
    setNewVacName('');
    setNewVacStart('');
    setNewVacEnd('');
  };

  // 방학 삭제 핸들러
  const handleDeleteVacation = (id: string) => {
    setVacations(prev => prev.filter(v => v.id !== id));
  };

  // 최종 저장
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      const currentStart = activeSemester === 1 ? sem1Start : sem2Start;
      const currentEnd = activeSemester === 1 ? sem1End : sem2End;

      const payload: AcademicCalendarConfig = {
        academicYear: config.academicYear || 2026,
        semester: activeSemester,
        startDate: currentStart,
        endDate: currentEnd,
        semesters: {
          1: { startDate: sem1Start, endDate: sem1End },
          2: { startDate: sem2Start, endDate: sem2End },
        },
        vacations,
        events,
      };

      await onSave(payload);
      alert('학사일정 및 기간 설정이 성공적으로 저장되었습니다!');
      onClose();
    } catch (err: any) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 교시 토글
  const togglePeriod = (p: number) => {
    setNewEventPeriods(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p].sort((a, b) => a - b)
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl h-[640px] max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 1. 모달 헤더 (연간 통합 학사일정 관리) */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                {config.academicYear || 2026}학년도 연간 학사일정 & 행사 관리
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white">
                  수업계 전용
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                1년 연간 1학기·2학기 수업 기간, 방학/휴업일, 학교 행사를 통합 관리합니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2. 흔들림 없는 세그먼트 알약형 탭 스위처 */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('periods')}
              className={cn(
                "flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
                activeTab === 'periods'
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              학사 기간 설정
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={cn(
                "flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
                activeTab === 'events'
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              행사 관리 ({events.length}건)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vacations')}
              className={cn(
                "flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
                activeTab === 'vacations'
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              )}
            >
              <Palmtree className="h-3.5 w-3.5 text-emerald-600" />
              방학 및 휴업일 ({vacations.length}건)
            </button>
          </div>
        </div>

        {/* 3. 탭별 스크롤 본문 (가로/세로 흔들림 방지) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700 [scrollbar-gutter:stable]">
          {/* TAB 1: 학사 기간 설정 (1학기 & 2학기 통합 관리) */}
          {activeTab === 'periods' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs font-black text-slate-900 block mb-0.5">
                    1학기 및 2학기 학사 기간 설정
                  </strong>
                  <p className="text-[11px] text-slate-500">
                    각 학기의 개학일과 종업일을 설정하면 주간 시간표의 주차 및 날짜가 자동으로 계산됩니다.
                  </p>
                </div>
              </div>

              {/* 1학기 기간 설정 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all space-y-3",
                activeSemester === 1
                  ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20"
                  : "bg-white border-slate-200"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                      1
                    </span>
                    <strong className="text-xs font-black text-slate-900">
                      1학기 학사 기간
                    </strong>
                    {activeSemester === 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                        현재 적용 학기
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSemester(1)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                      activeSemester === 1
                        ? "bg-indigo-600 text-white border-indigo-600 font-black"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    )}
                  >
                    {activeSemester === 1 ? '✓ 현재 학기로 선택됨' : '1학기로 시간표 전환'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      1학기 시작일 (개학일)
                    </label>
                    <Input
                      type="date"
                      value={sem1Start}
                      onChange={e => setSem1Start(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      1학기 종료일 (방학식)
                    </label>
                    <Input
                      type="date"
                      value={sem1End}
                      onChange={e => setSem1End(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* 2학기 기간 설정 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all space-y-3",
                activeSemester === 2
                  ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20"
                  : "bg-white border-slate-200"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                      2
                    </span>
                    <strong className="text-xs font-black text-slate-900">
                      2학기 학사 기간
                    </strong>
                    {activeSemester === 2 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                        현재 적용 학기
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSemester(2)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                      activeSemester === 2
                        ? "bg-indigo-600 text-white border-indigo-600 font-black"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    )}
                  >
                    {activeSemester === 2 ? '✓ 현재 학기로 선택됨' : '2학기로 시간표 전환'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      2학기 시작일 (개학일)
                    </label>
                    <Input
                      type="date"
                      value={sem2Start}
                      onChange={e => setSem2Start(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      2학기 종료일 (종업일/학년말)
                    </label>
                    <Input
                      type="date"
                      value={sem2End}
                      onChange={e => setSem2End(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 행사 관리 */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {/* 행사 신규 등록 카드 */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-indigo-600" />
                    새 행사 등록
                  </strong>
                  <span className="text-[10.5px] text-slate-500">
                    등록 시 해당 학년/담당교사 시간표에 자동으로 행사 배너가 표시됩니다.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      행사명 (예: 1학년 문화공연관람, 3학년 취업특강)
                    </label>
                    <Input
                      placeholder="행사명을 입력하세요..."
                      value={newEventTitle}
                      onChange={e => setNewEventTitle(e.target.value)}
                      className="h-8.5 text-xs bg-white border-indigo-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      행사 일자
                    </label>
                    <Input
                      type="date"
                      value={newEventDate}
                      onChange={e => setNewEventDate(e.target.value)}
                      className="h-8.5 text-xs bg-white border-indigo-200 rounded-xl font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      대상 범위
                    </label>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={newEventScope} 
                        onValueChange={(val: EventTargetScope) => setNewEventScope(val)}
                      >
                        <SelectTrigger className="h-8.5 text-xs font-bold bg-white border-indigo-200 rounded-xl flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grade" className="text-xs font-bold">특정 학년</SelectItem>
                          <SelectItem value="all" className="text-xs font-bold">전교생 전체</SelectItem>
                        </SelectContent>
                      </Select>

                      {newEventScope === 'grade' && (
                        <Select 
                          value={String(newEventGrade)} 
                          onValueChange={val => setNewEventGrade(parseInt(val))}
                        >
                          <SelectTrigger className="w-24 h-8.5 text-xs font-bold bg-white border-indigo-200 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1" className="text-xs font-bold">1학년</SelectItem>
                            <SelectItem value="2" className="text-xs font-bold">2학년</SelectItem>
                            <SelectItem value="3" className="text-xs font-bold">3학년</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* 행사 교시 다중 선택 */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      행사 진행 교시 (클릭하여 선택)
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7].map(p => {
                        const isSelected = newEventPeriods.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => togglePeriod(p)}
                            className={cn(
                              "w-10 h-8 rounded-xl text-xs font-black transition-all border",
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {p}교시
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 담당 교사 지정 (담임교사 일괄 자동 배정 버튼 탑재) */}
                  <div className="sm:col-span-2 space-y-2 bg-white/80 p-3 rounded-2xl border border-indigo-100">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <label className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-indigo-600" />
                        행사 담당 / 인솔 교사 ({newEventInChargeTeachers.length}명 지정됨)
                      </label>

                      <div className="flex items-center gap-1.5">
                        {/* 담임교사 일괄 자동 배정 버튼 */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAutoAssignHomeroomTeachers}
                          className="h-7 text-[10.5px] font-black gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200 rounded-lg shadow-2xs"
                        >
                          <Users className="h-3 w-3 text-indigo-600" />
                          {newEventScope === 'grade' 
                            ? `${newEventGrade}학년 담임교사 일괄 지정 (${timetableData.teachers.filter(t => getTeacherHomeroomGrade(t.homeroomClass) === newEventGrade).length}명)` 
                            : `전체 담임교사 일괄 지정 (${timetableData.teachers.filter(t => getTeacherHomeroomGrade(t.homeroomClass) !== null).length}명)`
                          }
                        </Button>

                        {/* 일괄 취소 버튼 */}
                        {newEventInChargeTeachers.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewEventInChargeTeachers([])}
                            className="h-7 px-2 text-[10.5px] font-black gap-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg shadow-2xs"
                          >
                            <X className="h-3 w-3 text-rose-500" />
                            일괄 취소
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 선택된 인솔 교사 칩 목록 */}
                    {newEventInChargeTeachers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-xl bg-slate-50 border border-slate-200">
                        {newEventInChargeTeachers.map(name => {
                          const tInfo = timetableData.teachers.find(t => t.teacherName === name);
                          return (
                            <span
                              key={name}
                              className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-2xs animate-in fade-in"
                            >
                              <span>{name} 선생님</span>
                              {tInfo?.homeroomClass && (
                                <span className="text-indigo-200 text-[9.5px]">({tInfo.homeroomClass})</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleToggleInChargeTeacher(name)}
                                className="ml-0.5 hover:text-rose-200"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setNewEventInChargeTeachers([])}
                          className="text-[10px] text-slate-400 hover:text-slate-700 px-1 py-0.5 self-center"
                        >
                          전체 해제
                        </button>
                      </div>
                    )}

                    {/* 개별 교사 직접 추가 드롭다운 */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] text-slate-500 font-bold shrink-0">개별 교사 추가:</span>
                      <Select value="" onValueChange={handleToggleInChargeTeacher}>
                        <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-200 rounded-xl flex-1">
                          <SelectValue placeholder="선생님을 선택하여 담당 교사로 추가..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {timetableData.teachers.map(t => (
                            <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium">
                              <span className="font-bold text-slate-900">{t.teacherName} 선생님</span>
                              {t.homeroomClass && <span className="ml-1 text-indigo-600 font-bold">({t.homeroomClass})</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-700 block mb-1">
                      행사 장소
                    </label>
                    <Input
                      placeholder="예: 대강당, 시청각실, 체육관..."
                      value={newEventLocation}
                      onChange={e => setNewEventLocation(e.target.value)}
                      className="h-8.5 text-xs bg-white border-indigo-200 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddEvent}
                  className="w-full h-8.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  위 내용으로 행사 등록 추가
                </Button>
              </div>

              {/* 등록된 행사 목록 */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-900 flex items-center justify-between">
                  <span>등록된 학사 행사 목록 ({events.length}건)</span>
                </label>

                {events.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400">
                    등록된 행사가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map(ev => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                              🎭 {ev.targetScope === 'all' ? '전교생' : `${ev.targetGrades?.join(', ')}학년`}
                            </span>
                            <strong className="text-xs font-black text-slate-900">{ev.title}</strong>
                            {ev.location && (
                              <span className="text-[10.5px] text-slate-500 flex items-center gap-0.5">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                {ev.location}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-600">
                            <span>📅 {ev.date} ({ev.day})</span>
                            <span className="font-bold text-indigo-700">⏱️ {ev.periods.join(', ')}교시</span>
                            {ev.inChargeTeachers && ev.inChargeTeachers.length > 0 && (
                              <span className="font-bold text-slate-700">
                                👤 담당: {ev.inChargeTeachers.join(', ')} 선생님
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 방학 및 휴업일 관리 */}
          {activeTab === 'vacations' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <strong className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-emerald-600" />
                  새 방학 / 휴업일 추가
                </strong>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">명칭</label>
                    <Input
                      placeholder="예: 겨울방학, 재량휴업일..."
                      value={newVacName}
                      onChange={e => setNewVacName(e.target.value)}
                      className="h-8.5 text-xs bg-white border-emerald-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">시작일</label>
                    <Input
                      type="date"
                      value={newVacStart}
                      onChange={e => setNewVacStart(e.target.value)}
                      className="h-8.5 text-xs bg-white border-emerald-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">종료일</label>
                    <Input
                      type="date"
                      value={newVacEnd}
                      onChange={e => setNewVacEnd(e.target.value)}
                      className="h-8.5 text-xs bg-white border-emerald-200 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddVacation}
                  className="w-full h-8.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  방학 / 휴업일 추가
                </Button>
              </div>

              {/* 목록 */}
              <div className="space-y-2">
                {vacations.map(vac => (
                  <div
                    key={vac.id}
                    className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between"
                  >
                    <div>
                      <strong className="text-xs font-black text-slate-900 block">{vac.name}</strong>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {vac.startDate} ~ {vac.endDate}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteVacation(vac.id)}
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. 하단 모달 액션 바 */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            닫기
          </Button>

          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="h-9 px-5 text-xs font-black gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 rounded-xl"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '저장 중...' : '학사일정 전체 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
