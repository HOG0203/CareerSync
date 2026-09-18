'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FullStudentEvaluation, CertificationRank, getDefaultPrizeName } from '@/lib/certification-calculator';
import { batchImportPastRewardsAction, getAllGradesEvaluationsAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  FileUp,
  Search,
  UserCheck,
  UserX,
  Edit2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RetroactiveExcelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluations: FullStudentEvaluation[];
  academicYear: number;
  grade: number;
  onSuccess: () => Promise<void>;
}

interface ParsedPastRewardRow {
  gradeNum: string;
  major: string;
  classInfo: string;
  studentNumber: string;
  studentName: string;
  matchedStudentId?: string;
  matchedMajor?: string;
  matchedClass?: string;
  matchedNumber?: string;
  matchedGrade?: number;
  rewardType: 'prize' | 'certificate_award';
  certifiedRank: CertificationRank;
  itemName: string;
  awardedDate: string;
  remarks: string;
  isValid: boolean;
  errorReason?: string;
}

// 정규화 헬퍼 함수
const cleanClass = (c: any) => String(c || '').replace(/[^0-9]/g, '');
const cleanNum = (n: any) => String(n || '').replace(/[^0-9]/g, '');
const cleanGrade = (g: any) => String(g || '').replace(/[^0-9]/g, '');
const cleanName = (n: any) => String(n || '').trim().replace(/\s+/g, '');
const cleanMajor = (m: any) => String(m || '').trim().replace(/\s+/g, '').toLowerCase();

// 엑셀 날짜(일련번호 예: 46225, Date 객체, YYYY-MM-DD 등)를 YYYY-MM-DD 표준 문자열로 변환
function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];

  // 1. 이미 Date 객체인 경우
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();

  // 2. 엑셀 날짜 일련번호 (예: 46225 -> 2026-07-22)
  if (!isNaN(Number(str)) && Number(str) > 20000 && Number(str) < 90000) {
    const serial = Number(str);
    // 엑셀 기준일: 1899-12-30 (1900년 윤년 버그 보정 적용, 25569 = 1970-01-01)
    const utcMs = Math.round((serial - 25569) * 86400 * 1000);
    const date = new Date(utcMs);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 3. YYYYMMDD (예: 20260722)
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }

  // 4. 구분자가 포함된 날짜 문자열 (예: 2026.07.22, 2026/07/22, 2026-07-22)
  if (str.includes('.') || str.includes('/') || str.includes('-')) {
    const parts = str.replace(/[./]/g, '-').split('-').map(p => p.trim());
    if (parts.length === 3) {
      const y = parts[0].padStart(4, '20');
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      const numY = Number(y);
      const numM = Number(m);
      const numD = Number(d);
      if (numY >= 1990 && numY <= 2100 && numM >= 1 && numM <= 12 && numD >= 1 && numD <= 31) {
        return `${y}-${m}-${d}`;
      }
    }
  }

  // 5. 이미 YYYY-MM-DD 형태인 경우
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  return new Date().toISOString().split('T')[0];
}

interface StudentMatcherPopoverProps {
  row: ParsedPastRewardRow;
  rowIndex: number;
  evaluations: FullStudentEvaluation[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStudent: (student: FullStudentEvaluation) => void;
  onUnmatch: () => void;
}

// 미매칭/재매칭용 인라인 검색 팝오버 컴포넌트 (전 학년 지원 및 학년 필터 탭 제공)
function StudentMatcherPopover({
  row,
  evaluations,
  isOpen,
  onOpenChange,
  onSelectStudent,
  onUnmatch,
}: StudentMatcherPopoverProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const initialGradeTab = row.matchedGrade ? String(row.matchedGrade) : (cleanGrade(row.gradeNum) || 'all');
  const [selectedGradeTab, setSelectedGradeTab] = React.useState<string>(initialGradeTab);

  // 팝오버가 열릴 때 엑셀의 기존 성명 및 학년 탭 초기화
  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm(row.studentName || '');
      const g = row.matchedGrade ? String(row.matchedGrade) : (cleanGrade(row.gradeNum) || 'all');
      setSelectedGradeTab(g);
    }
  }, [isOpen, row.studentName, row.matchedGrade, row.gradeNum]);

  // 전 학년 또는 선택된 학년 대상 다차원 필터링 (이름, 학번, 반, 번호, 학과)
  const candidates = React.useMemo(() => {
    if (!isOpen || !evaluations || evaluations.length === 0) return [];
    const query = searchTerm.trim().toLowerCase().replace(/\s+/g, '');

    let pool = evaluations;
    if (selectedGradeTab === '1' || selectedGradeTab === '2' || selectedGradeTab === '3') {
      pool = evaluations.filter(s => String(s.currentGrade) === selectedGradeTab);
    }

    if (!query) {
      return [...pool].sort((a, b) => {
        const gDiff = (Number(a.currentGrade) || 0) - (Number(b.currentGrade) || 0);
        if (gDiff !== 0) return gDiff;
        const classDiff = (Number(cleanClass(a.classInfo)) || 0) - (Number(cleanClass(b.classInfo)) || 0);
        if (classDiff !== 0) return classDiff;
        return (Number(cleanNum(a.studentNumber)) || 0) - (Number(cleanNum(b.studentNumber)) || 0);
      });
    }

    const matchClassNum = query.match(/^(\d+)[-반\s]+(\d+)/);
    const filterClass = matchClassNum ? matchClassNum[1] : null;
    const filterNum = matchClassNum ? matchClassNum[2] : null;

    return pool
      .filter(s => {
        const sName = (s.studentName || '').toLowerCase().replace(/\s+/g, '');
        const sNum = cleanNum(s.studentNumber);
        const sClass = cleanClass(s.classInfo);
        const sMajor = (s.major || '').toLowerCase().replace(/\s+/g, '');
        const fullStuNum = String(s.studentNumber || '');

        // 1. "1-5", "1반 5번" 형식
        if (filterClass && filterNum) {
          if (sClass === filterClass && (sNum === filterNum || sNum.endsWith(filterNum))) {
            return true;
          }
        }

        // 2. 성명 검색
        if (sName.includes(query)) return true;

        // 3. 번호 또는 학번 검색
        if (sNum === query || fullStuNum.includes(query)) return true;

        // 4. 학과명 검색
        if (sMajor.includes(query)) return true;

        // 5. "X반" 또는 "X번"
        if (query.endsWith('반') && sClass === query.replace('반', '')) return true;
        if (query.endsWith('번') && sNum === query.replace('번', '')) return true;

        return false;
      })
      .sort((a, b) => {
        const aName = (a.studentName || '').toLowerCase().replace(/\s+/g, '');
        const bName = (b.studentName || '').toLowerCase().replace(/\s+/g, '');
        if (aName === query && bName !== query) return -1;
        if (bName === query && aName !== query) return 1;

        const gDiff = (Number(a.currentGrade) || 0) - (Number(b.currentGrade) || 0);
        if (gDiff !== 0) return gDiff;
        const classDiff = (Number(cleanClass(a.classInfo)) || 0) - (Number(cleanClass(b.classInfo)) || 0);
        if (classDiff !== 0) return classDiff;
        return (Number(cleanNum(a.studentNumber)) || 0) - (Number(cleanNum(b.studentNumber)) || 0);
      });
  }, [isOpen, searchTerm, selectedGradeTab, evaluations]);

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {row.isValid && row.matchedStudentId ? (
          <div className="inline-flex items-center gap-1 max-w-[200px]">
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded px-1.5 py-0.5 truncate cursor-pointer hover:bg-emerald-100 transition-colors shadow-2xs"
              title="클릭하여 매칭 학생 변경"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
              <span className="truncate">
                {row.matchedGrade}학년 {row.matchedClass}반 {cleanNum(row.matchedNumber || '')}번 {row.studentName}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded"
              title="매칭 학생 변경"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-6 px-2 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md gap-1 shadow-2xs animate-pulse"
          >
            <Search className="h-3 w-3" />
            <span>학생 직접 매칭</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-92 p-3 shadow-2xl rounded-xl border border-slate-200 bg-white z-[99999]"
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              학생 매칭 ({selectedGradeTab === 'all' ? `전교생 ${evaluations.length}명` : `${selectedGradeTab}학년`} 대상)
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-slate-400 hover:text-slate-600"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 학년 빠른 필터 탭 */}
        <div className="flex items-center gap-1 mb-2 bg-slate-100/80 p-1 rounded-lg border border-slate-200">
          {['all', '1', '2', '3'].map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedGradeTab(g)}
              className={cn(
                "flex-1 py-1 text-[11px] font-bold rounded-md transition-colors",
                selectedGradeTab === g
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              )}
            >
              {g === 'all' ? '전체' : `${g}학년`}
            </button>
          ))}
        </div>

        <div className="relative mb-2">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름, 학번, 반, 번호 검색 (예: 이태희, 4-16)"
            className="h-8 pl-8 pr-7 text-xs rounded-lg border-slate-200 focus-visible:ring-indigo-500"
            autoFocus
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 p-0.5">
          {candidates.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 font-medium">
              일치하는 학생을 찾을 수 없습니다.
            </div>
          ) : (
            candidates.slice(0, 50).map((student) => {
              const isCurrent = row.matchedStudentId === student.studentId;
              return (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => {
                    onSelectStudent(student);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors border cursor-pointer",
                    isCurrent
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "hover:bg-indigo-50/70 border-transparent hover:border-indigo-100 text-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono font-bold bg-white text-slate-700 px-1.5 py-0 border-slate-300">
                      {student.currentGrade}학년 {student.classInfo}반 {cleanNum(student.studentNumber)}번
                    </Badge>
                    <span className="font-bold text-slate-900">
                      {student.studentName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({student.studentNumber})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {student.major}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {row.isValid && row.matchedStudentId && (
          <div className="pt-2 mt-2 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onUnmatch();
                onOpenChange(false);
              }}
              className="h-6 text-[11px] text-rose-600 hover:bg-rose-50 px-2 rounded-md"
            >
              <UserX className="h-3 w-3 mr-1" />
              매칭 해제
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function RetroactiveExcelModal({
  open,
  onOpenChange,
  evaluations,
  academicYear,
  grade,
  onSuccess,
}: RetroactiveExcelModalProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = React.useState<ParsedPastRewardRow[]>([]);
  const [isProcessingFile, setIsProcessingFile] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [openMatcherIdx, setOpenMatcherIdx] = React.useState<number | null>(null);

  // 전 학년(1, 2, 3학년) 전체 학생 목록 상태
  const [allEvaluations, setAllEvaluations] = React.useState<FullStudentEvaluation[]>(evaluations);
  const [isLoadingAllStudents, setIsLoadingAllStudents] = React.useState<boolean>(false);

  // 모달이 열릴 때 전 학년(1, 2, 3학년) 전체 학생 명단 동시 병렬 로드
  React.useEffect(() => {
    if (open) {
      let isMounted = true;
      setIsLoadingAllStudents(true);
      getAllGradesEvaluationsAction(academicYear)
        .then(allStudents => {
          if (isMounted && allStudents && allStudents.length > 0) {
            setAllEvaluations(allStudents);
          }
        })
        .catch(err => {
          console.error('Failed to load all grades evaluations:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingAllStudents(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [open, academicYear]);

  // 모달 닫힐 때 초기화
  React.useEffect(() => {
    if (!open) {
      setParsedRows([]);
      setIsDragging(false);
      setOpenMatcherIdx(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  // 표준 소급 양식 다운로드 (학년, 학과, 반, 번호, 성명 중심)
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const templateData = [
        {
          '학년': grade || 3,
          '학과': '스마트제어과',
          '반': 1,
          '번호': 5,
          '성명': '홍길동',
          '지급구분(상품/인증상)': '상품',
          '수령등급(S/A/B/C)': 'B',
          '품목명': '보조배터리',
          '지급일자(YYYY-MM-DD)': '2025-12-15',
          '비고': '2025학년도 2학기말 오프라인 기지급',
        },
        {
          '학년': grade || 3,
          '학과': '스마트제어과',
          '반': 1,
          '번호': 6,
          '성명': '김철수',
          '지급구분(상품/인증상)': '인증상',
          '수령등급(S/A/B/C)': 'A',
          '품목명': '옥저인재인증상',
          '지급일자(YYYY-MM-DD)': '2025-12-15',
          '비고': '2025학년도 2학기말 수여',
        },
        {
          '학년': grade || 3,
          '학과': '바이오제약과',
          '반': 2,
          '번호': 12,
          '성명': '이영희',
          '지급구분(상품/인증상)': '상품',
          '수령등급(S/A/B/C)': 'C',
          '품목명': '문화상품권 5천원권',
          '지급일자(YYYY-MM-DD)': '2025-07-18',
          '비고': '2025학년도 1학기말 지급',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);

      // 열 너비 설정
      ws['!cols'] = [
        { wch: 8 },  // 학년
        { wch: 16 }, // 학과
        { wch: 8 },  // 반
        { wch: 8 },  // 번호
        { wch: 12 }, // 성명
        { wch: 22 }, // 지급구분
        { wch: 18 }, // 수령등급
        { wch: 22 }, // 품목명
        { wch: 20 }, // 지급일자
        { wch: 30 }, // 비고
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '과거수령소급대장');
      XLSX.writeFile(wb, `${academicYear}학년도_옥저인재인증_과거수령이력_소급양식.xlsx`);
    } catch (err) {
      console.error(err);
      toast({ title: '양식 다운로드 실패', variant: 'destructive' });
    }
  };

  // 엑셀 파일 파싱 및 학생 자동 매칭 공통 처리 함수
  const processExcelFile = async (file?: File) => {
    if (!file) return;

    // 파일 확장자 검사
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      toast({
        title: '지원하지 않는 파일 형식',
        description: '엑셀 파일(.xlsx, .xls) 또는 .csv 파일만 업로드할 수 있습니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingFile(true);

    // 전 학년(1, 2, 3학년) 학생 데이터 풀 확보
    let candidateStudents = allEvaluations;
    if (!candidateStudents || candidateStudents.length <= evaluations.length) {
      try {
        const fetched = await getAllGradesEvaluationsAction(academicYear);
        if (fetched && fetched.length > 0) {
          candidateStudents = fetched;
          setAllEvaluations(fetched);
        }
      } catch (err) {
        console.error('Failed to fetch all grades for excel processing:', err);
      }
    }
    if (!candidateStudents || candidateStudents.length === 0) {
      candidateStudents = evaluations;
    }

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

      if (!rawRows || rawRows.length === 0) {
        toast({ title: '데이터 없음', description: '엑셀 파일에 데이터가 비어 있습니다.', variant: 'destructive' });
        return;
      }

      const rows: ParsedPastRewardRow[] = rawRows.map(row => {
        // 1. 기본 인적사항 추출 (다양한 헤더 명칭 포용)
        const rowGrade = String(row['학년'] || row['학년도'] || '').trim();
        const rowMajor = String(row['학과'] || row['전공'] || row['학과명'] || '').trim();
        const rowClass = String(row['반'] || row['학반'] || '').trim();
        const rowNum = String(row['번호'] || row['출석번호'] || row['학생번호'] || '').trim();
        const rowName = String(row['성명'] || row['이름'] || row['학생명'] || '').trim();
        const fallbackStuNum = String(row['학번'] || '').trim();

        // 2. 포상 구분 추출
        const typeRaw = String(row['지급구분(상품/인증상)'] || row['지급구분'] || row['구분'] || '').trim();
        const isCertAward = typeRaw.includes('인증상') || typeRaw.includes('상장');
        const rewardType: 'prize' | 'certificate_award' = isCertAward ? 'certificate_award' : 'prize';

        // 3. 등급 추출
        let rankRaw = String(row['수령등급(S/A/B/C)'] || row['수령등급'] || row['등급'] || 'C').toUpperCase().trim();
        if (!['S', 'A', 'B', 'C'].includes(rankRaw)) {
          rankRaw = 'C';
        }
        const certifiedRank = rankRaw as CertificationRank;

        // 4. 품목명 및 일자, 비고 (46225 등 엑셀 날짜 일련번호 자동 변환)
        const defaultItem = rewardType === 'prize' ? getDefaultPrizeName(certifiedRank) : '옥저인재인증상';
        const itemName = String(row['품목명'] || row['상품명'] || defaultItem).trim();
        const dateRaw = row['지급일자(YYYY-MM-DD)'] ?? row['지급일자'] ?? row['일자'] ?? row['지급일'] ?? row['수여일자'] ?? row['수여일'] ?? '';
        const awardedDate = parseExcelDate(dateRaw);
        const remarks = String(row['비고'] || '과거 이력 엑셀 소급 등록').trim();

        // 5. 학생 매칭 알고리즘 (전 학년 지원 및 엄격한 학년 한정)
        // 엑셀에 명시된 학년이 1, 2, 3 중 하나라면 반드시 해당 학년 학생으로만 후보 풀 한정!
        const explicitGrade = cleanGrade(rowGrade);
        const targetPool = (explicitGrade === '1' || explicitGrade === '2' || explicitGrade === '3')
          ? candidateStudents.filter(s => String(s.currentGrade) === explicitGrade)
          : (grade ? candidateStudents.filter(s => String(s.currentGrade) === String(grade)) : candidateStudents);

        let matched: FullStudentEvaluation | undefined;

        // 우선순위 1: 반 + 번호 + 성명 일치 (해당 학년 내)
        if (rowClass && rowNum && rowName) {
          matched = targetPool.find(s =>
            cleanClass(s.classInfo) === cleanClass(rowClass) &&
            cleanNum(s.studentNumber) === cleanNum(rowNum) &&
            cleanName(s.studentName) === cleanName(rowName)
          );
        }

        // 우선순위 2: 학과 + 반 + 번호 + 성명 일치 (해당 학년 내)
        if (!matched && rowMajor && rowClass && rowNum && rowName) {
          matched = targetPool.find(s =>
            (cleanMajor(s.major).includes(cleanMajor(rowMajor)) || cleanMajor(rowMajor).includes(cleanMajor(s.major))) &&
            cleanClass(s.classInfo) === cleanClass(rowClass) &&
            cleanNum(s.studentNumber) === cleanNum(rowNum) &&
            cleanName(s.studentName) === cleanName(rowName)
          );
        }

        // 우선순위 3: 학번(5자리) 제공 시 학번 및 성명 일치
        if (!matched && fallbackStuNum) {
          matched = targetPool.find(s =>
            cleanNum(s.studentNumber) === cleanNum(fallbackStuNum) &&
            (!rowName || cleanName(s.studentName) === cleanName(rowName))
          );
        }

        // 우선순위 4: 해당 학년 내 성명 고유 1명 (동명이인이 없을 때)
        if (!matched && rowName) {
          const nameCandidates = targetPool.filter(s => cleanName(s.studentName) === cleanName(rowName));
          if (nameCandidates.length === 1) {
            if (!rowMajor || cleanMajor(nameCandidates[0].major).includes(cleanMajor(rowMajor)) || cleanMajor(rowMajor).includes(cleanMajor(nameCandidates[0].major))) {
              matched = nameCandidates[0];
            }
          }
        }

        // 우선순위 5: 반 + 번호 일치 (단, 엑셀에 성명이 아예 비어있을 때만 허용! 성명이 기재되어 있는데 다른 사람과 매칭되는 오매칭 절대 금지)
        if (!matched && rowClass && rowNum && !rowName) {
          const numCandidates = targetPool.filter(s =>
            cleanClass(s.classInfo) === cleanClass(rowClass) &&
            cleanNum(s.studentNumber) === cleanNum(rowNum)
          );
          if (numCandidates.length === 1) {
            matched = numCandidates[0];
          }
        }

        const isValid = Boolean(matched);
        const errorReason = !matched
          ? (explicitGrade
              ? `${explicitGrade}학년 명단 미일치 (반: ${rowClass}, 번호: ${rowNum}, 성명: ${rowName})`
              : '학생 명단 미일치 (학년, 반, 번호 또는 성명 불일치)')
          : undefined;

        return {
          gradeNum: String(matched?.currentGrade || explicitGrade || grade),
          major: matched?.major || rowMajor || '',
          classInfo: matched?.classInfo || rowClass || '',
          studentNumber: cleanNum(matched?.studentNumber || rowNum || ''),
          studentName: matched?.studentName || rowName || '',
          matchedStudentId: matched?.studentId,
          matchedMajor: matched?.major,
          matchedClass: matched?.classInfo,
          matchedNumber: matched?.studentNumber,
          matchedGrade: matched?.currentGrade,
          rewardType,
          certifiedRank,
          itemName,
          awardedDate,
          remarks,
          isValid,
          errorReason,
        };
      });

      setParsedRows(rows);
    } catch (err: any) {
      console.error(err);
      toast({ title: '파일 분석 실패', description: err?.message || '엑셀 파싱 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const validRows = parsedRows.filter(r => r.isValid && r.matchedStudentId);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  // 학생 수동 매칭 핸들러
  const handleManuallyMatchStudent = (rowIdx: number, student: FullStudentEvaluation) => {
    setParsedRows(prev => {
      const updated = [...prev];
      const target = { ...updated[rowIdx] };
      target.matchedStudentId = student.studentId;
      target.matchedMajor = student.major;
      target.matchedClass = student.classInfo;
      target.matchedNumber = student.studentNumber;
      target.matchedGrade = student.currentGrade;
      target.gradeNum = String(student.currentGrade);
      target.major = student.major;
      target.classInfo = student.classInfo;
      target.studentNumber = cleanNum(student.studentNumber);
      target.studentName = student.studentName;
      target.isValid = true;
      target.errorReason = undefined;
      updated[rowIdx] = target;
      return updated;
    });
    toast({
      title: '학생 매칭 완료',
      description: `${student.studentName} (${student.currentGrade}학년 ${student.classInfo}반 ${cleanNum(student.studentNumber)}번) 학생과 매칭되었습니다.`,
    });
  };

  // 학생 수동 매칭 해제 핸들러
  const handleUnmatchStudent = (rowIdx: number) => {
    setParsedRows(prev => {
      const updated = [...prev];
      const target = { ...updated[rowIdx] };
      target.matchedStudentId = undefined;
      target.matchedMajor = undefined;
      target.matchedClass = undefined;
      target.matchedNumber = undefined;
      target.matchedGrade = undefined;
      target.isValid = false;
      target.errorReason = '수동 매칭 해제됨';
      updated[rowIdx] = target;
      return updated;
    });
    toast({
      title: '매칭 해제 완료',
      description: '해당 행의 학생 매칭이 해제되었습니다.',
    });
  };

  // 일괄 등록 제출
  const handleSubmitBatch = async () => {
    if (validRows.length === 0) {
      toast({ title: '등록 대상 없음', description: '매칭 성공한 학생 데이터가 없습니다.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payloads = validRows.map(r => ({
        studentId: r.matchedStudentId!,
        rewardType: r.rewardType,
        certifiedRank: r.certifiedRank,
        itemName: r.itemName,
        awardedDate: r.awardedDate,
        remarks: r.remarks,
      }));

      const res = await batchImportPastRewardsAction({
        academicYear,
        rewards: payloads,
        gradeNum: grade,
      });

      if (!res.success) {
        toast({ title: '소급 등록 실패', description: res.error || '오류가 발생했습니다.', variant: 'destructive' });
      } else {
        toast({
          title: '🎉 과거 이력 일괄 소급 등록 완료',
          description: `총 ${res.count}명의 과거 수령 기록이 DB에 정상 등록되었습니다.`,
        });
        onOpenChange(false);
        await onSuccess();
      }
    } catch (err: any) {
      toast({ title: '오류 발생', description: err?.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col rounded-2xl p-5 bg-white shadow-xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <UploadCloud className="h-4 w-4" />
            </div>
            <span>과거 수령 이력 엑셀 일괄 소급 등록</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            [학년, 학과, 반, 번호, 성명]이 포함된 수령 대장 엑셀을 업로드하면 학생을 자동으로 찾아 과거 지급 이력을 일괄 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex-1 overflow-y-auto space-y-3.5 py-2 text-xs transition-colors rounded-xl",
            isDragging && "bg-indigo-50/30"
          )}
        >
          {/* 전체 드래그 오버레이 (파일이 드래그 중일 때 화면 전체에 피드백) */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-indigo-900/60 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center text-white gap-3 border-2 border-dashed border-indigo-300 pointer-events-none animate-in fade-in-50">
              <div className="h-16 w-16 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-xl animate-bounce">
                <FileUp className="h-8 w-8" />
              </div>
              <div className="text-center space-y-1">
                <div className="text-base font-black">엑셀 파일을 여기에 놓으세요!</div>
                <div className="text-xs text-indigo-200">자동으로 [학년, 학과, 반, 번호, 성명]을 분석하여 학생을 매칭합니다.</div>
              </div>
            </div>
          )}

          {/* 상단 액션 바: 양식 다운로드 & 파일 업로드 */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="h-8 px-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg gap-1 border-slate-200 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-indigo-600" />
                <span>표준 엑셀 양식 다운로드 (학년·학과·반·번호)</span>
              </Button>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-past-upload"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="h-8 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1.5 shadow-2xs"
              >
                {isProcessingFile ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                <span>{isProcessingFile ? '파일 분석 중...' : '파일 선택 / 드래그 업로드'}</span>
              </Button>
            </div>
          </div>

          {/* 파싱 결과 미리보기 */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">분석 결과 미리보기:</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]">
                    매칭 성공 {validRows.length}명
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px]">
                      미매칭 {invalidRows.length}명 (제외됨)
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setParsedRows([])}
                  className="h-6 text-[11px] text-slate-400 hover:text-rose-600 px-1.5"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  비우기
                </Button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <Table className="text-[11px]">
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-center w-8">상태</TableHead>
                      <TableHead className="text-center w-12">학년</TableHead>
                      <TableHead className="w-24">학과</TableHead>
                      <TableHead className="text-center w-10">반</TableHead>
                      <TableHead className="text-center w-10">번호</TableHead>
                      <TableHead className="w-16 font-bold">엑셀성명</TableHead>
                      <TableHead className="w-48 text-indigo-900 font-bold">매칭 대상 학생 (수동 선택)</TableHead>
                      <TableHead className="text-center w-14">구분</TableHead>
                      <TableHead className="text-center w-12">등급</TableHead>
                      <TableHead className="w-24">품목명</TableHead>
                      <TableHead className="text-center w-24">지급일자</TableHead>
                      <TableHead className="w-28">비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((r, idx) => (
                      <TableRow key={idx} className={r.isValid ? '' : 'bg-rose-50/60'}>
                        <TableCell className="text-center py-1.5">
                          {r.isValid ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                          ) : (
                            <span title={r.errorReason} className="inline-flex justify-center">
                              <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-1.5 font-semibold text-slate-700">
                          {r.gradeNum}학년
                        </TableCell>
                        <TableCell className="py-1.5 text-slate-600 truncate max-w-[90px]">
                          {r.matchedMajor || r.major || '-'}
                        </TableCell>
                        <TableCell className="text-center py-1.5 font-semibold text-slate-700">
                          {r.classInfo ? `${r.classInfo}반` : '-'}
                        </TableCell>
                        <TableCell className="text-center py-1.5 font-mono text-slate-800">
                          {r.studentNumber ? `${r.studentNumber}번` : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 font-black text-slate-900">
                          {r.studentName}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <StudentMatcherPopover
                            row={r}
                            rowIndex={idx}
                            evaluations={allEvaluations}
                            isOpen={openMatcherIdx === idx}
                            onOpenChange={(open) => setOpenMatcherIdx(open ? idx : null)}
                            onSelectStudent={(student) => handleManuallyMatchStudent(idx, student)}
                            onUnmatch={() => handleUnmatchStudent(idx)}
                          />
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                            r.rewardType === 'certificate_award' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {r.rewardType === 'prize' ? '상품' : '인증상'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-1.5 font-extrabold text-indigo-700">
                          {r.certifiedRank}
                        </TableCell>
                        <TableCell className="py-1.5 font-medium text-slate-800 truncate max-w-[110px]">
                          {r.itemName}
                        </TableCell>
                        <TableCell className="text-center py-1.5 text-slate-700 font-mono text-xs font-semibold">
                          {r.awardedDate}
                        </TableCell>
                        <TableCell className="py-1.5 text-slate-500 truncate max-w-[110px]" title={r.remarks}>
                          {r.isValid ? r.remarks : <span className="text-rose-600 font-bold">{r.errorReason}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {parsedRows.length === 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "text-center py-12 px-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-3.5 group select-none",
                isDragging
                  ? "border-indigo-500 bg-indigo-50/80 shadow-md ring-2 ring-indigo-400/40 scale-[1.01]"
                  : "border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 shadow-2xs"
              )}
            >
              <div className={cn(
                "h-16 w-16 rounded-2xl flex items-center justify-center transition-all shadow-xs",
                isDragging 
                  ? "bg-indigo-600 text-white scale-110" 
                  : "bg-white border border-slate-200 text-indigo-600 group-hover:scale-105 group-hover:border-indigo-200 group-hover:shadow-md"
              )}>
                {isProcessingFile ? (
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                ) : isDragging ? (
                  <FileUp className="h-8 w-8 animate-bounce text-white" />
                ) : (
                  <UploadCloud className="h-8 w-8 text-indigo-600 group-hover:scale-110 transition-transform" />
                )}
              </div>

              <div className="space-y-1 text-center">
                <div className="text-sm font-black text-slate-800 group-hover:text-indigo-700 transition-colors">
                  {isProcessingFile
                    ? '엑셀 파일을 분석하고 학생을 매칭하는 중입니다...'
                    : isDragging
                    ? '마우스를 놓으면 파일이 즉시 업로드됩니다!'
                    : '작성한 엑셀 파일을 이곳으로 드래그하거나 클릭하여 선택하세요'}
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  [학년, 학과, 반, 번호, 성명]이 포함된 <strong>.xlsx, .xls, .csv</strong> 파일 지원
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs text-slate-600 font-semibold">
                  ⚡ 5자리 학번 몰라도 [학년·반·번호]로 자동 매칭
                </span>
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs text-slate-600 font-semibold">
                  📂 마우스 드래그앤드롭 / 원클릭 파일 선택 모두 지원
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold rounded-xl"
          >
            닫기
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || validRows.length === 0}
            onClick={handleSubmitBatch}
            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
          >
            {isSubmitting ? '소급 등록 진행 중...' : `매칭 성공 ${validRows.length}명 일괄 소급 등록`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
