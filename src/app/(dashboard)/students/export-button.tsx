'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { StudentEmploymentData } from '@/lib/data';

interface ExportButtonProps {
  data: StudentEmploymentData[] | any[];
  filename?: string;
  type?: 'basic' | 'comprehensive';
}

export function ExportButton({ 
  data, 
  filename = '학생_취업_실습_종합현황.csv',
  type = 'comprehensive'
}: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // 기본 명부 서식 (6개 컬럼)
    const basicHeaders = [
      { key: 'graduation_year', label: '졸업연도' },
      { key: 'major', label: '학과' },
      { key: 'class_info', label: '반' },
      { key: 'student_number', label: '번호' },
      { key: 'student_name', label: '성명' },
      { key: 'phone_number', label: '휴대전화번호' },
    ];

    // 취업·실습 종합 서식 (29개 컬럼)
    const comprehensiveHeaders = [
      // 기본 인적사항 (6개)
      { key: 'graduation_year', label: '졸업연도' },
      { key: 'major', label: '학과' },
      { key: 'class_info', label: '반' },
      { key: 'student_number', label: '번호' },
      { key: 'student_name', label: '성명' },
      { key: 'phone_number', label: '휴대전화번호' },

      // 학반데이터 (9개)
      { key: 'career_aspiration', label: '진로희망' },
      { key: 'special_notes', label: '희망 기업유형' },
      { key: 'career_course', label: '희망진로코스' },
      { key: 'military_status', label: '병역희망' },
      { key: 'desired_work_area', label: '취업희망지역' },
      { key: 'parents_opinion', label: '학부모의견' },
      { key: 'shoe_size', label: '신발사이즈' },
      { key: 'top_size', label: '상의사이즈' },
      { key: 'personal_remarks', label: '비고' },

      // 취업데이터 (6개)
      { key: 'is_desiring_employment', label: '취업희망여부' },
      { key: 'employment_status', label: '최종진로코스' },
      { key: 'business_type', label: '취업현황' },
      { key: 'company_type', label: '기업구분' },
      { key: 'company', label: '회사명' },
      { key: 'certificates', label: '취득자격증' },

      // 현장실습데이터 (8개)
      { key: 'latest_training_company', label: '실습처(회사명)' },
      { key: 'start_date', label: '현장실습 시작일' },
      { key: 'end_date', label: '현장실습 종료일' },
      { key: 'training_stipend_status', label: '지원금 신청' },
      { key: 'is_hiring_conversion', label: '채용전환' },
      { key: 'conversion_date', label: '채용전환일' },
      { key: 'is_returned', label: '복교 유무' },
      { key: 'return_to_school_reason', label: '복교사유' },
    ];


    const headers = type === 'basic' ? basicHeaders : comprehensiveHeaders;

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
            val = val.join('; ');
          }
          
          const cleanVal = val === null || val === undefined ? '' : String(val).replace(/"/g, '""');
          return `"${cleanVal}"`;
        }).join(',');
      })
    ].join('\n');

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
    <Button 
      variant="outline" 
      size="sm" 
      className="h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-xs font-bold rounded-xl shadow-2xs" 
      onClick={handleExport}
    >
      <Download className="mr-1 sm:mr-1.5 h-3.5 w-3.5" />
      내보내기
    </Button>
  );
}

