'use client'

import * as React from 'react'
import { StandardSpreadsheetTable, ColumnConfig } from '@/components/dashboard/standard-spreadsheet-table'
import { updateStudentField, bulkUpdateStudentData } from '@/app/students/actions'
import { MasterCertificate } from '@/app/(dashboard)/admin/settings/actions'
import { FieldTrainingModal } from './field-training-modal'

// 행 데이터 기반 동적 진로코스 옵션 생성 함수
const GET_CAREER_COURSE_OPTIONS = (rowData: any) => {
  const aspiration = rowData?.career_aspiration;
  
  if (aspiration === '취업') {
    return [
      { label: '대/공기업', value: '대/공기업' },
      { label: '공무원', value: '공무원' },
      { label: '중견/강소기업', value: '중견/강소기업' },
      { label: '가업승계', value: '가업승계' },
      { label: '부사관', value: '부사관' },
      { label: '아우스빌둥', value: '아우스빌둥' },
      { label: '도제', value: '도제' },
      { label: '기타(직접입력)', value: '기타(직접입력)' },
    ];
  }
  
  if (aspiration === '제외인정자') {
    return [
      { label: '군특성화', value: '군특성화' },
      { label: '기술사관', value: '기술사관' },
      { label: '운동부', value: '운동부' },
      { label: '특수교육대상자', value: '특수교육대상자' },
      { label: '기타(직접입력)', value: '기타(직접입력)' },
    ];
  }
  
  if (aspiration === '진학' || !aspiration) {
    return [];
  }

  return [];
}

// 학생 관리 컬럼 정의
const COLUMNS: ColumnConfig[] = [
  { key: 'major', label: '학과', width: 70, readOnly: true },
  { key: 'class_info', label: '반', width: 40, readOnly: true },
  { key: 'student_number', label: '번호', width: 40, readOnly: true },
  { key: 'student_name', label: '성명', width: 65, readOnly: true },
  { 
    key: 'career_aspiration', 
    label: '진로\n희망', 
    width: 80, 
    type: 'select',
    options: [
      { label: '취업', value: '취업' },
      { label: '진학', value: '진학' },
      { label: '제외인정자', value: '제외인정자' },
    ],
    variant: (val) => {
      if (!val) return '';
      if (val.includes('대/공기업') || val.includes('공무원')) return 'bg-blue-50 text-blue-700 border-blue-100';
      if (val.includes('취업')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      if (val.includes('가업승계')) return 'bg-amber-50 text-amber-700 border-amber-100';
      if (val.includes('진학')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      if (val.includes('부사관') || val.includes('군특성화')) return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      if (val.includes('아우스빌둥') || val.includes('일학습') || val.includes('맞춤반') || val.includes('기술사관')) return 'bg-purple-50 text-purple-700 border-purple-100';
      return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  },
  { 
    key: 'special_notes', 
    label: '진로 코스', 
    width: 100, 
    type: 'select',
    options: (rowData) => GET_CAREER_COURSE_OPTIONS(rowData),
    variant: (val) => {
      if (!val) return '';
      if (val === '도제반' || val === '도제') return 'bg-pink-50 text-pink-700 border-pink-100';
      if (val === '청솔반') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      if (val === '축구부') return 'bg-orange-50 text-orange-700 border-orange-100';
      if (val === '검도부') return 'bg-sky-50 text-sky-700 border-sky-100';
      if (val === '특수교육대상자') return 'bg-slate-100 text-slate-700 border-slate-200';
      if (val === '대/공기업') return 'bg-blue-50 text-blue-700 border-blue-100';
      if (val === '공무원') return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      if (val === '중견/강소기업') return 'bg-purple-50 text-purple-700 border-purple-100';
      if (val === '가업승계') return 'bg-amber-50 text-amber-700 border-amber-100';
      if (val === '부사관') return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      if (val === '아우스빌둥') return 'bg-rose-50 text-rose-700 border-rose-100';
      if (val === '군특성화') return 'bg-teal-50 text-teal-700 border-teal-100';
      if (val === '기술사관') return 'bg-lime-50 text-lime-700 border-lime-100';
      if (val === '운동부') return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      if (val === '기타(직접입력)') return 'bg-violet-50 text-violet-700 border-violet-100';
      return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  },
  { 
    key: 'is_desiring_employment', label: '취업\n희망', width: 55, type: 'select', 
    options: [
      { label: '예', value: '예' }, 
      { label: '아니오', value: '아니오' }
    ],
    variant: (val) => {
      if (val === '예') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      if (val === '아니오') return 'bg-rose-50 text-rose-700 border-rose-100'
      return 'text-slate-500'
    }
  },
  { 
    key: 'business_type', 
    label: '취업\n여부', 
    width: 80,
    type: 'select',
    options: [
      { label: '예', value: '예' },
      { label: '아니오', value: '아니오' },
      { label: '제외인정자', value: '제외인정자' }
    ],
    variant: (val) => {
      switch (val) {
        case '예': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        case '아니오': return 'bg-rose-100 text-rose-700 border-rose-200'
        case '제외인정자': return 'bg-slate-100 text-slate-700 border-slate-200'
        default: return val ? 'bg-slate-50 text-slate-600 border-slate-100' : ''
      }
    }
  },
  { 
    key: 'employment_status', label: '취업\n구분', width: 100, type: 'select', 
    options: [
      { label: '일반취업', value: '일반취업' }, 
      { label: '청솔반', value: '청솔반' }, 
      { label: '취업맞춤반', value: '취업맞춤반' }, 
      { label: '일학습병행', value: '일학습병행' }, 
      { label: '군특성화', value: '군특성화' }, 
      { label: '기술사관', value: '기술사관' }, 
      { label: '도제', value: '도제' }, 
      { label: '아우스빌둥', value: '아우스빌둥' },
      { label: '면접진행중', value: '면접진행중' }
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
    key: 'company_type', label: '기업\n구분', width: 95, type: 'select', 
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
  { key: 'company', label: '취업처\n(회사명)', width: 130 },
  { key: 'latest_training_company', label: '실습처\n(회사명)', width: 120, readOnly: true },
  { key: 'start_date', label: '시작일', width: 85, readOnly: true },
  { key: 'end_date', label: '종료일', width: 85, readOnly: true },
  { key: 'training_stipend_status', label: '지원금\n신청', width: 50, readOnly: true },
  { key: 'is_hiring_conversion', label: '채용\n전환', width: 85, readOnly: true },
  { key: 'is_returned', label: '복교', width: 60, readOnly: true },
  { key: 'field_training_action', label: '실습이력', width: 100, type: 'action' },
  { key: 'remarks', label: '비고', width: 150 },
]

const GROUP_HEADERS = [
  { label: '기본 정보', colSpan: 6, className: 'bg-slate-100 text-slate-900 text-[11px]' },
  { label: '취업 현황', colSpan: 5, className: 'bg-blue-100/50 text-blue-900 text-[11px]' },
  { label: '현장실습 상세 및 결과 (최근 차수)', colSpan: 7, className: 'bg-amber-100/50 text-amber-900 text-[11px]' },
  { label: '비고(특이사항)', colSpan: 1, className: 'bg-slate-50 text-slate-700 text-[11px]' },
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
  const [selectedStudent, setSelectedStudent] = React.useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // 모든 핸들러 함수를 useCallback으로 메모이제이션
  const handleSave = React.useCallback(async (id: string, field: string, value: any) => {
    if (!isAdmin) return { success: false, error: '권한이 없습니다.' };
    return await updateStudentField(id, field, value);
  }, [isAdmin]);

  const handleBulkSave = React.useCallback(async (updates: any[]) => {
    if (!isAdmin) return { success: false, error: '권한이 없습니다.' };
    return await bulkUpdateStudentData(updates);
  }, [isAdmin]);

  const handleAction = React.useCallback((id: string, key: string) => {
    if (key === 'field_training_action') {
      const student = initialData.find(s => s.id === id)
      if (student) {
        setSelectedStudent(student)
        setIsModalOpen(true)
      }
    }
  }, [initialData]);

  const columns = React.useMemo(() => COLUMNS.map(col => ({
    ...col,
    readOnly: !isAdmin || col.readOnly
  })), [isAdmin]);

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
          onAction={handleAction}
          searchPlaceholder="빠른 학생 검색..."
          masterCertificates={masterCertificates}
        />
      </div>

      <FieldTrainingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={selectedStudent}
      />
    </div>
  )
}
