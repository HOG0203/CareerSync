'use client'

import * as React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  UserPlus,
  GraduationCap,
  AlertTriangle,
  Loader2,
  Search,
  Trash2,
  ArrowRightCircle,
  Edit2,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImportButton } from '../../students/import-button';
import { ExportButton } from '../../students/export-button';
import DashboardFilters from '@/components/dashboard/dashboard-filters';
import { AddStudentButton } from './add-student-button';
import { PromotionImportButton } from './promotion-import-button';
import { updateStudentField, deleteStudents } from '@/app/students/actions';
import { PromotionModal } from '../../class-management/promotion-modal';
import { StandardSpreadsheetTable } from '@/components/dashboard/standard-spreadsheet-table/standard-spreadsheet-table';
import { ColumnConfig } from '@/components/dashboard/standard-spreadsheet-table/types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AdminStudentHubProps {
  initialData: any[];
  graduationYears: any[];
  majors: any[];
  classes: any[];
  statuses: any[];
  settings: { baseYear: number };
  params: any;
}


export function AdminStudentHub({
  initialData,
  graduationYears,
  majors,
  classes,
  statuses,
  settings,
  params,
}: AdminStudentHubProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedRowIds, setSelectedRowIds] = React.useState<string[]>([]);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = React.useState(false);
  const [selectedIdsForPromotion, setSelectedIdsForPromotion] = React.useState<string[]>([]);
  
  // 빠른 검색 및 페이지네이션
  const [search, setSearch] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number | 'all'>(50);

  // 개별 학생 수정 모달 상태
  const [editingStudent, setEditingStudent] = React.useState<any | null>(null);
  const [editFormData, setEditFormData] = React.useState({
    student_name: '',
    major: '',
    class_info: '',
    student_number: '',
    phone_number: '',
  });
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // 학사학년도 기반으로 각 학생의 학년 계산하여 데이터 가공
  const processedData = React.useMemo(() => {
    return initialData.map(s => {
      const diff = s.graduation_year - settings.baseYear;
      const grade = diff === 1 ? '3학년' : 
                    diff === 2 ? '2학년' : 
                    diff === 3 ? '1학년' : `${s.graduation_year}졸업`;
      return { ...s, grade };
    });
  }, [initialData, settings.baseYear]);

  // 검색 필터링
  const filteredData = React.useMemo(() => {
    if (!search.trim()) return processedData;
    const q = search.toLowerCase().trim();
    return processedData.filter(s =>
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.student_number || '').includes(q) ||
      (s.major || '').toLowerCase().includes(q) ||
      (s.class_info || '').includes(q) ||
      (s.phone_number || '').includes(q)
    );
  }, [processedData, search]);

  // 페이지네이션 슬라이싱
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = React.useMemo(() => {
    if (pageSize === 'all') return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // 필터나 검색어 변경 시 페이지 1로 리셋
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, params.year, params.major, params.class]);

  // 체크박스 전체 선택 / 해제
  const isAllSelected = paginatedData.length > 0 && paginatedData.every(s => selectedRowIds.includes(s.id));
  const isSomeSelected = paginatedData.some(s => selectedRowIds.includes(s.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = new Set(paginatedData.map(s => s.id));
      setSelectedRowIds(prev => prev.filter(id => !pageIds.has(id)));
    } else {
      const pageIds = paginatedData.map(s => s.id);
      setSelectedRowIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 선택 학생 일괄 진급
  const handlePromoteSelected = () => {
    if (selectedRowIds.length === 0) return;
    setSelectedIdsForPromotion(selectedRowIds);
    setIsPromotionModalOpen(true);
  };

  // 선택 학생 일괄 삭제
  const handleDeleteSelected = async () => {
    if (selectedRowIds.length === 0) return;
    if (!confirm(`선택한 ${selectedRowIds.length}명의 학생 정보를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 모든 상담 기록과 이력도 삭제됩니다.`)) {
      return;
    }

    const result = await deleteStudents(selectedRowIds);
    if (result.success) {
      toast({ title: '삭제 완료', description: `${selectedRowIds.length}명의 학생 정보가 삭제되었습니다.` });
      setSelectedRowIds([]);
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: '삭제 실패', description: result.error });
    }
  };

  // 학생 개별 수정 모달 오픈
  const handleOpenEdit = (student: any) => {
    setEditingStudent(student);
    setEditFormData({
      student_name: student.student_name || '',
      major: student.major || '',
      class_info: (student.class_info || '').replace(/[^0-9]/g, ''),
      student_number: (student.student_number || '').replace(/[^0-9]/g, ''),
      phone_number: student.phone_number || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setIsSavingEdit(true);

    try {
      const updates = [
        { field: 'student_name', value: editFormData.student_name.trim() },
        { field: 'major', value: editFormData.major.trim() },
        { field: 'class_info', value: editFormData.class_info.trim() },
        { field: 'student_number', value: editFormData.student_number.trim() },
        { field: 'phone_number', value: editFormData.phone_number.trim() || null },
      ];

      for (const u of updates) {
        if (editingStudent[u.field] !== u.value) {
          await updateStudentField(editingStudent.id, u.field, u.value);
        }
      }

      toast({
        title: '학생 정보 수정 완료',
        description: `${editFormData.student_name} 학생의 정보가 안전하게 갱신되었습니다.`,
      });

      setEditingStudent(null);
      router.refresh();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '수정 실패',
        description: err.message || '정보 수정 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const columns: ColumnConfig[] = React.useMemo(() => [
    {
      key: 'grade',
      label: '학년',
      width: 75,
      readOnly: true,
      type: 'text',
      variant: (val) => {
        if (val === '3학년') return 'bg-blue-50 text-blue-700 font-bold';
        if (val === '2학년') return 'bg-indigo-50 text-indigo-700 font-bold';
        if (val === '1학년') return 'bg-emerald-50 text-emerald-700 font-bold';
        return 'text-slate-600';
      },
    },
    {
      key: 'major',
      label: '학과',
      width: 140,
      type: 'select',
      options: majors.map((m: any) => ({ label: m.label, value: m.value })),
    },
    {
      key: 'class_info',
      label: '반',
      width: 60,
      type: 'text',
    },
    {
      key: 'student_number',
      label: '번호',
      width: 60,
      type: 'text',
    },
    {
      key: 'student_name',
      label: '성명',
      width: 100,
      type: 'text',
    },
    {
      key: 'phone_number',
      label: '휴대전화번호',
      width: 140,
      type: 'text',
    },
  ], [majors]);

  // 시트 인라인 단일 셀 저장 핸들러
  const handleSave = React.useCallback(async (id: string, field: string, value: any) => {
    try {
      const result = await updateStudentField(id, field, value);
      if (result.success) {
        toast({ title: '수정 완료', description: '학생 정보가 안전하게 저장되었습니다.' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
      return result;
    } catch (err: any) {
      toast({ variant: 'destructive', title: '저장 실패', description: err.message });
      return { success: false, error: err.message };
    }
  }, [toast]);

  // 시트 일괄 붙여넣기/삭제 다중 셀 저장 핸들러
  const handleBulkSave = React.useCallback(async (updates: { id: string; field: string; value: any }[]) => {
    try {
      for (const u of updates) {
        await updateStudentField(u.id, u.field, u.value);
      }
      toast({ title: '일괄 저장 완료', description: `${updates.length}개의 데이터가 반영되었습니다.` });
      return { success: true };
    } catch (err: any) {
      toast({ variant: 'destructive', title: '저장 실패', description: err.message });
      return { success: false, error: err.message };
    }
  }, [toast]);


  const selectedStudentsForPromotion = processedData.filter((s: any) => selectedIdsForPromotion.includes(s.id));

  return (
    <div className="flex flex-col h-[calc(100dvh-150px)] lg:h-[calc(100vh-115px)] max-h-[calc(100dvh-150px)] lg:max-h-[calc(100vh-115px)] min-h-0 gap-2.5 overflow-hidden">
      {/* 상단 툴바: 타이틀 & 작업 액션 버튼들 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between px-1 gap-3 shrink-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserPlus className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 shrink-0" />
            학생 등록 및 진급 관리
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            전교생 명부를 통합 관리하고 신규 등록, 정보 수정 및 학년 진급 처리를 수행합니다.
          </p>
        </div>

        {/* 상단 액션 버튼 그룹 */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <PromotionImportButton currentData={processedData} baseYear={settings.baseYear} />
          <ImportButton />
          <ExportButton 
            data={processedData} 
            filename={`학생_기본명부_${new Date().toLocaleDateString()}.csv`} 
            type="basic"
          />

          <AddStudentButton
            baseYear={settings.baseYear}
            majors={majors.map((m: any) => m.value)}
          />
        </div>
      </div>

      {/* 필터 컨트롤 바 */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="w-full lg:w-auto">
          <React.Suspense fallback={<div className="h-9 w-[350px] bg-slate-100 animate-pulse rounded-xl" />}>
            <DashboardFilters
              graduationYears={graduationYears}
              majors={majors}
              classes={classes}
              statuses={statuses}
              defaultYear={(settings.baseYear + 1).toString()}
              baseUrl="/admin/students"
              baseYear={settings.baseYear}
              hideStatus={true}
            />
          </React.Suspense>
        </div>

        {/* 총 인원 배지 */}
        <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-100/80 shadow-2xs whitespace-nowrap self-start lg:self-auto">
          총 {processedData.length}명
        </div>
      </div>

      {/* 일괄 선택 작업 바 (선택된 항목이 있을 때만 노출) */}
      {selectedRowIds.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200/80 px-4 py-2.5 rounded-2xl shadow-2xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-900">
              <span className="text-blue-600 font-black">{selectedRowIds.length}명</span> 선택됨
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePromoteSelected}
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <ArrowRightCircle className="h-3.5 w-3.5" />
              선택 학생 진급 처리
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteSelected}
              className="h-8 px-3 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs bg-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              선택 삭제
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedRowIds([])}
              className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-800"
            >
              선택 해제
            </Button>
          </div>
        </div>
      )}

      {/* 메인 학생 명부 엑셀식 스프레드시트 카드 */}
      <Card className="flex-1 min-h-0 shadow-2xs border border-slate-200/80 bg-white rounded-2xl overflow-hidden flex flex-col p-3 sm:p-4">
        <StandardSpreadsheetTable
          data={processedData}
          columns={columns}
          onSave={handleSave}
          onBulkSave={handleBulkSave}
          selectedRowIds={selectedRowIds}
          onSelectionChange={setSelectedRowIds}
          hideCheckbox={false}
          pageType="admin-students"
          baseYear={settings.baseYear}
          searchPlaceholder="학생 이름, 번호, 연락처 실시간 검색..."
        />

      </Card>


      {/* 진급 모달 */}
      <PromotionModal
        isOpen={isPromotionModalOpen}
        onClose={() => setIsPromotionModalOpen(false)}
        selectedStudents={selectedStudentsForPromotion}
      />

      {/* 학생 정보 수정 다이얼로그 모달 */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) setEditingStudent(null); }}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
          <DialogHeader className="p-5 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <Edit2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  학생 인적사항 수정
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  수정된 정보는 학생 학사 이력 및 계정 정보에 즉시 동기화됩니다.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">성명</label>
              <Input
                value={editFormData.student_name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, student_name: e.target.value }))}
                placeholder="학생 이름"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">학과</label>
                <Input
                  value={editFormData.major}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, major: e.target.value }))}
                  placeholder="학과명"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">반</label>
                <Input
                  value={editFormData.class_info}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, class_info: e.target.value }))}
                  placeholder="예: 1"
                  className="h-9 text-xs rounded-xl text-center"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">번호</label>
                <Input
                  value={editFormData.student_number}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, student_number: e.target.value }))}
                  placeholder="예: 12"
                  className="h-9 text-xs rounded-xl text-center"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">휴대전화번호</label>
              <Input
                value={editFormData.phone_number}
                onChange={(e) => setEditFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="010-0000-0000"
                className="h-9 text-xs rounded-xl font-mono"
              />
              <p className="text-[11px] text-slate-400">
                * 휴대폰 번호 변경 시 학생 로그인 초기 비밀번호(뒷 4자리)가 자동 동기화됩니다.
              </p>
            </div>

            <DialogFooter className="flex sm:justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingStudent(null)}
                disabled={isSavingEdit}
                className="h-9 px-4 text-xs font-bold rounded-xl"
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '저장 완료'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


