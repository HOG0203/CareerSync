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

// 학년별 진로희망 옵션 생성 함수
const GET_CAREER_OPTIONS = (grade: number) => {
  const options = [
    { label: '취업', value: '취업' },
    { label: '진학', value: '진학' },
    { label: '제외인정자', value: '제외인정자' },
  ];
  return options;
}

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
      { label: '기타(직접입력)', value: '기타(직접입력)' },
    ];
  }
  
  if (aspiration === '진학') {
    return [];
  }

  // 기본값
  return [
    { label: '축구부', value: '축구부' },
    { label: '검도부', value: '검도부' },
    { label: '특수교육대상자', value: '특수교육대상자' },
    { label: '기타(직접입력)', value: '기타(직접입력)' },
  ];
}

export function ClassTable({ initialData, masterCertificates }: ClassTableProps) {
  const [selectedStudent, setSelectedStudent] = React.useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // 현재 데이터로부터 학년 판별
  const currentGrade = React.useMemo(() => {
    if (!initialData || initialData.length === 0) return 3;
    const student = initialData[0];
    if (student.grade) return Number(student.grade);
    const gradYear = student.graduation_year || student.GraduationYear;
    if (!gradYear) return 3;
    const calculatedGrade = 4 - (gradYear - 2026); 
    return Math.max(1, Math.min(3, calculatedGrade)) || 3;
  }, [initialData]);

  // 학년에 맞는 컬럼 정의 동적 생성 (항목별 색상 강화)
  const columns: ColumnConfig[] = React.useMemo(() => {
    const baseCols: ColumnConfig[] = [
      { key: 'student_number', label: '번호', width: 35, readOnly: true },
      { key: 'student_name', label: '성명', width: 65, readOnly: true },
      { 
        key: 'career_aspiration', 
        label: '진로희망', 
        width: 120, 
        type: 'select', 
        options: GET_CAREER_OPTIONS(currentGrade),
        variant: (val) => {
          if (!val) return '';
          if (val.includes('대/공기업') || val.includes('공무원')) return 'bg-blue-50 text-blue-700 border-blue-100';
          if (val.includes('취업') || val === '일반취업') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
          if (val.includes('가업승계')) return 'bg-amber-50 text-amber-700 border-amber-100';
          if (val.includes('진학')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
          if (val.includes('부사관') || val.includes('군특성화')) return 'bg-cyan-50 text-cyan-700 border-cyan-100';
          if (val.includes('아우스빌둥') || val.includes('일학습') || val.includes('맞춤반') || val.includes('기술사관')) return 'bg-purple-50 text-purple-700 border-purple-100';
          return 'bg-slate-50 text-slate-600 border-slate-100';
        }
      },
      { 
        key: 'special_notes', 
        label: '진로코스 및\n특이사항', 
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
          return 'bg-amber-50 text-amber-700 border-amber-100';
        }
      },
      { key: 'certificates', label: '취득자격증', width: 150, type: 'multi-select' },
      { 
        key: 'military_status', 
        label: '병역희망', 
        width: 80, 
        type: 'select',
        options: [
          { label: '부사관', value: '부사관' },
          { label: '군입대', value: '군입대' },
          { label: '병역특례', value: '병역특례' },
          { label: '병역면제', value: '병역면제' },
        ],
        variant: (val) => 
          val === '부사관' ? 'bg-blue-50 text-blue-700 border-blue-100' :
          val === '군입대' ? 'bg-slate-50 text-slate-700 border-slate-100' : 
          val === '병역특례' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
          val === '병역면제' ? 'bg-orange-50 text-orange-700 border-orange-100' : ''
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
      },
      { 
        key: 'parents_opinion', 
        label: '부모님의견', 
        width: 130,
        type: 'select',
        options: [
          { label: '취업', value: '취업' },
          { label: '진학', value: '진학' },
          { label: '내선택 존중', value: '내선택 존중' },
        ],
        variant: (val) => 
          val === '취업' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
          val === '진학' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
          val === '내선택 존중' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''
      },
    ];

    if (currentGrade === 3) {
      baseCols.push({ key: 'shoe_size', label: '신발', width: 50 });
      baseCols.push({ key: 'top_size', label: '상의', width: 50 });
    }

    baseCols.push({ key: 'personal_remarks', label: '비고(행정)', width: 150 });
    baseCols.push({ key: 'counseling_log_action', label: '상담일지', width: 100, type: 'action' });

    return baseCols;
  }, [currentGrade]);

  const groupHeaders = React.useMemo(() => [
    { label: '학생 기본 정보', colSpan: 2, className: 'bg-slate-100 text-slate-900 text-[11px]' },
    { label: '진로 및\n진로코스', colSpan: 2, className: 'bg-blue-50 text-blue-900 text-[11px]' },
    { label: '취득 자격', colSpan: 1, className: 'bg-amber-50 text-amber-900 text-[11px]' },
    { label: '취업 상세 및 의견', colSpan: 3, className: 'bg-emerald-50 text-emerald-900 text-[11px]' },
    { 
      label: '피복 및 비고', 
      colSpan: currentGrade === 3 ? 3 : 1,
      className: 'bg-slate-50 text-slate-700 text-[11px]' 
    },
    { label: '기록', colSpan: 1, className: 'bg-indigo-50 text-indigo-900 text-[11px]' },
  ], [currentGrade]);

  const handleSave = React.useCallback(async (id: string, field: string, value: any) => {
    return await updatePersonalDetail(id, field, value)
  }, []);

  const handleBulkSave = React.useCallback(async (updates: any[]) => {
    return await bulkUpdatePersonalDetails(updates)
  }, []);

  const handleAction = React.useCallback((id: string, key: string) => {
    if (key === 'counseling_log_action') {
      const student = initialData.find(s => s.id === id)
      if (student) { setSelectedStudent(student); setIsModalOpen(true); }
    }
  }, [initialData]);

  return (
    <div className="w-full overflow-hidden">
      <StandardSpreadsheetTable 
        data={initialData}
        columns={columns}
        groupHeaders={groupHeaders}
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
