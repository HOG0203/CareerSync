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
  getDefaultAcademicCalendarConfig,
  TeacherInstructorAssignment,
  InstructorAssignedSlot
} from '@/lib/substitute/event-types';
import { 
  getKoreanHolidays, 
  parseScheduleExcel, 
  exportScheduleToExcel,
  generateSemesterWeeksFromConfig,
  findCurrentWeekNum
} from '@/lib/substitute/event-helper';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { getDayOfWeekFromDate } from '@/lib/substitute/validator';
import { DAYS_OF_WEEK } from '@/lib/timetable/constants';
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
  Square,
  Lock,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  Wand2,
  AlertCircle,
  HelpCircle,
  Pencil,
  Search,
  UserPlus
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
  // 4대 핵심 탭 ('calendar' | 'details' | 'instructors' | 'settings')
  const [activeTab, setActiveTab] = React.useState<'calendar' | 'details' | 'instructors' | 'settings'>('calendar');
  
  // 캘린더 월 이동 상태 (기본 2026년 9월 또는 현재 월)
  const [calendarYear, setCalendarYear] = React.useState<number>(() => {
    const d = new Date();
    return d.getFullYear() >= 2026 ? d.getFullYear() : 2026;
  });
  const [calendarMonth, setCalendarMonth] = React.useState<number>(() => {
    const d = new Date();
    return d.getFullYear() >= 2026 ? d.getMonth() + 1 : 9;
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = React.useState<string | null>(null);

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
  const [teacherInstructorAssignments, setTeacherInstructorAssignments] = React.useState<TeacherInstructorAssignment[]>(
    config?.teacherInstructorAssignments || []
  );

  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // [직접입력 모달] 달력 날짜 클릭 시 뜨는 직접입력 일정 설정 모달 상태
  const [dayScheduleModal, setDayScheduleModal] = React.useState<{
    dateStr: string;
    dayNumber: number;
    dayOfWeek: string;
    activeCategory: 'holiday' | 'shortened' | 'special_day' | 'exam' | 'event';
  } | null>(null);

  // [수정 모드 상태] 현재 수정 중인 기존 일정 ID 및 명칭 (null이면 신규 등록 모드)
  const [editingScheduleId, setEditingScheduleId] = React.useState<{
    id: string;
    category: 'holiday' | 'shortened' | 'special_day' | 'exam' | 'event';
    originalTitle: string;
  } | null>(null);

  // [직접입력 폼 필드 상태]
  // 1. 휴업일/재량휴업일 (단일일 vs 여러날짜 기간 모드)
  const [modalHolidayMode, setModalHolidayMode] = React.useState<'single' | 'range'>('single');
  const [modalHolidayEnd, setModalHolidayEnd] = React.useState<string>('');
  const [modalHolidayTitle, setModalHolidayTitle] = React.useState<string>('');
  const [modalHolidayType, setModalHolidayType] = React.useState<string>('discretionary');

  // 2. 단축수업
  const [modalShortenedPeriods, setModalShortenedPeriods] = React.useState<number>(5);
  const [modalShortenedDesc, setModalShortenedDesc] = React.useState<string>('');

  // 3. 대체요일 및 교시변형
  const [modalSwapMode, setModalSwapMode] = React.useState<'day' | 'period_block'>('day');
  const [modalSwapTargetDay, setModalSwapTargetDay] = React.useState<string>('수');
  const [modalSwapDesc, setModalSwapDesc] = React.useState<string>('');
  const [modalBlockSourcePeriod, setModalBlockSourcePeriod] = React.useState<number>(5);
  const [modalBlockTargetPeriod, setModalBlockTargetPeriod] = React.useState<number>(6);

  // 4. 지필평가/시험 (단일일 vs 여러날짜 기간 모드)
  const [modalExamMode, setModalExamMode] = React.useState<'single' | 'range'>('single');
  const [modalExamEnd, setModalExamEnd] = React.useState<string>('');
  const [modalExamName, setModalExamName] = React.useState<string>('');
  const [modalExamScope, setModalExamScope] = React.useState<'all' | '1' | '2' | '3'>('all');
  const [modalExamPeriods, setModalExamPeriods] = React.useState<number[]>([1, 2, 3]);
  const [modalExamDismiss, setModalExamDismiss] = React.useState<'dismiss' | 'regular_class'>('dismiss');

  // 5. 학교 행사
  const [modalEventTitle, setModalEventTitle] = React.useState<string>('');
  const [modalEventScope, setModalEventScope] = React.useState<EventTargetScope>('all');
  const [modalEventGrade, setModalEventGrade] = React.useState<number>(1);
  const [modalEventPeriods, setModalEventPeriods] = React.useState<number[]>([5, 6]);
  const [modalEventTeachers, setModalEventTeachers] = React.useState<string[]>([]);
  const [modalEventRoleLabel, setModalEventRoleLabel] = React.useState<string>('');
  const [modalEventLocation, setModalEventLocation] = React.useState<string>('');

  // 행사 인솔교사 개별 추가 팝오버 및 검색 상태
  const [showTeacherPicker, setShowTeacherPicker] = React.useState<boolean>(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = React.useState<string>('');

  // 모달 컨테이너 ref (팝업 메뉴의 모달 내부 상대위치 계산 및 넘침 방지)
  const modalContainerRef = React.useRef<HTMLDivElement>(null);

  // 엑셀 업로드 파일 input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // [상세 탭 서브스위치 & 검색/필터]
  const [detailSubTab, setDetailSubTab] = React.useState<'vacations' | 'exams' | 'events' | 'special_days'>('vacations');
  const [detailSearchQuery, setDetailSearchQuery] = React.useState<string>('');
  const [detailCategoryFilter, setDetailCategoryFilter] = React.useState<'all' | 'holiday' | 'exam' | 'shortened' | 'special_day' | 'event'>('all');

  // [수정 모드 상태]
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
  const [editingVacationId, setEditingVacationId] = React.useState<string | null>(null);
  const [editingSpecialDayId, setEditingSpecialDayId] = React.useState<string | null>(null);
  const [editingCustomClassId, setEditingCustomClassId] = React.useState<string | null>(null);
  const [editingExamId, setEditingExamId] = React.useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = React.useState<string | null>(null);

  // [시간강사 시간표 폼 상태]
  const [targetTeacherName, setTargetTeacherName] = React.useState<string>('');
  const [teacherSearchTerm, setTeacherSearchTerm] = React.useState<string>('');
  const [formInstructorName, setFormInstructorName] = React.useState<string>('');
  const [formInstructorType, setFormInstructorType] = React.useState<'hourly' | 'contract' | 'industry'>('hourly');
  const [formAssignmentMode, setFormAssignmentMode] = React.useState<'weekly' | 'daily'>('weekly'); // 'weekly' = 매주(상시), 'daily' = 특정 주차(보강)
  const [formAssignedWeek, setFormAssignedWeek] = React.useState<number>(1);
  const [formAssignedDate, setFormAssignedDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formRemarks, setFormRemarks] = React.useState<string>('');
  const [selectedInstructorSlots, setSelectedInstructorSlots] = React.useState<InstructorAssignedSlot[]>([]);

  // 시간강사 대상 교사 검색 필터링 목록
  const filteredTeachers = React.useMemo(() => {
    const list = timetableData?.teachers || [];
    const query = teacherSearchTerm.trim().toLowerCase();
    if (!query) {
      return list.slice().sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ko'));
    }
    return list
      .filter(t => 
        t.teacherName.toLowerCase().includes(query) || 
        (t.subjectGroup && t.subjectGroup.toLowerCase().includes(query))
      )
      .slice()
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ko'));
  }, [timetableData?.teachers, teacherSearchTerm]);

  // Select 컴포넌트 표시용 교사 목록 (현재 선택된 교사는 검색 결과와 무관하게 표시 유지)
  const displayedTeachers = React.useMemo(() => {
    const list = [...filteredTeachers];
    if (targetTeacherName && !list.some(t => t.teacherName === targetTeacherName)) {
      const currentTeacher = timetableData?.teachers.find(t => t.teacherName === targetTeacherName);
      if (currentTeacher) {
        list.unshift(currentTeacher);
      }
    }
    return list;
  }, [filteredTeachers, targetTeacherName, timetableData?.teachers]);

  // 학기 전체 주차 목록 생성
  const semesterWeeks = React.useMemo(() => {
    return generateSemesterWeeksFromConfig(config, activeSemester);
  }, [config, activeSemester]);

  // 오늘 날짜 기준 현재 주차 번호 계산 (주말 완벽 대응)
  const currentWeekNum = React.useMemo(() => {
    return findCurrentWeekNum(semesterWeeks);
  }, [semesterWeeks]);

  // 보강 주차 선택 기본값을 현재 주차로 자동 설정
  React.useEffect(() => {
    if (!editingAssignmentId) {
      setFormAssignedWeek(currentWeekNum);
    }
  }, [currentWeekNum, editingAssignmentId]);

  // 현재 선택된 주차 객체
  const selectedWeekObj = React.useMemo(() => {
    return semesterWeeks.find(w => w.weekNum === formAssignedWeek) || semesterWeeks[0];
  }, [semesterWeeks, formAssignedWeek]);

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

  // ==========================================
  // [UX 혁신] 1. 월별 학사 캘린더 날짜 계산 로직
  // ==========================================
  const calendarDays = React.useMemo(() => {
    const year = calendarYear;
    const month = calendarMonth; // 1-12
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const totalDays = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0(일) ~ 6(토)

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      dayOfWeek: number; // 0~6
      isCurrentMonth: boolean;
      events: SchoolEvent[];
      vacations: VacationPeriod[];
      specialDays: SpecialDaySchedule[];
      exams: ExamPeriod[];
      instructors: TeacherInstructorAssignment[];
    }> = [];

    // 이전 달 빈칸 (일요일 시작)
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dNum,
        dayOfWeek: new Date(prevY, prevM - 1, dNum).getDay(),
        isCurrentMonth: false,
        events: [],
        vacations: [],
        specialDays: [],
        exams: [],
        instructors: [],
      });
    }

    // 현재 달 날짜들
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();

      // 해당 일자에 걸치는 행사
      const matchedEvents = events.filter(e => e.date === dateStr);
      // 방학/휴업일
      const matchedVacations = vacations.filter(v => dateStr >= v.startDate && dateStr <= v.endDate);
      // 대체/단축
      const matchedSpecials = specialDaySchedules.filter(s => s.date === dateStr);
      // 시험
      const matchedExams = examPeriods.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
      // 일일/주차별 시간강사
      const matchedInstructors = teacherInstructorAssignments.filter(
        a => a.assignmentMode === 'daily' && (
          a.assignedDate === dateStr || 
          (a.effectivePeriod?.startDate && a.effectivePeriod?.endDate && dateStr >= a.effectivePeriod.startDate && dateStr <= a.effectivePeriod.endDate)
        )
      );

      days.push({
        dateStr,
        dayNumber: d,
        dayOfWeek,
        isCurrentMonth: true,
        events: matchedEvents,
        vacations: matchedVacations,
        specialDays: matchedSpecials,
        exams: matchedExams,
        instructors: matchedInstructors,
      });
    }

    // 다음 달 잔여 칸
    const remaining = 42 - days.length; // 6주 고정 그리드
    if (remaining > 0 && remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextM = month === 12 ? 1 : month + 1;
        const nextY = month === 12 ? year + 1 : year;
        const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({
          dateStr,
          dayNumber: d,
          dayOfWeek: new Date(nextY, nextM - 1, d).getDay(),
          isCurrentMonth: false,
          events: [],
          vacations: [],
          specialDays: [],
          exams: [],
          instructors: [],
        });
      }
    }

    return days;
  }, [calendarYear, calendarMonth, events, vacations, specialDaySchedules, examPeriods, teacherInstructorAssignments]);

  // 월 이동
  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarYear(y => y - 1);
      setCalendarMonth(12);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarYear(y => y + 1);
      setCalendarMonth(1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  // ==========================================
  // [마스터 데이터 테이블] 1년치 전체 일정 통합 리스트 & 필터
  // ==========================================
  const masterRows = React.useMemo(() => {
    const list: Array<{
      id: string;
      category: 'holiday' | 'exam' | 'shortened' | 'special_day' | 'event';
      date: string;
      endDate?: string;
      title: string;
      badgeLabel: string;
      badgeClass: string;
      details: string;
      rawItem: VacationPeriod | ExamPeriod | SpecialDaySchedule | SchoolEvent;
    }> = [];

    // 1. 방학/휴업일
    vacations.forEach(v => {
      const isHoliday = v.type === 'holiday';
      const isDiscretionary = v.type === 'discretionary';
      list.push({
        id: v.id,
        category: 'holiday',
        date: v.startDate,
        endDate: v.endDate !== v.startDate ? v.endDate : undefined,
        title: v.name,
        badgeLabel: isHoliday ? '🏖️ 공휴일' : (isDiscretionary ? '🏫 재량휴업' : '🌴 방학'),
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        details: v.endDate !== v.startDate 
          ? `${v.startDate} ~ ${v.endDate} (${isHoliday ? '법정공휴일' : (isDiscretionary ? '학교재량휴업' : '방학기간')})`
          : (isHoliday ? '법정공휴일' : (isDiscretionary ? '학교재량휴업일' : '방학기간')),
        rawItem: v,
      });
    });

    // 2. 지필평가
    examPeriods.forEach(e => {
      list.push({
        id: e.id,
        category: 'exam',
        date: e.startDate,
        endDate: e.endDate !== e.startDate ? e.endDate : undefined,
        title: e.name,
        badgeLabel: '📝 지필평가',
        badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
        details: `대상: ${e.targetGrades.join(',')}학년 | 시험교시: ${e.examPeriods.join('·')}교시 | 오후: ${e.afternoonType === 'dismiss' ? '하교' : '정규수업'}`,
        rawItem: e,
      });
    });

    // 3. 단축수업 및 교시연속/대체
    specialDaySchedules.forEach(s => {
      const hasOverrides = Boolean(s.periodOverrides && Object.keys(s.periodOverrides).length > 0);
      if (s.shortenedPeriods) {
        list.push({
          id: s.id,
          category: 'shortened',
          date: s.date,
          title: s.description || `${s.shortenedPeriods}교시 단축수업`,
          badgeLabel: `⏰ ${s.shortenedPeriods}교시 단축`,
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
          details: `${s.shortenedPeriods}교시까지 단축 운영 (${s.description || '정규 수업 단축'})`,
          rawItem: s,
        });
      } else if (hasOverrides && s.periodOverrides) {
        const targetP = Number(Object.keys(s.periodOverrides)[0]) || 6;
        const srcP = Number(s.periodOverrides[targetP]) || 5;
        list.push({
          id: s.id,
          category: 'special_day',
          date: s.date,
          title: s.description || `${srcP}~${targetP}교시 연속수업`,
          badgeLabel: `🔗 ${srcP}~${targetP}교시 연속`,
          badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
          details: `[연속수업] ${srcP}교시 수업 ➔ ${targetP}교시 연속 진행 (${s.description || '정규 시간표 연동'})`,
          rawItem: s,
        });
      } else {
        list.push({
          id: s.id,
          category: 'special_day',
          date: s.date,
          title: s.description || `${s.targetDayOfWeek}요일 시간표 대체`,
          badgeLabel: `🔄 ${s.originalDayOfWeek || '당일'} ➔ ${s.targetDayOfWeek}요일`,
          badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          details: `${s.originalDayOfWeek || '당일'}요일에 ${s.targetDayOfWeek}요일 시간표로 수업 대체 (${s.description || '시간표 변경'})`,
          rawItem: s,
        });
      }
    });

    // 4. 학교 행사
    events.forEach(ev => {
      const scopeText = ev.targetScope === 'grade' ? `${ev.targetGrades?.join(',')}학년` : '전교생';
      const periodsText = `${ev.periods.join(',')}교시`;
      const locationText = ev.location ? ` | 📍 ${ev.location}` : '';

      // 인솔교사 요약 (일괄 설정인 경우 "1학년 담임" 등 간소화)
      const teachersSummary = (() => {
        if (!ev.inChargeTeachers || ev.inChargeTeachers.length === 0) return '';

        // 1. inChargeRoleLabel 기반 분석
        if (ev.inChargeRoleLabel) {
          const rl = ev.inChargeRoleLabel.trim();
          if (rl.includes('담임')) {
            if (rl.includes('1학년')) return '1학년 담임';
            if (rl.includes('2학년')) return '2학년 담임';
            if (rl.includes('3학년')) return '3학년 담임';
            if (rl.includes('전교') || rl.includes('전체') || rl.includes('전학년')) return '전학년 담임';
            return '담임교사';
          }
          if (rl.includes('진로')) {
            if (rl.includes('1학년')) return '1학년 진로';
            if (rl.includes('2학년')) return '2학년 진로';
            if (rl.includes('3학년')) return '3학년 진로';
            return '진로담당';
          }
          if (rl.includes('동아리') || rl.includes('동아')) {
            if (rl.includes('1학년')) return '1학년 동아리';
            if (rl.includes('2학년')) return '2학년 동아리';
            if (rl.includes('3학년')) return '3학년 동아리';
            return '동아리담당';
          }
          return rl.replace(/\s*일괄/g, '').replace(/\(\d+명\)/g, '').trim() || rl;
        }

        // 2. timetableData 담임 목록 직접 매칭 분석
        if (timetableData?.teachers) {
          const allTeachers = timetableData.teachers;
          const getGradeHomeroom = (grade: number) => 
            allTeachers.filter(t => t.homeroomClass && getTeacherHomeroomGrade(t.homeroomClass) === grade).map(t => t.teacherName);

          const g1 = getGradeHomeroom(1);
          const g2 = getGradeHomeroom(2);
          const g3 = getGradeHomeroom(3);
          const allH = allTeachers.filter(t => t.homeroomClass && getTeacherHomeroomGrade(t.homeroomClass) !== null).map(t => t.teacherName);

          const isMatch = (list: string[]) => 
            list.length > 0 && 
            list.length === ev.inChargeTeachers.length && 
            list.every(name => ev.inChargeTeachers.includes(name));

          if (isMatch(g1)) return '1학년 담임';
          if (isMatch(g2)) return '2학년 담임';
          if (isMatch(g3)) return '3학년 담임';
          if (isMatch(allH)) return '전학년 담임';
        }

        // 3. 개별 지정인 경우
        if (ev.inChargeTeachers.length <= 3) {
          return ev.inChargeTeachers.join(', ');
        }
        return `${ev.inChargeTeachers.slice(0, 2).join(', ')} 외 ${ev.inChargeTeachers.length - 2}명`;
      })();

      const teachersText = teachersSummary ? ` | 인솔: ${teachersSummary}` : '';

      list.push({
        id: ev.id,
        category: 'event',
        date: ev.date,
        title: ev.title,
        badgeLabel: '🎭 학교행사',
        badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
        details: `대상: ${scopeText} | ${periodsText}${locationText}${teachersText}`,
        rawItem: ev,
      });
    });

    // 날짜순 정렬
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [vacations, examPeriods, specialDaySchedules, events, timetableData]);

  // 마스터 데이터 필터링 (검색어 + 카테고리 필터)
  const filteredMasterRows = React.useMemo(() => {
    let rows = masterRows;
    if (detailCategoryFilter !== 'all') {
      if (detailCategoryFilter === 'shortened') {
        rows = rows.filter(r => r.category === 'shortened');
      } else if (detailCategoryFilter === 'special_day') {
        rows = rows.filter(r => r.category === 'special_day');
      } else {
        rows = rows.filter(r => r.category === detailCategoryFilter);
      }
    }

    if (detailSearchQuery.trim()) {
      const q = detailSearchQuery.toLowerCase().trim();
      rows = rows.filter(r => 
        r.title.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        (r.endDate && r.endDate.includes(q)) ||
        r.details.toLowerCase().includes(q) ||
        r.badgeLabel.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [masterRows, detailCategoryFilter, detailSearchQuery]);

  // 마스터 행 수정 클릭 시 완성된 2단 모달 호출
  const handleEditMasterRow = (row: typeof masterRows[0]) => {
    if (row.category === 'holiday') {
      handleDayModalPrefillVacation(row.rawItem as VacationPeriod);
    } else if (row.category === 'exam') {
      handleDayModalPrefillExam(row.rawItem as ExamPeriod);
    } else if (row.category === 'shortened') {
      handleDayModalPrefillShortened(row.rawItem as SpecialDaySchedule);
    } else if (row.category === 'special_day') {
      handleDayModalPrefillSwapDay(row.rawItem as SpecialDaySchedule);
    } else if (row.category === 'event') {
      handleDayModalPrefillEvent(row.rawItem as SchoolEvent);
    }
  };

  // 마스터 행 삭제
  const handleDeleteMasterRow = (row: typeof masterRows[0]) => {
    if (!confirm(`'${row.title}' 일정을 삭제하시겠습니까?`)) return;
    if (row.category === 'holiday') {
      handleDeleteVacation(row.id);
    } else if (row.category === 'exam') {
      handleDeleteExamPeriod(row.id);
    } else if (row.category === 'shortened' || row.category === 'special_day') {
      handleDeleteSpecialDay(row.id);
    } else if (row.category === 'event') {
      handleDeleteEvent(row.id);
    }
  };

  // 신규 등록 클릭 시 오늘/현재 선택일 기준으로 2단 모달 열기
  const handleAddNewScheduleFromMaster = () => {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = (selectedCalendarDate && selectedCalendarDate.startsWith('2026')) ? selectedCalendarDate : today;
    const dayOfWeek = getDayOfWeekFromDate(targetDate) || '월';
    const dayNumber = parseInt(targetDate.split('-')[2], 10) || 1;
    handleOpenDayMenu({ dateStr: targetDate, dayNumber, isCurrentMonth: true });
  };

  // ==========================================
  // [UX 혁신] 2. 2026학년도 법정 공휴일 1초 마법사
  // ==========================================
  const handleApplyHolidaysWizard = () => {
    if (!confirm('2026학년도 법정 공휴일 및 주요 학사 기념일(3·1절, 어린이날, 추석 연휴, 성탄절 등)을 자동으로 등록하시겠습니까? (기존 일정 유지)')) {
      return;
    }
    const standardHolidays = getKoreanHolidays(config.academicYear || 2026);
    setVacations(prev => {
      const existingNames = new Set(prev.map(v => `${v.name}_${v.startDate}`));
      const newItems = standardHolidays.filter(h => !existingNames.has(`${h.name}_${h.startDate}`));
      return [...prev, ...newItems].sort((a, b) => a.startDate.localeCompare(b.startDate));
    });
    alert(`${standardHolidays.length}개의 법정 공휴일이 방학/휴업일 목록에 자동 등록되었습니다!`);
  };

  // ==========================================
  // [UX 혁신] 3. 엑셀 다운로드 / 업로드
  // ==========================================
  const handleExportExcel = async () => {
    try {
      const currentConfig: AcademicCalendarConfig = {
        ...config,
        vacations,
        events,
        specialDaySchedules,
        examPeriods,
        teacherInstructorAssignments,
      };
      await exportScheduleToExcel(currentConfig, `${config.academicYear || 2026}학년도_학사일정_전체.xlsx`);
    } catch (e: any) {
      alert('엑셀 다운로드 실패: ' + e.message);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseScheduleExcel(buffer);
      
      const totalCount = parsed.vacations.length + parsed.events.length + parsed.specialDays.length + parsed.exams.length;
      if (totalCount === 0) {
        alert('엑셀 파일에서 유효한 학사일정 데이터를 찾지 못했습니다.');
        return;
      }

      if (confirm(`엑셀에서 총 ${totalCount}건의 일정을 불러왔습니다.\n(휴업일: ${parsed.vacations.length}건, 행사: ${parsed.events.length}건, 단축/대체: ${parsed.specialDays.length}건, 시험: ${parsed.exams.length}건)\n기존 일정에 추가하시겠습니까?`)) {
        if (parsed.vacations.length > 0) setVacations(p => [...p, ...parsed.vacations]);
        if (parsed.events.length > 0) setEvents(p => [...p, ...parsed.events]);
        if (parsed.specialDays.length > 0) setSpecialDaySchedules(p => [...p, ...parsed.specialDays]);
        if (parsed.exams.length > 0) setExamPeriods(p => [...p, ...parsed.exams]);
        alert('엑셀 일정이 성공적으로 반영되었습니다!');
      }
    } catch (err: any) {
      alert('엑셀 파일 처리 중 오류가 발생했습니다: ' + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ==========================================
  // [UX 혁신] 4. 원클릭 퀵 액션 처리기
  // ==========================================
  // [직접입력 모달] 달력 날짜 클릭 시 모달 열기 핸들러
  const handleOpenDayMenu = (cDay: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }) => {
    if (!cDay.isCurrentMonth) return;
    setSelectedCalendarDate(cDay.dateStr);
    const dayOfWeek = getDayOfWeekFromDate(cDay.dateStr) || '월';

    // 기본값 초기화
    setModalHolidayTitle('');
    setModalHolidayType('discretionary');
    setModalHolidayMode('single');
    setModalHolidayEnd(cDay.dateStr);
    setModalShortenedPeriods(5);
    setModalShortenedDesc('');
    setModalSwapTargetDay(dayOfWeek === '수' ? '월' : '수');
    setModalSwapDesc(`${dayOfWeek}요일에 ${dayOfWeek === '수' ? '월' : '수'}요일 시간표 대체 운영`);
    setModalExamName('');
    setModalExamMode('single');
    setModalExamEnd(cDay.dateStr);
    setModalExamScope('all');
    setModalExamPeriods([1, 2, 3]);
    setModalExamDismiss('dismiss');
    setModalEventTitle('');
    setModalEventScope('all');
    setModalEventGrade(1);
    setModalEventPeriods([5, 6]);
    setModalEventTeachers([]);
    setModalEventRoleLabel('');
    setModalEventLocation('');
    setEditingScheduleId(null);

    setDayScheduleModal({
      dateStr: cDay.dateStr,
      dayNumber: cDay.dayNumber,
      dayOfWeek,
      activeCategory: 'holiday',
    });
  };

  // [수정 모드] 기존 등록된 일정을 클릭했을 때 입력폼에 기존 데이터를 프리필하고 수정 모드로 전환
  const handleDayModalPrefillVacation = (v: VacationPeriod) => {
    const targetDate = v.startDate;
    const dayOfWeek = getDayOfWeekFromDate(targetDate) || '월';
    const dayNumber = parseInt(targetDate.split('-')[2], 10) || 1;
    setSelectedCalendarDate(targetDate);
    setEditingScheduleId({ id: v.id, category: 'holiday', originalTitle: v.name });
    setModalHolidayTitle(v.name);
    setModalHolidayType(v.type || 'discretionary');
    const isRange = v.startDate !== v.endDate;
    setModalHolidayMode(isRange ? 'range' : 'single');
    setModalHolidayEnd(v.endDate || v.startDate);
    setDayScheduleModal(prev => prev ? { ...prev, activeCategory: 'holiday' } : {
      dateStr: targetDate,
      dayNumber,
      dayOfWeek,
      activeCategory: 'holiday',
    });
  };

  const handleDayModalPrefillShortened = (s: SpecialDaySchedule) => {
    const targetDate = s.date;
    const dayOfWeek = getDayOfWeekFromDate(targetDate) || '월';
    const dayNumber = parseInt(targetDate.split('-')[2], 10) || 1;
    setSelectedCalendarDate(targetDate);
    setEditingScheduleId({ 
      id: s.id, 
      category: 'shortened', 
      originalTitle: s.shortenedPeriods ? `${s.shortenedPeriods}교시 단축수업` : '단축수업' 
    });
    setModalShortenedPeriods(s.shortenedPeriods || 5);
    setModalShortenedDesc(s.description || '');
    setDayScheduleModal(prev => prev ? { ...prev, activeCategory: 'shortened' } : {
      dateStr: targetDate,
      dayNumber,
      dayOfWeek,
      activeCategory: 'shortened',
    });
  };

  const handleDayModalPrefillSwapDay = (s: SpecialDaySchedule) => {
    const targetDate = s.date;
    const dayOfWeek = getDayOfWeekFromDate(targetDate) || '월';
    const dayNumber = parseInt(targetDate.split('-')[2], 10) || 1;
    setSelectedCalendarDate(targetDate);

    const hasOverrides = Boolean(s.periodOverrides && Object.keys(s.periodOverrides).length > 0);
    const title = hasOverrides 
      ? (s.description || '교시 연속/변형 운영')
      : `${s.targetDayOfWeek}요일 대체 시간표`;

    setEditingScheduleId({ 
      id: s.id, 
      category: 'special_day', 
      originalTitle: title 
    });

    if (hasOverrides && s.periodOverrides) {
      setModalSwapMode('period_block');
      const targetP = Number(Object.keys(s.periodOverrides)[0]) || 6;
      const srcP = Number(s.periodOverrides[targetP]) || 5;
      setModalBlockSourcePeriod(srcP);
      setModalBlockTargetPeriod(targetP);
      setModalSwapDesc(s.description || `${s.originalDayOfWeek || '금'}요일 ${srcP}교시 수업 ${srcP}~${targetP}교시 연속/중복 진행`);
    } else {
      setModalSwapMode('day');
      setModalSwapTargetDay(s.targetDayOfWeek || '월');
      setModalSwapDesc(s.description || '');
    }

    setDayScheduleModal(prev => prev ? { ...prev, activeCategory: 'special_day' } : {
      dateStr: targetDate,
      dayNumber,
      dayOfWeek,
      activeCategory: 'special_day',
    });
  };

  const handleDayModalPrefillExam = (exItem: ExamPeriod) => {
    const targetDate = exItem.startDate;
    const dayOfWeek = getDayOfWeekFromDate(targetDate) || '월';
    const dayNumber = parseInt(targetDate.split('-')[2], 10) || 1;
    setSelectedCalendarDate(targetDate);

    setEditingScheduleId({ id: exItem.id, category: 'exam', originalTitle: exItem.name });
    setModalExamName(exItem.name);
    const isRange = exItem.startDate !== exItem.endDate;
    setModalExamMode(isRange ? 'range' : 'single');
    setModalExamEnd(exItem.endDate || exItem.startDate);
    const scopeVal = exItem.targetGrades.length === 3 ? 'all' : (exItem.targetGrades[0] ? String(exItem.targetGrades[0]) as any : 'all');
    setModalExamScope(scopeVal);
    setModalExamPeriods(exItem.examPeriods || [1, 2, 3]);
    setModalExamDismiss(exItem.afternoonType || 'dismiss');
    setDayScheduleModal(prev => prev ? { ...prev, activeCategory: 'exam' } : {
      dateStr: targetDate,
      dayNumber,
      dayOfWeek,
      activeCategory: 'exam',
    });
  };

  const handleDayModalPrefillEvent = (ev: SchoolEvent) => {
    const targetDate = ev.date;
    const dayOfWeek = getDayOfWeekFromDate(targetDate) || '월';
    const dayNumber = parseInt(targetDate.split('-')[2], 10) || 1;
    setSelectedCalendarDate(targetDate);

    setEditingScheduleId({ id: ev.id, category: 'event', originalTitle: ev.title });
    setModalEventTitle(ev.title);
    setModalEventScope(ev.targetScope || 'all');
    setModalEventGrade(ev.targetGrades?.[0] || 1);
    setModalEventPeriods(ev.periods || [1, 2, 3, 4, 5, 6, 7]);
    setModalEventTeachers(ev.inChargeTeachers || []);
    setModalEventRoleLabel(ev.inChargeRoleLabel || '');
    setModalEventLocation(ev.location || '');
    setDayScheduleModal(prev => prev ? { ...prev, activeCategory: 'event' } : {
      dateStr: targetDate,
      dayNumber,
      dayOfWeek,
      activeCategory: 'event',
    });
  };

  // 수정 취소하고 신규 등록 모드로 복귀 (모든 필드 공란 초기화)
  const handleCancelEditMode = () => {
    setEditingScheduleId(null);
    setModalHolidayTitle('');
    setModalHolidayMode('single');
    setModalHolidayEnd('');
    setModalShortenedDesc('');
    setModalSwapMode('day');
    setModalSwapDesc('');
    setModalBlockSourcePeriod(5);
    setModalBlockTargetPeriod(6);
    setModalExamName('');
    setModalExamMode('single');
    setModalExamEnd('');
    setModalEventTitle('');
    setModalEventTeachers([]);
    setModalEventRoleLabel('');
    setModalEventLocation('');
  };

  // 지필평가 교시 토글
  const handleToggleModalExamPeriod = (period: number) => {
    setModalExamPeriods(prev => 
      prev.includes(period) 
        ? (prev.length > 1 ? prev.filter(p => p !== period).sort((a, b) => a - b) : prev)
        : [...prev, period].sort((a, b) => a - b)
    );
  };

  // 퀵 행사 교시 토글
  const handleToggleModalEventPeriod = (period: number) => {
    setModalEventPeriods(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period).sort((a, b) => a - b)
        : [...prev, period].sort((a, b) => a - b)
    );
  };

  // 학급 코드 또는 슬롯에서 정확한 학년 추출 (예: '기14' -> 1, '섬21' -> 2, '도31' -> 3, '1-1' -> 1)
  const extractSlotGrade = (slot?: { grade?: number; classCode?: string }): number | null => {
    if (!slot) return null;
    if (typeof slot.grade === 'number' && slot.grade >= 1 && slot.grade <= 3) {
      return slot.grade;
    }
    const code = (slot.classCode || '').trim();
    if (!code) return null;
    // '도31', '기14', '섬22' 처럼 2번째 글자가 학년 숫자인 경우
    if (code.length >= 2 && /\d/.test(code.charAt(1))) {
      return parseInt(code.charAt(1), 10);
    }
    // '1-1', '2-3' 같은 일반 형식
    const match = code.match(/\d/);
    return match ? parseInt(match[0], 10) : null;
  };

  // 퀵 행사: 담임교사 일괄 자동 배정
  const handleAssignHomeroomToModalEvent = (scope = modalEventScope, grade = modalEventGrade) => {
    const targetTeachers = (timetableData?.teachers || []).filter(t => {
      if (!t.homeroomClass) return false;
      const tGrade = getTeacherHomeroomGrade(t.homeroomClass);
      if (scope === 'grade') {
        return tGrade === grade;
      }
      return tGrade !== null;
    }).map(t => t.teacherName);

    if (targetTeachers.length === 0) {
      alert('담임교사 정보를 찾을 수 없습니다.');
      return;
    }

    const label = scope === 'grade'
      ? `${grade}학년 담임교사 일괄 (${targetTeachers.length}명)`
      : `전교생 담임교사 일괄 (${targetTeachers.length}명)`;

    setModalEventTeachers(targetTeachers);
    setModalEventRoleLabel(label);
  };

  // 퀵 행사: 진로담당교사 일괄 배정 (정확한 학년 매칭)
  const handleAssignCareerToModalEvent = (scope = modalEventScope, grade = modalEventGrade) => {
    const targetTeachers = (timetableData?.teachers || []).filter(t => {
      const slots = Object.values(t.slots || {});
      return slots.some(s => {
        const isCareer = s?.subjectName?.includes('진로') || s?.activityType?.includes('진로');
        if (!isCareer) return false;
        if (scope === 'grade') {
          return extractSlotGrade(s) === grade;
        }
        return true;
      });
    }).map(t => t.teacherName);

    if (targetTeachers.length === 0) {
      alert(`${scope === 'grade' ? `${grade}학년 ` : ''}진로 수업 배정 교사를 찾을 수 없습니다.`);
      return;
    }

    const label = scope === 'grade'
      ? `${grade}학년 진로담당 일괄 (${targetTeachers.length}명)`
      : `전체 진로담당 일괄 (${targetTeachers.length}명)`;

    setModalEventTeachers(targetTeachers);
    setModalEventRoleLabel(label);
  };

  // 퀵 행사: 동아리담당교사 일괄 배정 (정확한 학년 매칭)
  const handleAssignClubToModalEvent = (scope = modalEventScope, grade = modalEventGrade) => {
    const targetTeachers = (timetableData?.teachers || []).filter(t => {
      const slots = Object.values(t.slots || {});
      return slots.some(s => {
        const isClub = s?.subjectName?.includes('동아') || s?.activityType?.includes('동아');
        if (!isClub) return false;
        if (scope === 'grade') {
          return extractSlotGrade(s) === grade;
        }
        return true;
      });
    }).map(t => t.teacherName);

    if (targetTeachers.length === 0) {
      alert(`${scope === 'grade' ? `${grade}학년 ` : ''}동아리 수업 배정 교사를 찾을 수 없습니다.`);
      return;
    }

    const label = scope === 'grade'
      ? `${grade}학년 동아리담당 일괄 (${targetTeachers.length}명)`
      : `전체 동아리담당 일괄 (${targetTeachers.length}명)`;

    setModalEventTeachers(targetTeachers);
    setModalEventRoleLabel(label);
  };

  // 행사: 개별 교사 추가 (검색 결과 클릭 또는 직접 입력)
  const handleAddTeacherToModalEvent = (teacherName: string) => {
    const trimmed = teacherName.trim();
    if (!trimmed) return;
    if (modalEventTeachers.includes(trimmed)) {
      alert(`'${trimmed}' 교사는 이미 배정되어 있습니다.`);
      return;
    }
    setModalEventTeachers(prev => [...prev, trimmed]);
    setTeacherSearchQuery('');
  };

  // 행사: 개별 교사 제외
  const handleRemoveTeacherFromModalEvent = (teacherName: string) => {
    setModalEventTeachers(prev => prev.filter(t => t !== teacherName));
  };

  // [직접입력 모달] 저장 처리기
  const handleSaveDaySchedule = () => {
    if (!dayScheduleModal) return;
    const { dateStr, dayOfWeek, activeCategory } = dayScheduleModal;

    if (activeCategory === 'holiday') {
      const title = modalHolidayTitle.trim();
      if (!title) {
        alert('휴업일 명칭을 입력해 주세요. (예: 재량휴업일, 개교기념일 등)');
        return;
      }
      const targetId = (editingScheduleId?.category === 'holiday') ? editingScheduleId.id : `vac-${Date.now()}`;
      
      // 단일일 vs 기간(여러 날짜) 처리
      let startDate = dateStr;
      let endDate = dateStr;
      if (modalHolidayMode === 'range' && modalHolidayEnd) {
        if (modalHolidayEnd < dateStr) {
          startDate = modalHolidayEnd;
          endDate = dateStr;
        } else {
          startDate = dateStr;
          endDate = modalHolidayEnd;
        }
      }

      const newVac: VacationPeriod = {
        id: targetId,
        name: title,
        startDate,
        endDate,
        type: modalHolidayType as any,
      };
      setVacations(p => [...p.filter(v => v.id !== targetId), newVac].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    } else if (activeCategory === 'shortened') {
      const targetId = (editingScheduleId?.category === 'shortened') ? editingScheduleId.id : `sp-short-${Date.now()}`;
      const newSp: SpecialDaySchedule = {
        id: targetId,
        date: dateStr,
        originalDayOfWeek: dayOfWeek,
        targetDayOfWeek: dayOfWeek,
        shortenedPeriods: modalShortenedPeriods,
        description: modalShortenedDesc.trim() || `${modalShortenedPeriods}교시 단축수업 운영`,
      };
      setSpecialDaySchedules(p => [...p.filter(s => s.id !== targetId && s.date !== dateStr), newSp].sort((a, b) => a.date.localeCompare(b.date)));
    } else if (activeCategory === 'special_day') {
      const targetId = (editingScheduleId?.category === 'special_day') ? editingScheduleId.id : `sp-swap-${Date.now()}`;
      let newSp: SpecialDaySchedule;
      if (modalSwapMode === 'period_block') {
        const desc = modalSwapDesc.trim() || `${dayOfWeek}요일 ${modalBlockSourcePeriod}교시 수업 ${modalBlockSourcePeriod}~${modalBlockTargetPeriod}교시 연속/중복 진행`;
        newSp = {
          id: targetId,
          date: dateStr,
          originalDayOfWeek: dayOfWeek,
          targetDayOfWeek: dayOfWeek,
          periodOverrides: { [modalBlockTargetPeriod]: modalBlockSourcePeriod },
          description: desc,
        };
      } else {
        newSp = {
          id: targetId,
          date: dateStr,
          originalDayOfWeek: dayOfWeek,
          targetDayOfWeek: modalSwapTargetDay,
          description: modalSwapDesc.trim() || `${dayOfWeek}요일에 ${modalSwapTargetDay}요일 시간표 대체 운영`,
        };
      }
      setSpecialDaySchedules(p => [...p.filter(s => s.id !== targetId && s.date !== dateStr), newSp].sort((a, b) => a.date.localeCompare(b.date)));
    } else if (activeCategory === 'exam') {
      const name = modalExamName.trim();
      if (!name) {
        alert('고사명을 입력해 주세요. (예: 1학기 1차 지필평가, 기말고사 등)');
        return;
      }
      const targetGrades = modalExamScope === 'all' ? [1, 2, 3] : [parseInt(modalExamScope, 10)];
      const periods = modalExamPeriods.length > 0 ? modalExamPeriods : [1, 2, 3];
      const targetId = (editingScheduleId?.category === 'exam') ? editingScheduleId.id : `exam-${Date.now()}`;
      
      // 단일일 vs 기간(여러 날짜) 처리
      let startDate = dateStr;
      let endDate = dateStr;
      if (modalExamMode === 'range' && modalExamEnd) {
        if (modalExamEnd < dateStr) {
          startDate = modalExamEnd;
          endDate = dateStr;
        } else {
          startDate = dateStr;
          endDate = modalExamEnd;
        }
      }

      const newExam: ExamPeriod = {
        id: targetId,
        name,
        startDate,
        endDate,
        targetGrades,
        examPeriods: periods,
        afternoonType: modalExamDismiss,
      };
      setExamPeriods(p => [...p.filter(e => e.id !== targetId), newExam].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    } else if (activeCategory === 'event') {
      const title = modalEventTitle.trim();
      if (!title) {
        alert('행사명을 입력해 주세요. (예: 축제, 현장체험학습, 체육대회 등)');
        return;
      }
      const periods = modalEventPeriods.length > 0 ? modalEventPeriods : [1, 2, 3, 4, 5, 6, 7];
      const targetId = (editingScheduleId?.category === 'event') ? editingScheduleId.id : `ev-${Date.now()}`;
      const newEv: SchoolEvent = {
        id: targetId,
        title,
        date: dateStr,
        day: dayOfWeek,
        periods,
        targetScope: modalEventScope,
        targetGrades: modalEventScope === 'all' ? [1, 2, 3] : [modalEventGrade],
        inChargeTeachers: modalEventTeachers,
        inChargeRoleLabel: modalEventRoleLabel.trim() || undefined,
        location: modalEventLocation.trim() || undefined,
      };
      setEvents(p => [...p.filter(e => e.id !== targetId), newEv].sort((a, b) => a.date.localeCompare(b.date)));
    }

    setEditingScheduleId(null);
    setDayScheduleModal(null);
  };

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
          return extractSlotGrade(s) === newEventGrade;
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
      : `전체 진로담당 일괄 (${targetTeachers.length}명)`;

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
          return extractSlotGrade(s) === newEventGrade;
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
      : `전체 동아리담당 일괄 (${targetTeachers.length}명)`;

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

  // ==========================================
  // 시간강사 상시보강 시간표 설정 핸들러들
  // ==========================================
  const handleSelectTeacherForInstructor = (tName: string) => {
    setTargetTeacherName(tName);
    // 이미 등록된 내역이 있는지 확인
    const existing = teacherInstructorAssignments.find(a => a.originalTeacherName === tName);
    if (existing && !editingAssignmentId) {
      setEditingAssignmentId(existing.id);
      setFormInstructorName(existing.instructorName);
      setFormInstructorType(existing.instructorType || 'hourly');
      setFormAssignmentMode(existing.assignmentMode || 'weekly');
      if (existing.assignedWeek) {
        setFormAssignedWeek(existing.assignedWeek);
      } else if (existing.assignedDate || existing.effectivePeriod?.startDate) {
        const d = existing.assignedDate || existing.effectivePeriod?.startDate;
        const found = semesterWeeks.find(w => d && d >= w.startDate && d <= w.endDate);
        if (found) setFormAssignedWeek(found.weekNum);
      }
      setFormRemarks(existing.remarks || '');
      setSelectedInstructorSlots([...existing.assignedSlots]);
    } else if (!editingAssignmentId) {
      setFormInstructorName('');
      setFormInstructorType('hourly');
      setFormRemarks('');
      setSelectedInstructorSlots([]);
    }
  };

  const handleToggleInstructorSlot = (slot: { day: string; period: number; classCode: string; subjectName: string }) => {
    setSelectedInstructorSlots(prev => {
      const idx = prev.findIndex(s => s.day === slot.day && s.period === slot.period && s.classCode === slot.classCode);
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      } else {
        return [...prev, { day: slot.day, period: slot.period, classCode: slot.classCode, subjectName: slot.subjectName }];
      }
    });
  };

  const handleSelectAllTeacherSlots = (teacher: any) => {
    if (!teacher || !teacher.slots) return;
    const allSlots: InstructorAssignedSlot[] = [];
    Object.values(teacher.slots).forEach((s: any) => {
      if (s && s.day && s.period) {
        allSlots.push({
          day: s.day,
          period: s.period,
          classCode: s.classCode,
          subjectName: s.subjectName || ''
        });
      }
    });
    setSelectedInstructorSlots(allSlots);
  };

  const handleClearInstructorSlots = () => {
    setSelectedInstructorSlots([]);
  };

  const handleSaveInstructorAssignment = () => {
    if (!targetTeacherName) {
      alert('대상 교사를 선택해주세요.');
      return;
    }
    if (!formInstructorName.trim()) {
      alert('배정할 시간강사 성명을 입력해주세요.');
      return;
    }
    if (selectedInstructorSlots.length === 0) {
      alert(formAssignmentMode === 'daily' 
        ? `${selectedWeekObj?.shortLabel || `${formAssignedWeek}주차`}에 시간강사가 수업할 요일/교시를 최소 1개 이상 선택해주세요.` 
        : '시간강사가 매주 수업할 요일/교시를 최소 1개 이상 선택해주세요.'
      );
      return;
    }

    const assignmentId = editingAssignmentId || `inst-${Date.now()}`;
    const newAssignment: TeacherInstructorAssignment = {
      id: assignmentId,
      originalTeacherName: targetTeacherName,
      instructorName: formInstructorName.trim(),
      instructorType: formInstructorType,
      assignmentMode: formAssignmentMode,
      assignedWeek: formAssignmentMode === 'daily' ? formAssignedWeek : undefined,
      assignedWeekLabel: formAssignmentMode === 'daily' ? selectedWeekObj?.label : undefined,
      assignedDate: formAssignmentMode === 'daily' ? selectedWeekObj?.startDate : undefined,
      semester: activeSemester,
      effectivePeriod: formAssignmentMode === 'daily' && selectedWeekObj ? {
        startDate: selectedWeekObj.startDate,
        endDate: selectedWeekObj.endDate,
      } : undefined,
      assignedSlots: selectedInstructorSlots.sort((a, b) => {
        const days = ['월', '화', '수', '목', '금'];
        if (a.day !== b.day) return days.indexOf(a.day) - days.indexOf(b.day);
        return a.period - b.period;
      }),
      weeklyHours: selectedInstructorSlots.length,
      remarks: formRemarks.trim() || undefined,
      color: formAssignmentMode === 'daily' ? 'amber' : 'violet',
    };

    setTeacherInstructorAssignments(prev => {
      const exists = prev.some(a => a.id === assignmentId);
      if (exists) {
        return prev.map(a => a.id === assignmentId ? newAssignment : a);
      } else {
        // 동일 모드 및 주차 편성일 경우 기존 항목 교체
        const filtered = prev.filter(a => {
          if (a.originalTeacherName !== targetTeacherName) return true;
          if (newAssignment.assignmentMode === 'weekly') {
            return a.assignmentMode !== 'weekly';
          } else {
            return !(a.assignmentMode === 'daily' && a.assignedWeek === newAssignment.assignedWeek);
          }
        });
        return [...filtered, newAssignment];
      }
    });

    // 폼 초기화
    setEditingAssignmentId(null);
    setTargetTeacherName('');
    setTeacherSearchTerm('');
    setFormInstructorName('');
    setFormInstructorType('hourly');
    setFormAssignmentMode('weekly');
    setFormAssignedWeek(currentWeekNum);
    setFormRemarks('');
    setSelectedInstructorSlots([]);
  };

  const handleStartEditAssignment = (assign: TeacherInstructorAssignment) => {
    setEditingAssignmentId(assign.id);
    setTargetTeacherName(assign.originalTeacherName);
    setTeacherSearchTerm('');
    setFormInstructorName(assign.instructorName);
    setFormInstructorType(assign.instructorType || 'hourly');
    setFormAssignmentMode(assign.assignmentMode || 'weekly');
    if (assign.assignedWeek) {
      setFormAssignedWeek(assign.assignedWeek);
    } else if (assign.assignedDate || assign.effectivePeriod?.startDate) {
      const d = assign.assignedDate || assign.effectivePeriod?.startDate;
      const found = semesterWeeks.find(w => d && d >= w.startDate && d <= w.endDate);
      if (found) setFormAssignedWeek(found.weekNum);
    }
    setFormRemarks(assign.remarks || '');
    setSelectedInstructorSlots([...assign.assignedSlots]);
  };

  const handleDeleteAssignment = (id: string) => {
    if (confirm('해당 교사의 시간강사 보강 편성을 삭제하시겠습니까?')) {
      setTeacherInstructorAssignments(prev => prev.filter(a => a.id !== id));
      if (editingAssignmentId === id) {
        setEditingAssignmentId(null);
        setTargetTeacherName('');
        setTeacherSearchTerm('');
        setFormInstructorName('');
        setSelectedInstructorSlots([]);
      }
    }
  };

  const handleCancelAssignmentEdit = () => {
    setEditingAssignmentId(null);
    setTargetTeacherName('');
    setTeacherSearchTerm('');
    setFormInstructorName('');
    setFormInstructorType('hourly');
    setFormAssignmentMode('weekly');
    setFormAssignedWeek(currentWeekNum);
    setFormRemarks('');
    setSelectedInstructorSlots([]);
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
        teacherInstructorAssignments,
      };

      await onSave(payload);
      alert('학사일정 및 시간강사 시간표 설정이 성공적으로 저장되었습니다!');
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
      <DialogContent ref={modalContainerRef} showCloseButton={false} className="max-w-4xl h-[88vh] max-h-[850px] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
        {/* 1. 표준 분리형 2단 상단 헤더 (1단: 제목 & 배지, 2단: 4대 탭 바) */}
        <div className="bg-white border-b border-slate-200 shrink-0">
          {/* 1단: 제목 & 배지 & 닫기 */}
          <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-2xs">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">
                  {config.academicYear || 2026}학년도 연간 학사일정
                </DialogTitle>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200/80 text-[11px] px-2 py-0.5 rounded-lg font-black">
                  수업계
                </Badge>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* 2단: 4대 핵심 업무 탭 스위처 바 */}
          <div className="px-5 pb-2.5">
            <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={cn(
                  "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTab === 'calendar'
                    ? "bg-white text-blue-900 font-black shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                <span>📅 학사 캘린더</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={cn(
                  "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTab === 'details'
                    ? "bg-white text-indigo-900 font-black shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                <span>📋 상세/엑셀</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('instructors')}
                className={cn(
                  "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTab === 'instructors'
                    ? "bg-white text-purple-900 font-black shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <Users className="h-3.5 w-3.5 text-purple-600" />
                <span>👤 시간강사 ({teacherInstructorAssignments.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTab === 'settings'
                    ? "bg-white text-emerald-900 font-black shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )}
              >
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                <span>⚙️ 기간/설정</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. 탭별 본문 (캘린더 탭은 스크롤 없이 한눈에 표출) */}
        <div className={cn(
          "flex-1 text-xs text-slate-700 custom-scrollbar bg-white min-h-0",
          activeTab === 'calendar' ? "p-2.5 space-y-1.5 overflow-hidden flex flex-col" : "p-4 sm:p-6 space-y-5 overflow-y-auto"
        )}>
          {/* ========================================================================= */}
          {/* [TAB 1] 월별 비주얼 학사 캘린더 대시보드 */}
          {/* ========================================================================= */}
          {activeTab === 'calendar' && (
            <div className="flex-1 flex flex-col space-y-1.5 min-h-0 overflow-hidden">
              {/* 월 이동 툴바 및 안내 */}
              <div className="flex items-center justify-between bg-white px-1 py-0.5 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-2xs">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                      title="이전 달"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3.5 py-1 text-sm font-black text-slate-900 bg-white border-x border-slate-200">
                      {calendarYear}년 {calendarMonth}월
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                      title="다음 달"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setCalendarYear(now.getFullYear() >= 2026 ? now.getFullYear() : 2026);
                      setCalendarMonth(now.getFullYear() >= 2026 ? now.getMonth() + 1 : 9);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    오늘 달
                  </button>


                </div>

                {/* 컬러 범례 가이드 */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> 휴업/방학
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> 단축수업
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block" /> 대체요일
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> 지필평가
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-purple-600 inline-block" /> 학교행사
                  </span>
                </div>
              </div>

              {/* 월별 캘린더 그리드 (flex-1 로 모달 높이를 가득 채움) */}
              <div className="flex-1 flex flex-col border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white min-h-0">
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center text-xs font-black py-1.5 shrink-0">
                  <div className="text-rose-600">일</div>
                  <div className="text-slate-700">월</div>
                  <div className="text-slate-700">화</div>
                  <div className="text-slate-700">수</div>
                  <div className="text-slate-700">목</div>
                  <div className="text-slate-700">금</div>
                  <div className="text-blue-600">토</div>
                </div>

                {/* 날짜 셀 그리드 (동적 1fr 그리드로 높이를 시원하게 확장) */}
                <div 
                  className="grid grid-cols-7 flex-1 divide-x divide-y divide-slate-100 bg-slate-50/30 min-h-0"
                  style={{
                    gridTemplateRows: `repeat(${calendarDays.length / 7}, minmax(0, 1fr))`
                  }}
                >
                  {calendarDays.map((cDay, idx) => {
                    const isSunday = cDay.dayOfWeek === 0;
                    const isSaturday = cDay.dayOfWeek === 6;
                    const isToday = cDay.dateStr === new Date().toISOString().split('T')[0];
                    const isSelected = selectedCalendarDate === cDay.dateStr;

                    return (
                      <div
                        key={`${cDay.dateStr}-${idx}`}
                        onClick={() => handleOpenDayMenu(cDay)}
                        className={cn(
                          "p-1.5 flex flex-col justify-between transition-all cursor-pointer relative group overflow-hidden",
                          !cDay.isCurrentMonth ? "bg-slate-100/50 text-slate-300 opacity-60 pointer-events-none" : "bg-white hover:bg-blue-50/50 hover:shadow-xs",
                          isSelected && "ring-2 ring-blue-500 ring-inset bg-blue-50/60",
                          isToday && "bg-amber-50/40"
                        )}
                      >
                        {/* 상단 날짜 번호 및 추가 버튼 */}
                        <div className="flex items-center justify-between leading-none">
                          <span className={cn(
                            "text-xs font-black rounded-md w-5 h-5 flex items-center justify-center",
                            !cDay.isCurrentMonth ? "text-slate-300" : (
                              isSunday ? "text-rose-600" : (isSaturday ? "text-blue-600" : "text-slate-800")
                            ),
                            isToday && "bg-blue-600 text-white font-black"
                          )}>
                            {cDay.dayNumber}
                          </span>

                          {cDay.isCurrentMonth && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDayMenu(cDay);
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition-opacity cursor-pointer rounded"
                              title="일정 등록 팝업 메뉴 열기"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* 일자별 컬러 뱃지 목록 */}
                        <div className="space-y-0.5 my-0.5 flex-1 overflow-hidden">
                          {/* 방학 / 공휴일 / 재량휴업일 */}
                          {cDay.vacations.map(v => (
                            <div
                              key={v.id}
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 truncate"
                              title={`[휴업일] ${v.name}`}
                            >
                              🏖️ {v.name}
                            </div>
                          ))}

                          {/* 지필평가 */}
                          {cDay.exams.map(e => (
                            <div
                              key={e.id}
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-rose-100 text-rose-900 border border-rose-200 truncate"
                              title={`[지필평가] ${e.name}`}
                            >
                              📝 {e.name}
                            </div>
                          ))}

                          {/* 단축 및 대체 요일 */}
                          {cDay.specialDays.map(s => {
                            const hasOverrides = Boolean(s.periodOverrides && Object.keys(s.periodOverrides).length > 0);
                            let label = `🔄 ${s.targetDayOfWeek}요일대체`;
                            let tooltip = s.description || `${s.targetDayOfWeek}요일 대체`;

                            if (s.shortenedPeriods) {
                              label = `⏰ ${s.shortenedPeriods}교시단축`;
                              tooltip = s.description || `${s.shortenedPeriods}교시 단축`;
                            } else if (hasOverrides && s.periodOverrides) {
                              const targetP = Number(Object.keys(s.periodOverrides)[0]) || 6;
                              const srcP = Number(s.periodOverrides[targetP]) || 5;
                              label = `🔗 ${srcP}~${targetP}교시 연속`;
                              tooltip = s.description || `[연속수업] ${srcP}교시 수업 ➔ ${targetP}교시 연속 진행`;
                            }

                            return (
                              <div
                                key={s.id}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[9.5px] font-bold truncate border",
                                  s.shortenedPeriods 
                                    ? "bg-amber-100 text-amber-900 border-amber-300" 
                                    : hasOverrides
                                      ? "bg-blue-100 text-blue-900 border-blue-200"
                                      : "bg-indigo-100 text-indigo-900 border-indigo-200"
                                )}
                                title={tooltip}
                              >
                                {label}
                              </div>
                            );
                          })}

                          {/* 학교 행사 */}
                          {cDay.events.map(ev => (
                            <div
                              key={ev.id}
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-100 text-purple-900 border border-purple-200 truncate"
                              title={`[행사] ${ev.title} (${ev.periods.join(',')}교시)`}
                            >
                              🎭 {ev.title}
                            </div>
                          ))}

                          {/* 일일 시간강사 */}
                          {cDay.instructors.map(inst => (
                            <div
                              key={inst.id}
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-900 border border-amber-200 truncate"
                              title={`[일일강사] ${inst.originalTeacherName}➔${inst.instructorName}`}
                            >
                              👤 강사: {inst.instructorName}
                            </div>
                          ))}
                        </div>

                        {/* 하단 빈 여백 클릭 안내 */}
                        <div className="h-0.5" />
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* [TAB 2] 상세 일정 관리 & 엑셀 (휴업일, 고사, 행사, 대체/단축 마스터 데이터 테이블) */}
          {/* ========================================================================= */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* 상단 마스터 툴바: 통계, 2단 모달 신규 등록, 공휴일 마법사, 엑셀 연동 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap gap-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    학사일정 마스터 데이터 & 엑셀
                  </span>
                  <Badge variant="outline" className="text-[10px] text-slate-600 bg-white font-mono font-bold">
                    총 {masterRows.length}건 등록됨
                  </Badge>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* + 새 학사일정 등록 (2단 분할 모달 팝업) */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddNewScheduleFromMaster}
                    className="h-8 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer shadow-2xs"
                    title="새 학사일정 등록 (2단 분할 모달 열기)"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    새 학사일정 등록
                  </Button>

                  {/* 2026 공휴일 마법사 */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyHolidaysWizard}
                    className="h-8 text-xs font-bold gap-1 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl cursor-pointer shadow-2xs"
                    title="2026학년도 법정 공휴일 1초 마법사"
                  >
                    <Wand2 className="h-3.5 w-3.5 text-emerald-600" />
                    2026 공휴일 1초 완성
                  </Button>

                  {/* 엑셀 가져오기 */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls"
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs font-bold gap-1 bg-white border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer shadow-2xs"
                    title="학교 학사일정 엑셀 파일 가져오기"
                  >
                    <Upload className="h-3.5 w-3.5 text-slate-500" />
                    엑셀 불러오기
                  </Button>

                  {/* 엑셀 내보내기 */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="h-8 text-xs font-bold gap-1 bg-white border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer shadow-2xs"
                    title="현재 일정 엑셀로 백업 및 다운로드 (교시 연속 및 단축 정보 포함)"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    엑셀 다운로드
                  </Button>
                </div>
              </div>

              {/* 검색 및 카테고리 필터 툴바 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
                {/* 카테고리 필터 칩들 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'all' as const, label: '전체 일정', count: masterRows.length, icon: '📋' },
                    { key: 'holiday' as const, label: '방학/휴업일', count: vacations.length, icon: '🏖️' },
                    { key: 'exam' as const, label: '지필평가', count: examPeriods.length, icon: '📝' },
                    { key: 'shortened' as const, label: '단축수업', count: specialDaySchedules.filter(s => !!s.shortenedPeriods).length, icon: '⏰' },
                    { key: 'special_day' as const, label: '교시연속/대체', count: specialDaySchedules.filter(s => !s.shortenedPeriods).length, icon: '🔗' },
                    { key: 'event' as const, label: '학교행사', count: events.length, icon: '🎭' },
                  ].map(chip => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setDetailCategoryFilter(chip.key)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border",
                        detailCategoryFilter === chip.key
                          ? "bg-slate-800 text-white border-slate-800 shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200"
                      )}
                    >
                      <span>{chip.icon}</span>
                      <span>{chip.label}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                        detailCategoryFilter === chip.key ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                      )}>
                        {chip.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 실시간 검색창 */}
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="일정명, 날짜, 인솔교사 검색..."
                    value={detailSearchQuery}
                    onChange={e => setDetailSearchQuery(e.target.value)}
                    className="h-8.5 text-xs pl-8 pr-7 bg-white border-slate-200 rounded-xl"
                  />
                  {detailSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDetailSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 1년치 통합 마스터 데이터 테이블 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-40">일자 / 기간</th>
                        <th className="py-2.5 px-3 w-32">구분</th>
                        <th className="py-2.5 px-3 min-w-[160px]">일정명</th>
                        <th className="py-2.5 px-3 min-w-[240px]">세부 운영 및 비고</th>
                        <th className="py-2.5 px-3 w-28 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMasterRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                            {detailSearchQuery ? '검색어와 일치하는 학사일정이 없습니다.' : '등록된 학사일정이 없습니다.'}
                          </td>
                        </tr>
                      ) : (
                        filteredMasterRows.map(row => (
                          <tr key={`${row.category}-${row.id}`} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{row.date}</span>
                                {row.endDate && <span className="text-[11px] text-slate-500 font-normal">~ {row.endDate}</span>}
                                <span className="text-[10px] text-slate-400">({getDayOfWeekFromDate(row.date)})</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={cn("px-2 py-0.5 rounded-md text-[10.5px] font-bold border", row.badgeClass)}>
                                {row.badgeLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-black text-slate-900">
                              {row.title}
                            </td>
                            <td 
                              className="py-2.5 px-3 text-slate-600 text-[11.5px]"
                              title={row.category === 'event' && (row.rawItem as SchoolEvent).inChargeTeachers?.length ? `배정 인솔교사 명단:\n${(row.rawItem as SchoolEvent).inChargeTeachers.join(', ')}` : undefined}
                            >
                              {row.details}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditMasterRow(row)}
                                  className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer gap-1 font-bold"
                                  title="2단 분할 모달에서 상세 수정"
                                >
                                  <FileEdit className="h-3.5 w-3.5" />
                                  수정
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteMasterRow(row)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="일정 삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium px-4">
                  <span>표시 중: <strong className="text-slate-800">{filteredMasterRows.length}</strong>건 (전체 {masterRows.length}건 중)</span>
                  <span className="text-[10.5px] text-slate-400 hidden sm:inline">
                    💡 [수정] 클릭 시 완성된 2단 분할 모달이 열려 교시 연속, 인솔교사 등 고급 설정을 안전하게 변경할 수 있습니다.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* [TAB 4] 학사 기간 및 기본 설정 */}
          {/* ========================================================================= */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <strong className="text-xs font-black text-slate-900 block mb-0.5">
                  1학기 및 2학기 학사 기간 설정
                </strong>
                <p className="text-[11px] text-slate-500">
                  각 학기의 개학일과 종업일을 설정하면 주간 시간표의 주차 및 날짜가 자동으로 계산됩니다.
                </p>
              </div>

              {/* 1학기 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all space-y-3",
                activeSemester === 1 ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20" : "bg-white border-slate-200"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                      1
                    </span>
                    <strong className="text-xs font-black text-slate-900">1학기 학사 기간</strong>
                    {activeSemester === 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">현재 적용 학기</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSemester(1)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                      activeSemester === 1 ? "bg-indigo-600 text-white border-indigo-600 font-black" : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    )}
                  >
                    {activeSemester === 1 ? '✓ 현재 학기로 선택됨' : '1학기로 시간표 전환'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">1학기 시작일 (개학일)</label>
                    <Input
                      type="date"
                      value={sem1Start}
                      onChange={e => setSem1Start(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">1학기 종료일 (방학식)</label>
                    <Input
                      type="date"
                      value={sem1End}
                      onChange={e => setSem1End(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* 2학기 카드 */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all space-y-3",
                activeSemester === 2 ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20" : "bg-white border-slate-200"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs inline-flex items-center justify-center shadow-xs">
                      2
                    </span>
                    <strong className="text-xs font-black text-slate-900">2학기 학사 기간</strong>
                    {activeSemester === 2 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">현재 적용 학기</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSemester(2)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                      activeSemester === 2 ? "bg-indigo-600 text-white border-indigo-600 font-black" : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    )}
                  >
                    {activeSemester === 2 ? '✓ 현재 학기로 선택됨' : '2학기로 시간표 전환'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">2학기 시작일 (개학일)</label>
                    <Input
                      type="date"
                      value={sem2Start}
                      onChange={e => setSem2Start(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-700 block mb-1">2학기 종료일 (종업일/학년말)</label>
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

          {/* TAB 7: 시간강사 상시보강 시간표 설정 (수업교체 및 추가보강 전면 차단) */}
          {activeTab === 'instructors' && (
            <div className="space-y-4">
              {/* 신규 / 수정 시간강사 시간표 편성 등록 폼 */}
              <div className={cn(
                "p-4 rounded-2xl border space-y-4 transition-all",
                editingAssignmentId ? "bg-purple-100/70 border-purple-400 ring-2 ring-purple-500/20 shadow-xs" : "bg-purple-50/50 border-purple-200/80"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                    <strong className="text-xs font-black text-purple-950">
                      {editingAssignmentId ? '✏️ 시간강사 보강 시간표 수정 중' : '시간강사 보강 시간표 신규 편성'}
                    </strong>
                  </div>
                  {editingAssignmentId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelAssignmentEdit}
                      className="h-6 px-2 text-[11px] text-purple-700 hover:bg-purple-200/60 rounded-lg cursor-pointer"
                    >
                      <X className="h-3 w-3 mr-1" /> 편집 취소
                    </Button>
                  )}
                </div>

                {/* 2열 레이아웃: 좌측 기본 정보 입력 / 우측 대화형 시간표 그리드 */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* 좌측 패널 (5 cols) */}
                  <div className="lg:col-span-5 space-y-3 bg-white p-3.5 rounded-xl border border-purple-100 shadow-2xs">
                    {/* 대상 교사 선택 (검색 + 드롭다운 한 줄 배치) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>1. 대상 교사 선택</span>
                          {teacherSearchTerm && (
                            <span className="text-[10px] font-semibold text-purple-600">
                              ({filteredTeachers.length}명 검색됨)
                            </span>
                          )}
                        </span>
                        {targetTeacherName && (
                          <span className="text-[10px] text-purple-600 font-bold">
                            {timetableData?.teachers.find(t => t.teacherName === targetTeacherName)?.subjectGroup || '교과'}
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        {/* 검색창 */}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                          <Input
                            type="text"
                            placeholder="교사명/교과 검색..."
                            value={teacherSearchTerm}
                            onChange={(e) => setTeacherSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredTeachers.length > 0) {
                                  handleSelectTeacherForInstructor(filteredTeachers[0].teacherName);
                                }
                              }
                            }}
                            className="h-8 pl-8 pr-6 text-xs bg-slate-50/70 border-slate-200 rounded-lg focus-visible:bg-white placeholder:text-slate-400"
                          />
                          {teacherSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setTeacherSearchTerm('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                              title="검색어 초기화"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* 교사 드롭다운 */}
                        <Select value={targetTeacherName} onValueChange={handleSelectTeacherForInstructor}>
                          <SelectTrigger className="h-8 text-xs font-bold rounded-lg border-slate-200 bg-white">
                            <SelectValue placeholder={filteredTeachers.length > 0 ? "교사를 선택하세요..." : "검색 결과 없음"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {displayedTeachers.length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-400 font-medium">
                                검색된 교사가 없습니다.
                              </div>
                            ) : (
                              displayedTeachers.map((t) => {
                                const isAssigned = teacherInstructorAssignments.some(a => a.originalTeacherName === t.teacherName);
                                return (
                                  <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium">
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span>{t.teacherName} ({t.subjectGroup || '교과'}, {t.rawPeriods}시간)</span>
                                      {isAssigned && (
                                        <span className="text-[10px] font-bold text-purple-600 px-1 bg-purple-50 rounded">강사배정됨</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* 편성 방식 선택: 매주 vs 특정 주차 */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">편성 방식</label>
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setFormAssignmentMode('weekly');
                            setSelectedInstructorSlots([]);
                          }}
                          className={cn(
                            "py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            formAssignmentMode === 'weekly'
                              ? "bg-white text-purple-950 shadow-xs border border-purple-200"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <Calendar className="h-3.5 w-3.5 text-purple-600" />
                          <span>매주 (상시)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormAssignmentMode('daily');
                            if (!editingAssignmentId) {
                              setFormAssignedWeek(currentWeekNum);
                            }
                            setSelectedInstructorSlots([]);
                          }}
                          className={cn(
                            "py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            formAssignmentMode === 'daily'
                              ? "bg-white text-amber-950 shadow-xs border border-amber-300"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          <span>특정 주차 (보강)</span>
                        </button>
                      </div>
                    </div>

                    {/* 특정 주차 보강인 경우 주차 선택기 */}
                    {formAssignmentMode === 'daily' && (
                      <div className="space-y-1.5 p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 animate-in fade-in">
                        <label className="text-[11px] font-black text-amber-950 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-amber-600" />
                            보강 주차 선택
                          </span>
                          {selectedWeekObj && (
                            <Badge className="bg-amber-600 text-white text-[10px] font-black px-2">
                              {selectedWeekObj.dateRangeLabel}
                            </Badge>
                          )}
                        </label>
                        <Select
                          value={String(formAssignedWeek)}
                          onValueChange={(val) => {
                            setFormAssignedWeek(Number(val));
                            setSelectedInstructorSlots([]);
                          }}
                        >
                          <SelectTrigger className="h-8.5 text-xs font-bold bg-white border-amber-300 text-slate-800">
                            <SelectValue placeholder="보강 주차 선택" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {semesterWeeks.map(w => (
                              <SelectItem key={w.weekNum} value={String(w.weekNum)} className="text-xs font-medium">
                                <span className="font-bold text-slate-900">{w.shortLabel}</span>
                                <span className="text-slate-500 ml-2">({w.dateRangeLabel})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* 시간강사 성명 입력 */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">2. 배정할 시간강사 성명</label>
                      <Input
                        placeholder="예: 김강사 (시간강사 성명)"
                        value={formInstructorName}
                        onChange={(e) => setFormInstructorName(e.target.value)}
                        className="h-8 text-xs font-bold bg-white"
                      />
                    </div>

                    {/* 강사 유형 및 사유 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">강사 구분</label>
                        <Select 
                          value={formInstructorType} 
                          onValueChange={(v: 'hourly' | 'contract' | 'industry') => setFormInstructorType(v)}
                        >
                          <SelectTrigger className="h-8 text-xs font-medium bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly" className="text-xs">시간강사(시급제)</SelectItem>
                            <SelectItem value="contract" className="text-xs">계약제강사</SelectItem>
                            <SelectItem value="industry" className="text-xs">산학겸임강사</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">편성 사유</label>
                        <Input
                          placeholder={formAssignmentMode === 'daily' ? '예: 교사 출장으로 인한 일일보강' : '예: 부장교사 시수 경감'}
                          value={formRemarks}
                          onChange={(e) => setFormRemarks(e.target.value)}
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>

                    {/* 시수 요약 인디케이터 */}
                    {targetTeacherName && (() => {
                      const teacher = timetableData?.teachers.find(t => t.teacherName === targetTeacherName);
                      const total = teacher?.rawPeriods || 0;
                      const instHours = selectedInstructorSlots.length;
                      const teacherHours = Math.max(0, total - instHours);
                      return (
                        <div className={cn(
                          "p-2.5 rounded-xl border space-y-1",
                          formAssignmentMode === 'daily' ? "bg-amber-50/90 border-amber-200" : "bg-purple-50/90 border-purple-200/80"
                        )}>
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span>{formAssignmentMode === 'daily' ? '일일 시간강사 보강 시수:' : '매주 시간강사 상시보강 시수:'}</span>
                            <Badge className={cn("text-white font-black text-xs px-2", formAssignmentMode === 'daily' ? "bg-amber-600" : "bg-purple-600")}>
                              {instHours}시간
                            </Badge>
                          </div>
                          {formAssignmentMode === 'weekly' && (
                            <div className="flex items-center justify-between text-[11px] text-purple-800">
                              <span>본교 교사 직접 수업:</span>
                              <span className="font-bold">{teacherHours}시간 / 총 {total}시간</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 등록 버튼 */}
                    <Button
                      type="button"
                      onClick={handleSaveInstructorAssignment}
                      className={cn(
                        "w-full h-8 text-xs font-bold gap-1 text-white shadow-2xs rounded-lg cursor-pointer mt-1",
                        formAssignmentMode === 'daily' ? "bg-amber-600 hover:bg-amber-700" : "bg-purple-600 hover:bg-purple-700"
                      )}
                    >
                      {editingAssignmentId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {editingAssignmentId 
                        ? (formAssignmentMode === 'daily' ? '일일 시간강사 보강 수정 완료' : '시간강사 보강 시간표 수정 완료')
                        : (formAssignmentMode === 'daily' ? '일일 시간강사 보강 등록' : '시간강사 보강 시간표 등록')}
                    </Button>
                  </div>

                  {/* 우측 패널 (7 cols): 교사 주간 시간표 대화형 슬롯 선택기 */}
                  <div className="lg:col-span-7 space-y-2 bg-white p-3.5 rounded-xl border border-purple-100 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Calendar className={cn("h-3.5 w-3.5", formAssignmentMode === 'daily' ? "text-amber-600" : "text-purple-600")} />
                        <span className="text-xs font-black text-slate-800">
                          {targetTeacherName 
                            ? (formAssignmentMode === 'daily' 
                                ? `📅 [${selectedWeekObj?.shortLabel || `${formAssignedWeek}주차`}] (${selectedWeekObj?.dateRangeLabel || ''}) 보강 슬롯 선택` 
                                : `${targetTeacherName} 교사 주간 시간표 (슬롯 클릭 토글)`)
                            : '교사를 선택하면 시간표가 표출됩니다'}
                        </span>
                      </div>

                      {targetTeacherName && (() => {
                        const teacher = timetableData?.teachers.find(t => t.teacherName === targetTeacherName);
                        return (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectAllTeacherSlots(teacher)}
                              className={cn(
                                "h-6 px-2 text-[10.5px] font-bold rounded",
                                formAssignmentMode === 'daily'
                                  ? "text-amber-700 border-amber-200 hover:bg-amber-50"
                                  : "text-purple-700 border-purple-200 hover:bg-purple-50"
                              )}
                            >
                              {formAssignmentMode === 'daily' ? `${selectedWeekObj?.shortLabel || ''} 전체선택` : '전체 선택'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleClearInstructorSlots}
                              className="h-6 px-2 text-[10.5px] font-bold text-slate-500 border-slate-200 hover:bg-slate-50 rounded"
                            >
                              선택 해제
                            </Button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 시간표 미니 그리드 (월~금 1~7교시) */}
                    {targetTeacherName ? (() => {
                      const teacher = timetableData?.teachers.find(t => t.teacherName === targetTeacherName);
                      const days = ['월', '화', '수', '목', '금'];
                      const periods = [1, 2, 3, 4, 5, 6, 7];

                      return (
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                          <table className="w-full table-fixed text-center border-collapse text-[11px]">
                            <colgroup>
                              <col className="w-10" />
                              <col className="w-1/5" />
                              <col className="w-1/5" />
                              <col className="w-1/5" />
                              <col className="w-1/5" />
                              <col className="w-1/5" />
                            </colgroup>
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <th className="py-1 px-1 border-r border-slate-200 w-10 text-[10px] font-bold text-slate-500">교시</th>
                                {days.map(d => {
                                  const dateLabel = (formAssignmentMode === 'daily' && selectedWeekObj?.monthDayLabels?.[d])
                                    ? selectedWeekObj.monthDayLabels[d]
                                    : null;
                                  return (
                                    <th 
                                      key={d} 
                                      className={cn(
                                        "py-1 px-1 border-r border-slate-200 last:border-r-0 transition-colors",
                                        formAssignmentMode === 'daily'
                                          ? "bg-amber-50/80 text-amber-950 font-bold"
                                          : "text-slate-800"
                                      )}
                                    >
                                      <div className="flex flex-col items-center leading-tight">
                                        <span>{d}</span>
                                        {dateLabel && <span className="text-[9.5px] font-normal text-amber-700">{dateLabel}</span>}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {periods.map(p => (
                                <tr key={p} className="border-b border-slate-100 last:border-b-0 h-11">
                                  <td className="py-0.5 px-1 bg-slate-50/70 font-bold text-slate-500 text-[10px] border-r border-slate-200">
                                    {p}
                                  </td>
                                  {days.map(d => {
                                    const slot = teacher?.slots?.[`${d}_${p}`];

                                    if (!slot) {
                                      return (
                                        <td key={d} className="p-0.5 border-r border-slate-100 last:border-r-0 bg-slate-50/30">
                                          <div className="w-full h-9 flex items-center justify-center text-slate-300 text-[10px] select-none">
                                            -
                                          </div>
                                        </td>
                                      );
                                    }

                                    const isSelected = selectedInstructorSlots.some(
                                      s => s.day === d && s.period === p && s.classCode === slot.classCode
                                    );

                                    return (
                                      <td key={d} className="p-0.5 border-r border-slate-100 last:border-r-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleInstructorSlot(slot)}
                                          className={cn(
                                            "w-full h-9 rounded-lg border text-left px-1 py-0.5 flex flex-col justify-between transition-colors cursor-pointer relative overflow-hidden",
                                            isSelected
                                              ? formAssignmentMode === 'daily'
                                                ? "bg-amber-100 border-amber-400 ring-1.5 ring-amber-500/40 text-amber-950 font-bold shadow-2xs"
                                                : "bg-purple-100 border-purple-400 ring-1.5 ring-purple-500/40 text-purple-950 font-bold shadow-2xs"
                                              : "bg-white border-slate-200/90 hover:border-purple-300 hover:bg-purple-50/40 text-slate-800"
                                          )}
                                        >
                                          <div className="flex items-center justify-between w-full leading-none min-w-0">
                                            <span className="text-[9.5px] font-bold text-slate-500 truncate">{slot.classCode}</span>
                                            {isSelected ? (
                                              <span className={cn(
                                                "text-[8.5px] font-black text-white px-1 py-0.2 rounded-full shrink-0",
                                                formAssignmentMode === 'daily' ? "bg-amber-600" : "bg-purple-600"
                                              )}>
                                                강사✓
                                              </span>
                                            ) : (
                                              <span className="text-[8.5px] text-slate-400 shrink-0">교사</span>
                                            )}
                                          </div>
                                          <span className="text-[10px] font-bold truncate leading-tight w-full block">
                                            {slot.subjectName}
                                          </span>
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })() : (
                      <div className="h-56 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 gap-1 text-xs">
                        <Users className="h-6 w-6 text-slate-300" />
                        <span>좌측에서 대상 교사를 선택하시면 주간 시간표가 표출됩니다.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 하단: 기 편성된 시간강사 시간표 목록 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-xs font-black text-slate-900">
                      등록된 시간강사 보강 시간표 목록 ({teacherInstructorAssignments.length}건)
                    </strong>
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                      교체·보강 불가 🔒
                    </Badge>
                  </div>
                </div>

                {teacherInstructorAssignments.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-1.5">
                    <Briefcase className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">등록된 시간강사 보강 편성이 없습니다.</p>
                    <p className="text-[11px] text-slate-400">
                      매주 시간강사 상시보강 또는 일일 시간강사 보강 편성을 상단에서 등록해주세요.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teacherInstructorAssignments.map((assign) => (
                      <div
                        key={assign.id}
                        className={cn(
                          "p-3.5 rounded-2xl border bg-white flex flex-col justify-between gap-2.5 transition-all shadow-2xs",
                          editingAssignmentId === assign.id
                            ? assign.assignmentMode === 'daily'
                              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30"
                              : "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/30"
                            : "border-slate-200/90 hover:border-purple-300"
                        )}
                      >
                        <div className="space-y-2">
                          {/* 카드 헤더 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900">
                                {assign.originalTeacherName} 교사
                              </span>
                              <span className="text-slate-400 text-xs">➔</span>
                              <Badge className={cn(
                                "text-white font-black text-xs px-2",
                                assign.assignmentMode === 'daily' ? "bg-amber-600" : "bg-purple-600"
                              )}>
                                {assign.assignmentMode === 'daily'
                                  ? `${assign.assignedWeek ? `${assign.assignedWeek}주차` : '주차'} 강사 ${assign.instructorName} (${assign.assignedWeekLabel || `${assign.effectivePeriod?.startDate || ''} ~ ${assign.effectivePeriod?.endDate || ''}`})`
                                  : `시간강사 ${assign.instructorName} (매주)`}
                              </Badge>
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-bold",
                                assign.assignmentMode === 'daily'
                                  ? "text-amber-800 border-amber-200 bg-amber-50"
                                  : "text-purple-700 border-purple-200 bg-purple-50"
                              )}>
                                {assign.assignmentMode === 'daily' ? `해당 주 ${assign.weeklyHours}시간` : `주당 ${assign.weeklyHours}시간`}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEditAssignment(assign)}
                                className="h-7 w-7 text-slate-400 hover:text-purple-700 hover:bg-purple-50 cursor-pointer"
                                title="수정"
                              >
                                <FileEdit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAssignment(assign.id)}
                                className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* 슬롯 칩 나열 */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500">배정 수업:</span>
                            {assign.assignedSlots.map((s, idx) => (
                              <span
                                key={idx}
                                className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.2 rounded border",
                                  assign.assignmentMode === 'daily'
                                    ? "bg-amber-50 text-amber-900 border-amber-200/90"
                                    : "bg-purple-50 text-purple-900 border-purple-200/90"
                                )}
                              >
                                {s.day} {s.period}교시 ({s.classCode} {s.subjectName})
                              </span>
                            ))}
                          </div>

                          {/* 잠금 뱃지 및 비고 */}
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-1 font-bold text-[10.5px]">
                              <Lock className="h-3 w-3 text-purple-700" />
                              <span className={assign.assignmentMode === 'daily' ? "text-amber-800" : "text-purple-700"}>
                                {assign.assignmentMode === 'daily'
                                  ? `일일보강 완료 (${assign.assignedDate || assign.effectivePeriod?.startDate} 당일 교체·추가보강 불가 🔒)`
                                  : '상시보강 완료 (수업교체 및 추가보강 불가 🔒)'}
                              </span>
                            </div>
                            {assign.remarks && (
                              <span className="text-slate-500 text-[10.5px] truncate max-w-[160px]" title={assign.remarks}>
                                📝 {assign.remarks}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. 하단 모달 액션 바 */}
        <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
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
                        {/* [직접입력 모달] 좌·우 2단 분할(Split) 레이아웃 모달 */}
        {dayScheduleModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div 
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-[840px] w-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ========================================================= */}
              {/* 좌측 사이드 패널: 날짜 정보, 5대 카테고리 메뉴, 등록된 일정 목록 */}
              {/* ========================================================= */}
              <div className="w-full md:w-[260px] shrink-0 bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200/80 p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar gap-3">
                <div className="space-y-3">
                  {/* 상단: 선택 날짜 배너 */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">선택된 날짜</span>
                      <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        {dayScheduleModal.dayOfWeek}요일
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 font-bold">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span className="text-base font-black text-slate-900 tracking-tight">
                        {dayScheduleModal.dateStr}
                      </span>
                    </div>
                  </div>

                  {/* 5대 카테고리 세로 메뉴 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block px-1">
                      일정 유형 선택
                    </label>

                    {/* 1. 휴업일 */}
                    <button
                      type="button"
                      onClick={() => setDayScheduleModal(p => p ? { ...p, activeCategory: 'holiday' } : null)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border",
                        dayScheduleModal.activeCategory === 'holiday'
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm font-black"
                          : "bg-white text-slate-700 border-slate-200/70 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🏖️</span>
                        <span>휴업일 / 재량휴업</span>
                      </div>
                      {dayScheduleModal.activeCategory === 'holiday' && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                    </button>

                    {/* 2. 단축수업 */}
                    <button
                      type="button"
                      onClick={() => setDayScheduleModal(p => p ? { ...p, activeCategory: 'shortened' } : null)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border",
                        dayScheduleModal.activeCategory === 'shortened'
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm font-black"
                          : "bg-white text-slate-700 border-slate-200/70 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⏰</span>
                        <span>단축수업 운영</span>
                      </div>
                      {dayScheduleModal.activeCategory === 'shortened' && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                    </button>

                    {/* 3. 대체요일 */}
                    <button
                      type="button"
                      onClick={() => setDayScheduleModal(p => p ? { ...p, activeCategory: 'special_day' } : null)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border",
                        dayScheduleModal.activeCategory === 'special_day'
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm font-black"
                          : "bg-white text-slate-700 border-slate-200/70 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔄</span>
                        <span>시간표 대체 / 변형</span>
                      </div>
                      {dayScheduleModal.activeCategory === 'special_day' && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                    </button>

                    {/* 4. 지필평가 */}
                    <button
                      type="button"
                      onClick={() => setDayScheduleModal(p => p ? { ...p, activeCategory: 'exam' } : null)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border",
                        dayScheduleModal.activeCategory === 'exam'
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm font-black"
                          : "bg-white text-slate-700 border-slate-200/70 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📝</span>
                        <span>지필평가 (시험)</span>
                      </div>
                      {dayScheduleModal.activeCategory === 'exam' && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                    </button>

                    {/* 5. 학교행사 */}
                    <button
                      type="button"
                      onClick={() => setDayScheduleModal(p => p ? { ...p, activeCategory: 'event' } : null)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between border",
                        dayScheduleModal.activeCategory === 'event'
                          ? "bg-purple-600 text-white border-purple-600 shadow-sm font-black"
                          : "bg-white text-slate-700 border-slate-200/70 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🎭</span>
                        <span>학교 행사 일정</span>
                      </div>
                      {dayScheduleModal.activeCategory === 'event' && <ChevronRight className="h-3.5 w-3.5 text-white" />}
                    </button>
                  </div>
                </div>

                {/* 하단: 기등록 일정 목록 및 수정 모드 알림 */}
                <div className="space-y-2 pt-2 border-t border-slate-200/80">
                  {/* 수정 모드 알림 배너 */}
                  {editingScheduleId && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1 animate-in fade-in">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Pencil className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="truncate"><strong>&apos;{editingScheduleId.originalTitle}&apos;</strong> 수정 중</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelEditMode}
                        className="w-full text-center text-[11px] font-bold text-amber-800 hover:text-rose-600 bg-white py-0.5 rounded-md border border-amber-200 cursor-pointer shadow-2xs"
                      >
                        수정 취소 (신규 등록)
                      </button>
                    </div>
                  )}

                  {/* 기등록 일정 목록 */}
                  {(() => {
                    const curVac = vacations.filter(v => v.startDate <= dayScheduleModal.dateStr && v.endDate >= dayScheduleModal.dateStr);
                    const curEx = examPeriods.filter(e => e.startDate <= dayScheduleModal.dateStr && e.endDate >= dayScheduleModal.dateStr);
                    const curSp = specialDaySchedules.filter(s => s.date === dayScheduleModal.dateStr);
                    const curEv = events.filter(e => e.date === dayScheduleModal.dateStr);
                    const totalCount = curVac.length + curEx.length + curSp.length + curEv.length;

                    if (totalCount === 0) {
                      return (
                        <div className="py-2 text-center text-[11px] text-slate-400">
                          이 날 등록된 일정 없음
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between px-0.5">
                          <span>📌 등록된 일정 ({totalCount}건)</span>
                          <span className="text-[10px] text-blue-600">클릭 시 수정</span>
                        </div>
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
                          {/* 휴업일 */}
                          {curVac.map(v => {
                            const isEditing = editingScheduleId?.id === v.id;
                            return (
                              <div
                                key={v.id}
                                className={cn(
                                  "px-2 py-1 rounded-lg border text-xs font-bold flex items-center justify-between transition-all",
                                  isEditing
                                    ? "bg-emerald-600 text-white border-emerald-700"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDayModalPrefillVacation(v)}
                                  className="flex items-center gap-1.5 cursor-pointer truncate text-left flex-1"
                                  title="클릭하여 수정"
                                >
                                  <span>🏖️</span>
                                  <span className="truncate">{v.name}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`'${v.name}' 휴업일 일정을 삭제하시겠습니까?`)) {
                                      handleCancelEditMode();
                                      handleDeleteVacation(v.id);
                                    }
                                  }}
                                  className={cn(
                                    "ml-1 text-xs px-1 hover:text-rose-600 cursor-pointer",
                                    isEditing ? "text-emerald-200" : "text-slate-400"
                                  )}
                                  title="삭제"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}

                          {/* 지필평가 */}
                          {curEx.map(e => {
                            const isEditing = editingScheduleId?.id === e.id;
                            return (
                              <div
                                key={e.id}
                                className={cn(
                                  "px-2 py-1 rounded-lg border text-xs font-bold flex items-center justify-between transition-all",
                                  isEditing
                                    ? "bg-rose-600 text-white border-rose-700"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDayModalPrefillExam(e)}
                                  className="flex items-center gap-1.5 cursor-pointer truncate text-left flex-1"
                                  title="클릭하여 수정"
                                >
                                  <span>📝</span>
                                  <span className="truncate">{e.name}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(eBtn) => {
                                    eBtn.stopPropagation();
                                    if (window.confirm(`'${e.name}' 지필평가 일정을 삭제하시겠습니까?`)) {
                                      if (editingScheduleId?.id === e.id) handleCancelEditMode();
                                      handleDeleteExamPeriod(e.id);
                                    }
                                  }}
                                  className={cn(
                                    "ml-1 text-xs px-1 hover:text-rose-600 cursor-pointer",
                                    isEditing ? "text-rose-200" : "text-slate-400"
                                  )}
                                  title="삭제"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}

                          {/* 단축 및 대체 요일 */}
                          {curSp.map(s => {
                            const isEditing = editingScheduleId?.id === s.id;
                            const isShort = !!s.shortenedPeriods;
                            const hasOverrides = Boolean(s.periodOverrides && Object.keys(s.periodOverrides).length > 0);
                            const desc = isShort 
                              ? `${s.shortenedPeriods}교시 단축` 
                              : hasOverrides 
                                ? (s.description || '교시 연속/변형') 
                                : `${s.targetDayOfWeek} 대체`;
                            const fullDesc = isShort 
                              ? `${s.shortenedPeriods}교시 단축수업` 
                              : hasOverrides 
                                ? (s.description || '교시 연속/변형 운영') 
                                : `${s.targetDayOfWeek}요일 대체 시간표`;
                            return (
                              <div
                                key={s.id}
                                className={cn(
                                  "px-2 py-1 rounded-lg border text-xs font-bold flex items-center justify-between transition-all",
                                  isEditing
                                    ? (isShort ? "bg-amber-600 text-white border-amber-700" : "bg-indigo-600 text-white border-indigo-700")
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => isShort ? handleDayModalPrefillShortened(s) : handleDayModalPrefillSwapDay(s)}
                                  className="flex items-center gap-1.5 cursor-pointer truncate text-left flex-1"
                                  title="클릭하여 수정"
                                >
                                  <span>{isShort ? '⏰' : (hasOverrides ? '🔗' : '🔄')}</span>
                                  <span className="truncate">{desc}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(eBtn) => {
                                    eBtn.stopPropagation();
                                    if (window.confirm(`'${fullDesc}' 일정을 삭제하시겠습니까?`)) {
                                      if (editingScheduleId?.id === s.id) handleCancelEditMode();
                                      handleDeleteSpecialDay(s.id);
                                    }
                                  }}
                                  className={cn(
                                    "ml-1 text-xs px-1 hover:text-rose-600 cursor-pointer",
                                    isEditing ? "text-white/80" : "text-slate-400"
                                  )}
                                  title="삭제"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}

                          {/* 학교 행사 */}
                          {curEv.map(ev => {
                            const isEditing = editingScheduleId?.id === ev.id;
                            return (
                              <div
                                key={ev.id}
                                className={cn(
                                  "px-2 py-1 rounded-lg border text-xs font-bold flex items-center justify-between transition-all",
                                  isEditing
                                    ? "bg-purple-600 text-white border-purple-700"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDayModalPrefillEvent(ev)}
                                  className="flex items-center gap-1.5 cursor-pointer truncate text-left flex-1"
                                  title="클릭하여 수정"
                                >
                                  <span>🎭</span>
                                  <span className="truncate">{ev.title}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`'${ev.title}' 학교 행사 일정을 삭제하시겠습니까?`)) {
                                      if (editingScheduleId?.id === ev.id) handleCancelEditMode();
                                      handleDeleteEvent(ev.id);
                                    }
                                  }}
                                  className={cn(
                                    "ml-1 text-xs px-1 hover:text-rose-600 cursor-pointer",
                                    isEditing ? "text-purple-200" : "text-slate-400"
                                  )}
                                  title="삭제"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ========================================================= */}
              {/* 우측 메인 패널: 헤더, 상세 입력 폼, 하단 액션 버튼 */}
              {/* ========================================================= */}
              <div className="flex-1 flex flex-col justify-between bg-white min-w-0">
                {/* 1. 우측 헤더 (현재 선택된 카테고리 명칭 및 닫기 버튼) */}
                <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      {dayScheduleModal.activeCategory === 'holiday' && <span>🏖️ 휴업일 / 재량휴업일 설정</span>}
                      {dayScheduleModal.activeCategory === 'shortened' && <span>⏰ 단축수업 일정 설정</span>}
                      {dayScheduleModal.activeCategory === 'special_day' && <span>🔄 시간표 대체 / 교시변형 설정</span>}
                      {dayScheduleModal.activeCategory === 'exam' && <span>📝 지필평가 (시험) 일정 설정</span>}
                      {dayScheduleModal.activeCategory === 'event' && <span>🎭 학교 행사 일정 설정</span>}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {dayScheduleModal.activeCategory === 'holiday' && '휴업 기간(당일 또는 기간 지정) 및 휴업 구분을 설정합니다.'}
                      {dayScheduleModal.activeCategory === 'shortened' && '당일 운영할 교시를 선택하면 이후 교시는 결보강이 발생하지 않습니다.'}
                      {dayScheduleModal.activeCategory === 'special_day' && '전교 요일 시간표를 대체하거나, 특정 교시 수업을 다른 교시에도 이어서 연속 진행합니다.'}
                      {dayScheduleModal.activeCategory === 'exam' && '고사 기간, 시험 교시, 대상 학년 및 오후 운영 형태를 지정합니다.'}
                      {dayScheduleModal.activeCategory === 'event' && '행사 대상 학년, 진행 교시 및 인솔·담당 교사를 지정합니다.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDayScheduleModal(null)}
                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 2. 우측 폼 본문 (넓고 시원한 공간) */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                  {/* [1. 휴업일] */}
                  {dayScheduleModal.activeCategory === 'holiday' && (
                    <div className="space-y-4">
                      {/* 기간 설정 방식 선택 */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">휴업 기간 설정 방식</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setModalHolidayMode('single');
                              setModalHolidayEnd(dayScheduleModal.dateStr);
                            }}
                            className={cn(
                              "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              modalHolidayMode === 'single'
                                ? "bg-white text-emerald-800 shadow-xs font-black border border-emerald-200"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            📅 하루만 (당일)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalHolidayMode('range');
                              if (!modalHolidayEnd || modalHolidayEnd === dayScheduleModal.dateStr) {
                                setModalHolidayEnd(dayScheduleModal.dateStr);
                              }
                            }}
                            className={cn(
                              "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              modalHolidayMode === 'range'
                                ? "bg-white text-emerald-800 shadow-xs font-black border border-emerald-200"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            📆 여러 날짜 (기간 지정)
                          </button>
                        </div>
                      </div>

                      {/* 기간 지정 시 날짜 피커 */}
                      {modalHolidayMode === 'range' && (
                        <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[11px] font-bold text-emerald-900 block mb-1">시작일 (선택 날짜)</span>
                              <div className="h-9 px-3 rounded-xl bg-white border border-emerald-200 flex items-center text-xs font-bold text-emerald-950">
                                {dayScheduleModal.dateStr} ({dayScheduleModal.dayOfWeek})
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] font-bold text-emerald-900 block mb-1">종료일 선택</span>
                              <Input
                                type="date"
                                value={modalHolidayEnd || dayScheduleModal.dateStr}
                                min={dayScheduleModal.dateStr}
                                onChange={e => setModalHolidayEnd(e.target.value)}
                                className="h-9 text-xs bg-white border-emerald-300 rounded-xl font-bold"
                              />
                            </div>
                          </div>

                          {/* 계산된 일수 피드백 */}
                          {(() => {
                            const start = new Date(dayScheduleModal.dateStr);
                            const end = new Date(modalHolidayEnd || dayScheduleModal.dateStr);
                            const diffTime = end.getTime() - start.getTime();
                            const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

                            return (
                              <div className="flex items-center justify-between text-xs font-bold text-emerald-900 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                                <span>
                                  ⏳ 설정 기간: <strong>{dayScheduleModal.dateStr} ~ {modalHolidayEnd || dayScheduleModal.dateStr}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[11px]">
                                  총 {diffDays}일간
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* 명칭 및 구분 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="text-xs font-bold text-slate-700 block mb-1">휴업일 명칭 직접입력</label>
                          <Input
                            placeholder="예: 재량휴업일, 개교기념일, 수능일 등 직접 입력"
                            value={modalHolidayTitle}
                            onChange={e => setModalHolidayTitle(e.target.value)}
                            className="h-10 text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-emerald-400"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-bold text-slate-700 block mb-1">휴업 구분</label>
                          <Select value={modalHolidayType} onValueChange={setModalHolidayType}>
                            <SelectTrigger className="h-10 text-xs bg-white border-slate-200 rounded-xl focus:ring-emerald-400">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="discretionary">재량휴업일</SelectItem>
                              <SelectItem value="holiday">공휴일 / 임시공휴일</SelectItem>
                              <SelectItem value="vacation">방학</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* [2. 단축수업] */}
                  {dayScheduleModal.activeCategory === 'shortened' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-2">운영 교시 선택 (해당 교시까지만 수업 진행)</label>
                        <div className="grid grid-cols-6 gap-2">
                          {[1, 2, 3, 4, 5, 6].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setModalShortenedPeriods(p)}
                              className={cn(
                                "py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-0.5",
                                modalShortenedPeriods === p
                                  ? "bg-amber-600 text-white border-amber-600 shadow-sm font-black"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300"
                              )}
                            >
                              <span>{p}교시</span>
                              <span className={cn("text-[10px] font-normal", modalShortenedPeriods === p ? "text-amber-100" : "text-slate-400")}>
                                수업운영
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">단축수업 설명 / 비고</label>
                        <Input
                          placeholder={`예: ${modalShortenedPeriods}교시 단축수업 (급식 후 하교), 입학식, 방학식 등 직접 입력`}
                          value={modalShortenedDesc}
                          onChange={e => setModalShortenedDesc(e.target.value)}
                          className="h-10 text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-amber-400"
                        />
                      </div>

                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1">
                        <div className="font-black flex items-center gap-1 text-amber-950">
                          <span>💡 시간표 결보강 영향 안내:</span>
                        </div>
                        <p>
                          당일은 <strong>{modalShortenedPeriods}교시까지만</strong> 정규 수업을 진행하며, 
                          <strong> {modalShortenedPeriods + 1}~7교시</strong>는 수업이 배정되지 않아 결보강이 발생하지 않습니다.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* [3. 시간표 대체 / 교시변형] */}
                  {dayScheduleModal.activeCategory === 'special_day' && (
                    <div className="space-y-4">
                      {/* 운영 방식 선택 (전교 요일 대체 vs 교시 연속/복제) */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">운영 방식 선택</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setModalSwapMode('day');
                              setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일에 ${modalSwapTargetDay}요일 시간표 대체 운영`);
                            }}
                            className={cn(
                              "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              modalSwapMode === 'day'
                                ? "bg-white text-indigo-800 shadow-xs font-black border border-indigo-200"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            📅 요일 전체 대체 (전교 시간표 치환)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalSwapMode('period_block');
                              setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일 ${modalBlockSourcePeriod}교시 수업 ${modalBlockSourcePeriod}~${modalBlockTargetPeriod}교시 연속/중복 진행`);
                            }}
                            className={cn(
                              "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              modalSwapMode === 'period_block'
                                ? "bg-white text-indigo-800 shadow-xs font-black border border-indigo-200"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            🔗 교시 연속(블록) / 중복 운영
                          </button>
                        </div>
                      </div>

                      {/* 1. 요일 전체 대체 모드 */}
                      {modalSwapMode === 'day' && (
                        <div className="space-y-3.5 animate-in fade-in duration-150">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-2">대체하여 운영할 시간표 요일</label>
                            <div className="grid grid-cols-5 gap-2">
                              {['월', '화', '수', '목', '금'].map(d => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => {
                                    setModalSwapTargetDay(d);
                                    setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일에 ${d}요일 시간표 대체 운영`);
                                  }}
                                  className={cn(
                                    "py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-0.5",
                                    modalSwapTargetDay === d
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm font-black"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300"
                                  )}
                                >
                                  <span>{d}요일</span>
                                  <span className={cn("text-[10px] font-normal", modalSwapTargetDay === d ? "text-indigo-100" : "text-slate-400")}>
                                    시간표 적용
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">설명 / 비고</label>
                            <Input
                              placeholder="예: 수요일 시간표로 전교 대체 운영..."
                              value={modalSwapDesc}
                              onChange={e => setModalSwapDesc(e.target.value)}
                              className="h-10 text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-indigo-400"
                            />
                          </div>

                          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-900 leading-relaxed">
                            💡 <strong>{dayScheduleModal.dateStr} ({dayScheduleModal.dayOfWeek}요일)</strong>에 
                            전교 수업이 <strong>[{modalSwapTargetDay}요일]</strong> 정규 시간표로 자동 치환되어 결보강이 산출됩니다.
                          </div>
                        </div>
                      )}

                      {/* 2. 교시 연속(블록) / 중복 운영 모드 */}
                      {modalSwapMode === 'period_block' && (
                        <div className="space-y-3.5 animate-in fade-in duration-150">
                          {/* ⚡ 퀵 프리셋 버튼 */}
                          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                                <span>⚡ 자주 쓰는 원클릭 퀵 설정</span>
                              </span>
                              <span className="text-[11px] text-indigo-600 font-bold">클릭 시 자동 세팅</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setModalBlockSourcePeriod(5);
                                  setModalBlockTargetPeriod(6);
                                  setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일 5교시 수업 5~6교시 연속/중복 진행`);
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-2xs",
                                  modalBlockSourcePeriod === 5 && modalBlockTargetPeriod === 6
                                    ? "bg-indigo-600 text-white border-indigo-600 font-black"
                                    : "bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100"
                                )}
                              >
                                ✨ 5교시 수업 ➔ 5~6교시 연속 진행 (금요일 등)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalBlockSourcePeriod(6);
                                  setModalBlockTargetPeriod(7);
                                  setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일 6교시 수업 6~7교시 연속/중복 진행`);
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-2xs",
                                  modalBlockSourcePeriod === 6 && modalBlockTargetPeriod === 7
                                    ? "bg-indigo-600 text-white border-indigo-600 font-black"
                                    : "bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100"
                                )}
                              >
                                6교시 수업 ➔ 6~7교시 연속
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalBlockSourcePeriod(3);
                                  setModalBlockTargetPeriod(4);
                                  setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일 3교시 수업 3~4교시 연속/중복 진행`);
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-2xs",
                                  modalBlockSourcePeriod === 3 && modalBlockTargetPeriod === 4
                                    ? "bg-indigo-600 text-white border-indigo-600 font-black"
                                    : "bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100"
                                )}
                              >
                                3교시 수업 ➔ 3~4교시 연속
                              </button>
                            </div>
                          </div>

                          {/* 직접 선택 그리드 */}
                          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                              {/* 기준 교시 */}
                              <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                  1. 가져올 기준 교시 (원래 수업)
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                  {[1, 2, 3, 4, 5, 6, 7].map(p => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => {
                                        setModalBlockSourcePeriod(p);
                                        const nextTarget = p < 7 ? p + 1 : 6;
                                        setModalBlockTargetPeriod(nextTarget);
                                        setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일 ${p}교시 수업 ${p}~${nextTarget}교시 연속/중복 진행`);
                                      }}
                                      className={cn(
                                        "py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center",
                                        modalBlockSourcePeriod === p
                                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs font-black"
                                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200"
                                      )}
                                    >
                                      {p}교시
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 적용할 교시 */}
                              <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                  2. 이어서 진행할 교시 (수업 복제)
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                  {[1, 2, 3, 4, 5, 6, 7].map(p => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => {
                                        setModalBlockTargetPeriod(p);
                                        setModalSwapDesc(`${dayScheduleModal.dayOfWeek}요일 ${modalBlockSourcePeriod}교시 수업 ${modalBlockSourcePeriod}~${p}교시 연속/중복 진행`);
                                      }}
                                      className={cn(
                                        "py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center",
                                        modalBlockTargetPeriod === p
                                          ? "bg-indigo-700 text-white border-indigo-700 shadow-xs font-black ring-2 ring-indigo-200"
                                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200"
                                      )}
                                    >
                                      {p}교시
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* 설정 요약 피드백 배지 */}
                            <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-200 flex items-center justify-between text-xs text-indigo-950 font-bold">
                              <span>
                                🔗 <strong>[{modalBlockSourcePeriod}교시]</strong> 수업을 ➔ <strong>[{modalBlockTargetPeriod}교시]</strong>에도 동일 교사·과목으로 연속 운영
                              </span>
                              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-black text-[11px]">
                                {modalBlockSourcePeriod}~{modalBlockTargetPeriod}교시 블록
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">설명 / 비고</label>
                            <Input
                              placeholder="예: 금요일 5교시 수업 5~6교시 연속/중복 진행..."
                              value={modalSwapDesc}
                              onChange={e => setModalSwapDesc(e.target.value)}
                              className="h-10 text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-indigo-400"
                            />
                          </div>

                          <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs text-indigo-900 leading-relaxed">
                            💡 <strong>시간표 변경 자동 연동:</strong> 나중에 시간표가 바뀌더라도 당일 <strong>{modalBlockSourcePeriod}교시</strong>를 담당하는 각 반 교사와 과목이 <strong>{modalBlockTargetPeriod}교시</strong>에 자동으로 연동되며, 출장/결강 시 두 교시 모두 결보강 대상에 정상 포함됩니다.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* [4. 지필평가] */}
                  {dayScheduleModal.activeCategory === 'exam' && (
                    <div className="space-y-4">
                      {/* 기간 설정 방식 선택 */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">시험 기간 설정 방식</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setModalExamMode('single');
                              setModalExamEnd(dayScheduleModal.dateStr);
                            }}
                            className={cn(
                              "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              modalExamMode === 'single'
                                ? "bg-white text-rose-800 shadow-xs font-black border border-rose-200"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            📅 하루만 (당일 시험)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalExamMode('range');
                              if (!modalExamEnd || modalExamEnd === dayScheduleModal.dateStr) {
                                setModalExamEnd(dayScheduleModal.dateStr);
                              }
                            }}
                            className={cn(
                              "py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center",
                              modalExamMode === 'range'
                                ? "bg-white text-rose-800 shadow-xs font-black border border-rose-200"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            📆 여러 날짜 (고사 기간 지정)
                          </button>
                        </div>
                      </div>

                      {/* 기간 지정 시 날짜 피커 */}
                      {modalExamMode === 'range' && (
                        <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200/80 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[11px] font-bold text-rose-900 block mb-1">시작일 (선택 날짜)</span>
                              <div className="h-9 px-3 rounded-xl bg-white border border-rose-200 flex items-center text-xs font-bold text-rose-950">
                                {dayScheduleModal.dateStr} ({dayScheduleModal.dayOfWeek})
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] font-bold text-rose-900 block mb-1">종료일 선택</span>
                              <Input
                                type="date"
                                value={modalExamEnd || dayScheduleModal.dateStr}
                                min={dayScheduleModal.dateStr}
                                onChange={e => setModalExamEnd(e.target.value)}
                                className="h-9 text-xs bg-white border-rose-300 rounded-xl font-bold"
                              />
                            </div>
                          </div>

                          {/* 계산된 일수 피드백 */}
                          {(() => {
                            const start = new Date(dayScheduleModal.dateStr);
                            const end = new Date(modalExamEnd || dayScheduleModal.dateStr);
                            const diffTime = end.getTime() - start.getTime();
                            const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

                            return (
                              <div className="flex items-center justify-between text-xs font-bold text-rose-900 bg-white px-3 py-1.5 rounded-lg border border-rose-200">
                                <span>
                                  ⏳ 고사 기간: <strong>{dayScheduleModal.dateStr} ~ {modalExamEnd || dayScheduleModal.dateStr}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[11px]">
                                  총 {diffDays}일간
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">고사명 직접입력</label>
                        <Input
                          placeholder="예: 1학기 1차 지필평가, 2학기 기말고사 등 직접 입력"
                          value={modalExamName}
                          onChange={e => setModalExamName(e.target.value)}
                          className="h-10 text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-rose-400"
                        />
                      </div>

                      {/* 시험 교시 선택 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700">시험 교시 선택</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setModalExamPeriods([1, 2, 3])}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 font-bold cursor-pointer hover:bg-rose-50"
                            >
                              1~3교시
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalExamPeriods([1, 2, 3, 4])}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 font-bold cursor-pointer hover:bg-rose-50"
                            >
                              1~4교시
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalExamPeriods([1, 2])}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 font-bold cursor-pointer hover:bg-rose-50"
                            >
                              1~2교시
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map(p => {
                            const active = modalExamPeriods.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleToggleModalExamPeriod(p)}
                                className={cn(
                                  "py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center",
                                  active
                                    ? "bg-rose-600 text-white border-rose-600 shadow-xs font-black"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-rose-50 hover:border-rose-300"
                                )}
                              >
                                {p}교시
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">대상 학년</label>
                          <Select value={modalExamScope} onValueChange={(v: any) => setModalExamScope(v)}>
                            <SelectTrigger className="h-10 text-xs bg-white border-slate-200 rounded-xl focus:ring-rose-400">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">전학년 (1~3학년)</SelectItem>
                              <SelectItem value="1">1학년만</SelectItem>
                              <SelectItem value="2">2학년만</SelectItem>
                              <SelectItem value="3">3학년만</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">오후 운영 형태</label>
                          <Select value={modalExamDismiss} onValueChange={(v: any) => setModalExamDismiss(v)}>
                            <SelectTrigger className="h-10 text-xs bg-white border-slate-200 rounded-xl focus:ring-rose-400">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dismiss">시험 후 하교 (수업 없음)</SelectItem>
                              <SelectItem value="regular_class">오후 정규 수업 진행</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* [5. 학교행사] */}
                  {dayScheduleModal.activeCategory === 'event' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">행사명 직접입력</label>
                        <Input
                          placeholder="예: 전교생 축제, 1학년 현장체험학습, 체육대회..."
                          value={modalEventTitle}
                          onChange={e => setModalEventTitle(e.target.value)}
                          className="h-10 text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-purple-400"
                        />
                      </div>

                      {/* 대상 범위 */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">대상 범위</label>
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => setModalEventScope('all')}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center",
                              modalEventScope === 'all'
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs font-black"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300"
                            )}
                          >
                            전교생
                          </button>
                          {[1, 2, 3].map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setModalEventScope('grade');
                                setModalEventGrade(g);
                              }}
                              className={cn(
                                "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center",
                                modalEventScope === 'grade' && modalEventGrade === g
                                  ? "bg-purple-600 text-white border-purple-600 shadow-xs font-black"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300"
                              )}
                            >
                              {g}학년
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 진행 교시 선택 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700">진행 교시 선택</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setModalEventPeriods([1, 2, 3, 4, 5, 6, 7])}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-800 font-bold cursor-pointer hover:bg-purple-50"
                            >
                              전일(1~7)
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalEventPeriods([1, 2, 3, 4])}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-800 font-bold cursor-pointer hover:bg-purple-50"
                            >
                              오전(1~4)
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalEventPeriods([5, 6, 7])}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-800 font-bold cursor-pointer hover:bg-purple-50"
                            >
                              오후(5~7)
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalEventPeriods([5, 6])}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-800 font-bold cursor-pointer hover:bg-purple-50"
                            >
                              5~6교시
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1.5">
                          {[1, 2, 3, 4, 5, 6, 7].map(p => {
                            const active = modalEventPeriods.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleToggleModalEventPeriod(p)}
                                className={cn(
                                  "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center",
                                  active
                                    ? "bg-purple-600 text-white border-purple-600 shadow-xs font-black"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300"
                                )}
                              >
                                {p}교시
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 담당 / 인솔 교사 지정 */}
                      <div className="space-y-2 p-3.5 rounded-xl bg-purple-50/40 border border-purple-200/80 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-purple-600" />
                            <span>담당 / 인솔 교사 지정</span>
                          </label>
                          <span className="text-xs font-bold text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                            {modalEventTeachers.length}명 지정됨
                          </span>
                        </div>

                        {/* 일괄 배정 버튼들 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* 담임교사 일괄 */}
                          <button
                            type="button"
                            onClick={() => handleAssignHomeroomToModalEvent()}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border",
                              modalEventRoleLabel.includes('담임교사 일괄')
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs font-black"
                                : "bg-white border-purple-200 text-purple-800 hover:bg-purple-50"
                            )}
                          >
                            <span>👨‍🏫 {modalEventScope === 'grade' ? `${modalEventGrade}학년 담임 일괄` : '전교생 담임 일괄'}</span>
                            {modalEventRoleLabel.includes('담임교사 일괄') && <span className="text-[10px] font-black">✓</span>}
                          </button>

                          {/* 진로담당 일괄 */}
                          <button
                            type="button"
                            onClick={() => handleAssignCareerToModalEvent()}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                              modalEventRoleLabel.includes('진로담당')
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs font-black"
                                : "bg-white border-purple-200 text-purple-800 hover:bg-purple-50"
                            )}
                          >
                            <span>{modalEventScope === 'grade' ? `${modalEventGrade}학년 진로담당` : '전체 진로담당'}</span>
                            {modalEventRoleLabel.includes('진로담당') && <span className="text-[10px] font-black ml-0.5">✓</span>}
                          </button>

                          {/* 동아리담당 일괄 */}
                          <button
                            type="button"
                            onClick={() => handleAssignClubToModalEvent()}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                              modalEventRoleLabel.includes('동아리담당')
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs font-black"
                                : "bg-white border-purple-200 text-purple-800 hover:bg-purple-50"
                            )}
                          >
                            <span>{modalEventScope === 'grade' ? `${modalEventGrade}학년 동아리담당` : '전체 동아리담당'}</span>
                            {modalEventRoleLabel.includes('동아리담당') && <span className="text-[10px] font-black ml-0.5">✓</span>}
                          </button>

                          {/* 개별 교사 추가 토글 */}
                          <button
                            type="button"
                            onClick={() => setShowTeacherPicker(p => !p)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border",
                              showTeacherPicker
                                ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                                : "bg-white border-purple-300 text-purple-900 hover:bg-purple-50"
                            )}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>+ 교사 개별 추가</span>
                            {showTeacherPicker ? <span className="text-[10px]">▲</span> : <span className="text-[10px]">▼</span>}
                          </button>

                          {modalEventTeachers.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setModalEventTeachers([]);
                                setModalEventRoleLabel('');
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:text-rose-600 text-xs font-bold transition-all cursor-pointer"
                            >
                              초기화
                            </button>
                          )}
                        </div>

                        {/* 인라인 개별 교사 검색창 */}
                        {showTeacherPicker && (
                          <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-purple-950 flex items-center gap-1">
                                <Search className="h-3.5 w-3.5 text-purple-600" />
                                <span>인솔 교사 검색 및 개별 선택</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowTeacherPicker(false)}
                                className="text-xs font-bold text-purple-700 hover:text-purple-950 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 cursor-pointer"
                              >
                                닫기 (접기)
                              </button>
                            </div>

                            <div className="relative">
                              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                              <Input
                                placeholder="교사 이름 검색 (엔터 치면 직접 추가)..."
                                value={teacherSearchQuery}
                                onChange={e => setTeacherSearchQuery(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddTeacherToModalEvent(teacherSearchQuery);
                                  }
                                }}
                                className="h-8 text-xs pl-8 pr-2 bg-white border-purple-200 rounded-lg shadow-2xs"
                                autoFocus
                              />
                            </div>

                            <div className="max-h-40 overflow-y-auto custom-scrollbar bg-slate-50/60 p-2 rounded-lg border border-purple-100 space-y-1">
                              {(() => {
                                const allTeachers = Array.from(
                                  new Set((timetableData?.teachers || []).map(t => t.teacherName).filter(Boolean))
                                ).sort((a, b) => a.localeCompare(b));

                                const filtered = allTeachers.filter(name => 
                                  !teacherSearchQuery.trim() || name.includes(teacherSearchQuery.trim())
                                );

                                if (filtered.length === 0) {
                                  return (
                                    <div className="text-center py-3 text-xs text-slate-500 space-y-1.5">
                                      <p>일치하는 교사가 없습니다.</p>
                                      {teacherSearchQuery.trim() && (
                                        <button
                                          type="button"
                                          onClick={() => handleAddTeacherToModalEvent(teacherSearchQuery)}
                                          className="inline-block px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 text-xs cursor-pointer shadow-2xs"
                                        >
                                          &apos;{teacherSearchQuery.trim()}&apos; 이름으로 직접 추가
                                        </button>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                    {filtered.map(name => {
                                      const isAssigned = modalEventTeachers.includes(name);
                                      return (
                                        <button
                                          key={name}
                                          type="button"
                                          onClick={() => {
                                            if (isAssigned) {
                                              handleRemoveTeacherFromModalEvent(name);
                                            } else {
                                              handleAddTeacherToModalEvent(name);
                                            }
                                          }}
                                          className={cn(
                                            "px-2 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-between cursor-pointer border",
                                            isAssigned
                                              ? "bg-purple-100 border-purple-300 text-purple-950 shadow-2xs"
                                              : "bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-200"
                                          )}
                                        >
                                          <span className="truncate">{name}</span>
                                          {isAssigned ? (
                                            <span className="text-[10px] text-purple-700 font-black shrink-0">✓</span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 font-normal shrink-0">+</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {/* 배정 라벨 및 태그 */}
                        {modalEventRoleLabel && (
                          <div className="flex items-center gap-1 text-xs font-bold text-purple-900 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                            <span>✨ {modalEventRoleLabel}</span>
                          </div>
                        )}

                        {modalEventTeachers.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar pt-0.5">
                            {modalEventTeachers.map(tName => (
                              <span
                                key={tName}
                                className="px-2 py-0.5 rounded-md bg-white border border-purple-200 text-xs font-bold text-purple-900 flex items-center gap-1 shadow-2xs"
                              >
                                {tName}
                                <button
                                  type="button"
                                  onClick={() => setModalEventTeachers(prev => prev.filter(t => t !== tName))}
                                  className="text-purple-400 hover:text-rose-600 font-black cursor-pointer text-xs ml-0.5"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 장소 */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">장소 (선택)</label>
                        <Input
                          placeholder="예: 대강당, 체육관, 시청각실, 교실"
                          value={modalEventLocation}
                          onChange={e => setModalEventLocation(e.target.value)}
                          className="h-10 text-xs bg-white border-slate-200 rounded-xl focus-visible:ring-purple-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. 우측 하단 액션 버튼 */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDayScheduleModal(null)}
                    className="h-9 px-4 text-xs font-bold text-slate-600 rounded-xl cursor-pointer border-slate-200 hover:bg-slate-100"
                  >
                    닫기
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveDaySchedule}
                    className={cn(
                      "h-9 px-5 text-xs font-bold text-white rounded-xl shadow-xs cursor-pointer gap-1.5",
                      editingScheduleId 
                        ? "bg-amber-600 hover:bg-amber-700" 
                        : "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    {editingScheduleId ? (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        <span>수정 내용 저장</span>
                      </>
                    ) : (
                      <span>등록 완료</span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
