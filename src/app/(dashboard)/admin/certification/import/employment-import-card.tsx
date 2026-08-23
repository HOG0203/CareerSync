'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Briefcase, 
  Download, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Save, 
  Search, 
  Loader2, 
  ChevronDown, 
  Sparkles,
  Info,
  Layers,
  GraduationCap,
  Award,
  Building,
  UserCheck,
  UserX,
  Settings2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { 
  parseEmploymentWorkbook, 
  buildUploadedOnlyEmploymentRows, 
  generateEmploymentTemplate,
  RawEmploymentRecord,
  UploadedStudentEmploymentRow
} from '@/lib/employment-parser';
import { getEvaluationsStore, batchImportEmploymentAction } from '../actions';
import { ManualStudentMatchingDialog, ManualMatchTarget } from './manual-student-matching-dialog';
import { DeleteMyRecordsDialog } from './delete-my-records-dialog';

interface EmploymentImportCardProps {
  isAdmin: boolean;
  userProfile: any;
  baseYear?: number;
  onImportSuccess?: () => void;
}

export function EmploymentImportCard({
  isAdmin,
  userProfile,
  baseYear = 2026,
  onImportSuccess,
}: EmploymentImportCardProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const [activeStudents, setActiveStudents] = React.useState<any[]>([]);
  const [existingStore, setExistingStore] = React.useState<Record<string, any>>({});
  
  const [files, setFiles] = React.useState<File[]>([]);
  const [rawRecords, setRawRecords] = React.useState<RawEmploymentRecord[]>([]);
  const [manualSelections, setManualSelections] = React.useState<Record<string, string>>({});

  // 수동 매칭 모달 대상
  const [matchingTarget, setMatchingTarget] = React.useState<ManualMatchTarget | null>(null);

  // 필터링 상태
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'matched' | 'unmatched'>('all');
  const [gradeTab, setGradeTab] = React.useState<'all' | 'grade3' | 'grade2' | 'grade1'>('all');
  const [searchName, setSearchName] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState('all');
  const [activeCategoryTab, setActiveCategoryTab] = React.useState<'all' | 'club' | 'edu' | 'course' | 'contest' | 'field'>('all');

  // 1. 2026학년도 1·2·3학년 전체 재학생 & 기존 저장소 로드
  const loadInitialData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      // 3학년 (baseYear + 1 졸업), 2학년 (baseYear + 2 졸업), 1학년 (baseYear + 3 졸업)
      const gradYears = [baseYear + 1, baseYear + 2, baseYear + 3];
      
      const [studentsRes, storeRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, student_id, student_name, student_number, major, class_info, graduation_year')
          .in('graduation_year', gradYears)
          .range(0, 4999)
          .order('graduation_year', { ascending: true })
          .order('class_info', { ascending: true })
          .order('student_number', { ascending: true }),
        getEvaluationsStore()
      ]);

      if (studentsRes.error) throw studentsRes.error;
      setActiveStudents(studentsRes.data || []);
      setExistingStore(storeRes || {});
    } catch (err: any) {
      console.error(err);
      toast({
        title: '데이터 로드 실패',
        description: err.message || '재학생 목록을 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [baseYear, toast]);

  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. 엑셀 파일 파싱 핸들러
  const handleFileChange = async (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    setIsParsing(true);
    try {
      const fileArr = Array.from(incomingFiles);
      const allNewRecords: RawEmploymentRecord[] = [];

      for (const file of fileArr) {
        const buffer = await file.arrayBuffer();
        const records = parseEmploymentWorkbook(buffer, file.name);
        allNewRecords.push(...records);
      }

      setFiles(prev => [...prev, ...fileArr]);
      setRawRecords(prev => [...prev, ...allNewRecords]);

      // 업로드된 데이터의 성격에 따라 뷰 탭 자동 전환 (해당 입력 데이터 탭이 기본으로 선택됨)
      const hasClub = allNewRecords.some(r => r.majorClub);
      const hasEdu = allNewRecords.some(r => r.industryEdu);
      const hasCourse = allNewRecords.some(r => r.careerCourse);
      const hasContest = allNewRecords.some(r => r.skillsContest);
      const hasField = allNewRecords.some(r => r.fieldTraining || r.apprenticeship || r.employedEarly);

      const activeTypes = [
        hasEdu && 'edu',
        hasCourse && 'course',
        hasClub && 'club',
        hasContest && 'contest',
        hasField && 'field'
      ].filter(Boolean) as ('edu' | 'course' | 'club' | 'contest' | 'field')[];

      if (activeTypes.length === 1) {
        setActiveCategoryTab(activeTypes[0]);
      } else {
        // 파일명 기반으로 해당 서식 전용 탭 우선 활성화
        const fileNames = fileArr.map(f => f.name).join(' ');
        if (fileNames.includes('현장실습') || fileNames.includes('도제') || fileNames.includes('취업') || fileNames.includes('5.현장')) {
          setActiveCategoryTab('field');
        } else if (fileNames.includes('전공동아리') || fileNames.includes('전공심화') || fileNames.includes('3.전공')) {
          setActiveCategoryTab('club');
        } else if (fileNames.includes('산학협력') || fileNames.includes('교육이수') || fileNames.includes('2.산학')) {
          setActiveCategoryTab('edu');
        } else if (fileNames.includes('취업진로') || fileNames.includes('코스') || fileNames.includes('1.취업')) {
          setActiveCategoryTab('course');
        } else if (fileNames.includes('기능경기') || fileNames.includes('기능대회') || fileNames.includes('4.기능')) {
          setActiveCategoryTab('contest');
        } else if (activeTypes.length > 0) {
          setActiveCategoryTab(activeTypes[0]);
        } else {
          setActiveCategoryTab('all');
        }
      }

      toast({
        title: '취업역량 엑셀 분석 완료',
        description: `총 ${fileArr.length}개 파일에서 ${allNewRecords.length}건의 실적 데이터를 로드했습니다.`,
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
    }
  };

  // 3. 서식 다운로드 핸들러 (개별 세부 서식 5종 - 드롭다운 목록 포함)
  const handleDownloadTemplate = async (type: 'course' | 'club' | 'contest' | 'field' | 'edu') => {
    try {
      const data = await generateEmploymentTemplate(type, baseYear);
      const blob = new Blob([data as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const nameMap: Record<string, string> = {
        course: '1.취업진로코스_참여명단_서식',
        edu: '2.산학협력_교육이수_명단_서식',
        club: '3.전공심화동아리_참여명단_서식',
        contest: '4.기능경기대회_입상명단_서식',
        field: '5.현장실습_도제_취업_명단_서식'
      };
      
      a.download = `(${baseYear}학년도)_${nameMap[type]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: '일괄 업로드 서식 다운로드 완료',
        description: `${nameMap[type]} 파일(드롭다운 유효성 검사 탑재)이 다운로드되었습니다.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: '서식 다운로드 실패',
        description: err.message || '서식 생성 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleClear = () => {
    setFiles([]);
    setRawRecords([]);
    setManualSelections({});
    setActiveCategoryTab('all');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 동명이인 수동 매칭 선택 핸들러
  const handleManualSelection = (rowKey: string, studentId: string) => {
    setManualSelections(prev => ({
      ...prev,
      [rowKey]: studentId,
    }));
  };

  // 4. 업로드된 엑셀에 등장하는 학생들만 추출 & DB 대조
  const uploadedRows: UploadedStudentEmploymentRow[] = React.useMemo(() => {
    if (rawRecords.length === 0) return [];
    return buildUploadedOnlyEmploymentRows(activeStudents, existingStore, rawRecords, manualSelections, baseYear);
  }, [activeStudents, existingStore, rawRecords, manualSelections, baseYear]);

  // 필터링 적용된 목록
  const filteredRows = React.useMemo(() => {
    return uploadedRows.filter(row => {
      if (statusFilter === 'matched' && row.matchStatus !== 'matched') return false;
      if (statusFilter === 'unmatched' && row.matchStatus === 'matched') return false;

      if (gradeTab === 'grade3' && row.currentGrade !== 3) return false;
      if (gradeTab === 'grade2' && row.currentGrade !== 2) return false;
      if (gradeTab === 'grade1' && row.currentGrade !== 1) return false;

      // 항목별 전용 탭 선택 시 해당 항목 실적이 있는 학생만 보기
      if (activeCategoryTab === 'club' && uploadedRows.some(r => r.majorClubYears > 0) && row.majorClubYears === 0) return false;
      if (activeCategoryTab === 'edu' && uploadedRows.some(r => r.industryEduCount > 0) && row.industryEduCount === 0) return false;
      if (activeCategoryTab === 'course' && uploadedRows.some(r => r.careerCourseSemesters > 0) && row.careerCourseSemesters === 0) return false;
      if (activeCategoryTab === 'contest' && uploadedRows.some(r => r.skillsContest && r.skillsContest.level !== 'none') && (!row.skillsContest || row.skillsContest.level === 'none')) return false;
      if (activeCategoryTab === 'field' && uploadedRows.some(r => r.fieldParticipationScore > 0) && row.fieldParticipationScore === 0) return false;

      if (selectedMajor !== 'all' && row.currentMajor !== selectedMajor) return false;
      if (searchName.trim() && !row.studentName.includes(searchName.trim()) && !row.excelStudentName.includes(searchName.trim())) return false;
      return true;
    });
  }, [uploadedRows, statusFilter, gradeTab, activeCategoryTab, selectedMajor, searchName]);

  // 학과 목록 추출
  const availableMajors = React.useMemo(() => {
    const set = new Set<string>();
    uploadedRows.forEach(st => {
      if (st.currentMajor) set.add(st.currentMajor);
      else if (st.excelMajor) set.add(st.excelMajor);
    });
    return Array.from(set).sort();
  }, [uploadedRows]);

  // 통계 계산
  const stats = React.useMemo(() => {
    const total = uploadedRows.length;
    const matchedCount = uploadedRows.filter(r => r.matchStatus === 'matched').length;
    const unmatchedCount = uploadedRows.filter(r => r.matchStatus !== 'matched').length;
    const avgScore = matchedCount > 0 
      ? (uploadedRows.filter(r => r.matchStatus === 'matched').reduce((acc, r) => acc + r.totalEmploymentScore, 0) / matchedCount).toFixed(1) 
      : '0.0';
    return {
      total,
      matchedCount,
      unmatchedCount,
      avgScore,
      rawRecordCount: rawRecords.length
    };
  }, [uploadedRows, rawRecords]);

  // 5. DB 매칭 완료된 학생들만 일괄 저장
  const handleSaveAll = async () => {
    const validRows = uploadedRows.filter(r => r.matchStatus === 'matched' && r.studentId);

    if (validRows.length === 0) {
      toast({
        title: '저장할 학생 데이터 없음',
        description: 'DB 재학생과 정상 매칭된 학생 데이터가 없습니다. 불일치 항목을 확인해주세요.',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const rowsToSave = validRows.map(r => ({
        studentId: r.studentId!,
        industryEduList: r.industryEduList,
        careerCourses: r.careerCourses,
        majorClubs: r.majorClubs,
        skillsContest: r.skillsContest,
        fieldTraining: r.fieldTraining,
        apprenticeship: r.apprenticeship,
        employedEarly: r.employedEarly,

        industryEduCount: r.industryEduCount,
        careerCourseSemesters: r.careerCourseSemesters,
        majorClubYears: r.majorClubYears,
        skillsContestLevel: r.skillsContest?.level || 'none',
        fieldTrainingCompleted: !!r.fieldTraining?.completed,
        apprenticeshipSemesters: Object.keys(r.apprenticeship).length,
        employedEarlyFlag: !!r.employedEarly?.confirmed,
      }));

      const res = await batchImportEmploymentAction(rowsToSave);
      if (!res.success) {
        throw new Error(res.error || '저장에 실패했습니다.');
      }

      toast({
        title: '취업역량 데이터 일괄 저장 완료! 🎉',
        description: `총 ${res.updatedCount}명의 매칭 학생 실적이 데이터베이스에 성공적으로 반영되었습니다.`,
      });

      // 기존 스토어 갱신
      await loadInitialData();
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
    <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50/80 border-b border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>취업역량 & 산학교육 일괄 등록</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
                  {baseYear}학년도 재학생 기준
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                업로드한 엑셀에 <strong>기재된 학생들만 실시간 추출</strong>하여 DB 재학생 정보와 대조·누적 병합합니다.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="h-10 px-3.5 text-xs sm:text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 font-black rounded-xl gap-2 shadow-xs cursor-pointer transition-all"
              title="내가 등록한 취업역량 & 산학교육 실적 데이터를 확인하고 수정/삭제합니다"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span>등록 내역 관리 (수정/삭제)</span>
            </Button>

            {/* 표준 서식 다운로드 드롭다운 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-4 text-xs sm:text-sm bg-blue-50/90 hover:bg-blue-100 text-blue-800 border-2 border-blue-200 hover:border-blue-300 font-black rounded-xl gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <Download className="h-4 w-4 text-blue-600" />
                  <span>일괄 업로드 서식 다운로드</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-[310px] rounded-xl text-xs font-semibold p-1.5 shadow-xl border-slate-200">
                <DropdownMenuItem onClick={() => handleDownloadTemplate('course')} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <GraduationCap className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">1. 취업진로코스 참여 명단</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">청솔·맞춤·중견·반도체·부사관반 (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadTemplate('edu')} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <Building className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">2. 산학협력 교육이수 명단</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">학년, 설명회·박람회·특강 (회당 1점) (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadTemplate('club')} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <Layers className="h-4 w-4 text-purple-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">3. 전공심화동아리 참여 명단</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">학년, 1~3학년 심화동아리 실적 (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadTemplate('contest')} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <Award className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">4. 기능경기대회 입상 명단</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">학년, 전국대회(5점)·지방대회(2점) (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadTemplate('field')} className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg">
                  <Briefcase className="h-4 w-4 text-rose-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">5. 현장실습·도제·취업 명단</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">학년, 현장실습(5점)·도제OJT·조기취업 (.xlsx)</span>
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
              ? "border-blue-300 bg-blue-50/20 hover:bg-blue-50/40" 
              : "border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20"
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

          <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
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
              산학맞춤반 명단, 채용설명회 이수 명단, 기능대회 입상 명단 등 엑셀을 업로드하면 <strong>엑셀에 포함된 학생들만 추출</strong>하여 DB 매칭 및 점수를 계산합니다.
            </p>
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-2 max-w-2xl">
              {files.map((f, i) => (
                <Badge key={i} className="bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1 gap-1.5 shadow-2xs">
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>{f.name}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 엑셀 파일이 업로드되었을 때만 통계 및 테이블 표출 */}
        {uploadedRows.length > 0 && (
          <>
            {/* 요약 통계 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 block">엑셀 기재 총 학생</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.total}명</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>DB 매칭 성공</span>
                </span>
                <span className="text-xl font-black text-emerald-700 mt-0.5 block">{stats.matchedCount}명</span>
              </div>
              <div className={cn(
                "p-3.5 rounded-xl border",
                stats.unmatchedCount > 0 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-slate-50 border-slate-200 text-slate-400"
              )}>
                <span className="text-[11px] font-bold flex items-center gap-1">
                  <UserX className="h-3.5 w-3.5" />
                  <span>DB 불일치/확인 필요</span>
                </span>
                <span className="text-xl font-black mt-0.5 block">{stats.unmatchedCount}명</span>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-[11px] font-bold text-blue-700 block">매칭 학생 평균 점수</span>
                <span className="text-xl font-black text-blue-700 mt-0.5 block">{stats.avgScore} / 25점</span>
              </div>
            </div>

            {/* 탭 & 필터 도구 모음 */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/70 p-3 rounded-2xl border border-slate-200">
                {/* 상태 및 학년 필터 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                    <Button
                      type="button"
                      variant={statusFilter === 'all' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setStatusFilter('all')}
                      className={cn(
                        "text-xs font-bold rounded-lg h-7 px-2.5 transition-all",
                        statusFilter === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <span>전체 ({uploadedRows.length})</span>
                    </Button>
                    <Button
                      type="button"
                      variant={statusFilter === 'matched' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setStatusFilter('matched')}
                      className={cn(
                        "text-xs font-bold rounded-lg h-7 px-2.5 transition-all gap-1",
                        statusFilter === 'matched' ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>매칭 성공 ({stats.matchedCount})</span>
                    </Button>
                    <Button
                      type="button"
                      variant={statusFilter === 'unmatched' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setStatusFilter('unmatched')}
                      className={cn(
                        "text-xs font-bold rounded-lg h-7 px-2.5 transition-all gap-1",
                        statusFilter === 'unmatched' ? "bg-rose-600 text-white" : "text-rose-700 hover:bg-rose-50"
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <span>불일치 ({stats.unmatchedCount})</span>
                    </Button>
                  </div>

                  {/* 학년 탭 */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={gradeTab === 'all' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setGradeTab('all')}
                      className={cn(
                        "text-xs font-bold rounded-xl h-7 px-2.5 transition-all",
                        gradeTab === 'all' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      <span>전체 학년</span>
                    </Button>
                    <Button
                      type="button"
                      variant={gradeTab === 'grade3' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setGradeTab('grade3')}
                      className={cn(
                        "text-xs font-bold rounded-xl h-7 px-2.5 transition-all",
                        gradeTab === 'grade3' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      <span>3학년</span>
                    </Button>
                    <Button
                      type="button"
                      variant={gradeTab === 'grade2' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setGradeTab('grade2')}
                      className={cn(
                        "text-xs font-bold rounded-xl h-7 px-2.5 transition-all",
                        gradeTab === 'grade2' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      <span>2학년</span>
                    </Button>
                    <Button
                      type="button"
                      variant={gradeTab === 'grade1' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setGradeTab('grade1')}
                      className={cn(
                        "text-xs font-bold rounded-xl h-7 px-2.5 transition-all",
                        gradeTab === 'grade1' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      <span>1학년</span>
                    </Button>
                  </div>
                </div>

                {/* 검색 및 필터 */}
                <div className="flex items-center gap-2">
                  <div className="relative w-40 sm:w-48">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="성명 검색..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      className="h-8 pl-8 text-xs bg-white rounded-xl border-slate-200"
                    />
                  </div>

                  <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                    <SelectTrigger className="h-8 text-xs w-32 bg-white rounded-xl border-slate-200 font-semibold">
                      <SelectValue placeholder="학과 전체" />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="all">학과 전체</SelectItem>
                      {availableMajors.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 세부 항목별 전용 뷰 전환 탭 툴바 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeCategoryTab === 'all' ? 'default' : 'outline'}
                    onClick={() => setActiveCategoryTab('all')}
                    className={cn(
                      "h-7 text-xs font-bold rounded-xl px-2.5 shadow-2xs transition-all",
                      activeCategoryTab === 'all' ? "bg-slate-800 text-white" : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                    )}
                  >
                    <span>📊 전체 종합 보기</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeCategoryTab === 'edu' ? 'default' : 'outline'}
                    onClick={() => setActiveCategoryTab('edu')}
                    className={cn(
                      "h-7 text-xs font-bold rounded-xl px-2.5 gap-1.5 shadow-2xs transition-all",
                      activeCategoryTab === 'edu' ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                    )}
                  >
                    <Building className="h-3.5 w-3.5" />
                    <span>1. 산학교육 ({uploadedRows.filter(r => r.industryEduCount > 0).length}명)</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeCategoryTab === 'course' ? 'default' : 'outline'}
                    onClick={() => setActiveCategoryTab('course')}
                    className={cn(
                      "h-7 text-xs font-bold rounded-xl px-2.5 gap-1.5 shadow-2xs transition-all",
                      activeCategoryTab === 'course' ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                    )}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>2. 취업진로코스 ({uploadedRows.filter(r => r.careerCourseSemesters > 0).length}명)</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeCategoryTab === 'club' ? 'default' : 'outline'}
                    onClick={() => setActiveCategoryTab('club')}
                    className={cn(
                      "h-7 text-xs font-bold rounded-xl px-2.5 gap-1.5 shadow-2xs transition-all",
                      activeCategoryTab === 'club' ? "bg-purple-600 text-white" : "bg-white text-purple-700 hover:bg-purple-50 border-purple-200"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>3. 전공심화동아리 ({uploadedRows.filter(r => r.majorClubYears > 0).length}명)</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeCategoryTab === 'contest' ? 'default' : 'outline'}
                    onClick={() => setActiveCategoryTab('contest')}
                    className={cn(
                      "h-7 text-xs font-bold rounded-xl px-2.5 gap-1.5 shadow-2xs transition-all",
                      activeCategoryTab === 'contest' ? "bg-amber-600 text-white" : "bg-white text-amber-700 hover:bg-amber-50 border-amber-200"
                    )}
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>4. 기능경기대회 ({uploadedRows.filter(r => r.skillsContest && r.skillsContest.level !== 'none').length}명)</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeCategoryTab === 'field' ? 'default' : 'outline'}
                    onClick={() => setActiveCategoryTab('field')}
                    className={cn(
                      "h-7 text-xs font-bold rounded-xl px-2.5 gap-1.5 shadow-2xs transition-all",
                      activeCategoryTab === 'field' ? "bg-rose-600 text-white" : "bg-white text-rose-700 hover:bg-rose-50 border-rose-200"
                    )}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>5. 현장실습·도제·취업 ({uploadedRows.filter(r => r.fieldParticipationScore > 0).length}명)</span>
                  </Button>
                </div>
                <div className="text-[11px] text-slate-500 font-semibold shrink-0">
                  표시 중: <strong className="text-slate-900">{filteredRows.length}명</strong>
                </div>
              </div>

              {/* 엑셀 추출 학생 목록 데이터 테이블 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="max-h-[520px] overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-100/90 sticky top-0 z-10">
                      {activeCategoryTab === 'club' ? (
                        <TableRow className="text-[11px] font-black text-slate-700">
                          <TableHead className="w-28 text-center">DB 매칭 상태</TableHead>
                          <TableHead className="w-24 text-center">엑셀 기재 학적</TableHead>
                          <TableHead className="w-28">매칭 학과/반</TableHead>
                          <TableHead className="w-20 font-bold">성명</TableHead>
                          <TableHead className="w-36">1학년 동아리 활동</TableHead>
                          <TableHead className="w-36">2학년 동아리 활동</TableHead>
                          <TableHead className="w-36">3학년 동아리 활동</TableHead>
                          <TableHead className="w-28 text-center">동아리 점수 (5점)</TableHead>
                        </TableRow>
                      ) : activeCategoryTab === 'edu' ? (
                        <TableRow className="text-[11px] font-black text-slate-700">
                          <TableHead className="w-28 text-center">DB 매칭 상태</TableHead>
                          <TableHead className="w-24 text-center">엑셀 기재 학적</TableHead>
                          <TableHead className="w-28">매칭 학과/반</TableHead>
                          <TableHead className="w-20 font-bold">성명</TableHead>
                          <TableHead className="w-72">산학협력 교육 / 행사 이수 내역</TableHead>
                          <TableHead className="w-24 text-center">이수 횟수</TableHead>
                          <TableHead className="w-28 text-center">산학교육 점수 (10점)</TableHead>
                        </TableRow>
                      ) : activeCategoryTab === 'course' ? (
                        <TableRow className="text-[11px] font-black text-slate-700">
                          <TableHead className="w-28 text-center">DB 매칭 상태</TableHead>
                          <TableHead className="w-24 text-center">엑셀 기재 학적</TableHead>
                          <TableHead className="w-28">매칭 학과/반</TableHead>
                          <TableHead className="w-20 font-bold">성명</TableHead>
                          <TableHead className="w-72">학기별 참여 코스명 (1-1 ~ 3-2)</TableHead>
                          <TableHead className="w-24 text-center">참여 학기</TableHead>
                          <TableHead className="w-28 text-center">진로코스 점수 (10점)</TableHead>
                        </TableRow>
                      ) : activeCategoryTab === 'contest' ? (
                        <TableRow className="text-[11px] font-black text-slate-700">
                          <TableHead className="w-28 text-center">DB 매칭 상태</TableHead>
                          <TableHead className="w-24 text-center">엑셀 기재 학적</TableHead>
                          <TableHead className="w-28">매칭 학과/반</TableHead>
                          <TableHead className="w-20 font-bold">성명</TableHead>
                          <TableHead className="w-32">대회 구분</TableHead>
                          <TableHead className="w-56">직종 / 대회 실적명</TableHead>
                          <TableHead className="w-28 text-center">기능대회 가산점 (5점)</TableHead>
                        </TableRow>
                      ) : activeCategoryTab === 'field' ? (
                        <TableRow className="text-[11px] font-black text-slate-700">
                          <TableHead className="w-28 text-center">DB 매칭 상태</TableHead>
                          <TableHead className="w-24 text-center">엑셀 기재 학적</TableHead>
                          <TableHead className="w-28">매칭 학과/반</TableHead>
                          <TableHead className="w-20 font-bold">성명</TableHead>
                          <TableHead className="w-28">구분</TableHead>
                          <TableHead className="w-64">참여 학기 및 기업명(업체명)</TableHead>
                          <TableHead className="w-28 text-center">현장실습 점수 (5점)</TableHead>
                        </TableRow>
                      ) : (
                        <TableRow className="text-[11px] font-black text-slate-700">
                          <TableHead className="w-28 text-center">DB 매칭 상태</TableHead>
                          <TableHead className="w-24 text-center">엑셀 기재 학적</TableHead>
                          <TableHead className="w-28">매칭 학과/반</TableHead>
                          <TableHead className="w-20 font-bold">성명</TableHead>
                          <TableHead className="w-44">1. 산학교육 (10점)</TableHead>
                          <TableHead className="w-56">2. 취업역량강화반 (10점)</TableHead>
                          <TableHead className="w-44">3. 현장실습 참여 (5점)</TableHead>
                          <TableHead className="w-24 text-center">취업역량 총점</TableHead>
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-32 text-center text-slate-400 text-xs font-bold">
                            조건에 일치하는 학생이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRows.map((row) => {
                          const courseTerms = Object.keys(row.careerCourses);
                          const apprTerms = Object.keys(row.apprenticeship);
                          const isMatched = row.matchStatus === 'matched';
                          const isAmbiguous = row.matchStatus === 'ambiguous';

                          return (
                            <TableRow 
                              key={row.rowKey} 
                              className={cn(
                                "hover:bg-slate-50/80 transition-colors",
                                !isMatched && !isAmbiguous && "bg-rose-50/30",
                                isAmbiguous && "bg-amber-50/30"
                              )}
                            >
                              {/* 1. DB 매칭 상태 */}
                              <TableCell className="text-center whitespace-nowrap">
                                {isMatched ? (
                                  <div className="space-y-1">
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-300 gap-1 shadow-2xs">
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>매칭 완료</span>
                                    </Badge>
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMatchingTarget({
                                            rowKey: row.rowKey,
                                            excelStudentName: row.excelStudentName,
                                            excelGrade: row.excelGrade,
                                            excelMajor: row.excelMajor,
                                            excelClassNumber: row.excelClassNumber,
                                            excelStudentNumber: row.excelStudentNumber,
                                            unmatchedReason: row.unmatchedReason,
                                            currentSelectedStudentId: row.studentId,
                                          })
                                        }
                                        className="text-[9px] text-slate-400 hover:text-indigo-600 underline font-medium cursor-pointer"
                                      >
                                        학적 변경
                                      </button>
                                    </div>
                                  </div>
                                ) : isAmbiguous ? (
                                  <div className="space-y-1">
                                    <Badge className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.5 border border-amber-300 gap-1">
                                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                                      <span>동명이인 선택</span>
                                    </Badge>
                                    <div className="flex items-center gap-1 justify-center">
                                      <Select 
                                        value={row.selectedStudentId || 'none'} 
                                        onValueChange={(val) => handleManualSelection(row.rowKey, val)}
                                      >
                                        <SelectTrigger className="h-7 text-[10px] w-32 bg-white border-amber-300 font-bold">
                                          <SelectValue placeholder="학생 선택" />
                                        </SelectTrigger>
                                        <SelectContent className="text-xs">
                                          <SelectItem value="none" className="text-slate-400">선택 안 함 (제외)</SelectItem>
                                          {row.candidateStudents?.map(c => {
                                            const cGrade = baseYear - c.graduation_year + 4;
                                            return (
                                              <SelectItem key={c.id} value={c.id} className="font-bold">
                                                {cGrade}학년 {c.class_info}반 {c.student_number}번 ({c.major})
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setMatchingTarget({
                                            rowKey: row.rowKey,
                                            excelStudentName: row.excelStudentName,
                                            excelGrade: row.excelGrade,
                                            excelMajor: row.excelMajor,
                                            excelClassNumber: row.excelClassNumber,
                                            excelStudentNumber: row.excelStudentNumber,
                                            unmatchedReason: row.unmatchedReason,
                                            currentSelectedStudentId: row.studentId,
                                          })
                                        }
                                        className="h-7 px-1.5 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-50"
                                        title="전체 재학생 중 검색"
                                      >
                                        <Search className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <Badge className="bg-rose-100 text-rose-800 text-[10px] font-black px-1.5 py-0.5 border border-rose-300 gap-1">
                                      <UserX className="h-3 w-3 text-rose-600" />
                                      <span>DB 불일치</span>
                                    </Badge>
                                    <p className="text-[9px] text-rose-600 max-w-[130px] truncate" title={row.unmatchedReason}>
                                      {row.unmatchedReason}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setMatchingTarget({
                                          rowKey: row.rowKey,
                                          excelStudentName: row.excelStudentName,
                                          excelGrade: row.excelGrade,
                                          excelMajor: row.excelMajor,
                                          excelClassNumber: row.excelClassNumber,
                                          excelStudentNumber: row.excelStudentNumber,
                                          unmatchedReason: row.unmatchedReason,
                                          currentSelectedStudentId: row.studentId,
                                        })
                                      }
                                      className="h-6 px-2 text-[10px] font-bold border-rose-300 text-rose-700 bg-white hover:bg-rose-50 rounded-md gap-1 cursor-pointer"
                                    >
                                      <Search className="h-2.5 w-2.5" />
                                      <span>수동 학생 매칭</span>
                                    </Button>
                                  </div>
                                )}
                              </TableCell>

                              {/* 2. 엑셀 기재 학적 */}
                              <TableCell className="text-center font-semibold text-slate-600 whitespace-nowrap">
                                <span className="text-[11px]">
                                  {row.excelGrade ? `${row.excelGrade}학년 ` : ''}
                                  {row.excelClassNumber ? `${row.excelClassNumber}반 ` : ''}
                                  {row.excelStudentNumber ? `${row.excelStudentNumber}번` : ''}
                                </span>
                              </TableCell>

                              {/* 3. 매칭된 실제 DB 학적 */}
                              <TableCell className="whitespace-nowrap">
                                {isMatched ? (
                                  <div>
                                    <span className="font-black text-slate-800 block text-xs">
                                      {row.currentGrade}학년 {row.currentClass}반 {row.currentNumber}번
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {row.currentMajor}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    {row.excelMajor || '미확인'}
                                  </span>
                                )}
                              </TableCell>

                              {/* 4. 성명 */}
                              <TableCell className="font-black text-slate-900 whitespace-nowrap">
                                {row.studentName}
                              </TableCell>

                              {/* 5~8. 뷰 모드별 상세 컬럼 렌더링 */}
                              {activeCategoryTab === 'club' ? (
                                <>
                                  {/* 1학년 동아리 */}
                                  <TableCell className="py-2">
                                    {row.majorClubs['1'] ? (
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-[11px] px-2 py-0.5">
                                        {row.majorClubs['1']}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* 2학년 동아리 */}
                                  <TableCell className="py-2">
                                    {row.majorClubs['2'] ? (
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-[11px] px-2 py-0.5">
                                        {row.majorClubs['2']}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* 3학년 동아리 */}
                                  <TableCell className="py-2">
                                    {row.majorClubs['3'] ? (
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-[11px] px-2 py-0.5">
                                        {row.majorClubs['3']}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* 동아리 인정 점수 */}
                                  <TableCell className="text-center font-black whitespace-nowrap">
                                    {row.majorClubYears > 0 ? (
                                      <Badge className="bg-purple-600 text-white font-extrabold text-xs px-2 py-0.5 shadow-2xs">
                                        {row.majorClubYears}개년 ({row.majorClubScore}점)
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                  </TableCell>
                                </>
                              ) : activeCategoryTab === 'edu' ? (
                                <>
                                  {/* 산학협력 교육 내역 */}
                                  <TableCell className="py-2">
                                    {row.industryEduList.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {row.industryEduList.map((e, idx) => (
                                          <Badge key={idx} variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold">
                                            <span>{e.title}</span>
                                            {e.dateOrTerm && <span className="text-emerald-600 font-normal ml-1">({e.dateOrTerm})</span>}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* 이수 횟수 */}
                                  <TableCell className="text-center font-bold text-slate-800 whitespace-nowrap">
                                    {row.industryEduCount > 0 ? `${row.industryEduCount}회` : '-'}
                                  </TableCell>

                                  {/* 점수 */}
                                  <TableCell className="text-center font-black whitespace-nowrap">
                                    {row.industryEduScore > 0 ? (
                                      <Badge className="bg-emerald-600 text-white font-extrabold text-xs px-2 py-0.5 shadow-2xs">
                                        {row.industryEduScore}점
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                  </TableCell>
                                </>
                              ) : activeCategoryTab === 'course' ? (
                                <>
                                  {/* 학기별 코스명 */}
                                  <TableCell className="py-2">
                                    {courseTerms.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {courseTerms.sort().map(t => (
                                          <Badge key={t} variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200 text-[10px] font-bold">
                                            <span>{t}학기:</span>
                                            <span className="ml-1 text-indigo-950 font-black">{row.careerCourses[t]}</span>
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* 참여 학기 */}
                                  <TableCell className="text-center font-bold text-slate-800 whitespace-nowrap">
                                    {row.careerCourseSemesters > 0 ? `${row.careerCourseSemesters}학기` : '-'}
                                  </TableCell>

                                  {/* 점수 */}
                                  <TableCell className="text-center font-black whitespace-nowrap">
                                    {row.careerCourseScore > 0 ? (
                                      <Badge className="bg-indigo-600 text-white font-extrabold text-xs px-2 py-0.5 shadow-2xs">
                                        {row.careerCourseScore}점
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                  </TableCell>
                                </>
                              ) : activeCategoryTab === 'contest' ? (
                                <>
                                  {/* 대회 구분 */}
                                  <TableCell className="py-2 font-bold whitespace-nowrap">
                                    {row.skillsContest?.level === 'national' ? (
                                      <Badge className="bg-amber-500 text-white text-[10px] font-extrabold">전국기능경기대회</Badge>
                                    ) : row.skillsContest?.level === 'regional' ? (
                                      <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">지방기능경기대회</Badge>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* 실적 상세 */}
                                  <TableCell className="py-2">
                                    <span className="text-slate-800 font-semibold">{row.skillsContest?.name || '-'}</span>
                                  </TableCell>

                                  {/* 점수 */}
                                  <TableCell className="text-center font-black whitespace-nowrap">
                                    {row.skillsContestScore > 0 ? (
                                      <Badge className="bg-amber-600 text-white font-extrabold text-xs px-2 py-0.5 shadow-2xs">
                                        {row.skillsContestScore}점
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                  </TableCell>
                                </>
                              ) : activeCategoryTab === 'field' ? (
                                <>
                                  {/* 구분 */}
                                  <TableCell className="py-2 font-bold whitespace-nowrap">
                                    {row.employedEarly?.confirmed ? (
                                      <Badge className="bg-rose-600 text-white text-[10px]">취업확정</Badge>
                                    ) : apprTerms.length > 0 ? (
                                      <Badge className="bg-blue-600 text-white text-[10px]">도제 OJT</Badge>
                                    ) : row.fieldTraining?.completed ? (
                                      <Badge className="bg-emerald-600 text-white text-[10px]">현장실습</Badge>
                                    ) : (
                                      <span className="text-slate-300 text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* 참여 학기 및 기업명 */}
                                  <TableCell className="py-2">
                                    <div className="space-y-0.5">
                                      {row.employedEarly?.company && (
                                        <p className="text-slate-900 font-bold">기업: {row.employedEarly.company}</p>
                                      )}
                                      {apprTerms.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {apprTerms.sort().map(t => (
                                            <Badge key={t} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-[10px]">
                                              {t}학기: {row.apprenticeship[t]}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {row.fieldTraining?.company && !row.employedEarly?.company && (
                                        <p className="text-slate-700 font-semibold">{row.fieldTraining.company}</p>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* 점수 */}
                                  <TableCell className="text-center font-black whitespace-nowrap">
                                    {row.fieldParticipationScore > 0 ? (
                                      <Badge className="bg-rose-600 text-white font-extrabold text-xs px-2 py-0.5 shadow-2xs">
                                        {row.fieldParticipationScore}점
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  {/* 5. 산학교육 이수 */}
                                  <TableCell className="py-2">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-slate-800">
                                        {row.industryEduCount}회 이수
                                      </span>
                                      <Badge className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-1.5">
                                        {row.industryEduScore}점
                                      </Badge>
                                    </div>
                                    {row.industryEduList.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {row.industryEduList.map((e, idx) => (
                                          <span key={idx} className="text-[9px] text-slate-600 bg-slate-100 px-1 py-0.5 rounded">
                                            • {e.title}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* 6. 취업역량강화반 */}
                                  <TableCell className="py-2 space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="text-[10px] text-slate-700 space-x-1">
                                        <span>코스 <strong>{row.careerCourseSemesters}학기</strong></span>
                                        <span className="text-slate-300">|</span>
                                        <span>동아리 <strong>{row.majorClubYears}개년</strong></span>
                                        {row.skillsContest && row.skillsContest.level !== 'none' && (
                                          <>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-indigo-600 font-bold">
                                              {row.skillsContest.level === 'national' ? '전국대회' : '지방대회'}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      <Badge className="bg-indigo-100 text-indigo-800 font-extrabold text-[10px] px-1.5 shrink-0">
                                        {row.enhancementScore}점
                                      </Badge>
                                    </div>

                                    {/* 세부 코스 배지 */}
                                    {courseTerms.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {courseTerms.sort().map(t => (
                                          <span key={t} className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded">
                                            {t}: {row.careerCourses[t]}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* 7. 현장실습 참여 */}
                                  <TableCell className="py-2 space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="text-[10px] text-slate-700 space-x-1">
                                        <span>실습: {row.fieldTraining?.completed ? '✅ 이수' : '미이수'}</span>
                                        {apprTerms.length > 0 && (
                                          <>
                                            <span className="text-slate-300">|</span>
                                            <span>도제 {apprTerms.length}학기</span>
                                          </>
                                        )}
                                        {row.employedEarly?.confirmed && (
                                          <>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-rose-600 font-bold">취업확정</span>
                                          </>
                                        )}
                                      </div>
                                      <Badge className="bg-blue-100 text-blue-800 font-extrabold text-[10px] px-1.5 shrink-0">
                                        {row.fieldParticipationScore}점
                                      </Badge>
                                    </div>

                                    {(row.fieldTraining?.company || row.employedEarly?.company) && (
                                      <p className="text-[9px] text-slate-400 truncate">
                                        {row.fieldTraining?.company || row.employedEarly?.company}
                                      </p>
                                    )}
                                  </TableCell>

                                  {/* 8. 총 환산 점수 */}
                                  <TableCell className="text-center font-black text-sm text-blue-700 whitespace-nowrap">
                                    {isMatched ? `${row.totalEmploymentScore}점` : '-'}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* 하단 저장 바 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  엑셀 기재 <strong>{uploadedRows.length}명</strong> 중 <strong>{stats.matchedCount}명</strong>이 DB 매칭 완료되었습니다. 저장 시 <strong>공식 평가표에 실시간 점수 및 산출 근거가 즉시 반영</strong>됩니다.
                </span>
              </div>

              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving || stats.matchedCount === 0}
                className="h-11 px-6 text-sm font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 shadow-md shrink-0 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>데이터베이스에 저장 중...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>DB 매칭 완료 학생 취업역량 실적 일괄 저장 ({stats.matchedCount}명)</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {/* 수동 학생 매칭 검색 모달 */}
      <ManualStudentMatchingDialog
        isOpen={!!matchingTarget}
        onClose={() => setMatchingTarget(null)}
        target={matchingTarget}
        activeStudents={activeStudents}
        baseYear={baseYear}
        onSelectStudent={(rowKey, studentId) => {
          handleManualSelection(rowKey, studentId);
          toast({
            title: '수동 매칭 완료',
            description: '선택한 DB 재학생으로 실적이 정상 연결되었습니다.',
          });
        }}
        onResetMatching={(rowKey) => {
          handleManualSelection(rowKey, 'none');
          toast({
            title: '매칭 제외 처리',
            description: '해당 행의 매칭이 해제되었습니다.',
          });
        }}
      />

      {/* 등록 내역 관리 및 삭제 모달 */}
      <DeleteMyRecordsDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        category="employment"
        categoryTitle="취업역량 & 산학협력"
        isAdmin={isAdmin}
        onSuccess={async () => {
          const freshStore = await getEvaluationsStore();
          setExistingStore(freshStore);
          if (onImportSuccess) onImportSuccess();
        }}
      />
    </Card>
  );
}
