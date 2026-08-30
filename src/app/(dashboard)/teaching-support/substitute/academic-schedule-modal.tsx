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
  SpecialDaySchedule,
  ExamPeriod,
  ExamDailySchedule,
  getDefaultAcademicCalendarConfig 
} from '@/lib/substitute/event-types';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { getDayOfWeekFromDate } from '@/lib/substitute/validator';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  CheckCircle2,
  Compass,
  Palette,
  ArrowLeftRight,
  FileEdit,
  Check,
  CheckSquare,
  Square
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
  const [activeTab, setActiveTab] = React.useState<'periods' | 'exams' | 'events' | 'vacations' | 'special_days' | 'custom_classes'>('periods');
  
  // 1학기 / 2학기 기간 상태
  const [sem1Start, setSem1Start] = React.useState<string>(config?.semesters?.[1]?.startDate || '2026-03-02');
  const [sem1End, setSem1End] = React.useState<string>(config?.semesters?.[1]?.endDate || '2026-08-17');
  const [sem2Start, setSem2Start] = React.useState<string>(config?.semesters?.[2]?.startDate || config?.startDate || '2026-08-18');
  const [sem2End, setSem2End] = React.useState<string>(config?.semesters?.[2]?.endDate || config?.endDate || '2027-02-28');

  // 현재 활성 학기 (기본값: 시간표 학기 또는 2)
  const [activeSemester, setActiveSemester] = React.useState<number>(config?.semester || timetableData?.semester || 2);

  // 행사, 방학, 대체 요일/변형, 시험 기간 리스트 상태
  const [events, setEvents] = React.useState<SchoolEvent[]>(config?.events || []);
  const [vacations, setVacations] = React.useState<VacationPeriod[]>(config?.vacations || []);
  const [specialDaySchedules, setSpecialDaySchedules] = React.useState<SpecialDaySchedule[]>(config?.specialDaySchedules || []);
  const [examPeriods, setExamPeriods] = React.useState<ExamPeriod[]>(config?.examPeriods || []);

  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // [수정 모드 상태]
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
  const [editingVacationId, setEditingVacationId] = React.useState<string | null>(null);
  const [editingSpecialDayId, setEditingSpecialDayId] = React.useState<string | null>(null);
  const [editingCustomClassId, setEditingCustomClassId] = React.useState<string | null>(null);
  const [editingExamId, setEditingExamId] = React.useState<string | null>(null);

  // 신규 행사 입력 폼 상태 (기본값 없이 깔끔하게 공란 시작)
  const [newEventTitle, setNewEventTitle] = React.useState<string>('');
  const [newEventDate, setNewEventDate] = React.useState<string>('');
  const [newEventPeriods, setNewEventPeriods] = React.useState<number[]>([]);
  const [newEventScope, setNewEventScope] = React.useState<EventTargetScope>('grade');
  const [newEventGrade, setNewEventGrade] = React.useState<number>(1);
  const [newEventInChargeTeachers, setNewEventInChargeTeachers] = React.useState<string[]>([]);
  const [newEventInChargeRoleLabel, setNewEventInChargeRoleLabel] = React.useState<string>('');
  const [showDetailedTeachers, setShowDetailedTeachers] = React.useState<boolean>(false);
  const [newEventLocation, setNewEventLocation] = React.useState<string>('');
  const [newEventDescription, setNewEventDescription] = React.useState<string>('');

  // 신규 방학/휴업일 입력 폼 상태
  const [newVacName, setNewVacName] = React.useState<string>('');
  const [newVacStart, setNewVacStart] = React.useState<string>('');
  const [newVacEnd, setNewVacEnd] = React.useState<string>('');
  const [newVacType, setNewVacType] = React.useState<'vacation' | 'holiday' | 'discretionary'>('vacation');

  // [TAB 4] 신규 대체 요일 시간표 입력 폼 상태 (순수 요일 전체 스왑 전용)
  const [newSpecialDate, setNewSpecialDate] = React.useState<string>('');
  const [newSpecialTargetDay, setNewSpecialTargetDay] = React.useState<string>('월');
  const [newSpecialDesc, setNewSpecialDesc] = React.useState<string>('');

  // [TAB 5] 신규 단축 및 변형수업 입력 폼 상태 (단축수업 & 특정 교시 복제 전용)
  const [newCustomDate, setNewCustomDate] = React.useState<string>('');
  const [newCustomTargetDay, setNewCustomTargetDay] = React.useState<string>('월');
  const [newCustomDesc, setNewCustomDesc] = React.useState<string>('');
  const [newCustomShortenedPeriods, setNewCustomShortenedPeriods] = React.useState<number | undefined>(undefined);
  const [newCustomPeriodOverrides, setNewCustomPeriodOverrides] = React.useState<Record<number, number>>({});

  // 신규 지필평가/시험 기간 입력 폼 상태
  const [newExamName, setNewExamName] = React.useState<string>('');
  const [newExamStart, setNewExamStart] = React.useState<string>('');
  const [newExamEnd, setNewExamEnd] = React.useState<string>('');
  const [newExamGrades, setNewExamGrades] = React.useState<number[]>([1, 2, 3]);
  const [newExamPeriodList, setNewExamPeriodList] = React.useState<number[]>([1, 2, 3]);
  const [newExamAfternoon, setNewExamAfternoon] = React.useState<'dismiss' | 'regular_class'>('dismiss');
  const [newExamDesc, setNewExamDesc] = React.useState<string>('');
  const [newExamDailySchedules, setNewExamDailySchedules] = React.useState<ExamDailySchedule[]>([]);

  // 시작일과 종료일이 설정되면 일자별 교시 스케줄 자동 생성
  React.useEffect(() => {
    if (!newExamStart || !newExamEnd) {
      setNewExamDailySchedules([]);
      return;
    }

    try {
      const start = new Date(newExamStart);
      const end = new Date(newExamEnd);
      if (start > end) {
        setNewExamDailySchedules([]);
        return;
      }

      const daysList: ExamDailySchedule[] = [];
      let curr = new Date(start);
      let dayNum = 1;

      while (curr <= end) {
        const dayOfWeek = curr.getDay(); // 0: 일, 6: 토
        const dateStr = curr.toISOString().split('T')[0];

        // 주말(토/일)은 기본적으로 제외하되, 평일만 시험일로 자동 포함
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // 기존에 설정된 해당 날짜 값이 있으면 유지, 없으면 기본값(1~3교시, dismiss) 적용
          const existing = newExamDailySchedules.find(d => d.date === dateStr);
          daysList.push({
            date: dateStr,
            dayNumber: dayNum++,
            examPeriods: existing?.examPeriods || [...newExamPeriodList],
            afternoonType: existing?.afternoonType || newExamAfternoon,
          });
        }
        curr.setDate(curr.getDate() + 1);
      }

      setNewExamDailySchedules(daysList);
    } catch (e) {
      // ignore
    }
  }, [newExamStart, newExamEnd]);

  React.useEffect(() => {
    if (config) {
      setSem1Start(config.semesters?.[1]?.startDate || '2026-03-02');
      setSem1End(config.semesters?.[1]?.endDate || '2026-08-17');
      setSem2Start(config.semesters?.[2]?.startDate || config.startDate || '2026-08-18');
      setSem2End(config.semesters?.[2]?.endDate || config.endDate || '2027-02-28');
      setActiveSemester(config.semester || timetableData?.semester || 2);
      setEvents(config.events || []);
      setVacations(config.vacations || []);
      setSpecialDaySchedules(config.specialDaySchedules || []);
      setExamPeriods(config.examPeriods || []);
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

    const label = newEventScope === 'grade'
      ? `${newEventGrade}학년 담임교사 일괄 (${targetTeachers.length}명)`
      : `전교생 담임교사 일괄 (${targetTeachers.length}명)`;

    setNewEventInChargeTeachers(targetTeachers);
    setNewEventInChargeRoleLabel(label);
  };

  // 진로담당교사 일괄 자동 배정 핸들러
  const handleAssignCareerTeachers = () => {
    const targetTeachers = timetableData.teachers.filter(t => {
      const slots = Object.values(t.slots || {});
      return slots.some(s => {
        const isCareer = s?.subjectName?.includes('진로') || s?.activityType?.includes('진로');
        if (!isCareer) return false;
        if (newEventScope === 'grade') {
          return s.grade === newEventGrade || (s.classCode && s.classCode.includes(String(newEventGrade)));
        }
        return true;
      });
    }).map(t => t.teacherName);

    if (targetTeachers.length === 0) {
      alert(`${newEventScope === 'grade' ? `${newEventGrade}학년 ` : ''}진로 수업이 배정된 교사를 찾을 수 없습니다.`);
      return;
    }

    const label = newEventScope === 'grade'
      ? `${newEventGrade}학년 진로담당 일괄 (${targetTeachers.length}명)`
      : `진로담당교사 일괄 (${targetTeachers.length}명)`;

    setNewEventInChargeTeachers(targetTeachers);
    setNewEventInChargeRoleLabel(label);
  };

  // 동아리(동아)담당교사 일괄 자동 배정 핸들러
  const handleAssignClubTeachers = () => {
    const targetTeachers = timetableData.teachers.filter(t => {
      const slots = Object.values(t.slots || {});
      return slots.some(s => {
        const isClub = s?.subjectName?.includes('동아') || s?.activityType?.includes('동아');
        if (!isClub) return false;
        if (newEventScope === 'grade') {
          return s.grade === newEventGrade || (s.classCode && s.classCode.includes(String(newEventGrade)));
        }
        return true;
      });
    }).map(t => t.teacherName);

    if (targetTeachers.length === 0) {
      alert(`${newEventScope === 'grade' ? `${newEventGrade}학년 ` : ''}동아리(동아) 수업이 배정된 교사를 찾을 수 없습니다.`);
      return;
    }

    const label = newEventScope === 'grade'
      ? `${newEventGrade}학년 동아리담당 일괄 (${targetTeachers.length}명)`
      : `동아리담당교사 일괄 (${targetTeachers.length}명)`;

    setNewEventInChargeTeachers(targetTeachers);
    setNewEventInChargeRoleLabel(label);
  };

  // 개별 담당 교사 추가/제거
  const handleToggleInChargeTeacher = (teacherName: string) => {
    setNewEventInChargeRoleLabel(''); // 개별 선택 시 라벨 초기화
    setNewEventInChargeTeachers(prev => 
      prev.includes(teacherName) ? prev.filter(t => t !== teacherName) : [...prev, teacherName]
    );
  };

  // ===================== [TAB 3: 행사 관리 핸들러] =====================
  const handleStartEditEvent = (ev: SchoolEvent) => {
    setEditingEventId(ev.id);
    setNewEventTitle(ev.title);
    setNewEventDate(ev.date);
    setNewEventPeriods(ev.periods);
    setNewEventScope(ev.targetScope);
    setNewEventGrade(ev.targetGrades?.[0] || 1);
    setNewEventInChargeTeachers(ev.inChargeTeachers || []);
    setNewEventInChargeRoleLabel(ev.inChargeRoleLabel || '');
    setShowDetailedTeachers(false);
    setNewEventLocation(ev.location || '');
    setNewEventDescription(ev.description || '');
  };

  const handleCancelEditEvent = () => {
    setEditingEventId(null);
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventPeriods([]);
    setNewEventInChargeTeachers([]);
    setNewEventInChargeRoleLabel('');
    setShowDetailedTeachers(false);
    setNewEventLocation('');
    setNewEventDescription('');
  };

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
    const updatedEvent: SchoolEvent = {
      id: editingEventId || `ev-${Date.now()}`,
      title: newEventTitle.trim(),
      date: newEventDate,
      day,
      periods: [...newEventPeriods].sort((a, b) => a - b),
      targetScope: newEventScope,
      targetGrades: newEventScope === 'grade' ? [newEventGrade] : (newEventScope === 'all' ? [1, 2, 3] : []),
      inChargeTeachers: newEventInChargeTeachers,
      inChargeRoleLabel: newEventInChargeRoleLabel.trim() || undefined,
      location: newEventLocation.trim() || undefined,
      description: newEventDescription.trim() || undefined,
    };

    if (editingEventId) {
      setEvents(prev => prev.map(e => e.id === editingEventId ? updatedEvent : e));
    } else {
      setEvents(prev => [...prev, updatedEvent]);
    }

    handleCancelEditEvent();
  };

  const handleDeleteEvent = (id: string) => {
    if (editingEventId === id) handleCancelEditEvent();
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // ===================== [TAB 2: 방학/휴업일 핸들러] =====================
  const handleStartEditVacation = (vac: VacationPeriod) => {
    setEditingVacationId(vac.id);
    setNewVacName(vac.name);
    setNewVacStart(vac.startDate);
    setNewVacEnd(vac.endDate);
    setNewVacType(vac.type || 'vacation');
  };

  const handleCancelEditVacation = () => {
    setEditingVacationId(null);
    setNewVacName('');
    setNewVacStart('');
    setNewVacEnd('');
  };

  const handleAddVacation = () => {
    if (!newVacName.trim() || !newVacStart || !newVacEnd) {
      alert('방학/휴업일 명칭과 시작일, 종료일을 모두 입력해 주세요.');
      return;
    }

    const updatedVac: VacationPeriod = {
      id: editingVacationId || `vac-${Date.now()}`,
      name: newVacName.trim(),
      startDate: newVacStart,
      endDate: newVacEnd,
      type: newVacType,
    };

    if (editingVacationId) {
      setVacations(prev => prev.map(v => v.id === editingVacationId ? updatedVac : v));
    } else {
      setVacations(prev => [...prev, updatedVac]);
    }

    handleCancelEditVacation();
  };

  const handleDeleteVacation = (id: string) => {
    if (editingVacationId === id) handleCancelEditVacation();
    setVacations(prev => prev.filter(v => v.id !== id));
  };

  // ===================== [TAB 4: 대체 요일 시간표 핸들러] =====================
  const handleStartEditSpecialDay = (sp: SpecialDaySchedule) => {
    setEditingSpecialDayId(sp.id);
    setNewSpecialDate(sp.date);
    setNewSpecialTargetDay(sp.targetDayOfWeek);
    setNewSpecialDesc(sp.description || '');
  };

  const handleCancelEditSpecialDay = () => {
    setEditingSpecialDayId(null);
    setNewSpecialDate('');
    setNewSpecialDesc('');
  };

  const handleAddSpecialDay = () => {
    if (!newSpecialDate) {
      alert('운영 날짜를 선택해 주세요.');
      return;
    }

    const origDay = getDayOfWeekFromDate(newSpecialDate) || '수';
    const updatedSpecial: SpecialDaySchedule = {
      id: editingSpecialDayId || `sp-${Date.now()}`,
      date: newSpecialDate,
      originalDayOfWeek: origDay,
      targetDayOfWeek: newSpecialTargetDay,
      description: newSpecialDesc.trim() || `${origDay}요일에 ${newSpecialTargetDay}요일 시간표로 전교 수업 운영`,
    };

    setSpecialDaySchedules(prev => {
      const filtered = prev.filter(s => s.id !== (editingSpecialDayId || updatedSpecial.id) && s.date !== newSpecialDate);
      return [...filtered, updatedSpecial].sort((a, b) => a.date.localeCompare(b.date));
    });

    handleCancelEditSpecialDay();
  };

  // ===================== [TAB 5: 단축 및 변형수업 핸들러] =====================
  const handleStartEditCustomClass = (sp: SpecialDaySchedule) => {
    setEditingCustomClassId(sp.id);
    setNewCustomDate(sp.date);
    setNewCustomTargetDay(sp.targetDayOfWeek);
    setNewCustomDesc(sp.description || '');
    setNewCustomShortenedPeriods(sp.shortenedPeriods);
    setNewCustomPeriodOverrides(sp.periodOverrides || {});
  };

  const handleCancelEditCustomClass = () => {
    setEditingCustomClassId(null);
    setNewCustomDate('');
    setNewCustomDesc('');
    setNewCustomShortenedPeriods(undefined);
    setNewCustomPeriodOverrides({});
  };

  const handleAddCustomClass = () => {
    if (!newCustomDate) {
      alert('운영 날짜를 선택해 주세요.');
      return;
    }

    const origDay = getDayOfWeekFromDate(newCustomDate) || '금';
    const hasOverrides = Object.keys(newCustomPeriodOverrides).length > 0;
    const defaultDesc = newCustomShortenedPeriods 
      ? `${newCustomShortenedPeriods}교시 단축수업 운영` 
      : `${origDay}요일 교시 변형/중복 운영`;

    const updatedCustom: SpecialDaySchedule = {
      id: editingCustomClassId || `sp-custom-${Date.now()}`,
      date: newCustomDate,
      originalDayOfWeek: origDay,
      targetDayOfWeek: newCustomTargetDay || origDay,
      shortenedPeriods: newCustomShortenedPeriods,
      periodOverrides: hasOverrides ? newCustomPeriodOverrides : undefined,
      description: newCustomDesc.trim() || defaultDesc,
    };

    setSpecialDaySchedules(prev => {
      const filtered = prev.filter(s => s.id !== (editingCustomClassId || updatedCustom.id) && s.date !== newCustomDate);
      return [...filtered, updatedCustom].sort((a, b) => a.date.localeCompare(b.date));
    });

    handleCancelEditCustomClass();
  };

  const handleDeleteSpecialDay = (id: string) => {
    if (editingSpecialDayId === id) handleCancelEditSpecialDay();
    if (editingCustomClassId === id) handleCancelEditCustomClass();
    setSpecialDaySchedules(prev => prev.filter(s => s.id !== id));
  };

  // ===================== [TAB 1: 지필평가/시험 핸들러] =====================
  const handleStartEditExam = (exam: ExamPeriod) => {
    setEditingExamId(exam.id);
    setNewExamName(exam.name);
    setNewExamStart(exam.startDate);
    setNewExamEnd(exam.endDate);
    setNewExamGrades(exam.targetGrades);
    setNewExamPeriodList(exam.examPeriods);
    setNewExamAfternoon(exam.afternoonType);
    setNewExamDesc(exam.description || '');
    setNewExamDailySchedules(exam.dailySchedules || []);
  };

  const handleCancelEditExam = () => {
    setEditingExamId(null);
    setNewExamName('');
    setNewExamStart('');
    setNewExamEnd('');
    setNewExamDesc('');
    setNewExamDailySchedules([]);
  };

  const handleAddExamPeriod = () => {
    if (!newExamName.trim()) {
      alert('시험/고사 명칭을 입력해 주세요.');
      return;
    }
    if (!newExamStart || !newExamEnd) {
      alert('시험 시작일과 종료일을 모두 입력해 주세요.');
      return;
    }
    if (newExamGrades.length === 0) {
      alert('대상 학년을 최소 1개 이상 선택해 주세요.');
      return;
    }

    const updatedExam: ExamPeriod = {
      id: editingExamId || `exam-${Date.now()}`,
      name: newExamName.trim(),
      startDate: newExamStart,
      endDate: newExamEnd,
      targetGrades: [...newExamGrades].sort((a, b) => a - b),
      examPeriods: [...newExamPeriodList].sort((a, b) => a - b),
      afternoonType: newExamAfternoon,
      dailySchedules: newExamDailySchedules.length > 0 ? newExamDailySchedules : undefined,
      description: newExamDesc.trim() || undefined,
    };

    if (editingExamId) {
      setExamPeriods(prev => prev.map(e => e.id === editingExamId ? updatedExam : e).sort((a, b) => a.startDate.localeCompare(b.startDate)));
    } else {
      setExamPeriods(prev => [...prev, updatedExam].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    }

    handleCancelEditExam();
  };

  const handleDeleteExamPeriod = (id: string) => {
    if (editingExamId === id) handleCancelEditExam();
    setExamPeriods(prev => prev.filter(e => e.id !== id));
  };

  // 시험 대상 학년 토글
  const handleToggleExamGrade = (g: number) => {
    setNewExamGrades(prev => 
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a, b) => a - b)
    );
  };

  // 특정 일자의 시험 진행 교시 토글
  const handleToggleDailyPeriod = (date: string, period: number) => {
    setNewExamDailySchedules(prev => prev.map(d => {
      if (d.date !== date) return d;
      const exists = d.examPeriods.includes(period);
      const updatedPeriods = exists 
        ? d.examPeriods.filter(p => p !== period)
        : [...d.examPeriods, period].sort((a, b) => a - b);
      return { ...d, examPeriods: updatedPeriods };
    }));
  };

  // 특정 일자의 오후 운영 형태 변경
  const handleChangeDailyAfternoon = (date: string, afternoonType: 'dismiss' | 'regular_class') => {
    setNewExamDailySchedules(prev => prev.map(d => {
      if (d.date !== date) return d;
      return { ...d, afternoonType };
    }));
  };

  // 전체 일자에 교시 일괄 적용
  const handleApplyAllDailyPeriods = (periods: number[]) => {
    setNewExamDailySchedules(prev => prev.map(d => ({
      ...d,
      examPeriods: [...periods],
    })));
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
        specialDaySchedules,
        examPeriods,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[88vh] max-h-[850px] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
        {/* 1. GradeImportModal 스타일 상단 헤더 */}
        <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0 flex flex-row items-center justify-start text-left w-full">
          <div className="flex items-center gap-3.5 text-left justify-start">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 shadow-sm">
              <CalendarDays className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center gap-2 text-left">
                <DialogTitle className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight text-left">
                  {config.academicYear || 2026}학년도 연간 학사일정 & 행사 관리
                </DialogTitle>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200/60 text-xs px-2.5 py-0.5 rounded-md font-bold">
                  수업계 전용
                </Badge>
              </div>
              <DialogDescription className="text-slate-500 text-xs sm:text-sm font-medium mt-1 text-left">
                1년 연간 1학기·2학기 수업 기간, 방학/휴업일, 학교 행사를 통합 관리하여 주간 시간표와 결보강 시스템에 실시간 연동합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 2. 세그먼트 탭 스위처 (5개 탭) */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 sm:px-6 py-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('periods')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                activeTab === 'periods'
                  ? "bg-white text-blue-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">학사 기간</span>
              <span className="sm:hidden">기간</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('exams')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                activeTab === 'exams'
                  ? "bg-white text-rose-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <FileEdit className="h-3.5 w-3.5 text-rose-600" />
              <span className="hidden sm:inline">지필평가/시험 ({examPeriods.length})</span>
              <span className="sm:hidden">시험 ({examPeriods.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                activeTab === 'events'
                  ? "bg-white text-amber-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">행사 관리 ({events.length})</span>
              <span className="sm:hidden">행사 ({events.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vacations')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                activeTab === 'vacations'
                  ? "bg-white text-emerald-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <Palmtree className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">방학/휴업 ({vacations.length})</span>
              <span className="sm:hidden">방학 ({vacations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('special_days')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                activeTab === 'special_days'
                  ? "bg-white text-indigo-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600" />
              <span className="hidden sm:inline">대체 요일 ({specialDaySchedules.filter(s => !s.shortenedPeriods && (!s.periodOverrides || Object.keys(s.periodOverrides).length === 0)).length})</span>
              <span className="sm:hidden">대체 ({specialDaySchedules.filter(s => !s.shortenedPeriods && (!s.periodOverrides || Object.keys(s.periodOverrides).length === 0)).length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom_classes')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                activeTab === 'custom_classes'
                  ? "bg-white text-amber-900 font-black shadow-2xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span className="hidden sm:inline">단축/변형 ({specialDaySchedules.filter(s => Boolean(s.shortenedPeriods) || (s.periodOverrides && Object.keys(s.periodOverrides).length > 0)).length})</span>
              <span className="sm:hidden">변형 ({specialDaySchedules.filter(s => Boolean(s.shortenedPeriods) || (s.periodOverrides && Object.keys(s.periodOverrides).length > 0)).length})</span>
            </button>
          </div>
        </div>

        {/* 3. 탭별 스크롤 본문 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-slate-700 custom-scrollbar bg-white">
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

          {/* TAB 2: 지필평가 / 시험 기간 관리 (중간고사, 기말고사, 모의고사) */}
          {activeTab === 'exams' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs font-black text-slate-900 block mb-0.5">
                    지필평가 및 정기고사 기간 관리
                  </strong>
                  <p className="text-[11px] text-slate-500">
                    지필평가(중간/기말고사) 기간을 설정하면 해당 기간 정규 수업이 고사 모드로 전환되고 교과 결보강이 자동 차단됩니다.
                  </p>
                </div>
              </div>

              {/* 신규 / 수정 시험 등록 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border space-y-3.5 transition-all",
                editingExamId ? "bg-rose-100/70 border-rose-400 ring-2 ring-rose-500/20 shadow-xs" : "bg-rose-50/60 border-rose-200/80"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileEdit className="h-4 w-4 text-rose-600" />
                    <strong className="text-xs font-black text-rose-950">
                      {editingExamId ? '✏️ 지필평가/시험 일정 수정 중' : '지필평가/시험 일정 신규 등록'}
                    </strong>
                  </div>
                  {editingExamId && (
                    <button
                      type="button"
                      onClick={handleCancelEditExam}
                      className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      수정 취소
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 시험명 */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">시험 명칭</label>
                    <Input
                      placeholder="예: 2학기 1차 지필평가 (중간고사)"
                      value={newExamName}
                      onChange={e => setNewExamName(e.target.value)}
                      className="h-8.5 text-xs font-bold bg-white border-rose-200 rounded-xl"
                    />
                  </div>

                  {/* 시작일 */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">시작일</label>
                    <Input
                      type="date"
                      value={newExamStart}
                      onChange={e => setNewExamStart(e.target.value)}
                      className="h-8.5 text-xs font-bold bg-white border-rose-200 rounded-xl"
                    />
                  </div>

                  {/* 종료일 */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">종료일</label>
                    <Input
                      type="date"
                      value={newExamEnd}
                      onChange={e => setNewExamEnd(e.target.value)}
                      className="h-8.5 text-xs font-bold bg-white border-rose-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* 대상 학년 선택 */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">대상 학년</label>
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-rose-200">
                      {[1, 2, 3].map(g => {
                        const isChecked = newExamGrades.includes(g);
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleToggleExamGrade(g)}
                            className={cn(
                              "flex-1 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer",
                              isChecked ? "bg-rose-600 text-white font-black shadow-xs" : "text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            {isChecked && '✓ '}{g}학년
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 설명 / 비고 */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">설명 / 비고 (선택)</label>
                    <Input
                      placeholder="예: 3일간 1~3학년 지필평가 운영"
                      value={newExamDesc}
                      onChange={e => setNewExamDesc(e.target.value)}
                      className="h-8.5 text-xs bg-white border-rose-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* 🌟 일자별 시험 교시 상세 설정표 */}
                <div className="pt-2 border-t border-rose-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-[11px] font-black text-rose-950 block">
                        일자별 시험 교시 & 오후 일정 개별 설정
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        날짜마다 시험 과목 수에 맞춰 교시(1~4교시)와 오후 하교 여부를 각각 지정할 수 있습니다.
                      </span>
                    </div>

                    {newExamDailySchedules.length > 0 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleApplyAllDailyPeriods([1, 2, 3])}
                          className="px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 text-[10px] font-bold hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                        >
                          전체 3교시 일괄
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyAllDailyPeriods([1, 2, 3, 4])}
                          className="px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 text-[10px] font-bold hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                        >
                          전체 4교시 일괄
                        </button>
                      </div>
                    )}
                  </div>

                  {newExamDailySchedules.length === 0 ? (
                    <div className="text-center py-4 bg-white/60 rounded-xl border border-dashed border-rose-200 text-slate-400 text-xs font-medium">
                      위에서 시작일과 종료일을 선택하시면 일자별 교시 설정 목록이 자동으로 나타납니다.
                    </div>
                  ) : (
                    <div className="space-y-1.5 bg-white/80 p-2 rounded-xl border border-rose-200 max-h-48 overflow-y-auto">
                      {newExamDailySchedules.map((daily, idx) => {
                        const dayOfWeekStr = getDayOfWeekFromDate(daily.date);
                        return (
                          <div
                            key={daily.date}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-rose-50/40 border border-rose-100 text-xs"
                          >
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <strong className="text-slate-900 font-bold text-[11px]">
                                {daily.date} ({dayOfWeekStr}요일)
                              </strong>
                            </div>

                            {/* 교시 선택 버튼들 */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {[1, 2, 3, 4].map(p => {
                                const isChecked = daily.examPeriods.includes(p);
                                return (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => handleToggleDailyPeriod(daily.date, p)}
                                    className={cn(
                                      "px-2 py-0.5 rounded text-[10.5px] font-black transition-all cursor-pointer",
                                      isChecked
                                        ? "bg-rose-600 text-white shadow-2xs"
                                        : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-100"
                                    )}
                                  >
                                    {p}교시
                                  </button>
                                );
                              })}
                            </div>

                            {/* 오후 일정 */}
                            <div className="shrink-0">
                              <Select
                                value={daily.afternoonType}
                                onValueChange={(val: any) => handleChangeDailyAfternoon(daily.date, val)}
                              >
                                <SelectTrigger className="h-7 text-[10.5px] font-bold bg-white border-rose-200 rounded-lg min-w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dismiss" className="text-xs font-bold">
                                    🏠 시험 후 하교
                                  </SelectItem>
                                  <SelectItem value="regular_class" className="text-xs font-bold">
                                    📚 오후 정상수업
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleAddExamPeriod}
                    className="flex-1 h-8.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                  >
                    {editingExamId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        지필평가 / 시험 일정 수정 완료
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        지필평가 / 시험 일정 추가
                      </>
                    )}
                  </Button>
                  {editingExamId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEditExam}
                      className="h-8.5 text-xs font-bold border-slate-300 text-slate-700 rounded-xl"
                    >
                      취소
                    </Button>
                  )}
                </div>
              </div>

              {/* 목록 */}
              <div className="space-y-2">
                {examPeriods.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    등록된 지필평가/시험 일정이 없습니다.
                  </div>
                ) : (
                  [...examPeriods].sort((a, b) => a.startDate.localeCompare(b.startDate)).map(exam => {
                    const isEditing = editingExamId === exam.id;
                    return (
                      <div
                        key={exam.id}
                        className={cn(
                          "p-3.5 rounded-2xl bg-white border shadow-2xs flex items-center justify-between gap-3 transition-all",
                          isEditing ? "border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/30" : "border-rose-100"
                        )}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-xs font-black text-slate-900">{exam.name}</strong>
                            <span className="font-mono text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              {exam.startDate} ~ {exam.endDate}
                            </span>
                            <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {exam.targetGrades.length === 3 ? '전학년' : `${exam.targetGrades.join(', ')}학년`}
                            </span>
                            {isEditing && (
                              <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded-full">
                                수정 중
                              </span>
                            )}
                          </div>

                          {/* 일자별 교시 상세 요약 */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {exam.dailySchedules && exam.dailySchedules.length > 0 ? (
                              exam.dailySchedules.map((ds, i) => (
                                <span key={ds.date} className="text-[10px] font-bold text-rose-800 bg-rose-50/80 border border-rose-200 px-1.5 py-0.2 rounded-md">
                                  {i + 1}일차({ds.date.slice(5)}): {ds.examPeriods.join('·')}교시 {ds.afternoonType === 'dismiss' ? '(하교)' : '(수업)'}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {exam.examPeriods.join('·')}교시 ({exam.afternoonType === 'dismiss' ? '하교' : '오후수업'})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEditExam(exam)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="수정"
                          >
                            <FileEdit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExamPeriod(exam.id)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 행사 관리 */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {/* 행사 신규/수정 등록 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border space-y-3 transition-all",
                editingEventId ? "bg-indigo-100/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs" : "bg-indigo-50/50 border-indigo-200/80"
              )}>
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    {editingEventId ? (
                      <>
                        <FileEdit className="h-4 w-4 text-indigo-600" />
                        ✏️ 행사 정보 수정 중
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-indigo-600" />
                        새 행사 등록
                      </>
                    )}
                  </strong>
                  {editingEventId ? (
                    <button
                      type="button"
                      onClick={handleCancelEditEvent}
                      className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      수정 취소
                    </button>
                  ) : (
                    <span className="text-[10.5px] text-slate-500">
                      등록 시 해당 학년/담당교사 시간표에 자동으로 행사 배너가 표시됩니다.
                    </span>
                  )}
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

                  {/* 담당 교사 지정 (담임/진로/동아리 일괄 자동 배정 버튼 탑재) */}
                  <div className="sm:col-span-2 space-y-2 bg-white/80 p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-blue-600" />
                        행사 담당 / 인솔 교사 ({newEventInChargeTeachers.length}명 지정됨)
                      </label>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1. 담임교사 일괄 버튼 */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAutoAssignHomeroomTeachers}
                          className="h-7 text-[10.5px] font-bold gap-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border-slate-200 rounded-lg shadow-2xs cursor-pointer"
                          title="해당 학년 담임교사 일괄 지정"
                        >
                          <Users className="h-3 w-3 text-blue-600" />
                          {newEventScope === 'grade' 
                            ? `${newEventGrade}학년 담임 일괄` 
                            : '전체 담임 일괄'
                          }
                        </Button>

                        {/* 2. 진로담당교사 일괄 버튼 */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAssignCareerTeachers}
                          className="h-7 text-[10.5px] font-bold gap-1 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 rounded-lg shadow-2xs cursor-pointer"
                          title="진로 수업 담당 교사 일괄 지정"
                        >
                          <Compass className="h-3 w-3 text-emerald-600" />
                          진로담당 일괄
                        </Button>

                        {/* 3. 동아리(동아)담당교사 일괄 버튼 */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAssignClubTeachers}
                          className="h-7 text-[10.5px] font-bold gap-1 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-800 border-slate-200 rounded-lg shadow-2xs cursor-pointer"
                          title="동아리(동아) 수업 담당 교사 일괄 지정"
                        >
                          <Palette className="h-3 w-3 text-purple-600" />
                          동아리담당 일괄
                        </Button>

                        {/* 4. 일괄 취소 버튼 */}
                        {newEventInChargeTeachers.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewEventInChargeTeachers([])}
                            className="h-7 px-2 text-[10.5px] font-bold gap-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg shadow-2xs cursor-pointer"
                          >
                            <X className="h-3 w-3 text-rose-500" />
                            일괄 취소
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 일괄 지정된 경우: 일괄 뱃지 표시 + 세부 명단 토글 */}
                    {newEventInChargeRoleLabel ? (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white flex items-center gap-1 shadow-2xs">
                              <Users className="h-3.5 w-3.5" />
                              {newEventInChargeRoleLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowDetailedTeachers(prev => !prev)}
                              className="text-[10.5px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
                            >
                              {showDetailedTeachers ? '명단 접기 ▲' : `세부 명단 보기 (${newEventInChargeTeachers.length}명) ▼`}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setNewEventInChargeTeachers([]);
                              setNewEventInChargeRoleLabel('');
                              setShowDetailedTeachers(false);
                            }}
                            className="text-[10.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            일괄 해제
                          </button>
                        </div>

                        {showDetailedTeachers && (
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in">
                            {newEventInChargeTeachers.map(name => {
                              const tInfo = timetableData.teachers.find(t => t.teacherName === name);
                              return (
                                <span
                                  key={name}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-700 flex items-center gap-1"
                                >
                                  <span>{name}</span>
                                  {tInfo?.homeroomClass && (
                                    <span className="text-indigo-600 text-[9px]">({tInfo.homeroomClass})</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* 개별 선택된 인솔 교사 칩 목록 */
                      newEventInChargeTeachers.length > 0 && (
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
                                  className="ml-0.5 hover:text-rose-200 cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setNewEventInChargeTeachers([])}
                            className="text-[10px] text-slate-400 hover:text-slate-700 px-1 py-0.5 self-center cursor-pointer"
                          >
                            전체 해제
                          </button>
                        </div>
                      )
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

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleAddEvent}
                    className="flex-1 h-8.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                  >
                    {editingEventId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        행사 정보 수정 완료
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        위 내용으로 행사 등록 추가
                      </>
                    )}
                  </Button>
                  {editingEventId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEditEvent}
                      className="h-8.5 text-xs font-bold border-slate-300 text-slate-700 rounded-xl"
                    >
                      취소
                    </Button>
                  )}
                </div>
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
                    {[...events].sort((a, b) => a.date.localeCompare(b.date) || ((a.periods[0] || 0) - (b.periods[0] || 0))).map(ev => {
                      const isEditing = editingEventId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          className={cn(
                            "p-3 rounded-2xl bg-white border shadow-2xs flex items-center justify-between gap-3 transition-all",
                            isEditing ? "border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/30" : "border-slate-200"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                🎭 {ev.targetScope === 'all' ? '전교생' : `${ev.targetGrades?.join(', ')}학년`}
                              </span>
                              <strong className="text-xs font-black text-slate-900">{ev.title}</strong>
                              {isEditing && (
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.2 rounded-full">
                                  수정 중
                                </span>
                              )}
                              {ev.location && (
                                <span className="text-[10.5px] text-slate-500 flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3 text-slate-400" />
                                  {ev.location}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
                              <span>📅 {ev.date} ({ev.day})</span>
                              <span className="font-bold text-indigo-700">⏱️ {ev.periods.join(', ')}교시</span>
                              {ev.inChargeRoleLabel ? (
                                <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md">
                                  👥 {ev.inChargeRoleLabel}
                                </span>
                              ) : ev.inChargeTeachers && ev.inChargeTeachers.length > 0 ? (
                                <span className="font-bold text-slate-700">
                                  👤 담당: {ev.inChargeTeachers.length > 3
                                    ? `${ev.inChargeTeachers.slice(0, 2).join(', ')} 외 ${ev.inChargeTeachers.length - 2}명`
                                    : `${ev.inChargeTeachers.join(', ')} 선생님`
                                  }
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEditEvent(ev)}
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="수정"
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 방학 및 휴업일 관리 */}
          {activeTab === 'vacations' && (
            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-2xl border space-y-3 transition-all",
                editingVacationId ? "bg-emerald-100/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs" : "bg-emerald-50/50 border-emerald-200/80"
              )}>
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    {editingVacationId ? (
                      <>
                        <FileEdit className="h-4 w-4 text-emerald-600" />
                        ✏️ 방학 / 휴업일 수정 중
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-emerald-600" />
                        새 방학 / 휴업일 추가
                      </>
                    )}
                  </strong>
                  {editingVacationId && (
                    <button
                      type="button"
                      onClick={handleCancelEditVacation}
                      className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      수정 취소
                    </button>
                  )}
                </div>

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

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleAddVacation}
                    className="flex-1 h-8.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                  >
                    {editingVacationId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        방학 / 휴업일 수정 완료
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        방학 / 휴업일 추가
                      </>
                    )}
                  </Button>
                  {editingVacationId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEditVacation}
                      className="h-8.5 text-xs font-bold border-slate-300 text-slate-700 rounded-xl"
                    >
                      취소
                    </Button>
                  )}
                </div>
              </div>

              {/* 목록 */}
              <div className="space-y-2">
                {[...vacations].sort((a, b) => a.startDate.localeCompare(b.startDate)).map(vac => {
                  const isEditing = editingVacationId === vac.id;
                  return (
                    <div
                      key={vac.id}
                      className={cn(
                        "p-3 rounded-2xl bg-white border shadow-2xs flex items-center justify-between transition-all",
                        isEditing ? "border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/30" : "border-slate-200"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-black text-slate-900 block">{vac.name}</strong>
                          {isEditing && (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                              수정 중
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {vac.startDate} ~ {vac.endDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEditVacation(vac)}
                          className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          title="수정"
                        >
                          <FileEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVacation(vac.id)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: 대체 요일 시간표 운영 (수요일에 월요일 시간표 운영 등) */}
          {activeTab === 'special_days' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs font-black text-slate-900 block mb-0.5">
                    대체 요일 시간표 운영 관리 (특수 요일 수업)
                  </strong>
                  <p className="text-[11px] text-slate-500">
                    공휴일로 인해 부족해진 특정 요일의 결손 시수를 확보하기 위해 다른 요일의 시간표로 전환하여 운영하는 날을 등록합니다. (예: 수요일에 월요일 시간표 운영)
                  </p>
                </div>
              </div>

              {/* 신규 / 수정 대체 요일 등록 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border space-y-3.5 transition-all",
                editingSpecialDayId ? "bg-indigo-100/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs" : "bg-indigo-50/50 border-indigo-200/80"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-indigo-600" />
                    <strong className="text-xs font-black text-indigo-950">
                      {editingSpecialDayId ? '✏️ 대체 요일 시간표 수정 중' : '대체 요일 시간표 신규 등록'}
                    </strong>
                  </div>
                  {editingSpecialDayId && (
                    <button
                      type="button"
                      onClick={handleCancelEditSpecialDay}
                      className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                    >
                      수정 취소
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">운영 날짜</label>
                    <Input
                      type="date"
                      value={newSpecialDate}
                      onChange={e => {
                        const dateVal = e.target.value;
                        setNewSpecialDate(dateVal);
                        const origDay = getDayOfWeekFromDate(dateVal);
                        if (origDay) setNewSpecialTargetDay(origDay);
                      }}
                      className="h-8.5 text-xs font-bold bg-white border-indigo-200 rounded-xl"
                    />
                    {newSpecialDate && (
                      <span className="text-[10px] text-indigo-700 font-bold mt-1 block">
                        달력상: {getDayOfWeekFromDate(newSpecialDate)}요일
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">적용할 요일 시간표</label>
                    <Select
                      value={newSpecialTargetDay}
                      onValueChange={setNewSpecialTargetDay}
                    >
                      <SelectTrigger className="h-8.5 text-xs font-bold bg-white border-indigo-200 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['월', '화', '수', '목', '금'].map(d => (
                          <SelectItem key={d} value={d} className="text-xs font-bold">
                            {d}요일 시간표로 전교 진행
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">사유 / 설명</label>
                    <Input
                      placeholder="예: 월요일 결손시수 확보 대체수업"
                      value={newSpecialDesc}
                      onChange={e => setNewSpecialDesc(e.target.value)}
                      className="h-8.5 text-xs bg-white border-indigo-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleAddSpecialDay}
                    className="flex-1 h-8.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                  >
                    {editingSpecialDayId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        대체 요일 시간표 수정 완료
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        대체 요일 시간표 운영일 추가
                      </>
                    )}
                  </Button>
                  {editingSpecialDayId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEditSpecialDay}
                      className="h-8.5 text-xs font-bold border-slate-300 text-slate-700 rounded-xl"
                    >
                      취소
                    </Button>
                  )}
                </div>
              </div>

              {/* 목록 */}
              <div className="space-y-2">
                {specialDaySchedules.filter(s => !s.shortenedPeriods && (!s.periodOverrides || Object.keys(s.periodOverrides).length === 0)).length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    등록된 대체 요일 시간표 운영일이 없습니다.
                  </div>
                ) : (
                  specialDaySchedules
                    .filter(s => !s.shortenedPeriods && (!s.periodOverrides || Object.keys(s.periodOverrides).length === 0))
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(sp => {
                      const isEditing = editingSpecialDayId === sp.id;
                      return (
                        <div
                          key={sp.id}
                          className={cn(
                            "p-3.5 rounded-2xl bg-white border shadow-2xs flex items-center justify-between gap-3 transition-all",
                            isEditing ? "border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/30" : "border-indigo-100"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                {sp.date} ({sp.originalDayOfWeek || getDayOfWeekFromDate(sp.date)}요일)
                              </span>
                              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ArrowLeftRight className="h-3 w-3" />
                                {sp.targetDayOfWeek}요일 시간표로 전교 수업 운영
                              </span>
                              {isEditing && (
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.2 rounded-full">
                                  수정 중
                                </span>
                              )}
                            </div>
                            {sp.description && (
                              <p className="text-[11px] text-slate-500">{sp.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEditSpecialDay(sp)}
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="수정"
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSpecialDay(sp.id)}
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: 단축수업 및 교시 변형/중복 운영 관리 */}
          {activeTab === 'custom_classes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs font-black text-slate-900 block mb-0.5">
                    단축수업 및 교시 변형/중복 운영 관리
                  </strong>
                  <p className="text-[11px] text-slate-500">
                    방학식/개학식/연수일의 <strong>조기 하교(4~5교시 단축수업)</strong> 또는 특정 과목의 <strong>연속/중복 수업(예: 금 5교시 ➔ 6교시 복제)</strong>을 설정합니다.
                  </p>
                </div>
              </div>

              {/* 신규 / 수정 단축 및 변형수업 등록 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border space-y-3.5 transition-all",
                editingCustomClassId ? "bg-amber-100/70 border-amber-400 ring-2 ring-amber-500/20 shadow-xs" : "bg-amber-50/50 border-amber-200/80"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <strong className="text-xs font-black text-amber-950">
                      {editingCustomClassId ? '✏️ 단축 및 변형수업 수정 중' : '단축 및 변형수업 신규 등록'}
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 퀵 프리셋 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomShortenedPeriods(3);
                        setNewCustomDesc('3교시 단축수업 (4~7교시 수업 없음)');
                      }}
                      className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-[10.5px] font-bold hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                    >
                      ⏰ 3교시 단축
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomShortenedPeriods(4);
                        setNewCustomDesc('4교시 단축수업 (5~7교시 수업 없음)');
                      }}
                      className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-[10.5px] font-bold hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                    >
                      ⏰ 4교시 단축
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomShortenedPeriods(5);
                        setNewCustomDesc('5교시 단축수업 (6~7교시 수업 없음)');
                      }}
                      className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 text-[10.5px] font-bold hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                    >
                      ⏰ 5교시 단축
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomTargetDay('금');
                        setNewCustomPeriodOverrides({ 6: 5 });
                        setNewCustomDesc('금요일 5교시 수업 5~6교시 연속/중복 진행');
                      }}
                      className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 text-[10.5px] font-bold hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs"
                    >
                      ✨ 금 5➔6교시 복제
                    </button>
                    {editingCustomClassId ? (
                      <button
                        type="button"
                        onClick={handleCancelEditCustomClass}
                        className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                      >
                        수정 취소
                      </button>
                    ) : (Object.keys(newCustomPeriodOverrides).length > 0 || newCustomShortenedPeriods !== undefined) && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustomPeriodOverrides({});
                          setNewCustomShortenedPeriods(undefined);
                        }}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[10.5px] font-bold hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">운영 날짜</label>
                    <Input
                      type="date"
                      value={newCustomDate}
                      onChange={e => {
                        const dateVal = e.target.value;
                        setNewCustomDate(dateVal);
                        const origDay = getDayOfWeekFromDate(dateVal);
                        if (origDay) setNewCustomTargetDay(origDay);
                      }}
                      className="h-8.5 text-xs font-bold bg-white border-amber-200 rounded-xl"
                    />
                    {newCustomDate && (
                      <span className="text-[10px] text-amber-700 font-bold mt-1 block">
                        달력상: {getDayOfWeekFromDate(newCustomDate)}요일
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">단축수업 교시 설정 (조기 종료)</label>
                    <Select
                      value={newCustomShortenedPeriods ? String(newCustomShortenedPeriods) : 'normal'}
                      onValueChange={val => {
                        if (val === 'normal') {
                          setNewCustomShortenedPeriods(undefined);
                        } else {
                          const pNum = parseInt(val, 10);
                          setNewCustomShortenedPeriods(pNum);
                          if (!newCustomDesc.trim()) {
                            setNewCustomDesc(`${pNum}교시 단축수업 운영`);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-8.5 text-xs font-bold bg-white border-amber-300 rounded-xl text-amber-950">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal" className="text-xs font-bold">
                          정상 교시 운영 (단축 없음)
                        </SelectItem>
                        <SelectItem value="1" className="text-xs font-bold text-amber-900">
                          ⏰ 1교시까지만 수업 (2~7교시 없음)
                        </SelectItem>
                        <SelectItem value="2" className="text-xs font-bold text-amber-900">
                          ⏰ 2교시까지만 수업 (3~7교시 없음)
                        </SelectItem>
                        <SelectItem value="3" className="text-xs font-bold text-amber-900">
                          ⏰ 3교시까지만 수업 (4~7교시 없음)
                        </SelectItem>
                        <SelectItem value="4" className="text-xs font-bold text-amber-900">
                          ⏰ 4교시까지만 수업 (5~7교시 없음)
                        </SelectItem>
                        <SelectItem value="5" className="text-xs font-bold text-amber-900">
                          ⏰ 5교시까지만 수업 (6~7교시 없음)
                        </SelectItem>
                        <SelectItem value="6" className="text-xs font-bold text-amber-900">
                          ⏰ 6교시까지만 수업 (7교시 없음)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">사유 / 설명</label>
                    <Input
                      placeholder="예: 4교시 단축수업, 교직원 연수"
                      value={newCustomDesc}
                      onChange={e => setNewCustomDesc(e.target.value)}
                      className="h-8.5 text-xs bg-white border-amber-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* 🌟 특정 교시 중복/변형 매핑 설정표 */}
                <div className="pt-2 border-t border-amber-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-[11px] font-black text-amber-950 block">
                        특정 교시 복제 / 연속 중복 운영 (선택 사항)
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        예: 6교시에 5교시 수업을 진행하려면 6교시 드롭다운에서 &apos;5교시 수업&apos;을 선택하세요.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 bg-white/80 p-2 rounded-xl border border-amber-200">
                    {[1, 2, 3, 4, 5, 6, 7].map(period => {
                      const currentMapped = newCustomPeriodOverrides[period] ?? period;
                      const isOverridden = currentMapped !== period;
                      const isDismissed = Boolean(newCustomShortenedPeriods && period > newCustomShortenedPeriods);

                      return (
                        <div
                          key={period}
                          className={cn(
                            "p-1.5 rounded-lg border text-center space-y-1 transition-all",
                            isDismissed
                              ? "bg-amber-100/70 border-dashed border-amber-400 text-amber-900 opacity-80"
                              : isOverridden
                              ? "bg-indigo-100/90 border-indigo-400 text-indigo-950 shadow-2xs font-bold"
                              : "bg-slate-50/60 border-slate-200 text-slate-700"
                          )}
                        >
                          <div className="text-[11px] font-black flex items-center justify-center gap-1">
                            <span>{period}교시</span>
                            {isDismissed ? (
                              <span className="text-[8.5px] px-1 py-0.1 rounded bg-amber-300 text-amber-950 font-black">
                                단축
                              </span>
                            ) : isOverridden ? (
                              <span className="text-[9px] px-1 py-0.1 rounded bg-indigo-600 text-white font-black">
                                변형
                              </span>
                            ) : null}
                          </div>

                          {isDismissed ? (
                            <div className="text-[9.5px] text-amber-800 font-bold py-1">
                              수업 없음
                            </div>
                          ) : (
                            <Select
                              value={String(currentMapped)}
                              onValueChange={val => {
                                const numVal = parseInt(val, 10);
                                setNewCustomPeriodOverrides(prev => {
                                  const next = { ...prev };
                                  if (numVal === period) {
                                    delete next[period];
                                  } else {
                                    next[period] = numVal;
                                  }
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger className="h-6 text-[10px] font-bold bg-white border-slate-200 rounded px-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7].map(p => (
                                  <SelectItem key={p} value={String(p)} className="text-xs">
                                    {newCustomTargetDay} {p}교시 수업
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleAddCustomClass}
                    className="flex-1 h-8.5 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
                  >
                    {editingCustomClassId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        단축 및 변형수업 수정 완료
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        단축 및 변형수업 운영일 추가
                      </>
                    )}
                  </Button>
                  {editingCustomClassId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEditCustomClass}
                      className="h-8.5 text-xs font-bold border-slate-300 text-slate-700 rounded-xl"
                    >
                      취소
                    </Button>
                  )}
                </div>
              </div>

              {/* 목록 */}
              <div className="space-y-2">
                {specialDaySchedules.filter(s => Boolean(s.shortenedPeriods) || (s.periodOverrides && Object.keys(s.periodOverrides).length > 0)).length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    등록된 단축 및 변형수업 운영일이 없습니다.
                  </div>
                ) : (
                  specialDaySchedules
                    .filter(s => Boolean(s.shortenedPeriods) || (s.periodOverrides && Object.keys(s.periodOverrides).length > 0))
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(sp => {
                      const isEditing = editingCustomClassId === sp.id;
                      return (
                        <div
                          key={sp.id}
                          className={cn(
                            "p-3.5 rounded-2xl bg-white border shadow-2xs flex items-center justify-between gap-3 transition-all",
                            isEditing ? "border-amber-400 ring-2 ring-amber-500/20 bg-amber-50/30" : "border-amber-200"
                          )}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                {sp.date} ({sp.originalDayOfWeek || getDayOfWeekFromDate(sp.date)}요일)
                              </span>
                              {sp.shortenedPeriods && (
                                <span className="text-xs font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  ⏰ {sp.shortenedPeriods}교시 단축수업
                                </span>
                              )}
                              {isEditing && (
                                <span className="text-[10px] font-black text-amber-800 bg-amber-200 px-1.5 py-0.2 rounded-full">
                                  수정 중
                                </span>
                              )}
                            </div>

                            {/* 교시별 변형 매핑 뱃지 */}
                            {sp.periodOverrides && Object.keys(sp.periodOverrides).length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-500">교시 매핑:</span>
                                {Object.entries(sp.periodOverrides).map(([currP, mappedP]) => (
                                  <span
                                    key={currP}
                                    className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 border border-indigo-200"
                                  >
                                    {currP}교시 ➔ {sp.targetDayOfWeek} {mappedP}교시 수업 진행
                                  </span>
                                ))}
                              </div>
                            )}

                            {sp.description && (
                              <p className="text-[11px] text-slate-500">{sp.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEditCustomClass(sp)}
                              className="h-8 w-8 text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                              title="수정"
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSpecialDay(sp.id)}
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. 하단 모달 액션 바 */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold text-slate-600 border-slate-200/90 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            닫기
          </Button>

          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="h-9 px-5 text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-2xs rounded-xl cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '저장 중...' : '학사일정 전체 저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
