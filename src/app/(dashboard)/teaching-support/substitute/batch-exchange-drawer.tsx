'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/batch-exchange-drawer.tsx
// 다교시 묶음 일괄 교체/보강 설정 서랍 (상대 교사 시간표 보며 직접 다교시 매칭)
// ==============================================================================

import * as React from 'react';
import { 
  SubstituteApplication, 
  SubstituteItem, 
  SubstituteType, 
  AvailableTeacher 
} from '@/lib/substitute/types';
import { ParsedTimetableResult, TimetableSlot } from '@/lib/timetable/parser';
import { 
  checkSubstituteItemConflict, 
  getAvailableTeachersForSlot, 
  getDayOfWeekFromDate,
  getUpcomingDateForDay,
  getAllPeriodsAvailableTeachers,
  MultiSlotAvailableTeacher,
  getSmartExchangeRecommendations,
  ExchangeRecommendation,
  getDateForDayInSameWeek,
  checkIsSameSubject,
  checkIsSameDept,
  isTeacherFreeOnDateAndPeriod,
  getEffectiveSlotForTeacher
} from '@/lib/substitute/validator';
import { SelectedSlotItem } from './interactive-teacher-timetable';
import { getClassDeptBadgeStyle } from '@/lib/timetable/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeftRight, 
  UserPlus, 
  Calendar, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  X, 
  User, 
  Layers, 
  Trash2,
  Search,
  CheckCheck,
  Send,
  SendHorizontal,
  Wand2,
  Check,
  Lock,
  ArrowRight,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  AcademicCalendarConfig, 
  DEFAULT_ACADEMIC_CALENDAR_2026_2 
} from '@/lib/substitute/event-types';
import { 
  generateSemesterWeeksFromConfig, 
  findCurrentWeekNum,
  getEventsForSlot,
  getClassEventsForSlot,
  getSpecialDaySchedule,
  getExamPeriodForDate,
  getExamSlotInfo,
  getVacationForDate,
  getInstructorAssignmentForSlot
} from '@/lib/substitute/event-helper';
import { SemesterWeek } from '@/lib/substitute/validator';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

interface BatchExchangeDrawerProps {
  selectedSlots: SelectedSlotItem[];
  initialMode?: SubstituteType;
  onClose: () => void;
  onSaveApplication: (app: SubstituteApplication, submitImmediately?: boolean) => Promise<void>;
  timetableData: ParsedTimetableResult;
  existingApplications: SubstituteApplication[];
  calendarConfig?: AcademicCalendarConfig;
  currentTeacherName: string;
}

const REASON_CATEGORIES = [
  '출장',
  '연가',
  '병가',
  '지각',
  '조퇴',
  '외출',
  '연수',
  '기타입력',
] as const;

export function BatchExchangeDrawer({
  selectedSlots,
  initialMode = 'exchange',
  onClose,
  onSaveApplication,
  timetableData,
  existingApplications,
  calendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
  currentTeacherName,
}: BatchExchangeDrawerProps) {
  const [batchMode, setBatchMode] = React.useState<SubstituteType>(initialMode);

  // 학기 주차 목록 생성
  const semesterWeeks = React.useMemo(() => {
    return generateSemesterWeeksFromConfig(calendarConfig);
  }, [calendarConfig]);

  // 신청 슬롯의 날짜에 해당하는 주차를 기본값으로 탐색
  const defaultWeekNum = React.useMemo(() => {
    const firstDate = selectedSlots[0]?.date;
    if (firstDate) {
      const match = semesterWeeks.find(w => w.startDate <= firstDate && w.endDate >= firstDate);
      if (match) return match.weekNum;
    }
    return findCurrentWeekNum(semesterWeeks);
  }, [selectedSlots, semesterWeeks]);

  const [selectedWeekNum, setSelectedWeekNum] = React.useState<number>(defaultWeekNum);

  React.useEffect(() => {
    setSelectedWeekNum(defaultWeekNum);
  }, [defaultWeekNum]);

  // 🌟 보강 모드에서는 신청 주차(defaultWeekNum)로 자동 고정, 교체 모드에서는 선택 주차 적용
  const activeWeekNum = batchMode === 'substitute' ? defaultWeekNum : selectedWeekNum;

  const selectedWeek: SemesterWeek = React.useMemo(() => {
    return semesterWeeks.find(w => w.weekNum === activeWeekNum) || semesterWeeks[0] || {
      weekNum: 1,
      label: '1주차',
      shortLabel: '1주차',
      dateRangeLabel: '',
      startDate: '',
      endDate: '',
      dates: {},
      monthDayLabels: {},
    };
  }, [semesterWeeks, activeWeekNum]);

  // 기준 요일
  const firstSlot = selectedSlots[0];
  const [baseDate, setBaseDate] = React.useState<string>(() => {
    return selectedSlots[0]?.date || getUpcomingDateForDay(firstSlot?.day || '월');
  });

  // 사유 구분 및 상세내용 상태
  const [reasonCategory, setReasonCategory] = React.useState<string>('출장');
  const [customCategory, setCustomCategory] = React.useState<string>('');
  const [reasonDetail, setReasonDetail] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // 일괄 교체 교사 및 보강 교사
  const [partnerTeacher, setPartnerTeacher] = React.useState<string>('');
  const [globalSubstituteTeacher, setGlobalSubstituteTeacher] = React.useState<string>('');
  const [partnerSearchQuery, setPartnerSearchQuery] = React.useState<string>('');

  // 개별 아이템 리스트 상태
  const [items, setItems] = React.useState<SubstituteItem[]>([]);

  // 주차 변경 핸들러
  const handleChangeWeekNum = (newWeekNum: number) => {
    const clamped = Math.max(1, Math.min(semesterWeeks.length, newWeekNum));
    setSelectedWeekNum(clamped);
    const targetW = semesterWeeks.find(w => w.weekNum === clamped);
    if (targetW) {
      if (batchMode === 'substitute') {
        // 🌟 보강 모드: 주차를 변경하면 보강 신청 대상 일자(sourceDate)가 선택된 주차의 요일 날짜로 동기화됨
        setItems(prev => prev.map(item => ({
          ...item,
          sourceDate: targetW.dates[item.sourceDay] || item.sourceDate,
        })));
      } else {
        // 🌟 교체 모드: 신청자의 원래 수업 일자(sourceDate)는 고정하고, 상대방 교체 매칭만 초기화
        setItems(prev => prev.map(item => ({
          ...item,
          targetDate: undefined,
          targetDay: undefined,
          targetPeriod: undefined,
          targetSubject: undefined,
          targetClass: undefined,
          targetTeacher: undefined,
        })));
      }
    }
  };
  React.useEffect(() => {
    const curMode = initialMode || 'exchange';
    setBatchMode(curMode);

    const initialItems: SubstituteItem[] = selectedSlots.map(s => {
      const slotDate = s.date || getUpcomingDateForDay(s.day);
      const avail = getAvailableTeachersForSlot(
        slotDate,
        s.period,
        timetableData,
        existingApplications,
        s.slot.deptName,
        undefined,
        undefined,
        undefined,
        calendarConfig
      );
      return {
        id: `batch-${Date.now()}-${s.day}-${s.period}-${Math.random().toString(36).slice(2, 6)}`,
        sourceDate: slotDate,
        sourceDay: s.day,
        sourcePeriod: s.period,
        deptName: s.slot.deptName || '전문교과',
        classCode: s.slot.classCode || '',
        subjectName: s.slot.subjectName || '',
        originalTeacher: currentTeacherName,
        type: curMode,
        substituteTeacher: '',
        targetDate: slotDate,
        targetDay: s.day,
        targetPeriod: s.period,
        targetTeacher: '',
        targetSubject: '',
        targetClass: '',
      };
    });
    setItems(initialItems);
    setBaseDate(selectedSlots[0]?.date || getUpcomingDateForDay(selectedSlots[0]?.day || '월'));
  }, [selectedSlots, initialMode, timetableData, existingApplications, currentTeacherName]);

  // 개별 아이템 업데이트
  const updateItem = (id: string, updates: Partial<SubstituteItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  };

  // 교사 객체 탐색
  const currentTeacher = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === currentTeacherName);
  }, [timetableData.teachers, currentTeacherName]);
  // 교체 상대 교사 요약
  const partnerTeacherSummary = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === partnerTeacher);
  }, [timetableData.teachers, partnerTeacher]);

  // 날짜별 바쁜 교사 맵
  const busyTeachersOnDate = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    existingApplications.forEach(app => {
      if (app.status !== 'rejected') {
        app.items.forEach(it => {
          if (it.type === 'substitute' && it.substituteTeacher) {
            const key = `${it.sourceDate}_${it.sourcePeriod}`;
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(it.substituteTeacher);
          }
          if (it.type === 'exchange' && it.targetTeacher && it.targetDate && it.targetPeriod) {
            const key = `${it.targetDate}_${it.targetPeriod}`;
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(it.targetTeacher);
          }
        });
      }
    });
    return map;
  }, [existingApplications]);

  // 보강 모드 추천 교사 랭킹 (신청 교시 중 보강 가능한 시수가 많은 순서대로 1~5순위)
  const topSubstituteRecommendations = React.useMemo(() => {
    if (items.length === 0) return [];

    const targetClassCodes = new Set(items.map(i => i.classCode).filter(Boolean));
    const targetDept = items[0]?.deptName;

    const list: {
      teacherName: string;
      subjectGroup?: string;
      homeroomClass?: string;
      isSameSubject: boolean;
      isSameDept: boolean;
      hasSameClassExp: boolean;
      availableCoverCount: number;
      weeklyClassCount: number;
      score: number;
    }[] = [];

    timetableData.teachers.forEach(t => {
      if (t.teacherName === currentTeacherName) return;

      // 1. 신청 교시 중 공강(보강 가능) 교시 수 카운트 (학교 행사·학사일정·결보강 100% 반영)
      const availableCoverCount = items.filter(it => {
        return isTeacherFreeOnDateAndPeriod(
          t.teacherName,
          it.sourceDate,
          it.sourcePeriod,
          timetableData,
          existingApplications,
          undefined,
          calendarConfig
        );
      }).length;

      // 🌟 [핵심] 신청된 모든 교시에 수업/행사 충돌 없이 100% 공강인 교사만 추천!
      // (단 1교시라도 수업불가/충돌이 있으면 추천 보강 교사 목록에서 완전히 배제)
      if (availableCoverCount < items.length) return;

      // 2. 동교과(subjectGroup 일치) 및 동일 학과/계열 여부 판별
      const isSameSubject = Boolean(
        currentTeacher?.subjectGroup && t.subjectGroup && currentTeacher.subjectGroup === t.subjectGroup
      );

      const isSameDept = Boolean(
        isSameSubject ||
        (targetDept && (
          (t.subjectGroup && targetDept.includes(t.subjectGroup)) ||
          t.remarks?.includes(targetDept) || 
          t.homeroomClass?.includes(targetDept.charAt(0))
        ))
      );

      // 3. 동일 학반 수업 경험
      let sameClassSlots = 0;
      let weeklySlots = 0;
      DAYS.forEach(d => {
        for (let p = 1; p <= 7; p++) {
          const sl = t.slots[`${d}_${p}`];
          if (sl && sl.subjectName && sl.subjectName !== '-' && sl.subjectName !== '공강') {
            weeklySlots++;
            if (targetClassCodes.has(sl.classCode || '')) {
              sameClassSlots++;
            }
          }
        }
      });

      const hasSameClassExp = sameClassSlots > 0;

      let score = availableCoverCount * 100;
      if (availableCoverCount === items.length) score += 200; // 전 교시 가능 시 가산점
      if (isSameSubject) score += 500; // [규정 최우선] 동교과 교사 대폭 가산점!
      else if (isSameDept) score += 150;
      if (hasSameClassExp) score += 50;
      score += (35 - weeklySlots) * 2;

      list.push({
        teacherName: t.teacherName,
        subjectGroup: t.subjectGroup,
        homeroomClass: t.homeroomClass,
        isSameSubject,
        isSameDept,
        hasSameClassExp,
        availableCoverCount,
        weeklyClassCount: weeklySlots,
        score,
      });
    });

    // 1순위: 보강 가능 시간 많은 순 -> 2순위: 동교과 교사 우선 -> 3순위: 종합 스코어 높은 순
    return list.sort((a, b) => 
      b.availableCoverCount - a.availableCoverCount || 
      (b.isSameSubject ? 1 : 0) - (a.isSameSubject ? 1 : 0) || 
      b.score - a.score || 
      a.weeklyClassCount - b.weeklyClassCount
    );
  }, [items, timetableData, currentTeacher, currentTeacherName, existingApplications, calendarConfig]);

  // 보강 담당 교사 요약
  const substituteTeacherSummary = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === globalSubstituteTeacher);
  }, [timetableData.teachers, globalSubstituteTeacher]);

  // 현재 선택된 보강 교사의 보강 가능 교시 수
  const currentSubAvailableCount = React.useMemo(() => {
    if (!substituteTeacherSummary || !globalSubstituteTeacher) return 0;
    return items.filter(it => {
      return isTeacherFreeOnDateAndPeriod(
        globalSubstituteTeacher,
        it.sourceDate,
        it.sourcePeriod,
        timetableData,
        existingApplications,
        undefined,
        calendarConfig
      );
    }).length;
  }, [items, substituteTeacherSummary, globalSubstituteTeacher, timetableData, existingApplications, calendarConfig]);

  const handleSelectSubstituteTeacher = (name: string) => {
    setGlobalSubstituteTeacher(name);
    setItems(prev => prev.map(it => ({ ...it, type: 'substitute', substituteTeacher: name })));
  };

  const handleClearSubstituteTeacher = () => {
    setGlobalSubstituteTeacher('');
    setItems(prev => prev.map(it => ({ ...it, type: 'substitute', substituteTeacher: '' })));
  };

  // 검색 필터링된 파트너 교사 목록
  const filteredPartnerTeachers = React.useMemo(() => {
    const list = timetableData.teachers.filter(t => t.teacherName !== currentTeacherName);
    if (!partnerSearchQuery.trim()) return list;
    const q = partnerSearchQuery.trim().toLowerCase();
    return list.filter(t => 
      t.teacherName.toLowerCase().includes(q) ||
      (t.homeroomClass && t.homeroomClass.toLowerCase().includes(q))
    );
  }, [timetableData.teachers, currentTeacherName, partnerSearchQuery]);

  // 선택된 모든 교시 슬롯에 대해 동시 공강 교사 계산 (학사일정·휴업일·행사 100% 반영)
  const allSlotCandidates = React.useMemo(() => {
    return getAllPeriodsAvailableTeachers(
      items.map(it => ({ date: it.sourceDate, period: it.sourcePeriod, day: it.sourceDay, deptName: it.deptName })),
      timetableData,
      existingApplications,
      currentTeacherName,
      items[0]?.deptName,
      calendarConfig
    );
  }, [items, timetableData, existingApplications, currentTeacherName, calendarConfig]);

  // 각 아이템별 스마트 맞교환 추천 맵
  const itemRecommendationsMap = React.useMemo(() => {
    const map = new Map<string, ExchangeRecommendation[]>();
    items.forEach(it => {
      const recs = getSmartExchangeRecommendations(
        it.sourceDate,
        it.sourcePeriod,
        { classCode: it.classCode, subjectName: it.subjectName, deptName: it.deptName, sourceDay: it.sourceDay },
        currentTeacherName,
        timetableData,
        existingApplications,
        calendarConfig
      );
      map.set(it.id, recs);
    });
    return map;
  }, [items, currentTeacherName, timetableData, existingApplications, calendarConfig]);

  // 다교시 일괄 맞교환 파트너 교사 정밀 판별 & 랭킹 (오직 동일 학반 SAME_CLASS 맞교환만 추천 및 허용!)
  // 🌟 추천 순위: 동일교과(1순위) > 동일학과(2순위) > 동일학반 교체 가능 시수 많은 순 (선택된 주차 학사일정·결보강 100% 반영)
  const topPartnerRecommendations = React.useMemo(() => {
    if (items.length === 0) return [];

    const validPartners: {
      partnerTeacher: string;
      homeroomClass?: string;
      isSameSubject: boolean;
      isSameDept: boolean;
      isFreeOnAllSource: boolean;
      totalScore: number;
      bestClassMatch?: string;
      hasSameClass: boolean;
      sameClassCount: number;
      availableTargetSlotCount: number;
    }[] = [];

    const targetClassCodes = new Set(items.map(i => i.classCode).filter(Boolean));
    const firstItem = items[0];

    timetableData.teachers.forEach(partner => {
      if (partner.teacherName === currentTeacherName) return;

      // [필수 조건 1]: 파트너 교사는 신청자의 원래 수업 시간(선택된 주차 기준)에 100% 실시간 공강이어야만 함!
      const isFreeOnAllSource = items.every(it => {
        return isTeacherFreeOnDateAndPeriod(
          partner.teacherName,
          it.sourceDate,
          it.sourcePeriod,
          timetableData,
          existingApplications,
          undefined,
          calendarConfig
        );
      });

      if (!isFreeOnAllSource) return;

      let sameClassCount = 0;
      let bestClass: string | undefined;

      DAYS.forEach(d => {
        const targetDate = selectedWeek.dates[d] || getDateForDayInSameWeek(baseDate, d);

        // 🌟 1. 공휴일 / 재량휴업일 / 방학 등 휴업일인 경우 수업이 없으므로 교체 불가
        const vacation = getVacationForDate(targetDate, calendarConfig);
        if (vacation) return;

        for (let p = 1; p <= 7; p++) {
          // 🌟 2. 내가 targetDate, d, p에 실시간 공강인지 검사 (학사일정·행사·결보강 100% 반영)
          const isCurrentFree = isTeacherFreeOnDateAndPeriod(
            currentTeacherName,
            targetDate,
            p,
            timetableData,
            existingApplications,
            undefined,
            calendarConfig
          );
          if (!isCurrentFree) continue;

          // 🌟 3. 파트너 교사의 해당 시간 유효 수업 상태 (학사일정·행사·결보강 100% 반영)
          const pEff = getEffectiveSlotForTeacher(
            partner.teacherName,
            targetDate,
            p,
            timetableData,
            existingApplications,
            calendarConfig
          );
          // 수업이 없거나, 교사 직접 인솔 행사 중이거나, 학생 행사로 수업이 없어진 경우, 또는 시간강사 상시보강 수업인 경우 교체 불가!
          if (!pEff.hasClass || pEff.isTeacherEvent || pEff.isClassEventFree || pEff.isInstructorAssigned) continue;

          // 🌟 4. 지필평가/시험 중이거나 시험 후 하교인 경우 교체 불가
          const examInfo = getExamSlotInfo(targetDate, p, pEff.classCode, calendarConfig);
          if (examInfo?.isExamRunning || examInfo?.isDismissed) continue;

          // [필수 조건 2]: 오직 동일 학반 수업만 카운트! (타 학반 및 공강은 교체 불가)
          const isSameClass = targetClassCodes.has(pEff.classCode || '');
          if (isSameClass) {
            sameClassCount++;
            if (!bestClass) bestClass = pEff.classCode;
          }
        }
      });

      // 동일 학반 수업을 실제로 교체 가능한 선생님만 추천 대상에 진입!
      if (sameClassCount > 0) {
        const isSameSubject = checkIsSameSubject(firstItem?.subjectName, currentTeacher, partner);
        const isSameDept = checkIsSameDept(firstItem?.deptName, firstItem?.classCode, currentTeacher, partner);

        let partnerScore = sameClassCount * 10 + (isSameSubject ? 100 : 0) + (isSameDept ? 30 : 0);

        validPartners.push({
          partnerTeacher: partner.teacherName,
          homeroomClass: partner.homeroomClass,
          isSameSubject,
          isSameDept,
          isFreeOnAllSource,
          totalScore: partnerScore,
          bestClassMatch: bestClass,
          hasSameClass: true,
          sameClassCount,
          availableTargetSlotCount: sameClassCount,
        });
      }
    });

    // 🌟 정렬: 동일교과(1순위) -> 동일학과(2순위) -> 동일 학반 교체 가능 시수 많은 순 -> 가나다순
    return validPartners.sort((a, b) => {
      if (a.isSameSubject && !b.isSameSubject) return -1;
      if (!a.isSameSubject && b.isSameSubject) return 1;
      if (a.isSameDept && !b.isSameDept) return -1;
      if (!a.isSameDept && b.isSameDept) return 1;
      return b.availableTargetSlotCount - a.availableTargetSlotCount || a.partnerTeacher.localeCompare(b.partnerTeacher, 'ko');
    });
  }, [items, timetableData.teachers, currentTeacher, selectedWeek, selectedWeekNum, currentTeacherName, existingApplications, calendarConfig]);

  // 파트너 교사 변경 핸들러
  const handleSelectPartner = (teacherName: string) => {
    setPartnerTeacher(teacherName);
  };

  // 선택된 모든 교체 슬롯 및 교사 선택 초기화 / 선택 해제
  const handleClearAllSelectedSlots = () => {
    setPartnerTeacher('');
    setItems(prev => prev.map(it => ({
      ...it,
      targetDate: undefined,
      targetDay: undefined,
      targetPeriod: undefined,
      targetSubject: undefined,
      targetClass: undefined,
      targetTeacher: undefined,
    })));
  };

  // 특정 아이템 매칭 해제
  const handleRemoveMatchedSlot = (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? {
      ...it,
      targetDate: undefined,
      targetDay: undefined,
      targetPeriod: undefined,
      targetSubject: undefined,
      targetClass: undefined,
    } : it));
  };

  // 파트너 시간표 그리드에서 특정 셀 클릭 핸들러
  const handleGridSlotClick = (targetDate: string, day: string, period: number, partnerSubject?: string, partnerClass?: string) => {
    setItems(prev => {
      // 이미 이 슬롯이 할당된 아이템이 있는지 확인
      const existingIdx = prev.findIndex(it => it.targetDate === targetDate && it.targetPeriod === period && it.targetTeacher === partnerTeacher);

      if (existingIdx !== -1) {
        // 이미 선택된 슬롯 클릭 시 해제
        return prev.map((it, idx) => idx === existingIdx ? {
          ...it,
          targetDate: undefined,
          targetDay: undefined,
          targetPeriod: undefined,
          targetSubject: undefined,
          targetClass: undefined,
        } : it);
      }

      // 아직 타겟이 없는 첫 번째 아이템에 할당, 모두 채워져 있으면 첫 번째 아이템부터 덮어씀
      const targetIdx = prev.findIndex(it => !it.targetPeriod || !it.targetTeacher) !== -1
        ? prev.findIndex(it => !it.targetPeriod || !it.targetTeacher)
        : 0;

      return prev.map((it, idx) => idx === targetIdx ? {
        ...it,
        type: 'exchange',
        targetTeacher: partnerTeacher,
        targetDate,
        targetDay: day,
        targetPeriod: period,
        targetSubject: partnerSubject || '',
        targetClass: partnerClass || '',
      } : it);
    });
  };

  // 충돌 검사
  const conflicts = React.useMemo(() => {
    return items.map(it => {
      const res = checkSubstituteItemConflict(it, timetableData, existingApplications, undefined, calendarConfig);
      return { id: it.id, ...res };
    });
  }, [items, timetableData, existingApplications, calendarConfig]);

  const hasAnyConflict = conflicts.some(c => c.hasConflict);

  // 최종 저장 & 1장 통합 생성
  const handleSubmit = async (submitImmediately = true) => {
    const activeCategory = reasonCategory === '기타입력' ? customCategory.trim() : reasonCategory;
    if (!activeCategory) {
      alert('사유 구분을 선택하거나 직접 입력해 주세요.');
      return;
    }
    const finalReason = reasonDetail.trim() ? `${activeCategory} (${reasonDetail.trim()})` : activeCategory;

    if (items.length === 0) {
      alert('신청할 수업이 없습니다.');
      return;
    }
    for (const it of items) {
      if (it.type === 'substitute' && !it.substituteTeacher) {
        alert(`${it.sourceDay}요일 ${it.sourcePeriod}교시 보강 교사를 지정해 주세요.`);
        return;
      }
      if (it.type === 'exchange' && (!it.targetDate || !it.targetPeriod || !it.targetTeacher)) {
        alert(`${it.sourceDay}요일 ${it.sourcePeriod}교시 맞교환할 슬롯을 시간표에서 클릭해 주세요.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const appNumber = `CS-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const app: SubstituteApplication = {
        id: `app-${Date.now()}`,
        applicationNumber: appNumber,
        applicantTeacher: currentTeacherName,
        academicYear: timetableData.academicYear,
        semester: timetableData.semester,
        periodStart: items[0]?.sourceDate || baseDate,
        periodEnd: items[items.length - 1]?.sourceDate || baseDate,
        reason: finalReason,
        applicationDate: new Date().toISOString().split('T')[0],
        status: submitImmediately ? 'submitted' : 'draft',
        items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: submitImmediately ? new Date().toISOString() : undefined,
      };

      await onSaveApplication(app, submitImmediately);
      onClose();
    } catch (err: any) {
      alert(err.message || '신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (selectedSlots.length === 0) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] md:w-[720px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
      {/* 1. 상단 헤더 */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-white">
                수업 {batchMode === 'exchange' ? '교체' : '보강'} 신청
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-500 text-white">
                총 {items.length}개 수업
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {batchMode === 'exchange'
                ? '상대 선생님의 주간 시간표를 보며 원하는 시간대 슬롯을 클릭하여 맞바꿉니다.'
                : '보강을 담당해 주실 선생님의 주간 시간표를 확인하고 신청합니다.'}
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

      {/* 2. 스크롤 본문 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs text-slate-700">
        {/* 모드 선택 스위처 (교체 vs 보강) */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setBatchMode('exchange')}
            className={cn(
              "flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
              batchMode === 'exchange'
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            교체 ({items.length}건)
          </button>

          <button
            type="button"
            onClick={() => {
              setBatchMode('substitute');
              setItems(prev => prev.map(it => ({ ...it, type: 'substitute' })));
            }}
            className={cn(
              "flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
              batchMode === 'substitute'
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <UserPlus className="h-3.5 w-3.5" />
            보강 ({items.length}건)
          </button>
        </div>

        {/* 1) 신청 정보 요약 (내가 신청한 수업들) */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-400" />
              <strong className="text-xs">{currentTeacherName} 선생님 신청 수업:</strong>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {items.map(it => (
                <span key={it.id} className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/20 text-indigo-200 text-[11px] font-bold">
                  {it.sourceDay} {it.sourcePeriod}교시 ({it.classCode} {it.subjectName})
                </span>
              ))}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] text-slate-300 block">선택한 슬롯</span>
            <span className="text-sm font-black text-amber-400">
              {items.filter(i => i.targetTeacher && i.targetPeriod).length} / {items.length}개 매칭됨
            </span>
          </div>
        </div>

        {/* 2) 수업 교체 모드: 상대 교사 선택 & 시간표 그리드 매트릭스 */}
        {batchMode === 'exchange' ? (
          <div className="space-y-3 bg-gradient-to-b from-indigo-50/70 to-purple-50/40 p-4 rounded-2xl border border-indigo-200/80 shadow-2xs">
            {/* 상단 컨트롤: 상대 교사 선택 & 주차 선택기 & 선택 해제 버튼 (한 줄 1열 완벽 배치) */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0">
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs font-black text-indigo-950 shrink-0">
                  교체할 상대 선생님:
                </label>
                <Select value={partnerTeacher} onValueChange={handleSelectPartner}>
                  <SelectTrigger className="h-8.5 text-xs font-black bg-white border-indigo-300 rounded-xl text-slate-900 w-[140px] shrink-0">
                    <SelectValue placeholder="선생님 선택..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredPartnerTeachers.map(t => (
                      <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-bold">
                        <span>{t.teacherName} 선생님</span>
                        {t.homeroomClass && <span className="ml-1 text-[10px] text-indigo-600 font-bold">({t.homeroomClass})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 주차 네비게이터 & 선택기 (드롭다운과 선택해제 사이) */}
                <div className="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded-xl border border-indigo-200 shadow-2xs h-8.5 shrink-0">
                  <button
                    type="button"
                    disabled={selectedWeekNum <= 1}
                    onClick={() => handleChangeWeekNum(selectedWeekNum - 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-indigo-700"
                    title="이전 주차"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  <Select value={String(selectedWeekNum)} onValueChange={v => handleChangeWeekNum(Number(v))}>
                    <SelectTrigger className="h-6.5 text-[11px] font-black border-none shadow-none bg-transparent text-indigo-950 px-1 min-w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {semesterWeeks.map(w => (
                        <SelectItem key={w.weekNum} value={String(w.weekNum)} className="text-xs font-bold">
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    disabled={selectedWeekNum >= semesterWeeks.length}
                    onClick={() => handleChangeWeekNum(selectedWeekNum + 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-indigo-700"
                    title="다음 주차"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 선택 해제 버튼 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleClearAllSelectedSlots}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 border border-slate-300 shadow-2xs transition-all cursor-pointer h-8.5 shrink-0"
                  title="선택된 모든 교체 슬롯 초기화"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>선택 해제</span>
                </button>
              </div>
            </div>

            {/* AI 추천 교체 교사 칩 목록 */}
            {topPartnerRecommendations.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-indigo-200/60">
                <span className="text-[10.5px] font-bold text-slate-600 shrink-0">추천 교체 교사:</span>
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {topPartnerRecommendations.map((stat, idx) => (
                    <button
                      key={stat.partnerTeacher}
                      type="button"
                      onClick={() => handleSelectPartner(stat.partnerTeacher)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shrink-0 flex items-center gap-1 cursor-pointer",
                        partnerTeacher === stat.partnerTeacher
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-white text-slate-700 border-indigo-200 hover:bg-indigo-50 shadow-2xs"
                      )}
                    >
                      <span className="font-bold">{idx + 1}. {stat.partnerTeacher}</span>
                      {stat.isSameSubject ? (
                        <span className={cn(
                          "text-[8.5px] px-1 py-0.2 rounded font-black",
                          partnerTeacher === stat.partnerTeacher ? "bg-indigo-800 text-white" : "bg-blue-100 text-blue-800 border border-blue-200"
                        )}>
                          동일교과
                        </span>
                      ) : stat.isSameDept ? (
                        <span className={cn(
                          "text-[8.5px] px-1 py-0.2 rounded font-black",
                          partnerTeacher === stat.partnerTeacher ? "bg-indigo-800 text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        )}>
                          동일학과
                        </span>
                      ) : null}
                      <span className={cn(
                        "text-[9.5px] font-bold px-1 py-0.2 rounded",
                        partnerTeacher === stat.partnerTeacher ? "bg-indigo-700/60 text-indigo-100" : "bg-indigo-50 text-indigo-700"
                      )}>
                        ({stat.availableTargetSlotCount}시간)
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between">
                <span>현재 선택한 수업({items.map(i => `${i.sourceDay}${i.sourcePeriod}(${i.classCode})`).join(', ')})과 맞바꿀 수 있는 동일학반 선생님이 없습니다.</span>
                <button
                  type="button"
                  onClick={() => setBatchMode('substitute')}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-black shrink-0 ml-2 cursor-pointer"
                >
                  보강 모드로 전환 ➔
                </button>
              </div>
            )}

            {/* 3) 상대 선생님의 실제 5일 x 7교시 주간 시간표 매트릭스 그리드 */}
            {!partnerTeacher ? (
              <div className="p-6 rounded-2xl border border-dashed border-indigo-300 bg-white/80 text-center text-xs font-bold text-indigo-800 flex flex-col items-center justify-center gap-2 shadow-2xs py-8">
                <ArrowLeftRight className="h-7 w-7 text-indigo-600 animate-pulse" />
                <span className="text-sm font-black text-slate-900">교체 대상 선생님을 선택해 주세요</span>
                <span className="text-[11px] text-slate-500 font-medium max-w-sm">
                  위 추천 교사 칩을 클릭하거나 드롭다운/검색에서 선생님을 선택하시면 시간표와 맞교환 가능 슬롯이 표시됩니다.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11.5px] font-black text-indigo-950 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                      {partnerTeacher} 선생님 시간표 ({selectedWeek.label}):
                    </span>

                    <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      실시간 결보강 반영됨
                    </span>
                  </div>
                </div>

              {/* 시간표 테이블 */}
              <div className="overflow-x-auto rounded-xl border border-indigo-200/90 bg-white shadow-2xs">
                <table className="w-full table-fixed text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-indigo-50/80 border-b border-indigo-100 text-[11px] font-black text-indigo-950">
                      <th className="py-1.5 px-1 w-10 border-r border-indigo-100 text-slate-500 font-bold shrink-0">교시</th>
                      {DAYS.map(day => {
                        const dayDate = selectedWeek.dates[day] || getDateForDayInSameWeek(baseDate, day);
                        const vacation = getVacationForDate(dayDate, calendarConfig);
                        const exam = getExamPeriodForDate(dayDate, calendarConfig);
                        const specialDay = getSpecialDaySchedule(dayDate, calendarConfig);

                        return (
                          <th key={day} className="py-1.5 px-1 border-r border-indigo-100 last:border-r-0 w-[19%]">
                            <div className="flex flex-col items-center leading-tight">
                              <div className="flex items-center gap-1 flex-wrap justify-center">
                                <span>{specialDay && specialDay.targetDayOfWeek !== day ? `${day}(${specialDay.targetDayOfWeek})` : `${day}요일`}</span>
                                {vacation && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                                    🌴 {vacation.name}
                                  </span>
                                )}
                                {exam && !vacation && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                                    📝 시험
                                  </span>
                                )}
                                {specialDay && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold">
                                    🔄 {specialDay.targetDayOfWeek !== day ? `${specialDay.targetDayOfWeek}수업` : '교시변형'}
                                  </span>
                                )}
                              </div>
                              {dayDate && (
                                <span className="text-[9px] font-mono text-indigo-600/80 font-bold">
                                  {dayDate.slice(5).replace('-', '/')}
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map(period => {
                      return (
                        <tr key={period} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40">
                          <td className="py-1 px-1 text-[11px] font-black text-slate-600 bg-slate-50/80 border-r border-slate-100">
                            {period}
                          </td>
                          {DAYS.map(day => {
                            const targetDate = selectedWeek.dates[day] || getDateForDayInSameWeek(baseDate, day);
                            const vacation = getVacationForDate(targetDate, calendarConfig);
                            const isHoliday = Boolean(vacation);
                            const specialDay = getSpecialDaySchedule(targetDate, calendarConfig);
                            const effectiveDay = specialDay ? specialDay.targetDayOfWeek : day;
                            const effectivePeriod = specialDay?.periodOverrides?.[period] ?? period;

                            // 1) 파트너 교사의 실시간 유효 슬롯 분석 (교체/보강 및 학사일정 100% 반영)
                            const pEffective = getEffectiveSlotForTeacher(
                              partnerTeacher,
                              targetDate,
                              period,
                              timetableData,
                              existingApplications,
                              calendarConfig
                            );
                            const pHasClass = pEffective.hasClass;

                            // 지필평가 / 시험 기간 검사
                            const examInfo = getExamSlotInfo(targetDate, period, pEffective?.classCode, calendarConfig);
                            const isExamRunning = Boolean(examInfo?.isExamRunning);
                            const isExamDismissed = Boolean(examInfo?.isDismissed);

                            // 단축수업으로 인한 수업 없음 검사
                            const isShortenedDismissed = Boolean(specialDay?.shortenedPeriods && period > specialDay.shortenedPeriods);

                            // 이 슬롯이 현재 선택된 슬롯인지 확인
                            const matchedItemIdx = items.findIndex(it => 
                              it.targetDate === targetDate && 
                              it.targetPeriod === period && 
                              it.targetTeacher === partnerTeacher
                            );
                            const isSelected = matchedItemIdx !== -1;

                            // 학교 행사 / 학사일정 검사 (교사가 직접 인솔하는 행사만 pHasTeacherEvent)
                            const pTeacherEvents = getEventsForSlot(targetDate, period, pEffective?.classCode, partnerTeacher, calendarConfig);
                            const pHasTeacherEvent = pTeacherEvents.length > 0;
                            const mainTeacherEvent = pTeacherEvents[0];

                            // 2) 신청자 본인이 해당 targetDate, period에 실제로 공강인지 검사
                            const isMyFreeAtTarget = isTeacherFreeOnDateAndPeriod(
                              currentTeacherName,
                              targetDate,
                              period,
                              timetableData,
                              existingApplications,
                              undefined,
                              calendarConfig
                            );
                            const myHasConflict = !isMyFreeAtTarget;
                            const myEvents = getEventsForSlot(targetDate, period, undefined, currentTeacherName, calendarConfig);
                            const myHasEvent = myEvents.length > 0;
                            
                            const isInstructorAssigned = Boolean(pEffective.isInstructorAssigned);
                            const isCalendarBlocked = isHoliday || myHasEvent || isExamRunning || isExamDismissed || isShortenedDismissed || isInstructorAssigned;
                            const isSameClass = pHasClass && items.some(i => i.classCode && pEffective?.classCode === i.classCode);
                            const isClickable = !myHasConflict && !isCalendarBlocked && isSameClass;

                            return (
                              <td key={`${day}_${period}`} className="p-0.5 border-r border-slate-100 last:border-r-0 align-middle">
                                <button
                                  type="button"
                                  disabled={!isClickable && !isSelected}
                                  onClick={() => {
                                    if (isClickable || isSelected) {
                                      handleGridSlotClick(targetDate, day, period, pEffective?.subjectName, pEffective?.classCode);
                                    }
                                  }}
                                  className={cn(
                                    "w-full h-11 p-1 rounded-lg border text-left transition-all flex flex-col justify-between select-none relative",
                                    isSelected
                                      ? "bg-indigo-600 text-white border-indigo-600 font-bold ring-2 ring-indigo-600/40 shadow-xs z-10 cursor-pointer"
                                      : isHoliday
                                      ? "bg-rose-50/70 text-rose-700 border-rose-200 cursor-not-allowed opacity-60"
                                      : isExamRunning
                                      ? "bg-rose-50 text-rose-900 border-rose-200 cursor-not-allowed opacity-80"
                                      : isExamDismissed
                                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50"
                                      : isInstructorAssigned
                                      ? "bg-purple-50/80 text-purple-900 border-purple-300 cursor-not-allowed opacity-80"
                                      : pHasTeacherEvent
                                      ? "bg-purple-50 text-purple-950 border-purple-300 hover:border-purple-500 shadow-2xs cursor-pointer"
                                      : pEffective.isClassEventFree
                                      ? "bg-amber-50/60 text-amber-800 border-amber-200 border-dashed cursor-not-allowed opacity-75"
                                      : myHasConflict
                                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-40"
                                      : isSameClass
                                      ? "bg-indigo-50 text-indigo-950 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-100 shadow-2xs cursor-pointer font-bold"
                                      : "bg-slate-100/60 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-40"
                                  )}
                                  title={
                                    isHoliday
                                      ? `[휴업일/공휴일] ${vacation?.name || '휴업일'} - 교체 불가`
                                      : isExamRunning
                                      ? `[시험 진행] ${examInfo?.exam.name} - 교체 불가`
                                      : isExamDismissed
                                      ? `[시험 후 하교] 수업 없음 - 교체 불가`
                                      : isInstructorAssigned
                                      ? `[시간강사 보강완료 🔒] ${pEffective.instructorName || '시간강사'} 선생님 상시보강 수업 - 맞교환 불가`
                                      : pHasTeacherEvent
                                      ? `[행사 진행] ${mainTeacherEvent?.title} (${mainTeacherEvent?.description || '학사일정 행사 인솔'})`
                                      : pEffective.isClassEventFree
                                      ? `[학급 행사로 수업 없음] ${pEffective.classCode} 학급 학생들이 '${pEffective.eventTitle}' 행사에 참여하여 수업이 없습니다 (공강)`
                                      : myHasConflict
                                      ? `본인 수업 있음 - 맞교환 불가`
                                      : isSameClass
                                      ? (pEffective.isExchangeIn ? `★ 동일학반 (${pEffective.classCode}) 재교체 가능` : `★ 동일학반 (${pEffective.classCode}) 맞교환 가능`)
                                      : !pHasClass
                                      ? '공강 (수업 교체는 공강과 맞바꿀 수 없음 - 보강 모드를 이용하세요)'
                                      : `학반 불일치 (${pEffective?.classCode} 수업 - 동일학반(${items[0]?.classCode || ''})만 교체 가능)`
                                  }
                                >
                                  {/* 상단: 과목 / 선택 번호 뱃지 */}
                                  <div className="flex items-center justify-between w-full">
                                    <span className={cn(
                                      "text-[10px] font-black truncate max-w-[65px] leading-tight",
                                      isSelected 
                                        ? "text-white" 
                                        : isHoliday
                                        ? "text-rose-700"
                                        : isInstructorAssigned
                                        ? "text-purple-900"
                                        : pHasTeacherEvent
                                        ? "text-purple-900"
                                        : pEffective.isClassEventFree
                                        ? "text-amber-800"
                                        : ""
                                    )}>
                                      {isHoliday
                                        ? `[${vacation?.name || '휴업일'}]`
                                        : isInstructorAssigned
                                        ? `🔒 ${pEffective.instructorName ? `${pEffective.instructorName}(강사)` : '강사수업'}`
                                        : pHasTeacherEvent
                                        ? `🎭 ${mainTeacherEvent?.title}`
                                        : pEffective.isExchangeIn
                                        ? `🔄 ${pEffective.subjectName}`
                                        : pEffective.isClassEventFree
                                        ? `공강 (${pEffective.eventTitle})`
                                        : pEffective.subjectName || '공강'}
                                    </span>

                                    {/* 매칭된 아이템 순번 뱃지 */}
                                    {isSelected && (
                                      <span className="w-3.5 h-3.5 rounded-full bg-white text-indigo-700 text-[9px] font-black flex items-center justify-center shrink-0">
                                        {matchedItemIdx + 1}
                                      </span>
                                    )}
                                  </div>

                                  {/* 하단: 학반 뱃지 또는 추천 태그 */}
                                  <div className="flex items-center justify-between w-full text-[9px] leading-tight">
                                    {pEffective.classCode ? (
                                      <span className={cn(
                                        "px-1 py-0.2 rounded font-black",
                                        isSelected 
                                          ? "bg-white/20 text-white" 
                                          : isSameClass 
                                          ? "bg-indigo-200 text-indigo-900" 
                                          : "bg-slate-200 text-slate-800"
                                      )}>
                                        {pEffective.classCode}
                                      </span>
                                    ) : (
                                      <span className={cn(
                                        "text-[8.5px]",
                                        isSelected ? "text-indigo-200" : "text-slate-400"
                                      )}>
                                        -
                                      </span>
                                    )}

                                    {isSameClass && !isSelected && (
                                      <span className="text-[8.5px] font-black text-indigo-700">
                                        {pEffective.isExchangeIn ? '★재교체' : '★추천'}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

            {/* 4) 선택된 매칭 결과 요약 바 (Before ➔ After 매핑) */}
            <div className="space-y-1.5 pt-2 border-t border-indigo-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">
                  교체 매칭 요약 ({items.filter(i => i.targetTeacher && i.targetPeriod).length} / {items.length}개 완료)
                </span>
                <span className="text-[11px] text-slate-500">
                  위 시간표에서 원하는 상대 수업을 클릭하면 1:1로 자동 연결됩니다.
                </span>
              </div>

              <div className="space-y-1.5">
                {items.map((it, idx) => {
                  const isMatched = Boolean(it.targetTeacher && it.targetPeriod && it.targetDate);
                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all",
                        isMatched
                          ? "bg-indigo-50/70 border-indigo-300 text-indigo-950 font-medium"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-black text-slate-900">
                          내 수업: {it.sourceDate} {it.sourceDay} {it.sourcePeriod}교시 ({it.classCode} {it.subjectName})
                        </span>
                      </div>

                      {isMatched ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-200 flex items-center gap-1">
                            <ArrowRight className="h-3 w-3 text-indigo-500" />
                            {it.targetTeacher} 선생님: {it.targetDate} {it.targetDay} {it.targetPeriod}교시 ({it.targetClass} {it.targetSubject})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMatchedSlot(it.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="이 매칭 해제"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-rose-500 font-bold text-[11px]">
                          위 시간표에서 슬롯을 클릭하세요
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* 보강 모드: 보강 교사 추천 & 시간표 그리드 매트릭스 */
          <div className="space-y-3 bg-gradient-to-b from-emerald-50/70 to-teal-50/40 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs">
            {/* 상단 컨트롤: 보강 선생님 선택 & 주간 수업 정보 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-emerald-950 shrink-0">
                  보강 담당 선생님:
                </label>
                <Select value={globalSubstituteTeacher} onValueChange={handleSelectSubstituteTeacher}>
                  <SelectTrigger className="h-8.5 text-xs font-black bg-white border-emerald-300 rounded-xl text-slate-900 min-w-[150px]">
                    <SelectValue placeholder="보강 교사 선택..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {topSubstituteRecommendations.map(t => (
                      <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-bold">
                        <span>{t.teacherName} 선생님</span>
                        {t.homeroomClass && <span className="ml-1 text-[10px] text-emerald-600 font-bold">({t.homeroomClass})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 보강 교사 선택 해제 버튼 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleClearSubstituteTeacher}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 border border-slate-300 shadow-2xs transition-all cursor-pointer"
                  title="선택된 보강 교사 초기화"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>선택 해제</span>
                </button>
              </div>
            </div>

            {/* 추천 보강 교사 칩 목록 */}
            {topSubstituteRecommendations.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-emerald-200/60">
                <span className="text-[10.5px] font-bold text-slate-600 shrink-0">추천 보강 교사:</span>
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {topSubstituteRecommendations.slice(0, 6).map((stat, idx) => (
                    <button
                      key={stat.teacherName}
                      type="button"
                      onClick={() => handleSelectSubstituteTeacher(stat.teacherName)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                        globalSubstituteTeacher === stat.teacherName
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-white text-slate-700 border-emerald-200 hover:bg-emerald-50 shadow-2xs"
                      )}
                    >
                      <span className="font-bold">{idx + 1}. {stat.teacherName}</span>
                      {stat.isSameSubject ? (
                        <span className={cn(
                          "text-[8.5px] px-1.5 py-0.2 rounded font-black",
                          globalSubstituteTeacher === stat.teacherName ? "bg-emerald-700 text-white" : "bg-blue-100 text-blue-800 border border-blue-200"
                        )}>
                          동일교과
                        </span>
                      ) : stat.isSameDept ? (
                        <span className={cn(
                          "text-[8.5px] px-1.5 py-0.2 rounded font-black",
                          globalSubstituteTeacher === stat.teacherName ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        )}>
                          동일학과
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 보강 선생님 주간 시간표 그리드 (신청 주차로 고정) */}
            {!globalSubstituteTeacher ? (
              <div className="p-6 rounded-2xl border border-dashed border-emerald-300 bg-white/80 text-center text-xs font-bold text-emerald-800 flex flex-col items-center justify-center gap-2 shadow-2xs py-8">
                <UserPlus className="h-7 w-7 text-emerald-600 animate-pulse" />
                <span className="text-sm font-black text-slate-900">보강 담당 선생님을 선택해 주세요</span>
                <span className="text-[11px] text-slate-500 font-medium max-w-sm">
                  위 추천 보강 교사 칩을 클릭하거나 드롭다운에서 선생님을 선택하시면 시간표와 보강 배정이 확정됩니다.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11.5px] font-black text-emerald-950 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      {globalSubstituteTeacher} 선생님 시간표:
                    </span>

                    {/* 신청 주차 뱃지 (이미지 디자인 적용) */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-emerald-300 text-emerald-950 text-xs font-bold shadow-2xs">
                      <span>🗓️</span>
                      <span className="font-extrabold">신청 주차:</span>
                      <span className="font-black text-emerald-900">{selectedWeek.label}</span>
                    </div>

                    <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      실시간 결보강 반영됨
                    </span>
                  </div>
                </div>

                {/* 시간표 테이블 */}
                <div className="overflow-x-auto rounded-xl border border-emerald-200/90 bg-white shadow-2xs">
                  <table className="w-full table-fixed text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-50/80 border-b border-emerald-100 text-[11px] font-black text-emerald-950">
                        <th className="py-1.5 px-1 w-10 border-r border-emerald-100 text-slate-500 font-bold shrink-0">교시</th>
                        {DAYS.map(day => {
                          const dayDate = selectedWeek.dates[day] || getDateForDayInSameWeek(baseDate, day);
                          const vacation = getVacationForDate(dayDate, calendarConfig);
                          const exam = getExamPeriodForDate(dayDate, calendarConfig);
                          const specialDay = getSpecialDaySchedule(dayDate, calendarConfig);

                          return (
                            <th key={day} className="py-1.5 px-1 border-r border-emerald-100 last:border-r-0 w-[19%]">
                              <div className="flex flex-col items-center leading-tight">
                                <div className="flex items-center gap-1 flex-wrap justify-center">
                                  <span>{specialDay && specialDay.targetDayOfWeek !== day ? `${day}(${specialDay.targetDayOfWeek})` : `${day}요일`}</span>
                                  {vacation && (
                                    <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                                      🌴 {vacation.name}
                                    </span>
                                  )}
                                  {exam && !vacation && (
                                    <span className="text-[8px] px-1 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                                      📝 시험
                                    </span>
                                  )}
                                  {specialDay && (
                                    <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold">
                                      🔄 {specialDay.targetDayOfWeek !== day ? `${specialDay.targetDayOfWeek}수업` : '교시변형'}
                                    </span>
                                  )}
                                </div>
                                {dayDate && (
                                  <span className="text-[9px] font-medium text-emerald-600/80 font-bold">
                                    {dayDate.slice(5).replace('-', '/')}
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map(period => {
                        return (
                          <tr key={period} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40">
                            <td className="py-1 px-1 text-[11px] font-black text-slate-600 bg-slate-50/80 border-r border-slate-100">
                              {period}
                            </td>
                            {DAYS.map(day => {
                              const targetDate = selectedWeek.dates[day] || getDateForDayInSameWeek(baseDate, day);
                              const vacation = getVacationForDate(targetDate, calendarConfig);
                              const isHoliday = Boolean(vacation);
                              const specialDay = getSpecialDaySchedule(targetDate, calendarConfig);
                              const effectiveDay = specialDay ? specialDay.targetDayOfWeek : day;
                              const effectivePeriod = specialDay?.periodOverrides?.[period] ?? period;

                              const slot = substituteTeacherSummary?.slots[`${effectiveDay}_${effectivePeriod}`];
                              const hasClass = Boolean(slot && slot.subjectName && slot.subjectName.trim() !== '' && slot.subjectName !== '-' && slot.subjectName !== '공강');
                              
                              // 지필평가/시험 기간 검사
                              const examInfo = getExamSlotInfo(targetDate, period, slot?.classCode, calendarConfig);
                              const isExamRunning = Boolean(examInfo?.isExamRunning);
                              const isExamDismissed = Boolean(examInfo?.isDismissed);

                              // 단축수업으로 인한 수업 없음 검사
                              const isShortenedDismissed = Boolean(specialDay?.shortenedPeriods && period > specialDay.shortenedPeriods);

                              // 학교 행사 검사
                              const subEvents = getEventsForSlot(targetDate, period, slot?.classCode, globalSubstituteTeacher, calendarConfig);
                              const subHasEvent = subEvents.length > 0;
                              const subMainEvent = subEvents[0];

                              // 학급 행사 검사
                              const subClassEvents = slot?.classCode ? getClassEventsForSlot(targetDate, period, slot.classCode, calendarConfig) : [];
                              const isClassEventRunning = subClassEvents.length > 0;

                              // 실시간 결보강 배정 검사
                              const subActiveApp = existingApplications.flatMap(a => a.items.map(it => ({ app: a, it }))).find(x => 
                                x.app.status !== 'rejected' && (
                                  (x.it.type === 'substitute' && x.it.substituteTeacher === globalSubstituteTeacher && x.it.sourceDate === targetDate && x.it.sourcePeriod === period) ||
                                  (x.it.type === 'exchange' && x.it.targetTeacher === globalSubstituteTeacher && x.it.targetDate === targetDate && x.it.targetPeriod === period) ||
                                  (x.it.originalTeacher === globalSubstituteTeacher && x.it.sourceDate === targetDate && x.it.sourcePeriod === period)
                                )
                              );
                              const isSubBusyWithApp = Boolean(subActiveApp);

                              // 시간강사 상시보강 검사
                              const subInstructor = globalSubstituteTeacher ? getInstructorAssignmentForSlot(
                                globalSubstituteTeacher,
                                day,
                                period,
                                slot?.classCode,
                                calendarConfig,
                                targetDate
                              ) : { isInstructorSlot: false };
                              const isSubInstructor = Boolean(subInstructor.isInstructorSlot);

                              // 이 슬롯이 신청된 보강 대상 슬롯인지 확인 (보강 교사 선택 시 해당 요일/교시 강조)
                              const isTargetSourceSlot = Boolean(globalSubstituteTeacher) && items.some(it => 
                                it.sourceDay === day && 
                                it.sourcePeriod === period && 
                                (it.sourceDate === targetDate || !it.sourceDate || !targetDate)
                              );

                              // 보강 대상 슬롯인데 행사/수업/결보강/시간강사로 충돌(불가)인지 확인
                              const isTargetSlotConflict = isTargetSourceSlot && (
                                isHoliday || isExamRunning || isSubBusyWithApp || subHasEvent || isSubInstructor || (hasClass && !isShortenedDismissed)
                              );

                              return (
                                <td key={`${day}_${period}`} className="p-0.5 border-r border-slate-100 last:border-r-0 align-middle">
                                  <div
                                    className={cn(
                                      "w-full h-11 p-1 rounded-lg border text-left flex flex-col justify-between select-none relative",
                                      isTargetSlotConflict
                                        ? "bg-rose-600 text-white border-rose-700 font-bold ring-2 ring-rose-500/40 shadow-xs"
                                        : isTargetSourceSlot
                                        ? "bg-emerald-600 text-white border-emerald-600 font-bold ring-2 ring-emerald-600/40 shadow-xs"
                                        : isHoliday
                                        ? "bg-rose-50/70 text-rose-700 border-rose-200"
                                        : isExamRunning
                                        ? "bg-rose-50 text-rose-900 border-rose-200"
                                        : isExamDismissed || isShortenedDismissed
                                        ? "bg-slate-100 text-slate-400 border-slate-200"
                                        : isSubInstructor
                                        ? "bg-purple-50 text-purple-900 border-purple-200"
                                        : isClassEventRunning
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : isSubBusyWithApp
                                        ? "bg-amber-50 text-amber-900 border-amber-300"
                                        : subHasEvent
                                        ? "bg-purple-50 text-purple-950 border-purple-300"
                                        : hasClass
                                        ? "bg-slate-100 text-slate-700 border-slate-200"
                                        : "bg-slate-50/50 text-slate-400 border-slate-100"
                                    )}
                                    title={
                                      isTargetSlotConflict
                                        ? `[보강 불가(충돌)] ${isSubInstructor ? `시간강사 상시보강(${subInstructor.instructorName})` : subHasEvent ? `학교 행사(${subMainEvent.title})` : hasClass ? `정규 수업(${slot?.subjectName})` : isSubBusyWithApp ? '기존 결보강 배정' : '시험/휴업'}으로 인해 보강 불가`
                                        : isHoliday
                                        ? `[휴업일/공휴일] ${vacation?.name || '휴업일'}`
                                        : isShortenedDismissed
                                        ? `[단축수업] ${specialDay?.shortenedPeriods}교시 단축으로 수업 없음`
                                        : isSubBusyWithApp
                                        ? `[실시간 결보강 배정됨] ${subActiveApp?.it.type === 'substitute' ? '수업보강' : '교체'} 투입됨`
                                        : isSubInstructor
                                        ? `[시간강사 보강 🔒] ${subInstructor.instructorName || '강사'} 선생님 상시보강 수업 - 보강 투입 불가`
                                        : subHasEvent
                                        ? `[학교 행사] ${subMainEvent.title} (${subMainEvent.description || ''})`
                                        : hasClass
                                        ? `[본인 수업] ${slot?.classCode} ${slot?.subjectName}`
                                        : '공강'
                                    }
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className={cn(
                                        "text-[10px] font-black truncate max-w-[65px] leading-tight",
                                        (isTargetSourceSlot || isTargetSlotConflict)
                                          ? "text-white" 
                                          : isHoliday
                                          ? "text-rose-700"
                                          : isSubBusyWithApp
                                          ? "text-amber-800"
                                          : isSubInstructor
                                          ? "text-purple-900"
                                          : subHasEvent
                                          ? "text-purple-900"
                                          : ""
                                      )}>
                                        {isTargetSlotConflict
                                          ? `⚠️불가(${isSubInstructor ? '강사' : subHasEvent ? '행사' : hasClass ? '수업' : '충돌'})`
                                          : isTargetSourceSlot 
                                          ? '★보강투입' 
                                          : isHoliday
                                          ? `[${vacation?.name || '휴업'}]`
                                          : isSubBusyWithApp
                                          ? (subActiveApp?.it.originalTeacher === globalSubstituteTeacher ? '[결강신청]' : `[${subActiveApp?.it.type === 'substitute' ? '보강투입' : '교체배정'}]`)
                                          : isSubInstructor
                                          ? `🔒 ${subInstructor.instructorName ? `${subInstructor.instructorName}(강사)` : '강사수업'}`
                                          : subHasEvent
                                          ? `🎭 ${subMainEvent.title}`
                                          : slot?.subjectName || '공강'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between w-full text-[9px]">
                                      <span className={cn(
                                        "font-medium truncate max-w-[45px]",
                                        (isTargetSourceSlot || isTargetSlotConflict) ? "text-white/90 font-bold" : "text-slate-500"
                                      )}>
                                        {isTargetSourceSlot 
                                          ? items.find(it => it.sourceDay === day && it.sourcePeriod === period)?.classCode 
                                          : isHoliday
                                          ? '휴업'
                                          : (slot?.classCode || (subHasEvent ? (substituteTeacherSummary?.homeroomClass || '-') : '-'))}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 보강 배정 요약 바 */}
            <div className="space-y-1.5 pt-2 border-t border-emerald-200/80">
              <span className="text-xs font-black text-slate-900 block">
                보강 배정 현황 ({items.length}개 수업 {globalSubstituteTeacher ? `➔ ${globalSubstituteTeacher} 선생님 배정` : '(미배정)'})
              </span>
              <div className="space-y-1.5">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-2 rounded-xl border border-emerald-200 bg-white flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <strong className="text-slate-900">{it.sourceDay} {it.sourcePeriod}교시</strong>
                      <span className="text-emerald-700 font-bold">[{it.classCode}]</span>
                      <span className="text-slate-600">{it.subjectName}</span>
                    </div>
                    {it.substituteTeacher || globalSubstituteTeacher ? (
                      <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-emerald-950 font-bold">
                        <span>보강: <strong>{it.substituteTeacher || globalSubstituteTeacher} 선생님</strong></span>
                      </div>
                    ) : (
                      <span className="text-rose-500 font-bold text-[11px]">선생님을 선택해 주세요</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3) 사유 입력 (2단 분할: 사유 구분 드롭다운 & 상세내용 직접입력) */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
          <label className="text-xs font-black text-slate-900 block">
            신청 사유
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* 왼쪽: 사유 구분 (드롭다운 + 기타입력 시 직접입력) */}
            <div className={cn(
              "space-y-1",
              reasonCategory === '기타입력' ? "sm:col-span-5" : "sm:col-span-4"
            )}>
              <span className="text-[11px] font-bold text-slate-500 block">사유 구분</span>
              <Select value={reasonCategory} onValueChange={setReasonCategory}>
                <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASON_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs font-bold">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {reasonCategory === '기타입력' && (
                <Input
                  placeholder="사유 구분 직접 입력"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  className="h-8.5 text-xs bg-white border-indigo-300 rounded-xl font-bold animate-in fade-in-50"
                  autoFocus
                />
              )}
            </div>

            {/* 오른쪽: 상세내용 직접 입력 */}
            <div className={cn(
              "space-y-1",
              reasonCategory === '기타입력' ? "sm:col-span-7" : "sm:col-span-8"
            )}>
              <span className="text-[11px] font-bold text-slate-500 block">상세내용 입력</span>
              <Input
                placeholder="상세내용을 입력하세요 (예: 전국기능경기대회 지도, 개인 사정 등)"
                value={reasonDetail}
                onChange={e => setReasonDetail(e.target.value)}
                className="h-9 text-xs bg-white border-slate-200 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* 4) 충돌 에러 안내 */}
        {hasAnyConflict && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold space-y-1">
            {conflicts.filter(c => c.hasConflict).map(c => (
              <p key={c.id} className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {c.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* 3. 하단 액션 바 */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-10 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
        >
          닫기
        </Button>

        <Button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || items.length === 0 || hasAnyConflict}
          className="h-10 px-5 text-xs font-black gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/30 flex-1 max-w-xs ml-auto"
        >
          <SendHorizontal className="h-4 w-4" />
          {isSubmitting ? '신청서 생성 중...' : '1장으로 묶어서 공식 신청서 생성'}
        </Button>
      </div>
    </div>
  );
}
