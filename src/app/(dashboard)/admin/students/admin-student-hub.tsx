'use client'

import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Users, UserPlus, GraduationCap, AlertTriangle, Loader2 } from 'lucide-react';
import { ImportButton } from '../../students/import-button';
import { ExportButton } from '../../students/export-button';
import DashboardFilters from '@/components/dashboard/dashboard-filters';
import { AddStudentButton } from './add-student-button';
import { PromotionImportButton } from './promotion-import-button';
import { StandardSpreadsheetTable } from '@/components/dashboard/standard-spreadsheet-table'
import { updateStudentField, bulkUpdateStudentData, deleteStudents } from '@/app/students/actions'
import { MasterCertificate } from '@/app/(dashboard)/admin/settings/actions'
import { PromotionModal } from '../../class-management/promotion-modal'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// 학생 등록 및 진급 관리 전용 컬럼 (기본 정보 직접 수정 가능)
const COLUMNS = [
  { key: 'grade', label: '학년', width: 60, readOnly: true },
  { key: 'major', label: '학과', width: 120 },
  { key: 'class_info', label: '반', width: 60 },
  { key: 'student_number', label: '번호', width: 60 },
  { key: 'student_name', label: '성명', width: 100 },
  { key: 'phone_number', label: '휴대전화번호', width: 110 },
]

const FIELD_LABEL_MAP: Record<string, string> = {
  major: '학과',
  class_info: '반',
  student_number: '번호',
  student_name: '성명',
  phone_number: '휴대전화번호',
};

const GROUP_HEADERS = [
  { label: '학생 기본 인적사항', colSpan: 6, className: 'bg-slate-100 text-slate-900 text-[11px]' },
]

interface PendingSaveRequest {
  id: string;
  field: string;
  fieldLabel: string;
  value: any;
  oldValue: any;
  studentName: string;
  resolve: (res: { success: boolean; error?: string }) => void;
}

export function AdminStudentHub({ 
  initialData, 
  graduationYears, 
  majors, 
  classes, 
  statuses, 
  settings,
  params,
  masterCertificates = []
}: {
  initialData: any[],
  graduationYears: any[],
  majors: any[],
  classes: any[],
  statuses: any[],
  settings: { baseYear: number },
  params: any,
  masterCertificates?: MasterCertificate[]
}) {
  const [selectedRowIds, setSelectedRowIds] = React.useState<string[]>([])
  const [isPromotionModalOpen, setIsPromotionModalOpen] = React.useState(false)
  const [selectedIdsForPromotion, setSelectedIdsForPromotion] = React.useState<string[]>([])
  const [pendingSave, setPendingSave] = React.useState<PendingSaveRequest | null>(null)
  const [isSavingConfirm, setIsSavingConfirm] = React.useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // 학사학년도 기반으로 각 학생의 학년 계산하여 데이터 가공
  const processedData = React.useMemo(() => {
    return initialData.map(s => {
      // 공식: 4 - (졸업연도 - 학사학년도)
      // 예: 2027(GY) 졸업생의 2026(AY) 학년은? 4 - (2027 - 2026) = 3학년
      const diff = s.graduation_year - settings.baseYear;
      const grade = diff === 1 ? '3학년' : 
                    diff === 2 ? '2학년' : 
                    diff === 3 ? '1학년' : `${s.graduation_year}졸업`;
      return { ...s, grade };
    });
  }, [initialData, settings.baseYear]);

  // 학년도 필터 등이 변경되면 선택된 항목 초기화
  React.useEffect(() => {
    setSelectedRowIds([])
  }, [params.year, params.major, params.class, params.status])

  const pendingSaveRef = React.useRef<PendingSaveRequest | null>(null);

  const handleSave = (id: string, field: string, value: any) => {
    if (pendingSaveRef.current) {
      return Promise.resolve({ success: false });
    }

    const student = processedData.find(s => s.id === id);
    const studentName = student?.student_name || '선택한 학생';
    const oldValue = student ? (student as any)[field] || '미입력' : '미입력';
    const fieldLabel = FIELD_LABEL_MAP[field] || field;

    if (String(oldValue).trim() === String(value).trim()) {
      return Promise.resolve({ success: true });
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const newPending = {
        id,
        field,
        fieldLabel,
        value,
        oldValue,
        studentName,
        resolve,
      };
      pendingSaveRef.current = newPending;
      setPendingSave(newPending);
    });
  };

  const handleConfirmSave = async () => {
    const target = pendingSaveRef.current || pendingSave;
    if (!target) return;
    setIsSavingConfirm(true);
    try {
      const res = await updateStudentField(target.id, target.field, target.value);
      if (res.success) {
        toast({
          title: '학생 정보 수정 완료',
          description: `${target.studentName} 학생의 ${target.fieldLabel} 정보가 성공적으로 변경되었습니다.`,
        });
        target.resolve({ success: true });
      } else {
        toast({
          variant: 'destructive',
          title: '수정 실패',
          description: res.error || '정보 수정 중 오류가 발생했습니다.',
        });
        target.resolve({ success: false, error: res.error });
      }
    } catch (err: any) {
      target.resolve({ success: false, error: err.message });
    } finally {
      setIsSavingConfirm(false);
      pendingSaveRef.current = null;
      setPendingSave(null);
    }
  };

  const handleCancelSave = () => {
    const target = pendingSaveRef.current || pendingSave;
    if (target) {
      target.resolve({ success: false });
    }
    pendingSaveRef.current = null;
    setPendingSave(null);
  };



  const handleBulkSave = async (updates: any[]) => {
    return await bulkUpdateStudentData(updates) as any
  }

  const handlePromoteTrigger = async (ids: string[]) => {
    setSelectedIdsForPromotion(ids)
    setIsPromotionModalOpen(true)
    return { success: true }
  }

  const handleDeleteTrigger = async (ids: string[]) => {
    if (!confirm(`선택한 ${ids.length}명의 학생 정보를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 모든 상담 기록과 이력도 삭제됩니다.`)) {
      return { success: false }
    }

    const result = await deleteStudents(ids)
    if (result.success) {
      toast({ title: '삭제 완료', description: `${ids.length}명의 학생 정보가 삭제되었습니다.` })
      router.refresh()
      return { success: true }
    } else {
      toast({ variant: 'destructive', title: '삭제 실패', description: result.error })
      return { success: false, error: result.error }
    }
  }

  const selectedStudentsForPromotion = processedData.filter((s: any) => selectedIdsForPromotion.includes(s.id))

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2.5">
      {/* 헤더 섹션 (제목 크기 유지 & 모바일 상단 유격 콤팩트화) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between px-1 gap-1.5 sm:gap-3 shrink-0">
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <UserPlus className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600 shrink-0" />
            학생 등록 및 진급 관리
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            전교생 데이터를 통합 관리하고 학년 교체기 진급 처리를 수행합니다.
          </p>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto custom-scrollbar scrollbar-hide whitespace-nowrap pt-1 lg:pt-0 w-full sm:w-auto shrink-0 pb-0.5 sm:pb-0">
          <PromotionImportButton currentData={processedData} baseYear={settings.baseYear} />
          <ImportButton />
          <ExportButton data={processedData} filename={`전교생_학생명부_${new Date().toLocaleDateString()}.csv`} />
          <AddStudentButton 
            baseYear={settings.baseYear} 
            majors={majors.map((m: any) => m.value)} 
          />
        </div>
      </div>

      {/* 필터 및 학생 수 카운터 (모바일 슬림화) */}
      <div className="bg-white p-1.5 sm:p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 shrink-0">
        <div className="w-full sm:w-auto">
          <React.Suspense fallback={<div className="h-10 w-[350px] bg-slate-50 animate-pulse rounded-lg" />}>
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
        
        <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-l sm:border-t-0 pt-1.5 sm:pt-0 sm:pl-3 border-slate-100 shrink-0">
          <div className="flex items-center gap-1.5 sm:flex-col sm:items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
            <span className="text-sm sm:text-base font-black text-indigo-600">{processedData.length}명</span>
          </div>
        </div>
      </div>

      {/* 카드 및 명부 테이블 */}
      <Card className="shadow-sm border-none bg-white flex flex-col rounded-xl min-w-full mb-0">
        <CardHeader className="py-2 sm:py-2.5 px-3 sm:px-5 border-b bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="bg-indigo-100 p-1 sm:p-1.5 rounded-lg text-indigo-600">
              <GraduationCap className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-800">
                통합 학생 명부 관리
              </CardTitle>
              <CardDescription className="text-[10px] sm:text-xs font-medium mt-0.5">
                {params.year ? `${params.year}년 졸업 예정 ` : '전 학년 '}
                {params.major && params.major !== 'all' ? `${params.major} ` : ''}
                조회 중
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative flex flex-col">
          <StandardSpreadsheetTable 
            data={processedData}
            columns={COLUMNS}
            groupHeaders={GROUP_HEADERS}
            onSave={handleSave}
            onBulkSave={handleBulkSave}
            onPromote={handlePromoteTrigger}
            onDelete={handleDeleteTrigger}
            selectedRowIds={selectedRowIds}
            onSelectionChange={setSelectedRowIds}
            searchPlaceholder="빠른 학생 검색..."
            masterCertificates={masterCertificates}
            disableNamePopover={true}
            baseYear={settings.baseYear}
            pageType="admin-students"
          />
        </CardContent>
      </Card>

      <PromotionModal 
        isOpen={isPromotionModalOpen}
        onClose={() => setIsPromotionModalOpen(false)}
        selectedStudents={selectedStudentsForPromotion}
      />

      {/* 학생 정보 변경 확인 2차 모달 */}
      <Dialog open={!!pendingSave} onOpenChange={(open) => { if (!open) handleCancelSave(); }}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4 mr-6">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2 text-slate-900 truncate">
                  학생 정보 변경 확인
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                  인적사항 변경사항 학사 이력 즉시 반영
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4">
            {pendingSave && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="font-bold text-slate-500">학생 성명</span>
                  <span className="font-black text-slate-900 text-sm">{pendingSave.studentName}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="font-bold text-slate-500">수정 항목</span>
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{pendingSave.fieldLabel}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">기존 값</span>
                    <span className="font-semibold text-slate-600 line-through">{String(pendingSave.oldValue)}</span>
                  </div>
                  <span className="text-slate-400 font-bold">➔</span>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">변경할 값</span>
                    <span className="font-black text-emerald-600 text-sm">{String(pendingSave.value)}</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex sm:justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelSave}
                disabled={isSavingConfirm}
                className="h-10 px-4 text-xs font-bold text-slate-600 rounded-xl"
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSavingConfirm}
                className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md"
              >
                {isSavingConfirm ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '변경 적용'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

