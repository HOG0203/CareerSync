// ==============================================================================
// src/lib/timetable/parser.ts
// 전체 교사 시간표 엑셀 파일 파서
// ==============================================================================

import * as xlsx from 'xlsx';
import { 
  DAYS_OF_WEEK, 
  parseClassCode, 
  getActivityInfo, 
  ActivityWeightConfig, 
  DEFAULT_ACTIVITY_WEIGHTS 
} from './constants';

export interface TimetableSlot {
  id: string;
  teacherName: string;
  homeroomClass: string;
  day: string; // '월', '화', '수', '목', '금'
  period: number; // 1 ~ 7
  subjectName: string;
  classCode: string;
  deptName: string;
  grade: number;
  classNum: number;
  weight: number;
  isActivity: boolean;
  activityType: string;
  isContinuous?: boolean;
}

export interface TeacherTimetableSummary {
  teacherName: string;
  subjectGroup?: string; // 교과군 (예: "국어", "수학", "섬유", "전기", "기계", "공간", "화공" 등)
  homeroomClass: string;
  rawPeriods: number; // 실제 수업 교시 수 (예: 16)
  weightedHours: number; // 가중치 반영 인정 시수 (예: 16.5)
  remarks: string;
  slots: Record<string, TimetableSlot>; // key: `${day}_${period}`
}

export interface ClassTimetableSummary {
  classCode: string;
  deptName: string;
  grade: number;
  classNum: number;
  displayName: string;
  homeroomTeacher: string;
  totalPeriods: number;
  slots: Record<string, TimetableSlot>; // key: `${day}_${period}`
}

export interface ParsedTimetableResult {
  academicYear: number;
  semester: number;
  title: string;
  effectiveDate: string;
  totalTeachers: number;
  totalClasses: number;
  totalSlots: number;
  teachers: TeacherTimetableSummary[];
  classes: ClassTimetableSummary[];
  allSlots: TimetableSlot[];
}

export function parseTimetableExcel(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  overrideYear?: number,
  overrideSemester?: number,
  customWeights?: ActivityWeightConfig
): ParsedTimetableResult {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0] || '전체 교사 시간표';
  const ws = wb.Sheets[sheetName];
  const rows: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (!rows || rows.length < 5) {
    throw new Error('시간표 엑셀 데이터가 올바르지 않거나 내용이 부족합니다.');
  }

  // 1. 헤더 분석 (학년도, 학기, 기준일자)
  const titleRow = String(rows[0]?.[0] || '');
  let academicYear = overrideYear || new Date().getFullYear();
  let semester = overrideSemester || 2;
  let effectiveDate = '';

  const yearMatch = titleRow.match(/(\d{4})\s*학년도/);
  if (yearMatch) academicYear = parseInt(yearMatch[1]);

  const semMatch = titleRow.match(/([12])\s*학기/);
  if (semMatch) semester = parseInt(semMatch[1]);

  const dateMatch = titleRow.match(/\(([^)]+)\)/);
  if (dateMatch) effectiveDate = dateMatch[1].trim();

  // 2. '교과' 컬럼 존재 여부 동적 감지 및 요일 컬럼 오프셋 계산
  const hasSubjectGroupCol = Boolean(
    rows[2] && (String(rows[2][1] || '').trim() === '교과' || String(rows[2][0] || '').trim() === '교과')
  );
  const teacherCol = hasSubjectGroupCol ? 2 : 1;
  const subjectGroupCol = hasSubjectGroupCol ? 1 : null;
  const colOffset = hasSubjectGroupCol ? 1 : 0;

  // 요일 및 교시 컬럼 매핑 (행 2: 요일, 행 3: 교시)
  const dayConfigs = [
    { name: '월', startCol: 2 + colOffset, periods: 7 },
    { name: '화', startCol: 9 + colOffset, periods: 7 },
    { name: '수', startCol: 16 + colOffset, periods: 6 },
    { name: '목', startCol: 22 + colOffset, periods: 6 },
    { name: '금', startCol: 28 + colOffset, periods: 6 },
  ];

  const teachersMap = new Map<string, TeacherTimetableSummary>();
  const classesMap = new Map<string, ClassTimetableSummary>();
  const allSlots: TimetableSlot[] = [];

  // 3. 교사 행 파싱 (Row 4부터 2행 단위)
  for (let r = 4; r < rows.length; r += 2) {
    const topRow = rows[r];
    const btmRow = rows[r + 1];

    if (!topRow || !topRow[teacherCol]) continue;

    const teacherName = String(topRow[teacherCol]).trim();
    if (!teacherName || teacherName === '교사' || teacherName === '합계') continue;

    const subjectGroup = subjectGroupCol !== null && topRow[subjectGroupCol] ? String(topRow[subjectGroupCol]).trim() : '';
    const homeroomClass = topRow[36 + colOffset] ? String(topRow[36 + colOffset]).trim() : '';
    const weeklyHours = topRow[34 + colOffset] ? Number(topRow[34 + colOffset]) : 0;
    const remarks = topRow[37 + colOffset] ? String(topRow[37 + colOffset]).trim() : '';

    const teacherSummary: TeacherTimetableSummary = {
      teacherName,
      subjectGroup,
      homeroomClass,
      rawPeriods: 0,
      weightedHours: 0,
      remarks,
      slots: {}
    };

    dayConfigs.forEach(d => {
      let prevSubject = '';
      let prevClass = '';

      for (let p = 1; p <= d.periods; p++) {
        const colIdx = d.startCol + (p - 1);
        let rawSubject = topRow[colIdx] ? String(topRow[colIdx]).trim() : '';
        let rawClass = btmRow && btmRow[colIdx] ? String(btmRow[colIdx]).trim() : '';

        // -- 및 -▷ (연속수업 / 블록타임) 감지 및 앞선 과목/학반 자동 상속
        const isSubjectCont = Boolean(
          rawSubject && (
            rawSubject.includes('▷') || 
            rawSubject.includes('▶') || 
            rawSubject.includes('->') || 
            rawSubject.includes('→') || 
            rawSubject === '--' || 
            rawSubject === '──' || 
            rawSubject === 'ㅡㅡ' || 
            rawSubject === 'ㅡ' || 
            rawSubject === '─' || 
            rawSubject === '-' || 
            rawSubject === '-▷' || 
            rawSubject === '─▷' || 
            rawSubject === '--▷' || 
            rawSubject === '──▷'
          )
        );

        const isClassCont = Boolean(
          rawClass && (
            rawClass.includes('▷') || 
            rawClass === '--' || 
            rawClass === '──' || 
            rawClass === 'ㅡㅡ' || 
            rawClass === 'ㅡ' || 
            rawClass === '─' || 
            rawClass === '-'
          )
        );

        const isContinuous = isSubjectCont || isClassCont;

        if (isContinuous) {
          rawSubject = prevSubject;
          if (!rawClass || isClassCont) rawClass = prevClass;
        } else {
          if (rawSubject) prevSubject = rawSubject;
          if (rawClass) prevClass = rawClass;
        }

        if (rawSubject || rawClass) {
          const classInfo = parseClassCode(rawClass);
          const actInfo = getActivityInfo(rawSubject, customWeights);

          const slot: TimetableSlot = {
            id: `${teacherName}_${d.name}_${p}`,
            teacherName,
            homeroomClass,
            day: d.name,
            period: p,
            subjectName: rawSubject,
            classCode: rawClass,
            deptName: classInfo.deptName,
            grade: classInfo.grade,
            classNum: classInfo.classNum,
            weight: actInfo.weight,
            isActivity: actInfo.isActivity,
            activityType: actInfo.type,
            isContinuous
          };

          teacherSummary.rawPeriods += 1;
          teacherSummary.weightedHours += actInfo.weight;
          teacherSummary.slots[`${d.name}_${p}`] = slot;
          allSlots.push(slot);

          // 학반별 역매핑 수집
          if (rawClass) {
            if (!classesMap.has(rawClass)) {
              classesMap.set(rawClass, {
                classCode: rawClass,
                deptName: classInfo.deptName,
                grade: classInfo.grade,
                classNum: classInfo.classNum,
                displayName: classInfo.displayName,
                homeroomTeacher: '',
                totalPeriods: 0,
                slots: {}
              });
            }

            const classSummary = classesMap.get(rawClass)!;
            classSummary.totalPeriods += 1;
            classSummary.slots[`${d.name}_${p}`] = slot;
          }
        }
      }
    });

    // 담임 교사 정보 학반에 연결
    if (homeroomClass) {
      if (!classesMap.has(homeroomClass)) {
        const classInfo = parseClassCode(homeroomClass);
        classesMap.set(homeroomClass, {
          classCode: homeroomClass,
          deptName: classInfo.deptName,
          grade: classInfo.grade,
          classNum: classInfo.classNum,
          displayName: classInfo.displayName,
          homeroomTeacher: teacherName,
          totalPeriods: 0,
          slots: {}
        });
      } else {
        classesMap.get(homeroomClass)!.homeroomTeacher = teacherName;
      }
    }

    teachersMap.set(teacherName, teacherSummary);
  }

  // 학반 정렬: 학년 오름차순 -> 학과순 -> 반 오름차순
  const sortedClasses = Array.from(classesMap.values()).sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.deptName !== b.deptName) return a.deptName.localeCompare(b.deptName, 'ko');
    return a.classNum - b.classNum;
  });

  const sortedTeachers = Array.from(teachersMap.values()).sort((a, b) => {
    return a.teacherName.localeCompare(b.teacherName, 'ko');
  });

  return {
    academicYear,
    semester,
    title: `${academicYear}학년도 ${semester}학기 전체 교사 시간표`,
    effectiveDate,
    totalTeachers: sortedTeachers.length,
    totalClasses: sortedClasses.length,
    totalSlots: allSlots.length,
    teachers: sortedTeachers,
    classes: sortedClasses,
    allSlots
  };
}
