'use client';

import * as React from 'react';
import { 
  Search, 
  User, 
  Award,
  Loader2,
  Edit2,
  Download
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAJOR_SORT_ORDER } from '@/lib/types';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { StudentCertificateSummary, updateStudentCertificates } from './actions';
import { CertificateImportModal } from './certificate-import-modal';

export function CertificateSummaryClient({ 
  initialSummaries, 
  currentGrade,
  isAdmin = false
}: { 
  initialSummaries: StudentCertificateSummary[], 
  currentGrade: number,
  isAdmin?: boolean
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchText] = React.useState('');
  const [selectedMajor, setSelectedMajor] = React.useState('all');
  const [selectedClass, setSelectedClass] = React.useState('all');
  const [editingStudent, setEditingStudent] = React.useState<StudentCertificateSummary | null>(null);
  const [certsInput, setCertsInput] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const PAGE_SIZE = 50;
  const { toast } = useToast();

  // 학년 변경 시 URL 업데이트 (서버 리로딩 유도)
  const handleGradeChange = (grade: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('grade', grade.toString());
    router.push(`/admin/certification/certificates?${params.toString()}`);
  };

  // 클라이언트 사이드 필터링 (학과, 반, 검색어)
  const filteredData = React.useMemo(() => {
    let filtered = initialSummaries.filter(s => {
      const matchMajor = selectedMajor === 'all' || s.major === selectedMajor;
      const matchClass = selectedClass === 'all' || s.classInfo === selectedClass;
      const matchSearch = s.name.includes(searchTerm) || s.number.includes(searchTerm);
      return matchMajor && matchClass && matchSearch;
    });

    // 학번 순으로 정렬
    filtered.sort((a, b) => {
      // 학과 정렬 우선
      const idxA = MAJOR_SORT_ORDER.indexOf(a.major);
      const idxB = MAJOR_SORT_ORDER.indexOf(b.major);
      const majorDiff = (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      if (majorDiff !== 0) return majorDiff;

      // 학급 정렬
      const classDiff = a.classInfo.localeCompare(b.classInfo, 'ko');
      if (classDiff !== 0) return classDiff;

      // 번호 정렬
      return (parseInt(a.number || '0') - parseInt(b.number || '0'));
    });

    return filtered;
  }, [initialSummaries, searchTerm, selectedMajor, selectedClass]);

  // 필터 변경 시 1페이지로 리셋
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMajor, selectedClass]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const majors = React.useMemo(() => {
    const allMajors = Array.from(new Set(initialSummaries.map(s => s.major))).filter(Boolean);
    return allMajors.sort((a, b) => {
      const idxA = MAJOR_SORT_ORDER.indexOf(a);
      const idxB = MAJOR_SORT_ORDER.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [initialSummaries]);

  const availableClasses = React.useMemo(() => {
    if (selectedMajor === 'all') return [];
    const classes = new Set(initialSummaries.filter(s => s.major === selectedMajor).map(s => s.classInfo));
    return Array.from(classes).sort();
  }, [initialSummaries, selectedMajor]);

  // 편집 시작
  const startEdit = (student: StudentCertificateSummary) => {
    setEditingStudent(student);
    setCertsInput(student.certificates.join(', '));
  };

  // 편집 저장
  const saveCertificates = async () => {
    if (!editingStudent) return;
    setIsSaving(true);
    
    // 쉼표/세미콜론으로 분할하고 앞뒤 공백 제거
    const certsArray = certsInput
      .split(/[,;]/)
      .map(c => c.trim())
      .filter(Boolean);

    try {
      const res = await updateStudentCertificates(editingStudent.id, certsArray);
      if (res.success) {
        toast({
          title: "자격증 수정 완료",
          description: `${editingStudent.name} 학생의 자격증 정보를 수정했습니다.`,
        });
        setEditingStudent(null);
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "저장 실패",
          description: res.error || "자격증 정보를 저장할 수 없습니다.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "오류 발생",
        description: e.message || "저장 중 서버 통신 오류가 발생했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    const params = new URLSearchParams(searchParams.toString());
    const ay = params.get('ay') || '';
    window.location.href = `/api/admin/certification/download${ay ? `?ay=${ay}` : ''}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* 헤더 바: 타이틀 및 버튼 */}
      <div className="px-3 py-3 sm:px-6 sm:py-4 border-b flex justify-between items-center bg-white min-w-0 shrink-0">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <Award className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 shrink-0" />
          <h2 className="font-black text-slate-800 tracking-tight text-base sm:text-lg whitespace-nowrap truncate">
            자격증 취득 현황
          </h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadExcel}
            className="border-slate-200 text-slate-700 font-bold gap-1.5 hover:bg-slate-50 h-8 sm:h-9 text-xs shadow-sm px-2.5 sm:px-3 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden sm:inline">현황 양식 다운로드</span>
            <span className="sm:hidden">양식 다운로드</span>
          </Button>
          {isAdmin && <CertificateImportModal />}
        </div>
      </div>

      {/* 필터 세션 */}
      <div className="p-3 sm:p-4 border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center gap-3 sm:gap-4 shrink-0">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="학생 이름 또는 번호 검색..." 
            className="pl-9 bg-white border-slate-200 text-xs sm:text-sm h-9 sm:h-10" 
            value={searchTerm} 
            onChange={(e) => setSearchText(e.target.value)} 
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-start w-full md:w-auto">
          {/* 학년 필터 */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
            {[1, 2, 3].map(g => (
              <Button 
                key={g} 
                variant={currentGrade === g ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => handleGradeChange(g)} 
                className={cn("h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-black", currentGrade === g && "text-indigo-600 bg-indigo-50")}
              >
                {g}학년
              </Button>
            ))}
          </div>

          {/* 학과 필터 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar max-w-full">
            <Button 
              variant={selectedMajor === 'all' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => { setSelectedMajor('all'); setSelectedClass('all'); }} 
              className={cn("h-7 sm:h-8 text-xs font-bold shrink-0", selectedMajor === 'all' && "bg-indigo-600 hover:bg-indigo-700")}
            >
              전체 학과
            </Button>
            {majors.map(major => (
              <Button 
                key={major} 
                variant={selectedMajor === major ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setSelectedMajor(major); setSelectedClass('all'); }} 
                className={cn("h-7 sm:h-8 text-xs font-bold shrink-0", selectedMajor === major && "bg-indigo-600 hover:bg-indigo-700")}
              >
                {major}
              </Button>
            ))}
          </div>

          {/* 반 필터 */}
          {selectedMajor !== 'all' && availableClasses.length > 0 && (
            <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l pt-2 sm:pt-0 sm:pl-3 border-slate-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter shrink-0">Class</span>
              <div className="flex items-center gap-1">
                <Button 
                  variant={selectedClass === 'all' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setSelectedClass('all')} 
                  className="h-7 px-2 text-[11px] font-bold shrink-0"
                >
                  전체
                </Button>
                {availableClasses.map(cls => (
                  <Button 
                    key={cls} 
                    variant={selectedClass === cls ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setSelectedClass(cls)} 
                    className="h-7 px-2 text-[11px] font-bold shrink-0"
                  >
                    {cls}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 데스크톱: 테이블 뷰 (md 이상) */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b">
            <tr>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center w-24">번호</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider">학생 정보</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider">취득 자격증 목록</th>
              {isAdmin && <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center w-24">작업</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 4 : 3} className="px-6 py-12 text-center text-slate-400 font-bold text-xs sm:text-sm">
                  등록된 자격증 데이터가 없거나 조건에 일치하는 학생이 없습니다.
                </td>
              </tr>
            ) : (
              paginatedData.map((student, idx) => (
                <tr key={student.id} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-6 py-4 text-center font-bold text-slate-400 text-xs">
                    {(currentPage - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 transition-colors">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{student.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {student.major} • {student.classInfo} • {student.number}번
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {student.certificates && student.certificates.length > 0 ? (
                        student.certificates.map((cert, i) => (
                          <span 
                            key={i} 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm"
                          >
                            <Award className="h-3 w-3 text-amber-500 shrink-0" />
                            {cert}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-300 font-medium italic">자격증 정보 없음</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => startEdit(student)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 목록 뷰 (md 미만) */}
      <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-2.5">
        {paginatedData.map((student, idx) => (
          <div 
            key={student.id} 
            className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2.5"
          >
            {/* 상단 학생 정보 및 작업 버튼 */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{student.name}</h3>
                    <span className="text-[10px] font-bold text-slate-400">
                      #{(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {student.major} • {student.classInfo} • {student.number}번
                  </p>
                </div>
              </div>

              {isAdmin && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => startEdit(student)}
                  className="h-8 px-2.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold shrink-0 gap-1"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  수정
                </Button>
              )}
            </div>

            {/* 자격증 목록 */}
            <div className="pt-0.5">
              <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">취득 자격증</p>
              <div className="flex flex-wrap gap-1.5">
                {student.certificates && student.certificates.length > 0 ? (
                  student.certificates.map((cert, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm"
                    >
                      <Award className="h-3 w-3 text-amber-500 shrink-0" />
                      {cert}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-300 font-medium italic">자격증 정보 없음</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {paginatedData.length === 0 && (
          <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-400 font-medium">등록된 자격증 데이터가 없거나 조건에 일치하는 학생이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 하단 페이지네이션 */}
      {totalPages > 1 && (
        <div className="p-3 sm:p-4 border-t bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0">
          <span className="text-[11px] font-bold text-slate-400">
            총 {filteredData.length}명 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredData.length)}명 표시
          </span>
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
              className="h-7 sm:h-8 px-2 text-xs font-bold shrink-0"
            >
              이전
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button 
                key={i} 
                variant={currentPage === i + 1 ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setCurrentPage(i + 1)}
                className={cn("h-7 w-7 sm:h-8 sm:w-8 text-xs font-bold shrink-0 p-0", currentPage === i + 1 && "bg-indigo-600 hover:bg-indigo-700")}
              >
                {i + 1}
              </Button>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
              className="h-7 sm:h-8 px-2 text-xs font-bold shrink-0"
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {/* 자격증 직접 수정 다이얼로그 */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full bg-white p-4 sm:p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900">자격증 정보 수정</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              {editingStudent?.name} 학생({editingStudent?.major} {editingStudent?.classInfo})의 취득 자격증을 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 sm:py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">자격증 목록 (쉼표 또는 세미콜론 구분)</label>
              <Input 
                value={certsInput} 
                onChange={(e) => setCertsInput(e.target.value)} 
                placeholder="예: 전기기능사, 승강기기능사, 정보기술자격(ITQ)"
                className="w-full text-xs sm:text-sm font-medium border-slate-200 focus-visible:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                각 자격증 명칭은 쉼표(,)나 세미콜론(;)으로 구분하여 입력해주세요. 비워두면 모든 자격증이 제거됩니다.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-row justify-end">
            <Button 
              variant="outline" 
              disabled={isSaving}
              onClick={() => setEditingStudent(null)}
              className="font-bold text-xs h-8 sm:h-9"
            >
              취소
            </Button>
            <Button 
              onClick={saveCertificates}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 sm:h-9 gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  저장 중...
                </>
              ) : (
                "저장하기"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

