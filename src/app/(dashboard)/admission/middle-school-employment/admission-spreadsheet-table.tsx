'use client';

import * as React from 'react';
import {
  Search,
  School,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Filter,
  Users,
  Building2,
  Download,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
  X,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StudentEmploymentData } from '@/lib/data';
import { cn } from '@/lib/utils';
import { batchUpdateMultipleStudentsInlineAction, bulkAssignMiddleSchoolAction, getRegisteredMiddleSchoolsAction } from './actions';
import { useToast } from '@/hooks/use-toast';

interface AdmissionSpreadsheetTableProps {
  students: StudentEmploymentData[];
  baseYear: number;
  onRefreshData?: () => void;
}

export function AdmissionSpreadsheetTable({
  students,
  baseYear,
  onRefreshData,
}: AdmissionSpreadsheetTableProps) {
  const { toast } = useToast();

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedGrade, setSelectedGrade] = React.useState<string>('all');
  const [selectedClass, setSelectedClass] = React.useState<string>('all');
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [onlyMissingMiddleSchool, setOnlyMissingMiddleSchool] = React.useState<boolean>(false);

  // 등록된 출신중학교 자동완성 목록
  const [registeredSchools, setRegisteredSchools] = React.useState<string[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = React.useState<boolean>(false);

  // 인라인 셀 수정 상태: { [studentId]: { middle_school?: string, admission_type?: string, admission_rank_percentile?: string } }
  const [pendingEdits, setPendingEdits] = React.useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  // 다중 체크 선택 상태
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([]);

  // 빠른 다중 할당 모달/팝업 상태
  const [bulkSchoolInput, setBulkSchoolInput] = React.useState('');
  const [isBulkAssigning, setIsBulkAssigning] = React.useState(false);
  const [showBulkAssignBar, setShowBulkAssignBar] = React.useState(false);

  // 등록된 중학교 목록 불러오기
  const loadSchools = React.useCallback(async () => {
    setIsLoadingSchools(true);
    try {
      const schools = await getRegisteredMiddleSchoolsAction();
      setRegisteredSchools(schools);
    } catch (e) {
      console.error('Failed to load registered middle schools:', e);
    } finally {
      setIsLoadingSchools(false);
    }
  }, []);

  React.useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  // 학과, 반 고유 목록 추출
  const majors = React.useMemo(() => {
    return Array.from(new Set(students.map(s => s.major).filter((m): m is string => Boolean(m)))).sort();
  }, [students]);

  const classes = React.useMemo(() => {
    return Array.from(new Set(students.map(s => s.class_info).filter((c): c is string => Boolean(c)))).sort((a, b) => {
      const numA = parseInt(a || '0', 10);
      const numB = parseInt(b || '0', 10);
      return numA - numB;
    });
  }, [students]);

  // 학년 계산 지원 (졸업예정연도 기반)
  const getStudentGrade = (student: StudentEmploymentData): number => {
    const gradYear = student.graduation_year || (baseYear + 3);
    const diff = gradYear - baseYear;
    if (diff === 1) return 3; // 3학년
    if (diff === 2) return 2; // 2학년
    if (diff === 3) return 1; // 1학년
    return 1;
  };

  // 필터링된 학생 데이터
  const filteredStudents = React.useMemo(() => {
    return students.filter(student => {
      // 미입력 필터
      if (onlyMissingMiddleSchool && (student.middle_school || '').trim().length > 0) {
        // 이미 수정 중인 값도 확인
        const pending = pendingEdits[student.id]?.middle_school;
        if (!pending || pending.trim().length === 0) {
          return false;
        }
      }

      // 학년 필터
      if (selectedGrade !== 'all') {
        const grade = getStudentGrade(student);
        if (grade.toString() !== selectedGrade) return false;
      }

      // 반 필터
      if (selectedClass !== 'all' && student.class_info !== selectedClass) {
        return false;
      }

      // 학과 필터
      if (selectedMajor !== 'all' && student.major !== selectedMajor) {
        return false;
      }

      // 검색어 필터 (학번, 이름, 중학교)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = (student.student_name || '').toLowerCase().includes(query);
        const matchNumber = (student.student_number || '').toLowerCase().includes(query);
        const matchSchool = (student.middle_school || '').toLowerCase().includes(query);
        const matchMajor = (student.major || '').toLowerCase().includes(query);
        if (!matchName && !matchNumber && !matchSchool && !matchMajor) return false;
      }

      return true;
    });
  }, [students, onlyMissingMiddleSchool, selectedGrade, selectedClass, selectedMajor, searchTerm, pendingEdits, baseYear]);

  // 전체 선택/해제 토글
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  // 단일 학생 선택 토글
  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 인라인 셀 값 변경 핸들러
  const handleCellEdit = (studentId: string, field: string, value: string) => {
    setPendingEdits(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [field]: value,
      },
    }));
  };

  // 특정 학생의 현재 표시될 값 (수정 중인 값 1순위, 기존 데이터 2순위)
  const getCellValue = (student: StudentEmploymentData, field: 'middle_school' | 'admission_type' | 'admission_rank_percentile') => {
    if (pendingEdits[student.id]?.[field] !== undefined) {
      return pendingEdits[student.id][field];
    }
    const val = student[field];
    if (val === null || val === undefined) return '';
    return String(val);
  };

  // 수정 취소
  const handleResetEdits = () => {
    setPendingEdits({});
  };

  // 일괄 저장
  const handleSaveAllEdits = async () => {
    const studentIds = Object.keys(pendingEdits);
    if (studentIds.length === 0) return;

    setIsSaving(true);
    try {
      const updates = studentIds.map(id => {
        const data = pendingEdits[id];
        return {
          id,
          middle_school: data.middle_school !== undefined ? data.middle_school : undefined,
          admission_type: data.admission_type !== undefined ? data.admission_type : undefined,
          admission_rank_percentile:
            data.admission_rank_percentile !== undefined
              ? data.admission_rank_percentile === ''
                ? null
                : parseFloat(data.admission_rank_percentile)
              : undefined,
        };
      });

      const res = await batchUpdateMultipleStudentsInlineAction(updates);
      if (res.success) {
        toast({
          title: '저장 완료',
          description: `${res.count}명 학생의 출신중학교 및 입학 정보가 저장되었습니다.`,
        });
        setPendingEdits({});
        await loadSchools();
        if (onRefreshData) onRefreshData();
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: res.error || '저장 처리 중 오류가 발생했습니다.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err.message || '저장 시도 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 다중 체크 학생 출신중학교 일괄 변경 (빠른 할당)
  const handleExecuteBulkAssign = async () => {
    if (!bulkSchoolInput.trim()) {
      toast({
        variant: 'destructive',
        title: '중학교명 입력 필요',
        description: '할당할 출신중학교 명칭을 입력해주세요.',
      });
      return;
    }

    if (selectedStudentIds.length === 0) return;

    setIsBulkAssigning(true);
    try {
      const res = await bulkAssignMiddleSchoolAction(selectedStudentIds, bulkSchoolInput.trim());
      if (res.success) {
        toast({
          title: '일괄 할당 완료',
          description: `선택한 ${selectedStudentIds.length}명 학생의 출신중학교를 '${bulkSchoolInput.trim()}'(으)로 일괄 등록했습니다.`,
        });
        setSelectedStudentIds([]);
        setBulkSchoolInput('');
        setShowBulkAssignBar(false);
        await loadSchools();
        if (onRefreshData) onRefreshData();
      } else {
        toast({
          variant: 'destructive',
          title: '일괄 할당 실패',
          description: res.error || '일괄 업데이트 중 오류가 발생했습니다.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err.message || '일괄 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const pendingCount = Object.keys(pendingEdits).length;
  const missingCount = students.filter(s => !(s.middle_school || '').trim()).length;

  return (
    <div className="space-y-4 relative">
      {/* 데이터리스트: 중학교 자동완성 옵션 제공 */}
      <datalist id="registered-middle-schools-list">
        {registeredSchools.map(school => (
          <option key={school} value={school} />
        ))}
      </datalist>

      {/* 1. 상단 컨트롤 툴바 (검색 + 필터 + 미입력 전용 스위치) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold">
              <School className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                출신중학교 스프레드시트 편집기
                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-bold">
                  총 {filteredStudents.length}명 표시 / 전체 {students.length}명
                </Badge>
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold">
                웹상에서 엑셀처럼 학생별 출신중학교를 직접 입력하고 자동완성 기능으로 손쉽게 정비할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 저장 및 초기화 버튼 */}
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetEdits}
                disabled={isSaving}
                className="h-8.5 px-3 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                수정 취소 ({pendingCount})
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAllEdits}
              disabled={pendingCount === 0 || isSaving}
              className={cn(
                "h-8.5 px-4 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer",
                pendingCount > 0
                  ? "bg-purple-600 hover:bg-purple-700 text-white ring-2 ring-purple-400/30 animate-pulse"
                  : "bg-slate-100 text-slate-400 border border-slate-200"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  변경사항 저장 ({pendingCount}건)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 필터 및 조작 바 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center pt-2 border-t border-slate-100">
          {/* 미입력 학생 전용 필터링 토글 스위치 */}
          <div className="md:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyMissingMiddleSchool(prev => !prev)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer w-full justify-between shadow-2xs",
                onlyMissingMiddleSchool
                  ? "bg-rose-500 text-white border-rose-600 ring-2 ring-rose-300"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              <span className="flex items-center gap-1.5">
                <AlertCircle className={cn("h-4 w-4", onlyMissingMiddleSchool ? "text-white" : "text-rose-500")} />
                <span>미입력 학생만 보기</span>
              </span>
              <Badge className={cn("text-[10px] font-black px-1.5", onlyMissingMiddleSchool ? "bg-white text-rose-600" : "bg-rose-100 text-rose-800")}>
                {missingCount}명 누락
              </Badge>
            </button>
          </div>

          {/* 학년/반/학과 선택 드롭다운 */}
          <div className="md:col-span-5 grid grid-cols-3 gap-1.5">
            {/* 학년 */}
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="h-8.5 text-xs font-bold bg-slate-50/80 border-slate-200">
                <SelectValue placeholder="학년 전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">학년 전체</SelectItem>
                <SelectItem value="1">1학년 (신입생)</SelectItem>
                <SelectItem value="2">2학년</SelectItem>
                <SelectItem value="3">3학년</SelectItem>
              </SelectContent>
            </Select>

            {/* 반 */}
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-8.5 text-xs font-bold bg-slate-50/80 border-slate-200">
                <SelectValue placeholder="반 전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">반 전체</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c} value={c}>{c}반</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 학과 */}
            <Select value={selectedMajor} onValueChange={setSelectedMajor}>
              <SelectTrigger className="h-8.5 text-xs font-bold bg-slate-50/80 border-slate-200">
                <SelectValue placeholder="학과 전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">학과 전체</SelectItem>
                {majors.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 검색어 입력 */}
          <div className="md:col-span-3 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="학번/이름/중학교 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8.5 pl-8 pr-7 text-xs bg-slate-50/80 border-slate-200 rounded-xl focus-visible:bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 대량 스프레드시트 데이터 그리드 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="max-h-[620px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-200 backdrop-blur-xs">
              <tr>
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-400 h-3.5 w-3.5 cursor-pointer"
                  />
                </th>
                <th className="w-14 px-3 py-2.5 text-center">학년</th>
                <th className="w-20 px-3 py-2.5">학번</th>
                <th className="w-24 px-3 py-2.5">성명</th>
                <th className="w-32 px-3 py-2.5">학과</th>
                <th className="min-w-[200px] px-3 py-2.5 text-purple-950 font-black">
                  <div className="flex items-center gap-1.5">
                    <School className="h-4 w-4 text-purple-600" />
                    <span>출신중학교 (자동완성 셀)</span>
                  </div>
                </th>
                <th className="w-36 px-3 py-2.5">입학 전형 구분</th>
                <th className="w-28 px-3 py-2.5 text-right pr-4">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <School className="h-8 w-8 opacity-40 text-slate-400" />
                      <p className="font-bold text-xs">조건에 해당하는 학생 데이터가 없습니다.</p>
                      {onlyMissingMiddleSchool && (
                        <p className="text-[11px] text-purple-600 font-semibold">모든 학생의 출신중학교 데이터가 완벽히 입력되어 있습니다! 🎉</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const isEdited = pendingEdits[student.id] !== undefined;
                  const currentMiddleSchool = getCellValue(student, 'middle_school');
                  const currentAdmissionType = getCellValue(student, 'admission_type');
                  const grade = getStudentGrade(student);
                  const isMissing = !currentMiddleSchool.trim();

                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        "transition-colors hover:bg-purple-50/30",
                        isSelected && "bg-purple-50/60",
                        isEdited && "bg-amber-50/70"
                      )}
                    >
                      {/* 체크박스 */}
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(student.id)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-400 h-3.5 w-3.5 cursor-pointer"
                        />
                      </td>

                      {/* 학년 */}
                      <td className="px-3 py-2 text-center">
                        <Badge
                          className={cn(
                            "text-[10px] font-black px-1.5 py-0.5",
                            grade === 1 ? "bg-emerald-100 text-emerald-800" : grade === 2 ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                          )}
                        >
                          {grade}학년
                        </Badge>
                      </td>

                      {/* 학번 */}
                      <td className="px-3 py-2 font-mono text-slate-600 font-medium">
                        {student.student_number || '-'}
                      </td>

                      {/* 성명 */}
                      <td className="px-3 py-2 font-bold text-slate-900">
                        {student.student_name}
                      </td>

                      {/* 학과 */}
                      <td className="px-3 py-2 text-slate-600 text-[11px] truncate max-w-[120px]">
                        {student.major || '-'}
                      </td>

                      {/* 출신중학교 셀 (자동완성 Datalist 연동) */}
                      <td className="px-3 py-1.5">
                        <div className="relative">
                          <Input
                            type="text"
                            list="registered-middle-schools-list"
                            placeholder="중학교명 입력 (예: OO중학교)"
                            value={currentMiddleSchool}
                            onChange={(e) => handleCellEdit(student.id, 'middle_school', e.target.value)}
                            className={cn(
                              "h-8 text-xs font-bold rounded-lg border-slate-200 transition-all",
                              isMissing ? "bg-rose-50/50 border-rose-300 text-rose-900 placeholder:text-rose-400 focus:bg-white" : "bg-white text-slate-900",
                              isEdited && "border-amber-400 ring-2 ring-amber-300/40 bg-amber-50"
                            )}
                          />
                        </div>
                      </td>

                      {/* 입학 전형 구분 셀 */}
                      <td className="px-3 py-1.5">
                        <Input
                          type="text"
                          placeholder="전형 구분 (예: 일반전형/특별전형)"
                          value={currentAdmissionType}
                          onChange={(e) => handleCellEdit(student.id, 'admission_type', e.target.value)}
                          className={cn(
                            "h-8 text-xs font-medium rounded-lg border-slate-200 bg-white",
                            isEdited && "border-amber-400 bg-amber-50"
                          )}
                        />
                      </td>

                      {/* 상태 배지 */}
                      <td className="px-3 py-2 text-right pr-4">
                        {isEdited ? (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold">수정됨</Badge>
                        ) : isMissing ? (
                          <Badge className="bg-rose-100 text-rose-700 text-[10px] font-bold">미입력</Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium">완료</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 하단 다중 선택 "빠른 일괄 할당" 고정 플로팅 바 */}
      {selectedStudentIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-purple-400" />
            <span className="text-xs font-bold">
              <strong className="text-purple-300">{selectedStudentIds.length}명</strong>의 학생이 선택됨
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* 일괄 지정 입력 폼 */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              list="registered-middle-schools-list"
              placeholder="일괄 적용할 출신중학교 명칭..."
              value={bulkSchoolInput}
              onChange={(e) => setBulkSchoolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleExecuteBulkAssign();
                }
              }}
              className="h-8.5 text-xs font-bold bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 w-56 focus-visible:ring-purple-400"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleExecuteBulkAssign}
              disabled={isBulkAssigning || !bulkSchoolInput.trim()}
              className="h-8.5 px-3.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs cursor-pointer"
            >
              {isBulkAssigning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  한번에 일괄 지정
                </>
              )}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedStudentIds([])}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer ml-2"
            title="선택 해제"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
