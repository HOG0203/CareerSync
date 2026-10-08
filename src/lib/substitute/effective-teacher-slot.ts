import type { TeacherTimetableSummary } from '@/lib/timetable/parser';
import type { SubstituteApplication } from '@/lib/substitute/types';
import type { AcademicCalendarConfig } from '@/lib/substitute/event-types';
import { getSpecialDaySchedule } from '@/lib/substitute/event-helper';

export function getEffectiveTeacherSlot(
  teacher: TeacherTimetableSummary | undefined,
  dateStr: string,
  period: number,
  dayOfWeek: string,
  existingApplications: SubstituteApplication[],
  calendarConfig?: AcademicCalendarConfig
): {
  hasClass: boolean;
  subjectName?: string;
  classCode?: string;
  deptName?: string;
  isExchangeIn?: boolean;
  isExchangeOut?: boolean;
  isTeachingSub?: boolean;
  isAbsenceSub?: boolean;
  partnerTeacher?: string;
  status?: 'approved' | 'submitted';
} {
  if (!teacher) return { hasClass: false };

  const specialDay = calendarConfig ? getSpecialDaySchedule(dateStr, calendarConfig) : null;
  const effectiveDayKey = specialDay ? specialDay.targetDayOfWeek : dayOfWeek;
  const effectivePeriod = specialDay?.periodOverrides?.[period] ?? period;

  const regularSlot = teacher.slots[`${effectiveDayKey}_${effectivePeriod}`];

  let hasRegularClass = Boolean(
    regularSlot && regularSlot.subjectName && regularSlot.subjectName.trim() !== '' && regularSlot.subjectName !== '-' && regularSlot.subjectName !== '공강'
  );
  if (specialDay?.shortenedPeriods && period > specialDay.shortenedPeriods) {
    hasRegularClass = false;
  }

  const teacherName = teacher.teacherName;
  const activeApps = existingApplications.filter(app => app.status !== 'rejected');

  let modification: {
    type: 'exchange_out' | 'exchange_in' | 'absence_substitute' | 'teaching_substitute';
    partnerTeacher: string;
    subjectName?: string;
    classCode?: string;
    deptName?: string;
    status: 'approved' | 'submitted';
  } | null = null;

  for (const app of activeApps) {
    const appStatus = app.status === 'approved' ? 'approved' : 'submitted';
    for (const it of app.items) {
      if (it.type === 'substitute') {
        if (it.originalTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
          modification = {
            type: 'absence_substitute',
            partnerTeacher: it.substituteTeacher || '보강교사',
            status: appStatus,
          };
        }
        if (it.substituteTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
          modification = {
            type: 'teaching_substitute',
            partnerTeacher: it.originalTeacher,
            subjectName: it.subjectName,
            classCode: it.classCode,
            deptName: it.deptName,
            status: appStatus,
          };
        }
      }
      if (it.type === 'exchange') {
        if (app.applicantTeacher === teacherName) {
          if (it.sourceDate === dateStr && it.sourcePeriod === period) {
            modification = {
              type: 'exchange_out',
              partnerTeacher: it.targetTeacher || '교체교사',
              status: appStatus,
            };
          }
          if (it.targetDate === dateStr && it.targetPeriod === period) {
            modification = {
              type: 'exchange_in',
              partnerTeacher: it.targetTeacher || '교체교사',
              subjectName: it.targetSubject || it.subjectName,
              classCode: it.classCode,
              deptName: it.deptName,
              status: appStatus,
            };
          }
        }
        if (it.targetTeacher === teacherName && app.applicantTeacher !== teacherName) {
          if (it.targetDate === dateStr && it.targetPeriod === period) {
            modification = {
              type: 'exchange_out',
              partnerTeacher: app.applicantTeacher,
              status: appStatus,
            };
          }
          if (it.sourceDate === dateStr && it.sourcePeriod === period) {
            modification = {
              type: 'exchange_in',
              partnerTeacher: app.applicantTeacher,
              subjectName: it.subjectName,
              classCode: it.classCode,
              deptName: it.deptName,
              status: appStatus,
            };
          }
        }
      }
    }
  }

  // 1) 교체받아 들어온 수업이거나 보강 수업 -> 수업 있음!
  if (modification && (modification.type === 'exchange_in' || modification.type === 'teaching_substitute')) {
    return {
      hasClass: true,
      subjectName: modification.subjectName || regularSlot?.subjectName || '교체수업',
      classCode: modification.classCode || regularSlot?.classCode || '',
      deptName: modification.deptName || regularSlot?.deptName || '',
      isExchangeIn: modification.type === 'exchange_in',
      isTeachingSub: modification.type === 'teaching_substitute',
      partnerTeacher: modification.partnerTeacher,
      status: modification.status,
    };
  }

  // 2) 교체 나간 수업 또는 결강 수업 -> 실제로 수업 없음(공강)!
  if (modification && (modification.type === 'exchange_out' || modification.type === 'absence_substitute')) {
    return {
      hasClass: false,
      subjectName: regularSlot?.subjectName,
      classCode: regularSlot?.classCode,
      deptName: regularSlot?.deptName,
      isExchangeOut: modification.type === 'exchange_out',
      isAbsenceSub: modification.type === 'absence_substitute',
      partnerTeacher: modification.partnerTeacher,
      status: modification.status,
    };
  }

  // 3) 일반 정규 수업
  return {
    hasClass: hasRegularClass,
    subjectName: regularSlot?.subjectName,
    classCode: regularSlot?.classCode,
    deptName: regularSlot?.deptName,
  };
}

