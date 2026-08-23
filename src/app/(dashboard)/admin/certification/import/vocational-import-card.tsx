'use client';

import * as React from 'react';
import { 
  parseSingleVocationalFile, 
  buildStudentCentricVocalRows,
  generateVocationalTemplate, 
  RawVocalRecord,
  StudentVocalMatchRow,
} from '@/lib/vocational-parser';
import { 
  getAllStudentsForMatching, 
  batchImportVocationalAction, 
  VocationalImportStudentRow 
} from '../actions';
import { DeleteMyRecordsDialog } from './delete-my-records-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  Award, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Loader2, 
  Trash2, 
  Save, 
  Download, 
  Search,
  ChevronDown,
  UserCheck,
  CheckSquare,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VocationalImportCardProps {
  isAdmin: boolean;
  userProfile: any;
  baseYear?: number;
  onImportSuccess?: () => void;
}

export function VocationalImportCard({
  isAdmin,
  userProfile,
  baseYear = 2026,
  onImportSuccess,
}: VocationalImportCardProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [files, setFiles] = React.useState<File[]>([]);
  const [rawRecords, setRawRecords] = React.useState<RawVocalRecord[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  // 수동 선택 상태 Map: `${studentId}_grade_${gradeNum}` -> rawRecord.id (or 'none')
  const [manualSelections, setManualSelections] = React.useState<Record<string, string>>({});

  // DB 전교생 목록 캐시
  const [dbStudents, setDbStudents] = React.useState<any[]>([]);

  // 서식 다운로드 학년도 선택 상태
  const [templateYear, setTemplateYear] = React.useState<number>(baseYear);

  React.useEffect(() => {
    setTemplateYear(baseYear);
  }, [baseYear]);

  // 검색 및 필터 상태
  const [search, setSearch] = React.useState('');
  const [selectedGradeTab, setSelectedGradeTab] = React.useState<string>('all'); // 'all', '3', '2', '1'
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'ambiguous' | 'matched' | 'empty'>('all');

  React.useEffect(() => {
    getAllStudentsForMatching().then(res => {
      setDbStudents(res || []);
    });
  }, []);

  // 파일 선택 및 파싱 처리
  const handleFileChange = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsParsing(true);
    const fileArr = Array.from(selectedFiles).filter(f => 
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );

    if (fileArr.length === 0) {
      toast({
        title: '지원하지 않는 파일 형식',
        description: '.xlsx 또는 .xls 엑셀 파일만 업로드 가능합니다.',
        variant: 'destructive'
      });
      setIsParsing(false);
      return;
    }

    try {
      let currentStudents = dbStudents;
      if (currentStudents.length === 0) {
        currentStudents = await getAllStudentsForMatching();
        setDbStudents(currentStudents);
      }

      const allNewRecords: RawVocalRecord[] = [];

      for (const file of fileArr) {
        const buffer = await file.arrayBuffer();
        const records = parseSingleVocationalFile(buffer, file.name, baseYear);
        allNewRecords.push(...records);
      }

      setFiles(prev => [...prev, ...fileArr]);
      setRawRecords(prev => [...prev, ...allNewRecords]);

      toast({
        title: '직공통 평가 파일 분석 완료',
        description: `총 ${fileArr.length}개 파일에서 ${allNewRecords.length}건의 과거 평가 기록을 로드했습니다. 현재 재학생 기준으로 자동 매핑되었습니다.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: '파일 분석 실패',
        description: err.message || '엑셀 파일을 읽는 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 초기화
  const handleClear = () => {
    setFiles([]);
    setRawRecords([]);
    setManualSelections({});
    setSearch('');
  };

  // 템플릿 다운로드 핸들러
  const handleDownloadTemplate = async (grade: number, isMock: boolean = false, yearToUse: number = templateYear) => {
    try {
      const templateBuffer = await generateVocationalTemplate(yearToUse, grade, isMock);
      const blob = new Blob([templateBuffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const evalTypeName = isMock ? '모의평가' : (grade === 3 ? '전국단위평가' : '자가진단평가');
      a.download = `(${yearToUse}학년도_${grade}학년)_직업공통능력평가_${evalTypeName}_일괄서식.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: '일괄 업로드 서식 다운로드 완료',
        description: `${yearToUse}학년도 ${grade}학년 직업공통능력평가 ${evalTypeName} 표준 서식이 다운로드되었습니다.`,
      });
    } catch (err: any) {
      toast({
        title: '다운로드 실패',
        description: err.message || '템플릿 생성 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  // 올해 재학생 기준 매핑된 행 목록 계산
  const studentRows = React.useMemo(() => {
    if (rawRecords.length === 0 || dbStudents.length === 0) return [];
    return buildStudentCentricVocalRows(rawRecords, dbStudents, baseYear, manualSelections);
  }, [rawRecords, dbStudents, baseYear, manualSelections]);

  // 학과 목록 추출
  const availableMajors = React.useMemo(() => {
    const majors = new Set(studentRows.map(r => r.currentMajor).filter(Boolean));
    return Array.from(majors).sort();
  }, [studentRows]);

  // 검색 및 필터 적용
  const filteredRows = React.useMemo(() => {
    return studentRows.filter(r => {
      // 1. 학년 필터
      if (selectedGradeTab !== 'all' && String(r.currentGrade) !== selectedGradeTab) {
        return false;
      }

      // 2. 학과 필터
      if (selectedMajor !== 'all' && r.currentMajor !== selectedMajor) {
        return false;
      }

      // 3. 상태 필터
      if (filterStatus === 'ambiguous' && !r.hasAmbiguity) return false;
      if (filterStatus === 'matched' && (r.hasAmbiguity || (!r.grade1Record && !r.grade2Record && !r.grade3Record))) return false;
      if (filterStatus === 'empty' && (r.grade1Record || r.grade2Record || r.grade3Record)) return false;

      // 4. 검색어 필터
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.currentMajor.toLowerCase().includes(q) ||
        `${r.currentGrade}학년 ${r.currentClass}반 ${r.currentNumber}번`.includes(q)
      );
    });
  }, [studentRows, selectedGradeTab, selectedMajor, filterStatus, search]);

  // 통계 계산
  const stats = React.useMemo(() => {
    const totalStudents = studentRows.length;
    const ambiguousCount = studentRows.filter(r => r.hasAmbiguity).length;
    const withDataCount = studentRows.filter(r => r.grade1Record || r.grade2Record || r.grade3Record).length;
    const cleanMatchedCount = withDataCount - ambiguousCount;

    return { totalStudents, ambiguousCount, withDataCount, cleanMatchedCount };
  }, [studentRows]);

  // 동명이인 수동 선택 핸들러
  const handleSelectPastRecord = (studentId: string, gradeNum: number, rawRecordId: string) => {
    const key = `${studentId}_grade_${gradeNum}`;
    setManualSelections(prev => ({
      ...prev,
      [key]: rawRecordId
    }));
  };

  // DB 일괄 저장 실행
  const handleSaveToDb = async () => {
    if (studentRows.length === 0) return;

    setIsSaving(true);
    try {
      const importRows: VocationalImportStudentRow[] = [];

      for (const r of studentRows) {
        // 1학년 데이터 반영
        if (r.grade1Record) {
          importRows.push({
            studentId: r.studentId,
            grade: 1,
            academicYear: r.grade1Record.academicYear,
            korean: r.grade1Record.korean,
            english: r.grade1Record.english,
            math: r.grade1Record.math,
            problem: r.grade1Record.problem,
            gradeSum: r.grade1Record.gradeSum,
            isCompleted: r.grade1Record.isCompleted,
            studentName: r.studentName,
          });
        }

        // 2학년 데이터 반영
        if (r.grade2Record) {
          importRows.push({
            studentId: r.studentId,
            grade: 2,
            academicYear: r.grade2Record.academicYear,
            korean: r.grade2Record.korean,
            english: r.grade2Record.english,
            math: r.grade2Record.math,
            problem: r.grade2Record.problem,
            gradeSum: r.grade2Record.gradeSum,
            isCompleted: r.grade2Record.isCompleted,
            studentName: r.studentName,
          });
        }

        // 3학년 데이터 반영
        if (r.grade3Record) {
          importRows.push({
            studentId: r.studentId,
            grade: 3,
            academicYear: r.grade3Record.academicYear,
            korean: r.grade3Record.korean,
            english: r.grade3Record.english,
            math: r.grade3Record.math,
            problem: r.grade3Record.problem,
            gradeSum: r.grade3Record.gradeSum,
            isCompleted: r.grade3Record.isCompleted,
            studentName: r.studentName,
          });
        }
      }

      if (importRows.length === 0) {
        toast({
          title: '저장할 평가 데이터 없음',
          description: '재학생에게 매칭된 직공통 평가 기록이 없습니다.',
          variant: 'destructive'
        });
        setIsSaving(false);
        return;
      }

      const res = await batchImportVocationalAction(importRows);

      if (!res.success) {
        throw new Error(res.error || '저장에 실패했습니다.');
      }

      toast({
        title: '직공통 평가 점수 일괄 반영 완료! 🎉',
        description: `총 ${res.updatedCount}건의 학년별 평가 점수가 올해 재학생에게 성공적으로 반영되었습니다.`,
      });

      if (onImportSuccess) onImportSuccess();
    } catch (err: any) {
      console.error(err);
      toast({
        title: '일괄 저장 실패',
        description: err.message || '데이터베이스 저장 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50/80 border-b border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>직업공통능력평가 등급 일괄 등록</span>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-bold">
                  {baseYear}학년도 재학생 기준
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                과거 자가진단 및 전국단위평가 엑셀을 업로드하면 <strong>현재({baseYear}학년도) 재학생의 학과·반·번호 기준</strong>으로 자동 매핑하여 등록합니다.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="h-10 px-3.5 text-xs sm:text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 font-black rounded-xl gap-2 shadow-xs cursor-pointer transition-all"
              title="내가 등록한 직공통 평가 등급 데이터를 확인하고 수정/삭제합니다"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span>등록 내역 관리 (수정/삭제)</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-4 text-xs sm:text-sm bg-indigo-50/90 hover:bg-indigo-100 text-indigo-800 border-2 border-indigo-200 hover:border-indigo-300 font-black rounded-xl gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <Download className="h-4 w-4 text-indigo-600" />
                  <span>일괄 업로드 서식 다운로드</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-[300px] rounded-xl text-xs font-semibold p-1.5 shadow-xl border-slate-200">
                {/* 서식 기준 학년도 선택 헤더 */}
                <div className="p-2.5 mb-1 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>서식 평가 학년도 선택</span>
                    <Badge className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5">
                      {templateYear}학년도 서식
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {[baseYear - 2, baseYear - 1, baseYear, baseYear + 1].map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTemplateYear(y);
                        }}
                        className={cn(
                          "flex-1 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer",
                          templateYear === y
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                        )}
                      >
                        {y}년
                      </button>
                    ))}
                  </div>
                </div>

                <DropdownMenuItem onClick={() => handleDownloadTemplate(1, false, templateYear)} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">[{templateYear}학년도] 1학년 자가진단평가 표준서식</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">직업공통능력 자가진단평가 (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadTemplate(2, false, templateYear)} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">[{templateYear}학년도] 2학년 자가진단평가 표준서식</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">직업공통능력 자가진단평가 (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadTemplate(3, true, templateYear)} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-violet-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">[{templateYear}학년도] 3학년 모의평가 표준서식</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">직업공통능력 모의평가 (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadTemplate(3, false, templateYear)} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">[{templateYear}학년도] 3학년 전국단위평가 표준서식</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">직업공통능력 전국단위평가 (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {files.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-10 px-3 text-xs text-slate-500 hover:text-rose-600 font-bold rounded-xl gap-1"
              >
                <Trash2 className="h-4 w-4" />
                <span>초기화</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* 드래그 앤 드롭 업로드 영역 */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFileChange(e.dataTransfer.files);
          }}
          className={cn(
            "border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3",
            files.length > 0 
              ? "border-indigo-300 bg-indigo-50/20 hover:bg-indigo-50/40" 
              : "border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx, .xls"
            onChange={(e) => handleFileChange(e.target.files)}
            className="hidden"
          />

          <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
            {isParsing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <UploadCloud className="h-6 w-6" />
            )}
          </div>

          <div>
            <p className="text-sm font-black text-slate-800">
              엑셀 파일들을 클릭하거나 드래그하여 업로드하세요
            </p>
            <p className="text-xs text-slate-500 mt-1">
              과거의 데이터는 {baseYear}학년도 현재 학년 기준으로 자동 통합 분석됩니다.
            </p>
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-2 max-w-2xl">
              {files.map((f, i) => (
                <Badge key={i} className="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-1 gap-1.5 shadow-2xs">
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>{f.name}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 요약 통계 카드 */}
        {studentRows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block">대상 재학생 (현재)</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.totalStudents}명</span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 block">과거 데이터 매칭 성공</span>
              <span className="text-xl font-black text-emerald-700 mt-0.5 block">{stats.cleanMatchedCount}명</span>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-700 block">동명이인 (과거 데이터 선택 필요)</span>
              <span className="text-xl font-black text-amber-700 mt-0.5 block">{stats.ambiguousCount}명</span>
            </div>
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
              <span className="text-[11px] font-bold text-indigo-700 block">평가 데이터 반영 예정</span>
              <span className="text-xl font-black text-indigo-700 mt-0.5 block">{stats.withDataCount}명</span>
            </div>
          </div>
        )}

        {/* 재학생 기준 미리보기 테이블 및 필터/검색 바 */}
        {studentRows.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                {/* 학년 탭 선택 */}
                <div className="flex items-center bg-slate-200/80 p-1 rounded-xl">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGradeTab('all')}
                    className={cn(
                      "h-7 px-3 text-xs font-extrabold rounded-lg transition-all",
                      selectedGradeTab === 'all' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    전체 학년
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGradeTab('3')}
                    className={cn(
                      "h-7 px-3 text-xs font-extrabold rounded-lg transition-all",
                      selectedGradeTab === '3' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    3학년
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGradeTab('2')}
                    className={cn(
                      "h-7 px-3 text-xs font-extrabold rounded-lg transition-all",
                      selectedGradeTab === '2' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    2학년
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGradeTab('1')}
                    className={cn(
                      "h-7 px-3 text-xs font-extrabold rounded-lg transition-all",
                      selectedGradeTab === '1' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    1학년
                  </Button>
                </div>

                {/* 학과 필터 */}
                {availableMajors.length > 0 && (
                  <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                    <SelectTrigger className="h-8 text-xs w-36 rounded-xl bg-white">
                      <SelectValue placeholder="전체 학과" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 학과</SelectItem>
                      {availableMajors.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* 상태 필터 */}
                <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                  <SelectTrigger className="h-8 text-xs w-36 rounded-xl bg-white">
                    <SelectValue placeholder="매칭 상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태 ({studentRows.length})</SelectItem>
                    <SelectItem value="ambiguous">동명이인 ({stats.ambiguousCount})</SelectItem>
                    <SelectItem value="matched">매칭 완료 ({stats.cleanMatchedCount})</SelectItem>
                    <SelectItem value="empty">미제출자 ({stats.totalStudents - stats.withDataCount})</SelectItem>
                  </SelectContent>
                </Select>

                {/* 검색 인풋 */}
                <div className="relative w-48 sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="학생 성명, 번호 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-white rounded-xl"
                  />
                </div>
              </div>

              {/* 저장 버튼 */}
              <Button
                type="button"
                onClick={handleSaveToDb}
                disabled={isSaving || stats.withDataCount === 0}
                className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl gap-2 shadow-md shrink-0 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>데이터베이스 반영 중...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>DB 일괄 반영하기 ({stats.withDataCount}명)</span>
                  </>
                )}
              </Button>
            </div>

            {/* 메인 테이블 (올해 재학생 중심) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="max-h-[480px] overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-100/90 sticky top-0 z-10">
                    <TableRow className="text-[11px] font-black text-slate-700">
                      <TableHead className="w-24 text-center">현재 학적</TableHead>
                      <TableHead className="w-28">현재 학과</TableHead>
                      <TableHead className="w-20 font-bold">학생 성명</TableHead>
                      <TableHead className="w-60">1학년 자가진단 (매칭)</TableHead>
                      <TableHead className="w-60">2학년 자가진단 (매칭)</TableHead>
                      <TableHead className="w-60">3학년 전국/모의평가 (매칭)</TableHead>
                      <TableHead className="w-24 text-center">직공통 합산</TableHead>
                      <TableHead className="w-24 text-center">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-slate-400 text-xs font-bold">
                          조건에 일치하는 학생이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((st) => {
                        return (
                          <TableRow key={st.studentId} className={cn("hover:bg-slate-50/80", st.hasAmbiguity && "bg-amber-50/30")}>
                            {/* 현재 학적 */}
                            <TableCell className="text-center font-black text-slate-800 whitespace-nowrap">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-white border-slate-300">
                                {st.currentGrade}학년 {st.currentClass}반 {st.currentNumber}번
                              </Badge>
                            </TableCell>

                            {/* 현재 학과 */}
                            <TableCell className="font-semibold text-slate-800 whitespace-nowrap">
                              {st.currentMajor}
                            </TableCell>

                            {/* 학생 성명 */}
                            <TableCell className="font-extrabold text-slate-900 whitespace-nowrap">
                              {st.studentName}
                            </TableCell>

                            {/* 1학년 자가진단 매칭 열 */}
                            <TableCell>
                              {st.grade1Candidates.length > 1 ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] font-bold px-1 py-0 shrink-0">
                                      동명이인 ({st.grade1Candidates.length}건)
                                    </Badge>
                                    <span className="text-[10px] text-slate-500">과거 1학년 데이터 선택:</span>
                                  </div>
                                  <Select
                                    value={st.grade1SelectedId || 'none'}
                                    onValueChange={(val) => handleSelectPastRecord(st.studentId, 1, val)}
                                  >
                                    <SelectTrigger className={cn(
                                      "h-7 text-[11px] w-full rounded-lg transition-all",
                                      st.grade1SelectedId && st.grade1SelectedId !== 'none'
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                                        : "bg-amber-50/80 border-amber-300 text-amber-900 font-medium"
                                    )}>
                                      <SelectValue placeholder="선택 안 함 (선택 필요)" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-medium">
                                      <SelectItem value="none" className="text-slate-500 font-bold">
                                        ❌ 선택 안 함 (미지정 / 0점)
                                      </SelectItem>
                                      {st.grade1Candidates.map(c => {
                                        const domStr = `[국${c.korean > 0 ? c.korean : '미'}/영${c.english > 0 ? c.english : '미'}/수${c.math > 0 ? c.math : '미'}/문${c.problem > 0 ? c.problem : '미'}]`;
                                        return (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.rawClass} {c.rawNumber}번 ➔ {c.gradeSum > 0 ? `${c.gradeSum}등급` : '미응시'} ({c.calculatedScore}점) {domStr}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : st.grade1Record ? (
                                <div className="flex items-center justify-between gap-1 p-1 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-[11px]">
                                  <div className="flex items-center gap-1 font-semibold text-emerald-900 truncate">
                                    <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1 py-0.5 rounded shrink-0">
                                      {st.grade1Record.rawClass} {st.grade1Record.rawNumber}번
                                    </span>
                                    <span className="truncate">
                                      {st.grade1Record.gradeSum > 0 ? `${st.grade1Record.gradeSum}등급` : '미응시'} [국{st.grade1Record.korean > 0 ? st.grade1Record.korean : '미'}/영{st.grade1Record.english > 0 ? st.grade1Record.english : '미'}/수{st.grade1Record.math > 0 ? st.grade1Record.math : '미'}/문{st.grade1Record.problem > 0 ? st.grade1Record.problem : '미'}]
                                    </span>
                                  </div>
                                  <span className="font-extrabold text-indigo-700 shrink-0">
                                    {st.grade1Record.calculatedScore}점
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">- (미응시/미등록)</span>
                              )}
                            </TableCell>

                            {/* 2학년 자가진단 매칭 열 */}
                            <TableCell>
                              {st.grade2Candidates.length > 1 ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] font-bold px-1 py-0 shrink-0">
                                      동명이인 ({st.grade2Candidates.length}건)
                                    </Badge>
                                    <span className="text-[10px] text-slate-500">과거 2학년 데이터 선택:</span>
                                  </div>
                                  <Select
                                    value={st.grade2SelectedId || 'none'}
                                    onValueChange={(val) => handleSelectPastRecord(st.studentId, 2, val)}
                                  >
                                    <SelectTrigger className={cn(
                                      "h-7 text-[11px] w-full rounded-lg transition-all",
                                      st.grade2SelectedId && st.grade2SelectedId !== 'none'
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                                        : "bg-amber-50/80 border-amber-300 text-amber-900 font-medium"
                                    )}>
                                      <SelectValue placeholder="선택 안 함 (선택 필요)" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-medium">
                                      <SelectItem value="none" className="text-slate-500 font-bold">
                                        ❌ 선택 안 함 (미지정 / 0점)
                                      </SelectItem>
                                      {st.grade2Candidates.map(c => {
                                        const domStr = `[국${c.korean > 0 ? c.korean : '미'}/영${c.english > 0 ? c.english : '미'}/수${c.math > 0 ? c.math : '미'}/문${c.problem > 0 ? c.problem : '미'}]`;
                                        return (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.rawClass} {c.rawNumber}번 ➔ {c.gradeSum > 0 ? `${c.gradeSum}등급` : '미응시'} ({c.calculatedScore}점) {domStr}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : st.grade2Record ? (
                                <div className="flex items-center justify-between gap-1 p-1 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-[11px]">
                                  <div className="flex items-center gap-1 font-semibold text-emerald-900 truncate">
                                    <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1 py-0.5 rounded shrink-0">
                                      {st.grade2Record.rawClass} {st.grade2Record.rawNumber}번
                                    </span>
                                    <span className="truncate">
                                      {st.grade2Record.gradeSum > 0 ? `${st.grade2Record.gradeSum}등급` : '미응시'} [국{st.grade2Record.korean > 0 ? st.grade2Record.korean : '미'}/영{st.grade2Record.english > 0 ? st.grade2Record.english : '미'}/수{st.grade2Record.math > 0 ? st.grade2Record.math : '미'}/문{st.grade2Record.problem > 0 ? st.grade2Record.problem : '미'}]
                                    </span>
                                  </div>
                                  <span className="font-extrabold text-indigo-700 shrink-0">
                                    {st.grade2Record.calculatedScore}점
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">- (미응시/미등록)</span>
                              )}
                            </TableCell>

                            {/* 3학년 전국단위/모의평가 매칭 열 */}
                            <TableCell>
                              {st.grade3Candidates.length > 1 ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] font-bold px-1 py-0 shrink-0">
                                      동명이인 ({st.grade3Candidates.length}건)
                                    </Badge>
                                    <span className="text-[10px] text-slate-500">3학년 데이터 선택:</span>
                                  </div>
                                  <Select
                                    value={st.grade3SelectedId || 'none'}
                                    onValueChange={(val) => handleSelectPastRecord(st.studentId, 3, val)}
                                  >
                                    <SelectTrigger className={cn(
                                      "h-7 text-[11px] w-full rounded-lg transition-all",
                                      st.grade3SelectedId && st.grade3SelectedId !== 'none'
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                                        : "bg-amber-50/80 border-amber-300 text-amber-900 font-medium"
                                    )}>
                                      <SelectValue placeholder="선택 안 함 (선택 필요)" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-medium">
                                      <SelectItem value="none" className="text-slate-500 font-bold">
                                        ❌ 선택 안 함 (미지정 / 0점)
                                      </SelectItem>
                                      {st.grade3Candidates.map(c => {
                                        const domStr = `[국${c.korean > 0 ? c.korean : '미'}/영${c.english > 0 ? c.english : '미'}/수${c.math > 0 ? c.math : '미'}/문${c.problem > 0 ? c.problem : '미'}]`;
                                        return (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.rawClass} {c.rawNumber}번 ➔ {c.gradeSum > 0 ? `${c.gradeSum}등급` : '미응시'} ({c.calculatedScore}점) {domStr}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : st.grade3Record ? (
                                <div className="flex items-center justify-between gap-1 p-1 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-[11px]">
                                  <div className="flex items-center gap-1 font-semibold text-emerald-900 truncate">
                                    <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1 py-0.5 rounded shrink-0">
                                      {st.grade3Record.rawClass} {st.grade3Record.rawNumber}번
                                    </span>
                                    <span className="truncate">
                                      {st.grade3Record.gradeSum > 0 ? `${st.grade3Record.gradeSum}등급` : '미응시'} [국{st.grade3Record.korean > 0 ? st.grade3Record.korean : '미'}/영{st.grade3Record.english > 0 ? st.grade3Record.english : '미'}/수{st.grade3Record.math > 0 ? st.grade3Record.math : '미'}/문{st.grade3Record.problem > 0 ? st.grade3Record.problem : '미'}]
                                    </span>
                                  </div>
                                  <span className="font-extrabold text-indigo-700 shrink-0">
                                    {st.grade3Record.calculatedScore}점
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">- (미응시/미등록)</span>
                              )}
                            </TableCell>

                            {/* 직기초 총 환산 점수 */}
                            <TableCell className="text-center font-extrabold text-indigo-700 align-middle">
                              {st.totalScore > 0 ? `${st.totalScore}점` : '0점'}
                            </TableCell>

                            {/* 매칭 상태 */}
                            <TableCell className="text-center align-middle">
                              {st.hasAmbiguity ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold px-1.5 py-0.5 gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>선택 필요</span>
                                </Badge>
                              ) : (st.grade1Record || st.grade2Record || st.grade3Record) ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold px-1.5 py-0.5 gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>매칭 완료</span>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400 text-[10px] px-1.5 py-0.5 border-slate-200">
                                  기록 없음
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    <DeleteMyRecordsDialog
      open={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
      category="vocational"
      categoryTitle="직업공통능력평가 등급"
      isAdmin={isAdmin}
      onSuccess={() => {
        if (onImportSuccess) onImportSuccess();
      }}
    />
  </>
);
}
