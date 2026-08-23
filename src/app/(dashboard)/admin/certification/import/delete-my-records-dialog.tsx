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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  getMyImportedRecordsAction, 
  deleteMyImportedRecordsAction, 
  updateSingleImportedRecordAction,
  MyImportedStudentItem 
} from '../actions';
import { 
  Trash2, 
  Search, 
  Loader2, 
  AlertTriangle, 
  CheckSquare, 
  User, 
  Calendar, 
  RefreshCw,
  Edit3,
  Save,
  Check,
  Award,
  Layers,
  HeartHandshake,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteMyRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: 'volunteer' | 'vocational' | 'employment' | 'arts_contest';
  categoryTitle: string;
  isAdmin: boolean;
  onSuccess?: () => void;
}

export function DeleteMyRecordsDialog({
  open,
  onOpenChange,
  category,
  categoryTitle,
  isAdmin,
  onSuccess,
}: DeleteMyRecordsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [records, setRecords] = React.useState<MyImportedStudentItem[]>([]);
  const [totalItemCount, setTotalItemCount] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // 단건 수정 모달 상태
  const [editingStudent, setEditingStudent] = React.useState<MyImportedStudentItem | null>(null);
  
  // 직공통 수정 임시 폼 상태
  const [vocationalEditForm, setVocationalEditForm] = React.useState<{
    grade1: { korean: number; english: number; math: number; problem: number; isCompleted: boolean };
    grade2: { korean: number; english: number; math: number; problem: number; isCompleted: boolean };
    grade3: { korean: number; english: number; math: number; problem: number; isCompleted: boolean };
  }>({
    grade1: { korean: 5, english: 5, math: 5, problem: 5, isCompleted: false },
    grade2: { korean: 5, english: 5, math: 5, problem: 5, isCompleted: false },
    grade3: { korean: 5, english: 5, math: 5, problem: 5, isCompleted: false },
  });

  // 봉사활동 수정 임시 폼 상태
  const [volunteerEditForm, setVolunteerEditForm] = React.useState<{
    schoolHours: number;
    outsideHours: number;
  }>({
    schoolHours: 0,
    outsideHours: 0,
  });

  const loadRecords = React.useCallback(async () => {
    setIsLoading(true);
    setSelectedIds(new Set());
    try {
      const res = await getMyImportedRecordsAction(category);
      if (res.success) {
        setRecords(res.records);
        setTotalItemCount(res.totalItemCount);
      } else {
        toast({
          title: '데이터 조회 실패',
          description: res.error || '등록 내역을 불러오지 못했습니다.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '오류 발생',
        description: err.message || '서버 통신 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [category, toast]);

  React.useEffect(() => {
    if (open) {
      loadRecords();
    }
  }, [open, loadRecords]);

  // 학생 단건 수정 시작
  const handleStartEdit = (item: MyImportedStudentItem) => {
    setEditingStudent(item);
    if (category === 'vocational') {
      const vDetails = item.rawVocationalDetails || {};
      setVocationalEditForm({
        grade1: {
          korean: vDetails.grade1?.korean || 5,
          english: vDetails.grade1?.english || 5,
          math: vDetails.grade1?.math || 5,
          problem: vDetails.grade1?.problem || 5,
          isCompleted: Boolean(vDetails.grade1?.isCompleted),
        },
        grade2: {
          korean: vDetails.grade2?.korean || 5,
          english: vDetails.grade2?.english || 5,
          math: vDetails.grade2?.math || 5,
          problem: vDetails.grade2?.problem || 5,
          isCompleted: Boolean(vDetails.grade2?.isCompleted),
        },
        grade3: {
          korean: vDetails.grade3?.korean || 5,
          english: vDetails.grade3?.english || 5,
          math: vDetails.grade3?.math || 5,
          problem: vDetails.grade3?.problem || 5,
          isCompleted: Boolean(vDetails.grade3?.isCompleted),
        },
      });
    } else if (category === 'volunteer') {
      setVolunteerEditForm({
        schoolHours: item.rawVolunteerHours?.school || 0,
        outsideHours: item.rawVolunteerHours?.outside || 0,
      });
    }
  };

  // 단건 수정 저장
  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setIsSavingEdit(true);
    try {
      let payloadData: any = {};
      if (category === 'vocational') {
        payloadData = { vocationalDetails: vocationalEditForm };
      } else if (category === 'volunteer') {
        payloadData = volunteerEditForm;
      }

      const res = await updateSingleImportedRecordAction(category, editingStudent.studentId, payloadData);
      if (res.success) {
        toast({
          title: '수정 완료',
          description: `${editingStudent.studentName} 학생의 ${categoryTitle} 데이터가 수정되었습니다.`,
        });
        setEditingStudent(null);
        await loadRecords();
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: '수정 실패',
          description: res.error || '데이터 수정에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '오류 발생',
        description: err.message || '수정 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 검색 필터링
  const filteredRecords = React.useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter(
      r =>
        r.studentName.toLowerCase().includes(q) ||
        r.classInfo.toLowerCase().includes(q) ||
        (r.grade && `${r.grade}학년`.includes(q)) ||
        (r.grade && String(r.grade) === q) ||
        r.studentNumber.includes(q) ||
        r.major.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredRecords.map(r => r.studentId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (studentId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleDelete = async (targetStudentIds?: string[]) => {
    const isAll = !targetStudentIds || targetStudentIds.length === 0;
    const targetCount = isAll ? records.length : targetStudentIds.length;

    if (targetCount === 0) {
      toast({ title: '선택된 항목이 없습니다.', description: '삭제할 학생을 선택해 주세요.' });
      return;
    }

    const confirmMsg = isAll
      ? `정말로 [${categoryTitle}] 부문에서 ${isAdmin ? '등록된 모든' : '내가 등록한'} 학생 (${targetCount}명)의 실적 데이터를 전체 삭제하시겠습니까?\n(삭제 시 산출 점수가 자동으로 차감 재계산됩니다)`
      : `선택한 ${targetCount}명의 학생 [${categoryTitle}] 실적 데이터를 삭제하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      const res = await deleteMyImportedRecordsAction(category, targetStudentIds);
      if (res.success) {
        toast({
          title: '데이터 삭제 완료',
          description: `${res.deletedStudentsCount}명의 학생 실적(${res.deletedItemsCount}건)이 안전하게 삭제되었으며 점수가 재산출되었습니다.`,
        });
        await loadRecords();
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: '삭제 실패',
          description: res.error || '데이터 삭제 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '오류 발생',
        description: err.message || '서버 통신 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isAllSelected = filteredRecords.length > 0 && selectedIds.size === filteredRecords.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full p-0 max-h-[88vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-slate-200 bg-white">
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-200/80 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-2xs shrink-0">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
                    <span>{categoryTitle} 등록 내역 관리 (수정/삭제)</span>
                    <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 shrink-0">
                      {isAdmin ? '관리자 모드 (전체)' : '내가 등록한 데이터'}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                    {isAdmin
                      ? `등록된 실적 데이터를 확인하고 개별 수정하거나 선택 삭제/일괄 초기화할 수 있습니다.`
                      : `선생님께서 등록하신 실적 데이터를 확인하고 개별 수정 및 안전한 삭제를 진행할 수 있습니다.`}
                  </DialogDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadRecords}
                disabled={isLoading}
                className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 border-slate-200 font-bold rounded-xl gap-1.5 shrink-0 shadow-2xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                <span className="hidden sm:inline">새로고침</span>
              </Button>
            </div>
          </DialogHeader>

          {/* 본문 영역 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/60 custom-scrollbar">
            {/* 상단 검색 및 통계 바 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="이름, 학과, 반, 번호 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white rounded-xl border-slate-200 shadow-2xs focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-xs text-slate-600 font-medium">
                <span>
                  등록 학생: <strong className="text-slate-900">{records.length}명</strong> (총 {totalItemCount}건)
                </span>
                {selectedIds.size > 0 && (
                  <Badge className="bg-indigo-600 text-white text-[11px] font-bold shadow-2xs">
                    {selectedIds.size}명 선택됨
                  </Badge>
                )}
              </div>
            </div>

            {/* 학생 목록 테이블 */}
            <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {isLoading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold">등록된 실적 데이터를 불러오는 중...</span>
                </div>
              ) : records.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <div className="h-10 w-10 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <CheckSquare className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-600">
                    {isAdmin ? '등록된 실적 데이터가 없습니다.' : '선생님께서 등록하신 실적 데이터가 없습니다.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    엑셀 일괄 등록을 통해 데이터를 등록하시면 이곳에서 관리하실 수 있습니다.
                  </p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  검색 조건에 맞는 학생이 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-100/80">
                    <TableRow className="text-slate-700 font-extrabold text-xs">
                      <TableHead className="w-10 text-center p-2">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="전체 선택"
                        />
                      </TableHead>
                      <TableHead className="w-24 p-2 text-slate-800">학생 정보</TableHead>
                      <TableHead className="p-2 text-slate-800">등록된 실적 내역 요약</TableHead>
                      <TableHead className="w-28 p-2 text-slate-800 text-right">등록 일시</TableHead>
                      <TableHead className="w-24 p-2 text-center text-slate-800">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((item) => {
                      const isSelected = selectedIds.has(item.studentId);
                      return (
                        <TableRow
                          key={item.studentId}
                          onClick={() => handleToggleSelect(item.studentId)}
                          className={cn(
                            "cursor-pointer hover:bg-slate-50/80 transition-colors text-xs border-b border-slate-100",
                            isSelected && "bg-indigo-50/50"
                          )}
                        >
                          <TableCell className="text-center p-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelect(item.studentId)}
                              aria-label={`${item.studentName} 선택`}
                            />
                          </TableCell>
                          <TableCell className="p-2.5 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900">{item.studentName}</span>
                              {item.grade && (
                                <Badge variant="outline" className="text-[10px] font-black px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                                  {item.grade}학년
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {item.major} {item.classInfo} {item.studentNumber}번
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="space-y-1">
                              {item.summary.map((line, idx) => (
                                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                                  <span className="text-indigo-500 font-bold shrink-0">•</span>
                                  <span className="leading-tight">{line}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 text-right text-[10px] text-slate-400 whitespace-nowrap">
                            {item.registeredAt ? (
                              <div>
                                <div className="font-medium text-slate-600">{new Date(item.registeredAt).toLocaleDateString()}</div>
                                <div className="text-[9px] text-slate-400">{item.registeredByName ? `${item.registeredByName}` : ''}</div>
                              </div>
                            ) : (
                              <span>-</span>
                            )}
                          </TableCell>
                          <TableCell className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartEdit(item)}
                                className="h-7 px-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 border-indigo-200 rounded-lg gap-1 shadow-2xs"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>수정</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete([item.studentId])}
                                className="h-7 px-2 text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                title="이 학생의 실적 삭제"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* 하단 푸터 액션 버튼 */}
          <DialogFooter className="p-4 bg-white border-t border-slate-200/80 flex flex-row items-center justify-between sm:justify-between shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-xs text-slate-700 font-bold rounded-xl border-slate-200 hover:bg-slate-50"
            >
              닫기
            </Button>

            <div className="flex items-center gap-2">
              {records.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDeleting || records.length === 0}
                  onClick={() => handleDelete(undefined)}
                  className="h-9 px-3 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl gap-1.5"
                  title="등록된 모든 데이터를 일괄 삭제합니다"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isAdmin ? '부문 전체 삭제' : '내가 등록한 전체 삭제'}</span>
                  <span className="sm:hidden">전체삭제</span> ({records.length}명)
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                disabled={isDeleting || selectedIds.size === 0}
                onClick={() => handleDelete(Array.from(selectedIds))}
                className="h-9 px-4 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl gap-1.5 shadow-2xs"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>선택 항목 삭제 ({selectedIds.size}명)</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 개별 학생 실적 단건 수정 모달 */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && !isSavingEdit && setEditingStudent(null)}>
        <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200 bg-white flex flex-col max-h-[85vh]">
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-200/80 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-2xs shrink-0">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
                    <span>{editingStudent?.studentName} 학생 {categoryTitle} 수정</span>
                    {editingStudent?.grade && (
                      <Badge className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5">
                        {editingStudent.grade}학년
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                    {editingStudent?.major} • {editingStudent?.classInfo} • {editingStudent?.studentNumber}번
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/60 custom-scrollbar">
            {/* 1. 직업공통능력평가 등급 수정 폼 */}
            {category === 'vocational' && (
              <div className="space-y-4">
                {(['grade1', 'grade2', 'grade3'] as const).map((gk, idx) => {
                  const gYear = idx + 1;
                  const gState = vocationalEditForm[gk];
                  const gradeSum = gState.isCompleted 
                    ? ((gState.korean || 5) + (gState.english || 5) + (gState.math || 5) + (gState.problem || 5))
                    : 20;

                  return (
                    <div key={gk} className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-black text-xs px-2 py-0.5">
                            {gYear}학년 평가
                          </Badge>
                          <span className="text-xs font-bold text-slate-700">
                            {gYear === 3 ? '전국단위평가' : '자가진단평가'}
                          </span>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            checked={gState.isCompleted}
                            onCheckedChange={(checked) => {
                              setVocationalEditForm(prev => ({
                                ...prev,
                                [gk]: { ...prev[gk], isCompleted: Boolean(checked) }
                              }));
                            }}
                          />
                          <span className="text-xs font-extrabold text-slate-800">응시 완료 (이수)</span>
                        </label>
                      </div>

                      {gState.isCompleted ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {/* 국어영역 */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 block">국어 (1~5등급)</label>
                              <Select
                                value={String(gState.korean || 5)}
                                onValueChange={(val) => {
                                  setVocationalEditForm(prev => ({
                                    ...prev,
                                    [gk]: { ...prev[gk], korean: Number(val) }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg font-semibold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5].map(gr => (
                                    <SelectItem key={gr} value={String(gr)} className="text-xs">{gr}등급</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 영어영역 */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 block">영어 (1~5등급)</label>
                              <Select
                                value={String(gState.english || 5)}
                                onValueChange={(val) => {
                                  setVocationalEditForm(prev => ({
                                    ...prev,
                                    [gk]: { ...prev[gk], english: Number(val) }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg font-semibold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5].map(gr => (
                                    <SelectItem key={gr} value={String(gr)} className="text-xs">{gr}등급</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 수리영역 */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 block">수리 (1~5등급)</label>
                              <Select
                                value={String(gState.math || 5)}
                                onValueChange={(val) => {
                                  setVocationalEditForm(prev => ({
                                    ...prev,
                                    [gk]: { ...prev[gk], math: Number(val) }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg font-semibold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5].map(gr => (
                                    <SelectItem key={gr} value={String(gr)} className="text-xs">{gr}등급</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 문제해결영역 */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 block">문제해결 (1~5등급)</label>
                              <Select
                                value={String(gState.problem || 5)}
                                onValueChange={(val) => {
                                  setVocationalEditForm(prev => ({
                                    ...prev,
                                    [gk]: { ...prev[gk], problem: Number(val) }
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg font-semibold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5].map(gr => (
                                    <SelectItem key={gr} value={String(gr)} className="text-xs">{gr}등급</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 bg-indigo-50/60 rounded-lg border border-indigo-100 text-xs">
                            <span className="font-bold text-indigo-900">4영역 등급 합계</span>
                            <span className="font-black text-indigo-700 text-sm">{gradeSum}등급</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-medium py-1">
                          미응시 또는 기록 없음 상태입니다. 응시 완료 시 체크 후 등급을 입력하세요.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. 봉사활동 시간 수정 폼 */}
            {category === 'volunteer' && (
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">교내 봉사활동 인정시간</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={volunteerEditForm.schoolHours}
                        onChange={(e) => setVolunteerEditForm(p => ({ ...p, schoolHours: parseFloat(e.target.value) || 0 }))}
                        className="h-9 text-xs rounded-xl bg-slate-50 border-slate-200 font-semibold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">시간</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">교외 봉사활동 인정시간</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={volunteerEditForm.outsideHours}
                        onChange={(e) => setVolunteerEditForm(p => ({ ...p, outsideHours: parseFloat(e.target.value) || 0 }))}
                        className="h-9 text-xs rounded-xl bg-slate-50 border-slate-200 font-semibold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">시간</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                  <span className="font-bold text-emerald-950">총 봉사 인정 시간</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {(volunteerEditForm.schoolHours + volunteerEditForm.outsideHours).toFixed(1)}시간
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-white border-t border-slate-200/80 flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingEdit}
              onClick={() => setEditingStudent(null)}
              className="text-xs h-9 font-bold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-xl px-4"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingEdit}
              onClick={handleSaveEdit}
              className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-5 shadow-2xs gap-1.5"
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>수정 내용 저장</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
