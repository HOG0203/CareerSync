// ==============================================================================
// src/lib/substitute/types.ts
// 결보강 및 수업 교체 관리 시스템 데이터 모델
// ==============================================================================

export type SubstituteType = 'exchange' | 'substitute'; // 'exchange' = 수업교체, 'substitute' = 보강/대강
export type ApplicationStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

/**
 * 개별 교시 교체/보강 항목
 */
export interface SubstituteItem {
  id: string;
  // 1) 신청 수업 (결강 / 변경 대상)
  sourceDate: string;         // YYYY-MM-DD (예: "2026-09-01")
  sourceDay: string;          // "월" | "화" | "수" | "목" | "금"
  sourcePeriod: number;       // 1 ~ 7
  deptName: string;           // 학과명 (예: "스마트공간건축과", "자동화기계과")
  classCode: string;          // 학반 코드 (예: "축31", "기22", "도31")
  subjectName: string;        // 교과목명 (예: "목공", "안전", "실내")
  originalTeacher: string;    // 원래 담당 교사 (신청 교사)

  // 처리 유형
  type: SubstituteType;

  // 2) 수업 교체인 경우 (교체 대상 수업)
  targetDate?: string;        // YYYY-MM-DD
  targetDay?: string;         // "월" | "화" | "수" | "목" | "금"
  targetPeriod?: number;      // 1 ~ 7
  targetSubject?: string;     // 교체 수업 교과목명
  targetClass?: string;       // 교체 대상 학반 코드
  targetTeacher?: string;     // 교체 대상 교사 (맞교환 교사 또는 본인)

  // 3) 보강/대강인 경우
  substituteTeacher?: string; // 보강 교사
}

/**
 * 수업 교체 및 보강 신청서 1건 (공식 양식 대응)
 */
export interface SubstituteApplication {
  id: string;
  applicationNumber: string;  // 문서 번호 (예: "2026-2-001")
  academicYear: number;       // 2026
  semester: number;           // 2

  applicantTeacher: string;   // 신청 교사 성명
  reason: string;             // 신청 사유 (예: 전국기능경기대회 지도 출장, 병가, 연가 등)

  periodStart: string;        // 신청 기간 시작 (YYYY-MM-DD)
  periodEnd: string;          // 신청 기간 종료 (YYYY-MM-DD)
  applicationDate: string;    // 신청일자 (YYYY-MM-DD)

  status: ApplicationStatus;  // 상태

  items: SubstituteItem[];    // 교시별 상세 항목 목록

  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;        // 결재/승인자 (수업계/부장)
}

/**
 * 충돌 검증 결과
 */
export interface ConflictCheckResult {
  hasConflict: boolean;
  message: string;
  conflictType?: 'TEACHER_BUSY' | 'CLASS_BUSY' | 'ALREADY_MODIFIED' | 'SELF_CONFLICT';
  details?: {
    date: string;
    period: number;
    teacherName?: string;
    classCode?: string;
    existingSubject?: string;
  };
}

/**
 * 공강 교사 추천 정보
 */
export interface AvailableTeacher {
  teacherName: string;
  homeroomClass?: string;
  deptName?: string;
  isSameDept: boolean;
  totalSubstitutesDone: number; // 이번 학기 누적 보강 횟수
}
