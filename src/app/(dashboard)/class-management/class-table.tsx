'use client'

import * as React from 'react'
import { StandardSpreadsheetTable, ColumnConfig } from '@/components/dashboard/standard-spreadsheet-table'
import { updatePersonalDetail, bulkUpdatePersonalDetails } from './actions'
import { MasterCertificate } from '@/app/(dashboard)/admin/settings/actions'
import { CounselingModal } from './counseling-modal'

interface ClassTableProps {
  initialData: any[];
  masterCertificates: MasterCertificate[];
}

// 학반 관리 컬럼 정의 (상담일지 우측 이동 및 액션화)
const COLUMNS: ColumnConfig[] = [
  { key: 'student_number', label: '번호', width: 35, readOnly: true },
  { key: 'student_name', label: '성명', width: 65, readOnly: true },
  { 
    key: 'career_aspiration', 
    label: '기초진로희망', 
    width: 120, 
    type: 'select', 
    options: [
      { label: '취업(일반취업)', value: '취업(일반취업)' },
      { label: '취업(대/공기업)', value: '취업(대/공기업)' },
      { label: '취업(일학습병행)', value: '취업(일학습병행)' },
      { label: '취업(취업맞춤반)', value: '취업(취업맞춤반)' },
      { label: '진학', value: '진학' },
      { label: '기술사관', value: '기술사관' },
      { label: '부사관', value: '부사관' },
      { label: '군특성화', value: '군특성화' },
      { label: '기타', value: '기타' },
    ],
    variant: (val) => val ? 'bg-blue-50 text-blue-700 border-blue-100' : ''
  },
  { 
    key: 'special_notes', 
    label: '특이사항', 
    width: 100, 
    type: 'select',
    options: [
      { label: '청솔반', value: '청솔반' },
      { label: '도제반', value: '도제반' },
      { label: '축구부', value: '축구부' },
      { label: '검도부', value: '검도부' },
      { label: '특수교육대상자', value: '특수교육대상자' },
      { label: '기타', value: '기타' },
    ],
    variant: (val) => val ? 'bg-amber-50 text-amber-700 border-amber-100' : ''
  },
  { 
    key: 'certificates', 
    label: '취득자격증', 
    width: 150, 
    type: 'multi-select' 
  },
  { 
    key: 'military_status', 
    label: '병역희망', 
    width: 80, 
    type: 'select',
    options: [
      { label: '군대입소', value: '군대입소' },
      { label: '병역특례', value: '병역특례' },
      { label: '병역면제', value: '병역면제' },
    ],
    variant: (val) => val === '군대입소' ? 'bg-slate-50 text-slate-700 border-slate-100' : val === '병역특례' ? 'bg-purple-50 text-purple-700 border-purple-100' : ''
  },
  {
    key: 'desired_work_area',
    label: '취업희망지역',
    width: 120,
    type: 'select',
    options: [
      { label: '대구인근', value: '대구인근' },
      { label: '원거리(기숙사)', value: '원거리(기숙사)' },
      { label: '둘다가능', value: '둘다가능' },
    ],
    variant: (val) => val === '대구인근' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : val === '원거리(기숙사)' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : val === '둘다가능' ? 'bg-sky-50 text-sky-700 border-sky-100' : ''
  },  { 
    key: 'parents_opinion', 
    label: '부모님의견', 
    width: 130,
    type: 'select',
    options: [
      { label: '취업', value: '취업' },
      { label: '진학', value: '진학' },
      { label: '내선택 존중', value: '내선택 존중' },
    ],
    variant: (val) => val === '내선택 존중' ? 'bg-amber-50 text-amber-700 border-amber-100' : val ? 'bg-slate-50 text-slate-700 border-slate-100' : ''
  },
  { key: 'shoe_size', label: '신발', width: 50 },
  { key: 'top_size', label: '상의', width: 50 },
  { key: 'personal_remarks', label: '비고(행정)', width: 150 },
  { 
    key: 'counseling_log_action', 
    label: '상담일지', 
    width: 100, 
    type: 'action' 
  },
]

const GROUP_HEADERS = [
  { label: '학생 기본 정보', colSpan: 2, className: 'bg-slate-100 text-slate-900 text-[11px]' },
  { label: '진로 및 특이사항', colSpan: 2, className: 'bg-blue-50 text-blue-900 text-[11px]' },
  { label: '취득 자격', colSpan: 1, className: 'bg-amber-50 text-amber-900 text-[11px]' },
  { label: '취업 상세 및 의견', colSpan: 3, className: 'bg-emerald-50 text-emerald-900 text-[11px]' },
  { label: '피복 및 비고', colSpan: 3, className: 'bg-slate-50 text-slate-700 text-[11px]' },
  { label: '기록', colSpan: 1, className: 'bg-indigo-50 text-indigo-900 text-[11px]' },
]

export function ClassTable({ initialData, masterCertificates }: ClassTableProps) {
  const [selectedStudent, setSelectedStudent] = React.useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  const handleSave = async (id: string, field: string, value: any) => {
    const result: any = await updatePersonalDetail(id, field, value)
    if (!result.success) {
      console.error(`[개별 저장 실패] ID: ${id}, Field: ${field}, Error:`, result.error)
    }
    return result
  }

  const handleBulkSave = async (updates: any[]) => {
    const result: any = await bulkUpdatePersonalDetails(updates)
    if (!result.success) {
      console.error('[일괄 저장 실패] Updates:', updates, 'Error:', result.error)
    }
    return result
  }

  const handleAction = (id: string, key: string) => {
    if (key === 'counseling_log_action') {
      const student = initialData.find(s => s.id === id)
      if (student) {
        setSelectedStudent(student)
        setIsModalOpen(true)
      }
    }
  }

  return (
    <div className="w-full overflow-hidden">
      <StandardSpreadsheetTable 
        data={initialData}
        columns={COLUMNS}
        groupHeaders={GROUP_HEADERS}
        onSave={handleSave}
        onBulkSave={handleBulkSave}
        onAction={handleAction}
        searchPlaceholder="학반 학생 검색..."
        masterCertificates={masterCertificates}
      />

      <CounselingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={selectedStudent}
      />
    </div>
  )
}
