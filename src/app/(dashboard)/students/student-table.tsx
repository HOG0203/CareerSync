'use client'

import * as React from 'react'
import { StandardSpreadsheetTable, ColumnConfig } from '@/components/dashboard/standard-spreadsheet-table'
import { updateStudentField, bulkUpdateStudentData } from '@/app/students/actions'
import { MasterCertificate } from '@/app/(dashboard)/admin/settings/actions'

// 학생 관리 컬럼 정의 (모든 데이터 필드 포함 풀 버전)
const COLUMNS: ColumnConfig[] = [
  { key: 'major', label: '학과', width: 70, readOnly: true },
  { key: 'class_info', label: '반', width: 40, readOnly: true },
  { key: 'student_number', label: '번호', width: 40, readOnly: true },
  { key: 'student_name', label: '성명', width: 65, readOnly: true },
  { key: 'graduation_year', label: '졸업연도', width: 60, readOnly: true },
  { 
    key: 'is_desiring_employment', label: '희망', width: 55, type: 'select', 
    options: [
      { label: '예', value: '예' }, 
      { label: '아니오', value: '아니오' }, 
      { label: '제외인정', value: '제외인정' }, 
      { label: '기술사관', value: '기술사관' }, 
      { label: '위탁학생', value: '위탁학생' }
    ],
    variant: (val) => {
      if (val === '예') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      if (val === '아니오') return 'bg-rose-50 text-rose-700 border-rose-100'
      if (val === '제외인정') return 'bg-slate-100 text-slate-700 border-slate-200'
      if (val === '기술사관') return 'bg-indigo-50 text-indigo-700 border-indigo-100'
      if (val === '위탁학생') return 'bg-orange-50 text-orange-700 border-orange-100'
      return 'text-slate-500'
    }
  },
  { 
    key: 'employment_status', label: '취업구분', width: 100, type: 'select',
    options: [
      { label: '일반취업', value: '일반취업' }, 
      { label: '청솔반', value: '청솔반' }, 
      { label: '취업맞춤반', value: '취업맞춤반' }, 
      { label: '일학습병행', value: '일학습병행' }, 
      { label: '군특성화', value: '군특성화' }, 
      { label: '기술사관', value: '기술사관' }, 
      { label: '도제', value: '도제' }, 
      { label: '면접진행중', value: '면접진행중' },
      { label: '아우스빌둥', value: '아우스빌둥' }
    ],
    variant: (val) => {
      switch (val) {
        case '일반취업': return 'bg-blue-50 text-blue-700 border-blue-100'
        case '청솔반': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
        case '취업맞춤반': return 'bg-amber-50 text-amber-700 border-amber-100'
        case '일학습병행': return 'bg-purple-50 text-purple-700 border-purple-100'
        case '군특성화': return 'bg-indigo-50 text-indigo-700 border-indigo-100'
        case '기술사관': return 'bg-cyan-50 text-cyan-700 border-cyan-100'
        case '도제': return 'bg-pink-50 text-pink-700 border-pink-100'
        case '면접진행중': return 'bg-orange-100 text-orange-800 border-orange-200'
        case '아우스빌둥': return 'bg-sky-100 text-sky-700 border-sky-200'
        default: return val ? 'bg-slate-50 text-slate-600 border-slate-100' : ''
      }
    }
  },
  { 
    key: 'business_type', 
    label: '사업구분', 
    width: 100,
    type: 'select',
    options: [
      { label: '청솔반', value: '청솔반' },
      { label: '혁신지구사업', value: '혁신지구사업' },
      { label: '아우스빌둥', value: '아우스빌둥' },
      { label: '일학습병행', value: '일학습병행' },
      { label: '도제교육', value: '도제교육' },
      { label: '대구형현장학습', value: '대구형현장학습' }
    ],
    variant: (val) => {
      switch (val) {
        case '청솔반': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        case '혁신지구사업': return 'bg-sky-100 text-sky-700 border-sky-200'
        case '아우스빌둥': return 'bg-indigo-100 text-indigo-700 border-indigo-200'
        case '일학습병행': return 'bg-purple-100 text-purple-700 border-purple-200'
        case '도제교육': return 'bg-rose-100 text-rose-700 border-rose-200'
        case '대구형현장학습': return 'bg-amber-100 text-amber-700 border-amber-200'
        default: return val ? 'bg-slate-50 text-slate-600 border-slate-100' : ''
      }
    }
  },
  { key: 'company', label: '취업처(회사명)', width: 130 },
  { 
    key: 'company_type', label: '기업', width: 95, type: 'select', 
    options: [
      { label: '대기업', value: '대기업' }, 
      { label: '공기업', value: '공기업' }, 
      { label: '공무원', value: '공무원' }, 
      { label: '중견기업', value: '중견기업' }, 
      { label: '중소기업', value: '중소기업' }, 
      { label: '연계교육', value: '연계교육' }, 
      { label: '부사관', value: '부사관' }
    ],
    variant: (val) => {
      switch (val) {
        case '대기업': return 'bg-blue-50 text-blue-700 border-blue-100'
        case '공기업': return 'bg-indigo-50 text-indigo-700 border-indigo-100'
        case '공무원': return 'bg-slate-100 text-slate-700 border-slate-200'
        case '중견기업': return 'bg-purple-50 text-purple-700 border-purple-100'
        case '중소기업': return 'bg-cyan-50 text-cyan-700 border-cyan-100'
        case '연계교육': return 'bg-orange-50 text-orange-700 border-orange-100'
        case '부사관': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
        default: return val ? 'bg-slate-50 text-slate-600 border-slate-100' : ''
      }
    }
  },
  { key: 'has_field_training', label: '실습', width: 40, type: 'select', options: [{ label: 'O', value: 'O' }, { label: 'X', value: 'X' }] },
  { key: 'start_date', label: '시작일', width: 85, type: 'date' },
  { key: 'end_date', label: '종료일', width: 85, type: 'date' },
  { key: 'training_stipend_status', label: '지원금', width: 50, type: 'select', options: [{ label: 'O', value: 'O' }, { label: 'X', value: 'X' }] },
  { key: 'is_hiring_conversion', label: '채용전환여부', width: 85, type: 'select', options: [{ label: 'O', value: 'O' }, { label: 'X', value: 'X' }] },
  { key: 'conversion_date', label: '채용전환일', width: 85, type: 'date' },
  { key: 'is_returned', label: '복교여부', width: 65, type: 'select', options: [{ label: 'O', value: 'O' }, { label: 'X', value: 'X' }] },
  { key: 'return_to_school_reason', label: '복교사유', width: 120 },
  { key: 'remarks', label: '비고(특이사항)', width: 150 },
  { key: 'certificates', label: '자격증', width: 120, type: 'multi-select' },
]

const GROUP_HEADERS = [
  { label: '기본 정보', colSpan: 5, className: 'bg-slate-100 text-slate-900 text-[10px]' },
  { label: '취업 현황', colSpan: 5, className: 'bg-blue-100/50 text-blue-900 text-[10px]' },
  { label: '현장실습 상세', colSpan: 4, className: 'bg-amber-100/50 text-amber-900 text-[10px]' },
  { label: '채용', colSpan: 2, className: 'bg-purple-100/50 text-purple-900 text-[10px]' },
  { label: '복교', colSpan: 2, className: 'bg-rose-100/50 text-rose-900 text-[10px]' },
  { label: '기타/자격', colSpan: 2, className: 'bg-slate-50 text-slate-700 text-[10px]' },
]

export function StudentTable({ 
  initialData, 
  isAdmin = false, 
  masterCertificates = [] 
}: { 
  initialData: any[], 
  isAdmin?: boolean,
  masterCertificates?: MasterCertificate[]
}) {
  const handleSave = async (id: string, field: string, value: any) => {
    if (!isAdmin) return { success: false, error: '권한이 없습니다.' }
    const result = await updateStudentField(id, field, value)
    return result as any
  }

  const handleBulkSave = async (updates: any[]) => {
    if (!isAdmin) return { success: false, error: '권한이 없습니다.' }
    const result = await bulkUpdateStudentData(updates)
    return result as any
  }

  // 관리자가 아닐 경우 모든 컬럼을 readOnly로 설정
  const columns = COLUMNS.map(col => ({
    ...col,
    readOnly: !isAdmin || col.readOnly
  }));

  return (
    <div className="w-full h-full flex flex-col">
      {!isAdmin && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-bold text-amber-700">읽기 전용 모드: 담당 학반 데이터만 조회 가능하며 수정은 제한됩니다.</span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <StandardSpreadsheetTable 
          data={initialData}
          columns={columns}
          groupHeaders={GROUP_HEADERS}
          onSave={handleSave}
          onBulkSave={handleBulkSave}
          searchPlaceholder="빠른 학생 검색..."
          masterCertificates={masterCertificates}
        />
      </div>
    </div>
  )
}
