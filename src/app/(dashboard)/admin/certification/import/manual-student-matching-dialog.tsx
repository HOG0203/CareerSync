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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserCheck, AlertTriangle, User, Check, RefreshCw, X } from 'lucide-react';

export interface ManualMatchTarget {
  rowKey: string;
  excelStudentName: string;
  excelGrade?: number;
  excelMajor?: string;
  excelClassNumber?: number;
  excelStudentNumber?: number;
  unmatchedReason?: string;
  currentSelectedStudentId?: string;
}

interface ManualStudentMatchingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  target: ManualMatchTarget | null;
  activeStudents: any[];
  baseYear: number;
  onSelectStudent: (rowKey: string, studentId: string) => void;
  onResetMatching: (rowKey: string) => void;
}

export function ManualStudentMatchingDialog({
  isOpen,
  onClose,
  target,
  activeStudents,
  baseYear,
  onSelectStudent,
  onResetMatching,
}: ManualStudentMatchingDialogProps) {
  const [query, setQuery] = React.useState('');
  const [selectedGrade, setSelectedGrade] = React.useState<'all' | '3' | '2' | '1'>('all');

  // 다이얼로그 열릴 때 엑셀 이름으로 기본 검색어 세팅
  React.useEffect(() => {
    if (target && isOpen) {
      setQuery(target.excelStudentName || '');
      setSelectedGrade('all');
    }
  }, [target, isOpen]);

  // 검색된 DB 재학생 목록
  const searchedStudents = React.useMemo(() => {
    if (!target) return [];

    return activeStudents.filter((st) => {
      const stGrade = baseYear - st.graduation_year + 4;

      if (selectedGrade !== 'all') {
        if (stGrade !== parseInt(selectedGrade, 10)) return false;
      }

      if (!query.trim()) return true;

      const q = query.trim().toLowerCase();
      const nameMatch = (st.student_name || '').toLowerCase().includes(q);
      const majorMatch = (st.major || '').toLowerCase().includes(q);
      const classMatch = String(st.class_info || '').includes(q);
      const numMatch = String(st.student_number || '').includes(q);
      const idMatch = (st.student_id || '').toLowerCase().includes(q);

      return nameMatch || majorMatch || classMatch || numMatch || idMatch;
    });
  }, [activeStudents, target, query, selectedGrade, baseYear]);

  // 현재 지정된 학생 객체
  const currentlySelectedStudent = React.useMemo(() => {
    if (!target?.currentSelectedStudentId) return null;
    return activeStudents.find((st) => st.id === target.currentSelectedStudentId) || null;
  }, [activeStudents, target]);

  if (!target) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[95vw] p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl bg-white flex flex-col max-h-[85vh]">
        <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 truncate">
                수동 학생 매칭 (학적 지정)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                오타나 학급 번호 불일치로 자동 매칭되지 않은 엑셀 행에 실제 DB 재학생을 직접 연결합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/60 custom-scrollbar">
          {/* 1. 엑셀 원본 기재 정보 박스 */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>엑셀 파일 기재 정보</span>
              </span>
              <Badge className="bg-amber-500 text-white border-none font-bold text-[10px] px-2 py-0.5">
                매칭 대상
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-amber-200/60 font-medium shadow-2xs">
              <div>
                <span className="text-slate-400 block text-[10px]">성명</span>
                <span className="font-black text-slate-900 text-sm">{target.excelStudentName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">학년 / 학과</span>
                <span className="font-bold text-slate-800">
                  {target.excelGrade ? `${target.excelGrade}학년 ` : '- '}
                  {target.excelMajor || ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">학급 / 번호</span>
                <span className="font-bold text-slate-800">
                  {target.excelClassNumber ? `${target.excelClassNumber}반 ` : '- '}
                  {target.excelStudentNumber ? `${target.excelStudentNumber}번` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">불일치 사유</span>
                <span className="font-bold text-rose-600 truncate block" title={target.unmatchedReason}>
                  {target.unmatchedReason || '확인 필요'}
                </span>
              </div>
            </div>

            {currentlySelectedStudent && (
              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-[11px]">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  현재 지정됨: {currentlySelectedStudent.student_name} (
                  {baseYear - currentlySelectedStudent.graduation_year + 4}학년{' '}
                  {currentlySelectedStudent.major} {currentlySelectedStudent.class_info}반{' '}
                  {currentlySelectedStudent.student_number}번)
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onResetMatching(target.rowKey);
                  }}
                  className="h-6 px-2 text-[10px] text-rose-600 hover:bg-rose-50 font-bold rounded-md"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  지정 취소
                </Button>
              </div>
            )}
          </div>

          {/* 2. DB 재학생 검색 바 & 학년 필터 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="DB 재학생 이름, 학과, 반, 번호 검색..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl bg-white border-slate-200 shadow-2xs focus-visible:ring-indigo-500"
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-200 shrink-0">
                {(['all', '3', '2', '1'] as const).map((gr) => (
                  <button
                    key={gr}
                    type="button"
                    onClick={() => setSelectedGrade(gr)}
                    className={`h-7 px-2.5 text-xs font-bold rounded-lg transition-all ${
                      selectedGrade === gr
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {gr === 'all' ? '전체' : `${gr}학년`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. 검색 결과 학생 리스트 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100/80 px-3.5 py-2 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-700 flex items-center justify-between">
              <span>DB 재학생 검색 결과 ({searchedStudents.length}명)</span>
              <span className="text-[10px] text-slate-400 font-normal">
                클릭하여 이 행과 연결할 학생을 선택하세요
              </span>
            </div>

            <ScrollArea className="h-56 custom-scrollbar">
              {searchedStudents.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                  <User className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                  <p>일치하는 재학생이 없습니다.</p>
                  <p className="text-[10px] text-slate-400">검색어(성명, 학과, 반 등)를 변경해 보세요.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {searchedStudents.map((st) => {
                    const stGrade = baseYear - st.graduation_year + 4;
                    const isCurrent = target.currentSelectedStudentId === st.id;

                    return (
                      <div
                        key={st.id}
                        onClick={() => {
                          onSelectStudent(target.rowKey, st.id);
                          onClose();
                        }}
                        className={`p-3 px-3.5 flex items-center justify-between gap-3 hover:bg-indigo-50/60 cursor-pointer transition-colors ${
                          isCurrent ? 'bg-indigo-50/80' : ''
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{st.student_name}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 font-extrabold bg-slate-50 text-slate-700 border-slate-200"
                            >
                              {stGrade}학년
                            </Badge>
                            <span className="text-[11px] font-bold text-slate-600">
                              {st.major} {st.class_info}반 {st.student_number}번
                            </span>
                          </div>
                          {st.student_id && (
                            <div className="text-[10px] text-slate-400">
                              학번(ID): {st.student_id}
                            </div>
                          )}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant={isCurrent ? 'default' : 'outline'}
                          className={`h-7 px-3 text-xs font-bold rounded-lg shrink-0 ${
                            isCurrent
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                              : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                          }`}
                        >
                          {isCurrent ? '선택됨' : '선택'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-4 bg-white border-t border-slate-200/80 flex sm:justify-between items-center shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            선택한 학생으로 실시간 점수 계산 및 저장이 진행됩니다.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl border-slate-200"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
