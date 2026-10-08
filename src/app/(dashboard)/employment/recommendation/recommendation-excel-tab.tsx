'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FileSpreadsheet,
  UploadCloud,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  RefreshCw,
  UserCheck,
  Users,
  UserPlus,
  Loader2,
  HelpCircle,
  Info,
  Search,
  ArrowRight,
  Sparkles,
  Edit2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import {
  RecommendationSession,
  CandidateScoreRecord
} from './types';
import {
  addCandidatesToSession
} from './actions';

export interface RecommendationExcelTabProps {
  currentSession: RecommendationSession;
  availableStudents: any[];
  candidatesMap: Record<string, CandidateScoreRecord>;
  onSuccess: (updatedSession: RecommendationSession, addedCount: number) => void;
  onCancel: () => void;
}

export interface ParsedExcelCandidateRow {
  rowId: string;
  originalIndex: number;
  rawMajor: string;
  rawClass: string;
  rawNumber: string;
  rawName: string;
  rawStudentId?: string;
  ncsScore: number | null;
  interviewScore: number | null;
  remarks: string;

  matchStatus: 'matched' | 'already_registered' | 'ambiguous' | 'unmatched';
  matchedStudent?: any;
  candidateStudents?: any[];
  selectedStudentId?: string;
  unmatchedReason?: string;
  mismatchWarning?: string; // 인적사항 불일치 자동보정 안내 메시지
  isSelected: boolean;
}

// 텍스트 정규화 유틸리티
function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function cleanNoSpace(val: any): string {
  return cleanText(val).replace(/\s+/g, '');
}

function extractNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const m = String(val).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseScore(val: any, max: number): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return null;
  return Math.min(max, Math.max(0, parseFloat(num.toFixed(2))));
}

// 학과명 유연 정규화 (예: '전기', '전기과' -> '스마트전기과')
function normalizeMajor(rawMajor: string): string {
  if (!rawMajor) return '';
  const s = cleanNoSpace(rawMajor);
  if (s.includes('전기')) return '스마트전기과';
  if (s.includes('기계') || s.includes('자동화')) return '자동화기계과';
  if (s.includes('자동차')) return '친환경자동차과';
  if (s.includes('화학') || s.includes('바이오')) return '바이오화학과';
  if (s.includes('공간') || s.includes('건축') || s.includes('토목')) return '스마트공간과';
  if (s.includes('섬유')) return '스마트융합섬유과';
  return rawMajor;
}

export function RecommendationExcelTab({
  currentSession,
  availableStudents,
  candidatesMap,
  onSuccess,
  onCancel,
}: RecommendationExcelTabProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isParsing, setIsParsing] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [parsedRows, setParsedRows] = React.useState<ParsedExcelCandidateRow[]>([]);
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'matched' | 'already_registered' | 'unmatched'>('all');
  const [isDragOver, setIsDragOver] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 수동 매칭 검색 상태 (rowId -> 검색어)
  const [activeSearchRowId, setActiveSearchRowId] = React.useState<string | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = React.useState<string>('');

  // 1. 엑셀 등록 양식 다운로드 핸들러 (헤더 순서: 학과, 반, 번호, 성명, ...)
  const handleDownloadTemplate = () => {
    try {
      const targetGrade = currentSession.targetGrade || 3;
      const weights = currentSession.evaluationWeights || {
        mode: 'standard' as const,
        useNcs: true,
        useSchoolScore: true,
        useCertScore: true,
        useInterview: true,
        ncsMax: 30,
        schoolScoreMax: 30,
        certScoreMax: 30,
        interviewMax: 10
      };

      const headers: string[] = ['학과', '반', '번호', '성명'];
      if (weights.useNcs) {
        headers.push(`NCS점수(${weights.ncsMax}점만점/선택)`);
      }
      if (weights.useInterview) {
        headers.push(`면접점수(${weights.interviewMax}점만점/선택)`);
      }
      headers.push('비고(선택)');

      // 학교 학과/학년 정보를 반영한 실전 예시 데이터
      const sampleRows: any[][] = [];
      const row1: any[] = ['스마트전기과', 1, 1, '홍길동'];
      if (weights.useNcs) row1.push(Math.round(weights.ncsMax * 0.95 * 10) / 10);
      if (weights.useInterview) row1.push(Math.round(weights.interviewMax * 0.9 * 10) / 10);
      row1.push('추천 희망');
      sampleRows.push(row1);

      const row2: any[] = ['친환경자동차과', 2, 15, '이순신'];
      if (weights.useNcs) row2.push(Math.round(weights.ncsMax * 0.86 * 10) / 10);
      if (weights.useInterview) row2.push(Math.round(weights.interviewMax * 0.85 * 10) / 10);
      row2.push('공기업 대비반');
      sampleRows.push(row2);

      const row3: any[] = ['바이오화학과', 3, 3, '강감찬'];
      if (weights.useNcs) row3.push('');
      if (weights.useInterview) row3.push('');
      row3.push('성적/인증점수 자동계산 희망');
      sampleRows.push(row3);

      const wsData = [
        headers,
        ...sampleRows
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 열 너비 설정 (학과, 반, 번호, 성명, NCS, 면접, 비고)
      ws['!cols'] = [
        { wch: 18 }, // 학과
        { wch: 8 },  // 반
        { wch: 8 },  // 번호
        { wch: 12 }, // 성명
        { wch: 24 }, // NCS 점수
        { wch: 24 }, // 면접 점수
        { wch: 28 }, // 비고
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '추천희망학생_명단');

      const safeTitle = (currentSession.title || '학교장추천').replace(/[\\/:*?"<>|]/g, '_');
      XLSX.writeFile(wb, `${safeTitle}_희망학생_등록양식.xlsx`);
    } catch (err) {
      console.error('Template download error:', err);
      alert('양식 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 2. 엑셀 파일 파싱 및 지능형 오류 보정 매칭 엔진
  const parseExcelFile = async (selectedFile: File) => {
    setIsParsing(true);
    setFile(selectedFile);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('엑셀 파일 내 유효한 시트를 찾을 수 없습니다.');
      }

      const ws = wb.Sheets[firstSheetName];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('시트에 데이터가 비어 있습니다.');
      }

      // 헤더 행 탐색 (상위 15개 행 중 학과/반/번호/성명 키워드 감지)
      let headerRowIndex = -1;
      let colMajor = -1;
      let colClass = -1;
      let colNumber = -1;
      let colName = -1;
      let colNcs = -1;
      let colInterview = -1;
      let colRemarks = -1;
      let colId = -1;

      for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const row = rawRows[i];
        if (!Array.isArray(row)) continue;

        const stringCells = row.map(c => cleanNoSpace(c).toLowerCase());
        const foundName = stringCells.findIndex(c => c.includes('성명') || c.includes('이름') || c.includes('학생명') || c === '학생');
        const foundClass = stringCells.findIndex(c => (c === '반' || c.includes('학반')) && !c.includes('학번'));
        const foundMajor = stringCells.findIndex(c => c.includes('학과') || c.includes('전공') || c === '과');

        if (foundName !== -1 || foundClass !== -1 || foundMajor !== -1) {
          headerRowIndex = i;

          stringCells.forEach((c, idx) => {
            if (colMajor === -1 && (c.includes('학과') || c.includes('전공') || c === '과')) {
              colMajor = idx;
            } else if (colClass === -1 && (c === '반' || c.includes('학반')) && !c.includes('학번')) {
              colClass = idx;
            } else if (colNumber === -1 && (c === '번호' || c.includes('출석번호') || c === '번') && !c.includes('학번') && !c.includes('전화')) {
              colNumber = idx;
            } else if (colName === -1 && (c.includes('성명') || c.includes('이름') || c.includes('학생명') || c === '학생')) {
              colName = idx;
            } else if (colNcs === -1 && (c.includes('ncs') || c.includes('직기능') || c.includes('직업기초'))) {
              colNcs = idx;
            } else if (colInterview === -1 && (c.includes('면접') || c.includes('인터뷰'))) {
              colInterview = idx;
            } else if (colRemarks === -1 && (c.includes('비고') || c.includes('메모') || c.includes('특이사항') || c.includes('희망'))) {
              colRemarks = idx;
            } else if (colId === -1 && (c.includes('학번') || c.includes('학생번호') || c === 'id')) {
              colId = idx;
            }
          });
          break;
        }
      }

      // 헤더가 감지되지 않았을 때 기본 인덱스 설정 (학과, 반, 번호, 성명, NCS, 면접, 비고)
      if (headerRowIndex === -1) {
        headerRowIndex = 0;
        colMajor = 0;
        colClass = 1;
        colNumber = 2;
        colName = 3;
        colNcs = 4;
        colInterview = 5;
        colRemarks = 6;
      }

      const targetGrade = currentSession.targetGrade || 3;
      const dataRows = rawRows.slice(headerRowIndex + 1);
      const parsedResults: ParsedExcelCandidateRow[] = [];

      dataRows.forEach((row, idx) => {
        if (!Array.isArray(row)) return;

        const rawMajor = colMajor !== -1 ? cleanText(row[colMajor]) : '';
        const rawClass = colClass !== -1 ? cleanText(row[colClass]) : '';
        const rawNumber = colNumber !== -1 ? cleanText(row[colNumber]) : '';
        const rawName = colName !== -1 ? cleanText(row[colName]) : '';
        const rawStudentId = colId !== -1 ? cleanText(row[colId]) : '';
        const weights = currentSession.evaluationWeights || {
          mode: 'standard' as const,
          useNcs: true,
          useSchoolScore: true,
          useCertScore: true,
          useInterview: true,
          ncsMax: 30,
          schoolScoreMax: 30,
          certScoreMax: 30,
          interviewMax: 10
        };
        const ncsScore = (colNcs !== -1 && weights.useNcs) ? parseScore(row[colNcs], weights.ncsMax) : null;
        const interviewScore = (colInterview !== -1 && weights.useInterview) ? parseScore(row[colInterview], weights.interviewMax) : null;
        const remarks = colRemarks !== -1 ? cleanText(row[colRemarks]) : '';

        // 완전 빈 행 무시
        if (!rawName && !rawClass && !rawNumber && !rawMajor && !rawStudentId) return;

        // 3. 학생 지능형 매칭 & 인적사항 오류 보정 알고리즘
        let matchedStudent: any = null;
        let candidateStudents: any[] = [];
        let matchStatus: 'matched' | 'already_registered' | 'ambiguous' | 'unmatched' = 'unmatched';
        let unmatchedReason = '';
        let mismatchWarning = '';

        const cNum = extractNumber(rawClass);
        const nNum = extractNumber(rawNumber);
        const cleanNameVal = cleanNoSpace(rawName);
        const normMajorVal = normalizeMajor(rawMajor);

        // 3-1. 완벽 일치 검사 (학과 + 반 + 번호 + 성명)
        if (cNum !== null && nNum !== null && cleanNameVal) {
          const exactMatches = availableStudents.filter(s => {
            const sameClass = extractNumber(s.class_info) === cNum;
            const sameNum = extractNumber(s.student_number) === nNum;
            const sameName = cleanNoSpace(s.student_name) === cleanNameVal;
            const sameMajor = !normMajorVal || cleanNoSpace(s.major).includes(cleanNoSpace(normMajorVal)) || cleanNoSpace(normMajorVal).includes(cleanNoSpace(s.major));
            return sameClass && sameNum && sameName && sameMajor;
          });

          if (exactMatches.length === 1) {
            matchedStudent = exactMatches[0];
          }
        }

        // 3-2. 반/번호 + 성명 일치 (학과명 오기재/누락 보정)
        if (!matchedStudent && cNum !== null && nNum !== null && cleanNameVal) {
          const classNumNameMatches = availableStudents.filter(s => {
            const sameClass = extractNumber(s.class_info) === cNum;
            const sameNum = extractNumber(s.student_number) === nNum;
            const sameName = cleanNoSpace(s.student_name) === cleanNameVal;
            return sameClass && sameNum && sameName;
          });

          if (classNumNameMatches.length === 1) {
            matchedStudent = classNumNameMatches[0];
            if (rawMajor && matchedStudent.major !== rawMajor) {
              mismatchWarning = `학과명 오기재 자동보정 (엑셀: ${rawMajor} → 실제: ${matchedStudent.major})`;
            }
          }
        }

        // 3-3. 성명 단독 매칭 (반 또는 번호 오기재/오타 보정)
        if (!matchedStudent && cleanNameVal) {
          const nameMatches = availableStudents.filter(s => cleanNoSpace(s.student_name) === cleanNameVal);

          if (nameMatches.length === 1) {
            // 해당 학년에 단 1명만 존재하는 고유 이름인 경우 자동 매칭
            matchedStudent = nameMatches[0];
            const realC = extractNumber(matchedStudent.class_info);
            const realN = extractNumber(matchedStudent.student_number);

            if ((cNum !== null && realC !== cNum) || (nNum !== null && realN !== nNum)) {
              mismatchWarning = `반/번호 오기재 자동보정 (엑셀: ${rawClass ? `${rawClass}반` : ''} ${rawNumber ? `${rawNumber}번` : ''} → 실제: ${matchedStudent.class_info}반 ${matchedStudent.student_number}번)`;
            }
          } else if (nameMatches.length > 1) {
            // 동명이인: 학과로 1차 필터링
            const majorFiltered = normMajorVal
              ? nameMatches.filter(s => cleanNoSpace(s.major).includes(cleanNoSpace(normMajorVal)) || cleanNoSpace(normMajorVal).includes(cleanNoSpace(s.major)))
              : [];

            if (majorFiltered.length === 1) {
              matchedStudent = majorFiltered[0];
              mismatchWarning = `동명이인 학과 기준 보정 (${matchedStudent.major} · ${matchedStudent.class_info}반 ${matchedStudent.student_number}번)`;
            } else {
              candidateStudents = majorFiltered.length > 1 ? majorFiltered : nameMatches;
            }
          }
        }

        // 3-4. 학과 + 반 + 번호 일치 (성명 오타 의심 감지)
        if (!matchedStudent && cNum !== null && nNum !== null) {
          const classNumMatches = availableStudents.filter(s => {
            const sameClass = extractNumber(s.class_info) === cNum;
            const sameNum = extractNumber(s.student_number) === nNum;
            const sameMajor = !normMajorVal || cleanNoSpace(s.major).includes(cleanNoSpace(normMajorVal));
            return sameClass && sameNum && sameMajor;
          });

          if (classNumMatches.length === 1) {
            // 성명 오타가 의심되는 상황 -> 후보자로 제시하여 확인 유도
            candidateStudents = classNumMatches;
            unmatchedReason = `성명 오타 의심 (${classNumMatches[0].class_info}반 ${classNumMatches[0].student_number}번 학생: ${classNumMatches[0].student_name})`;
          }
        }

        // 3-5. 학번(student_id)이 제공된 경우 보조 매칭
        if (!matchedStudent && rawStudentId) {
          const idMatch = availableStudents.find(s => cleanNoSpace(s.student_id) === cleanNoSpace(rawStudentId));
          if (idMatch) matchedStudent = idMatch;
        }

        // 4. 상태 판정
        if (matchedStudent) {
          if (candidatesMap[matchedStudent.id]) {
            matchStatus = 'already_registered';
          } else {
            matchStatus = 'matched';
          }
        } else if (candidateStudents.length > 0) {
          matchStatus = 'ambiguous';
          if (!unmatchedReason) {
            unmatchedReason = `동명이인 (${candidateStudents.length}명) 중 선택 필요`;
          }
        } else {
          matchStatus = 'unmatched';
          unmatchedReason = `해당 학년(${targetGrade}학년) 재학생 중 일치 정보 없음 (수동 매칭 지원)`;
        }

        parsedResults.push({
          rowId: `excel-row-${idx}-${Date.now()}`,
          originalIndex: idx + 1,
          rawMajor,
          rawClass,
          rawNumber,
          rawName,
          rawStudentId,
          ncsScore,
          interviewScore,
          remarks,
          matchStatus,
          matchedStudent,
          candidateStudents,
          selectedStudentId: matchedStudent?.id,
          unmatchedReason,
          mismatchWarning,
          isSelected: matchStatus === 'matched'
        });
      });

      setParsedRows(parsedResults);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      alert(err.message || '엑셀 파일을 분석하는 중 오류가 발생했습니다.');
    } finally {
      setIsParsing(false);
    }
  };

  // 파일 업로드 이벤트
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      parseExcelFile(files[0]);
    }
  };

  // 드래그 앤 드롭 이벤트
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      parseExcelFile(files[0]);
    }
  };

  // 인적사항 오류 시 수동 학생 매칭 지정 핸들러
  const handleBindStudentToRow = (rowId: string, studentId: string) => {
    const student = availableStudents.find(s => s.id === studentId);
    if (!student) return;

    setParsedRows(prev =>
      prev.map(row => {
        if (row.rowId !== rowId) return row;
        const isAlready = !!candidatesMap[student.id];

        let warning = '';
        const origC = extractNumber(row.rawClass);
        const origN = extractNumber(row.rawNumber);
        const realC = extractNumber(student.class_info);
        const realN = extractNumber(student.student_number);

        if (cleanNoSpace(row.rawName) !== cleanNoSpace(student.student_name)) {
          warning = `성명 변경 수동 지정 (엑셀: ${row.rawName || '-'} → 실제: ${student.student_name})`;
        } else if ((origC !== null && realC !== origC) || (origN !== null && realN !== origN)) {
          warning = `반/번호 오기재 수동 교정 (엑셀: ${row.rawClass}반 ${row.rawNumber}번 → 실제: ${student.class_info}반 ${student.student_number}번)`;
        }

        return {
          ...row,
          matchedStudent: student,
          selectedStudentId: student.id,
          matchStatus: isAlready ? 'already_registered' : 'matched',
          isSelected: !isAlready,
          unmatchedReason: undefined,
          mismatchWarning: warning || undefined
        };
      })
    );

    setActiveSearchRowId(null);
    setManualSearchQuery('');
  };

  // 개별 행 체크박스 토글
  const handleToggleRowSelect = (rowId: string) => {
    setParsedRows(prev =>
      prev.map(r => (r.rowId === rowId ? { ...r, isSelected: !r.isSelected } : r))
    );
  };

  // 전체 선택 / 해제
  const handleToggleSelectAll = () => {
    const selectableRows = parsedRows.filter(r => r.matchStatus === 'matched' || r.matchStatus === 'already_registered');
    const allSelected = selectableRows.every(r => r.isSelected);

    setParsedRows(prev =>
      prev.map(r => {
        if (r.matchStatus === 'matched' || r.matchStatus === 'already_registered') {
          return { ...r, isSelected: !allSelected };
        }
        return r;
      })
    );
  };

  // 필터링된 행 목록
  const filteredRows = React.useMemo(() => {
    return parsedRows.filter(r => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'matched') return r.matchStatus === 'matched';
      if (activeFilter === 'already_registered') return r.matchStatus === 'already_registered';
      if (activeFilter === 'unmatched') return r.matchStatus === 'unmatched' || r.matchStatus === 'ambiguous';
      return true;
    });
  }, [parsedRows, activeFilter]);

  // 통계 계산
  const stats = React.useMemo(() => {
    const total = parsedRows.length;
    const matchedCount = parsedRows.filter(r => r.matchStatus === 'matched').length;
    const alreadyCount = parsedRows.filter(r => r.matchStatus === 'already_registered').length;
    const unmatchedCount = parsedRows.filter(r => r.matchStatus === 'unmatched' || r.matchStatus === 'ambiguous').length;
    const selectedCount = parsedRows.filter(r => r.isSelected && (r.matchStatus === 'matched' || r.matchStatus === 'already_registered')).length;
    return { total, matchedCount, alreadyCount, unmatchedCount, selectedCount };
  }, [parsedRows]);

  // 최종 등록 실행
  const handleSubmitCandidates = async () => {
    const rowsToRegister = parsedRows.filter(r => r.isSelected && r.matchedStudent);
    if (rowsToRegister.length === 0) {
      alert('등록할 학생을 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const studentIds = Array.from(new Set(rowsToRegister.map(r => r.matchedStudent.id)));

      // 엑셀에서 입력된 NCS점수, 면접점수, 비고 맵 생성
      const initialScores: Record<string, { ncsScore?: number | null; interviewScore?: number | null; remarks?: string }> = {};
      rowsToRegister.forEach(r => {
        const id = r.matchedStudent.id;
        initialScores[id] = {
          ncsScore: r.ncsScore,
          interviewScore: r.interviewScore,
          remarks: r.remarks
        };
      });

      const res = await addCandidatesToSession(currentSession.id, studentIds, initialScores);

      if (res.success && res.session) {
        onSuccess(res.session, studentIds.length);
      } else {
        alert(res.error || '학생 등록에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Submit candidates error:', err);
      alert('학생 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 수동 검색 필터 학생 목록
  const manualFilteredStudents = React.useMemo(() => {
    if (!manualSearchQuery.trim()) return availableStudents.slice(0, 15);
    const q = manualSearchQuery.trim().toLowerCase();
    return availableStudents.filter(s => {
      const matchName = s.student_name?.toLowerCase().includes(q);
      const matchMajor = s.major?.toLowerCase().includes(q);
      const matchClass = s.class_info?.includes(q);
      const matchNum = s.student_number?.includes(q);
      const matchId = s.student_id?.includes(q);
      return matchName || matchMajor || matchClass || matchNum || matchId;
    }).slice(0, 20);
  }, [availableStudents, manualSearchQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* 1. 상단 안내 및 템플릿 다운로드 바 */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              <span>엑셀 파일 추천 희망 학생 일괄 등록</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-emerald-700 bg-emerald-50 border-emerald-200">
                헤더 순서: 학과 · 반 · 번호 · 성명
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-blue-700 bg-blue-50 border-blue-200">
                인적사항 오류 자동보정 지원
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              학과, 반, 번호, 성명이 포함된 엑셀 파일을 업로드하면 학생을 자동 매칭하며, 오기재 시에도 즉시 수동 검색/매칭할 수 있습니다.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          className="h-8 text-xs font-bold rounded-lg border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5 shrink-0 bg-white shadow-2xs"
        >
          <Download className="h-3.5 w-3.5 text-emerald-600" />
          <span>등록 양식(샘플) 다운로드</span>
        </Button>
      </div>

      {/* 2. 파일 업로드 영역 (파싱 전) */}
      {parsedRows.length === 0 ? (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full max-w-xl p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all",
              isDragOver
                ? "border-emerald-500 bg-emerald-50/50 scale-[1.01]"
                : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50/70"
            )}
          >
            {isParsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                <div className="text-sm font-bold text-slate-800">엑셀 파일 분석 및 학생 지능형 매칭 중...</div>
                <div className="text-xs text-slate-400">잠시만 기다려 주세요.</div>
              </div>
            ) : (
              <>
                <div className="h-14 w-14 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center mb-3.5 shadow-2xs">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <div className="text-sm font-bold text-slate-800 mb-1">
                  이곳에 엑셀(.xlsx, .xls, .csv) 파일을 끌어다 놓거나 클릭하여 선택하세요
                </div>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  표준 헤더 순서: <strong className="text-emerald-700">학과 | 반 | 번호 | 성명 | NCS점수 | 면접점수 | 비고</strong>
                </p>
                <div className="mt-3 p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-left max-w-md">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span>인적사항 오류 보정 기능 안내</span>
                  </div>
                  <ul className="text-[11px] text-blue-700 mt-1 space-y-0.5 list-disc list-inside">
                    <li>반/번호를 잘못 적어도 이름 기준으로 고유 학생을 자동 감지합니다.</li>
                    <li>오타나 불일치가 발생한 행은 화면에서 <strong>[학생 직접 검색/매칭]</strong>으로 1초 만에 바로 지정할 수 있습니다.</li>
                  </ul>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] font-semibold text-slate-600 border-slate-200 bg-white">
                    .xlsx
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-semibold text-slate-600 border-slate-200 bg-white">
                    .xls
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-semibold text-slate-600 border-slate-200 bg-white">
                    .csv
                  </Badge>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* 3. 파싱 결과 미리보기 및 선택 영역 */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 상태 요약 바 & 필터 탭 */}
          <div className="p-3 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                  activeFilter === 'all'
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                전체 분석: {stats.total}건
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('matched')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                  activeFilter === 'matched'
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                등록 가능: {stats.matchedCount}명
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('already_registered')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                  activeFilter === 'already_registered'
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                <Info className="h-3.5 w-3.5" />
                이미 등록됨: {stats.alreadyCount}명
              </button>
              {stats.unmatchedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('unmatched')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                    activeFilter === 'unmatched'
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  오류 / 확인 필요: {stats.unmatchedCount}건
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleSelectAll}
                className="h-7 text-xs font-bold rounded-lg border-slate-200"
              >
                {stats.selectedCount === (stats.matchedCount + stats.alreadyCount) && stats.selectedCount > 0
                  ? '전체 해제'
                  : '등록 가능 전체 선택'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParsedRows([]);
                  setFile(null);
                  setActiveSearchRowId(null);
                }}
                className="h-7 text-xs font-bold text-slate-500 hover:text-slate-800 gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                다른 파일 선택
              </Button>
            </div>
          </div>

          {/* 학생 매칭 리스트 테이블 */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">선택</th>
                  <th className="py-2.5 px-3 w-48">엑셀 데이터 (학과·반·번호·성명)</th>
                  <th className="py-2.5 px-3">시스템 매칭 학생 및 오류 보정</th>
                  <th className="py-2.5 px-3 w-36">추가 점수 / 비고</th>
                  <th className="py-2.5 px-3 w-28 text-center">매칭 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(row => {
                  const isSelectable = row.matchStatus === 'matched' || row.matchStatus === 'already_registered';
                  const isSearchActive = activeSearchRowId === row.rowId;

                  return (
                    <tr
                      key={row.rowId}
                      className={cn(
                        "transition-colors",
                        row.isSelected ? "bg-emerald-50/40" : "hover:bg-slate-50/70"
                      )}
                    >
                      {/* 1. 선택 체크박스 */}
                      <td className="py-2.5 px-3 text-center align-top pt-3">
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={row.isSelected}
                            onChange={() => handleToggleRowSelect(row.rowId)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 2. 엑셀 원본 데이터 (학과, 반, 번호, 성명 순서) */}
                      <td className="py-2.5 px-3 align-top pt-3">
                        <div className="font-bold text-slate-900">
                          {row.rawName || '(성명 미기재)'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-semibold text-slate-700">{row.rawMajor || '학과미기재'}</span>
                          {(row.rawClass || row.rawNumber) && (
                            <span> · {row.rawClass ? `${row.rawClass}반 ` : ''}{row.rawNumber ? `${row.rawNumber}번` : ''}</span>
                          )}
                        </div>
                      </td>

                      {/* 3. 시스템 매칭 결과 및 인적사항 오류 보정 UI */}
                      <td className="py-2.5 px-3 align-top pt-2.5">
                        {/* 3-A. 수동 검색 UI가 열려있는 경우 */}
                        {isSearchActive ? (
                          <div className="p-2.5 bg-blue-50/90 rounded-xl border border-blue-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                                <Search className="h-3 w-3 text-blue-600" />
                                <span>학생 직접 검색 및 매칭</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => { setActiveSearchRowId(null); setManualSearchQuery(''); }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="relative">
                              <Input
                                placeholder="이름, 학과, 반 또는 번호 검색..."
                                value={manualSearchQuery}
                                onChange={e => setManualSearchQuery(e.target.value)}
                                className="h-7 text-xs bg-white border-blue-200"
                                autoFocus
                              />
                            </div>

                            {/* 검색 결과 목록 */}
                            <div className="max-h-36 overflow-y-auto divide-y divide-blue-100 bg-white rounded-lg border border-blue-100">
                              {manualFilteredStudents.length === 0 ? (
                                <div className="p-2.5 text-center text-[11px] text-slate-400">
                                  검색 결과가 없습니다.
                                </div>
                              ) : (
                                manualFilteredStudents.map(st => (
                                  <div
                                    key={st.id}
                                    onClick={() => handleBindStudentToRow(row.rowId, st.id)}
                                    className="p-1.5 px-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900">{st.student_name}</span>
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        {st.major} · {st.class_info}반 {st.student_number}번
                                      </span>
                                    </div>
                                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600 font-bold px-2">
                                      지정
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ) : (
                          /* 3-B. 일반 매칭 표시 상태 */
                          <div className="space-y-1">
                            {row.matchedStudent ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                                    <span>{row.matchedStudent.student_name}</span>
                                    <span className="text-[11px] font-normal text-emerald-700">
                                      ({row.matchedStudent.major} · {row.matchedStudent.class_info}반 {row.matchedStudent.student_number}번)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSearchRowId(row.rowId);
                                      setManualSearchQuery(row.rawName || '');
                                    }}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium flex items-center gap-0.5"
                                  >
                                    <Edit2 className="h-2.5 w-2.5" />
                                    <span>변경</span>
                                  </button>
                                </div>

                                {/* 인적사항 불일치 자동보정 경고 뱃지 */}
                                {row.mismatchWarning && (
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex font-medium">
                                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                                    <span>{row.mismatchWarning}</span>
                                  </div>
                                )}
                              </div>
                            ) : row.matchStatus === 'ambiguous' ? (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                  <span>{row.unmatchedReason || '후보 학생 선택 필요'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={row.selectedStudentId || ''}
                                    onChange={e => e.target.value && handleBindStudentToRow(row.rowId, e.target.value)}
                                    className="h-7 text-xs border border-amber-300 rounded-md bg-amber-50 px-2 py-0.5 font-medium max-w-xs"
                                  >
                                    <option value="">후보자 목록에서 선택</option>
                                    {row.candidateStudents?.map(cs => (
                                      <option key={cs.id} value={cs.id}>
                                        {cs.student_name} ({cs.major} · {cs.class_info}반 {cs.student_number}번)
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setActiveSearchRowId(row.rowId);
                                      setManualSearchQuery(row.rawName || '');
                                    }}
                                    className="h-7 text-[11px] font-bold border-amber-300 text-amber-800 bg-white hover:bg-amber-50"
                                  >
                                    직접 검색
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                  <span>{row.unmatchedReason || '일치하는 학생을 찾을 수 없습니다.'}</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setActiveSearchRowId(row.rowId);
                                    setManualSearchQuery(row.rawName || '');
                                  }}
                                  className="h-6 text-[11px] font-bold border-rose-200 text-rose-700 bg-rose-50/70 hover:bg-rose-100 gap-1"
                                >
                                  <Search className="h-3 w-3" />
                                  <span>학생 직접 검색 및 매칭</span>
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. 점수 / 비고 */}
                      <td className="py-2.5 px-3 align-top pt-3">
                        <div className="space-y-0.5 text-[11px]">
                          {row.ncsScore !== null && (
                            <div className="text-slate-700">
                              <span className="font-semibold text-slate-400">NCS:</span> {row.ncsScore}점
                            </div>
                          )}
                          {row.interviewScore !== null && (
                            <div className="text-slate-700">
                              <span className="font-semibold text-slate-400">면접:</span> {row.interviewScore}점
                            </div>
                          )}
                          {row.remarks && (
                            <div className="text-slate-500 truncate max-w-[140px]" title={row.remarks}>
                              <span className="font-semibold text-slate-400">비고:</span> {row.remarks}
                            </div>
                          )}
                          {row.ncsScore === null && row.interviewScore === null && !row.remarks && (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                      </td>

                      {/* 5. 상태 뱃지 */}
                      <td className="py-2.5 px-3 text-center align-top pt-3">
                        {row.matchStatus === 'matched' && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold">
                            등록 가능
                          </Badge>
                        )}
                        {row.matchStatus === 'already_registered' && (
                          <Badge variant="outline" className="text-slate-500 bg-slate-100 border-slate-200 text-[10px] font-bold">
                            이미 등록됨
                          </Badge>
                        )}
                        {row.matchStatus === 'ambiguous' && (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-[10px] font-bold">
                            확인 필요
                          </Badge>
                        )}
                        {row.matchStatus === 'unmatched' && (
                          <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-200 text-[10px] font-bold">
                            미일치
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. 모달 푸터 바 */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span>등록된 학생은 공고의 성적 기준에 따라 교과성적(30점)과 옥저인재인증점수(30점)가 자동 계산됩니다.</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-8 text-xs font-bold rounded-lg border-slate-200"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={stats.selectedCount === 0 || isSubmitting}
            onClick={handleSubmitCandidates}
            className="h-8 px-4 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-2xs"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            <span>선택한 {stats.selectedCount}명 희망학생 등록</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
