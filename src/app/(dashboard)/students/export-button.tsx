'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { StudentEmploymentData } from '@/lib/data';

interface ExportButtonProps {
  data: StudentEmploymentData[];
  filename?: string;
}

export function ExportButton({ data, filename = '학생_취업_현황.csv' }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;

    // 1. 헤더 정의 (출력 순서 및 명칭)
    const headers = [
      { key: 'graduation_year', label: '졸업연도' },
      { key: 'major', label: '학과' },
      { key: 'class_info', label: '학반' },
      { key: 'student_number', label: '번호' },
      { key: 'student_name', label: '성명' },
      { key: 'is_desiring_employment', label: '취업희망유무' },
      { key: 'employment_status', label: '취업구분' },
      { key: 'company_type', label: '기업구분' },
      { key: 'business_type', label: '사업구분' },
      { key: 'company', label: '회사명' },
      { key: 'has_field_training', label: '현장실습 실시유무' },
      { key: 'start_date', label: '현장실습 시작일' },
      { key: 'end_date', label: '현장실습 종료일' },
      { key: 'training_stipend_status', label: '지원금 신청' },
      { key: 'is_hiring_conversion', label: '채용전환 유무' },
      { key: 'conversion_date', label: '채용전환일' },
      { key: 'is_returned', label: '복교 유무' },
      { key: 'return_to_school_reason', label: '복교사유' },
      { key: 'remarks', label: '비고' },
    ];

    // 2. CSV 데이터 생성
    const csvContent = [
      // 헤더 행
      headers.map(h => `"${h.label}"`).join(','),
      // 데이터 행
      ...data.map(row => {
        return headers.map(h => {
          let val = (row as any)[h.key];
          
          // 데이터 타입별 가공
          if (h.key === 'certificates' && Array.isArray(val)) {
            val = val.join('; '); // 자격증은 세미콜론으로 구분
          }
          
          const cleanVal = val === null || val === undefined ? '' : String(val).replace(/"/g, '""');
          return `"${cleanVal}"`;
        }).join(',');
      })
    ].join('\n'); // 줄바꿈 문자 복구

    // 3. 다운로드 트리거 (BOM 추가로 한글 깨짐 방지)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
      <Download className="mr-2 h-3.5 w-3.5" />
      내보내기
    </Button>
  );
}
