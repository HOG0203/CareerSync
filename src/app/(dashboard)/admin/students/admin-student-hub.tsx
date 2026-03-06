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
import { Users, UserPlus, GraduationCap } from 'lucide-react';
import { ImportButton } from '../../students/import-button';
import { ExportButton } from '../../students/export-button';
import DashboardFilters from '@/components/dashboard/dashboard-filters';
import { AddStudentButton } from './add-student-button';
import { StandardSpreadsheetTable } from '@/components/dashboard/standard-spreadsheet-table'
import { updateStudentField, bulkUpdateStudentData, deleteStudents } from '@/app/students/actions'
import { MasterCertificate } from '@/app/(dashboard)/admin/settings/actions'
import { PromotionModal } from '../../class-management/promotion-modal'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// 학생 등록 및 진급 관리 전용 컬럼 (기본 정보만 노출)
const COLUMNS = [
  { key: 'grade', label: '학년', width: 60, readOnly: true },
  { key: 'major', label: '학과', width: 120, readOnly: true },
  { key: 'class_info', label: '반', width: 60, readOnly: true },
  { key: 'student_number', label: '번호', width: 60, readOnly: true },
  { key: 'student_name', label: '성명', width: 100, readOnly: true },
]

const GROUP_HEADERS = [
  { label: '학생 기본 인적사항', colSpan: 5, className: 'bg-slate-100 text-slate-900 text-[11px]' },
]

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

  const handleSave = async (id: string, field: string, value: any) => {
    return await updateStudentField(id, field, value) as any
  }

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
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between px-1 gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <UserPlus className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600" />
            학생 등록 및 진급 관리
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            전교생 데이터를 통합 관리하고 학년 교체기 진급 처리를 수행합니다.
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap border-t lg:border-none pt-3 lg:pt-0">
          <ImportButton />
          <ExportButton data={processedData} filename={`전교생_학생명부_${new Date().toLocaleDateString()}.csv`} />
          <AddStudentButton 
            baseYear={settings.baseYear} 
            majors={majors.map((m: any) => m.value)} 
          />
        </div>
      </div>

      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <DashboardFilters 
            graduationYears={graduationYears}
            majors={majors}
            classes={classes}
            statuses={statuses}
            defaultYear={(settings.baseYear + 1).toString()}
            baseUrl="/admin/students"
            baseYear={settings.baseYear}
          />
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-l sm:border-t-0 pt-3 sm:pt-0 sm:pl-4 border-slate-100 shrink-0">
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Students</span>
            <span className="text-base sm:text-lg font-black text-indigo-600">{processedData.length}명</span>
          </div>
        </div>
      </div>

      <Card className="flex-1 min-h-0 shadow-md border-none bg-white flex flex-col rounded-2xl overflow-hidden min-w-full">
        <CardHeader className="py-3 sm:py-4 px-4 sm:px-6 border-b bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-indigo-100 p-1.5 sm:p-2 rounded-xl text-indigo-600">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-lg font-bold text-slate-800">
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
        <CardContent className="flex-1 p-0 relative">
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
          />
        </CardContent>
      </Card>

      <PromotionModal 
        isOpen={isPromotionModalOpen}
        onClose={() => setIsPromotionModalOpen(false)}
        selectedStudents={selectedStudentsForPromotion}
      />
    </div>
  )
}
