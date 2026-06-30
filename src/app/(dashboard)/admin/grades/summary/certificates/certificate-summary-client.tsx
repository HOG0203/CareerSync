'use client';

import * as React from 'react';
import { 
  Search, 
  User, 
  Award,
  Loader2,
  Edit2
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
  currentGrade
}: { 
  initialSummaries: StudentCertificateSummary[], 
  currentGrade: number
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
    router.push(`/admin/grades/summary/certificates?${params.toString()}`);
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

  return (
    <div className="flex flex-col h-full">
      {/* 상단 액션 바 */}
      <div className="px-4 pt-4 flex justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {[1, 2, 3].map(g => (
            <Button 
              key={g} 
              variant={currentGrade === g ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => handleGradeChange(g)} 
              className={cn("h-8 px-3 text-xs font-black", currentGrade === g && "text-indigo-600 bg-indigo-50")}
            >
              {g}학년
            </Button>
          ))}
        </div>

        <CertificateImportModal />
      </div>

      {/* 필터 세션 */}
      <div className="p-4 border-b bg-slate-50/50 flex flex-wrap items-center gap-4 shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="학생 이름 또는 번호 검색..." 
            className="pl-9 bg-white border-slate-200" 
            value={searchTerm} 
            onChange={(e) => setSearchText(e.target.value)} 
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <Button 
            variant={selectedMajor === 'all' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => { setSelectedMajor('all'); setSelectedClass('all'); }} 
            className={cn("h-8 text-xs font-bold shrink-0", selectedMajor === 'all' && "bg-indigo-600 hover:bg-indigo-700")}
          >
            전체 학과
          </Button>
          {majors.map(major => (
            <Button 
              key={major} 
              variant={selectedMajor === major ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => { setSelectedMajor(major); setSelectedClass('all'); }} 
              className={cn("h-8 text-xs font-bold shrink-0", selectedMajor === major && "bg-indigo-600 hover:bg-indigo-700")}
            >
              {major}
            </Button>
          ))}
        </div>

        {selectedMajor !== 'all' && availableClasses.length > 0 && (
          <div className="flex items-center gap-2 border-l pl-4 border-slate-200 ml-auto sm:ml-0">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">학급</span>
            <div className="flex items-center gap-1">
              <Button 
                variant={selectedClass === 'all' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setSelectedClass('all')} 
                className="h-7 px-2 text-[11px] font-bold"
              >
                전체
              </Button>
              {availableClasses.map(cls => (
                <Button 
                  key={cls} 
                  variant={selectedClass === cls ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setSelectedClass(cls)} 
                  className="h-7 px-2 text-[11px] font-bold"
                >
                  {cls}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 자격증 그리드/테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b">
            <tr>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center w-24">번호</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider">학생 정보</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider">취득 자격증 목록</th>
              <th className="px-6 py-3 font-bold text-[11px] uppercase tracking-wider text-center w-24">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 하단 페이지네이션 */}
      {totalPages > 1 && (
        <div className="p-4 border-t bg-slate-50/50 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-400">
            총 {filteredData.length}명 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredData.length)}명 표시
          </span>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
              className="h-8 text-xs font-bold"
            >
              이전
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button 
                key={i} 
                variant={currentPage === i + 1 ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setCurrentPage(i + 1)}
                className={cn("h-8 w-8 text-xs font-bold", currentPage === i + 1 && "bg-indigo-600 hover:bg-indigo-700")}
              >
                {i + 1}
              </Button>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
              className="h-8 text-xs font-bold"
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {/* 자격증 직접 수정 다이얼로그 */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">자격증 정보 수정</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              {editingStudent?.name} 학생({editingStudent?.major} {editingStudent?.classInfo})의 취득 자격증을 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">자격증 목록 (쉼표 또는 세미콜론 구분)</label>
              <Input 
                value={certsInput} 
                onChange={(e) => setCertsInput(e.target.value)} 
                placeholder="예: 전기기능사, 승강기기능사, 정보기술자격(ITQ)"
                className="w-full text-sm font-medium border-slate-200 focus-visible:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                각 자격증 명칭은 쉼표(,)나 세미콜론(;)으로 구분하여 입력해주세요. 비워두면 모든 자격증이 제거됩니다.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              disabled={isSaving}
              onClick={() => setEditingStudent(null)}
              className="font-bold text-xs"
            >
              취소
            </Button>
            <Button 
              onClick={saveCertificates}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
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
