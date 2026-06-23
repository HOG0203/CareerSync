'use client';

import * as React from 'react';
import { StudentEmploymentData } from '@/lib/data';
import { StudentGridCell } from './student-grid-cell';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GridLoadingSkeleton } from '@/components/dashboard/loading-skeleton';

interface EmploymentStatusGridProps {
  allData: StudentEmploymentData[];
  rankingMap: Record<string, any>;
  userProfile: any;
  baseYear?: number;
}

const MAJOR_MAP: Record<string, string> = {
  '자동화기계과': '기계',
  '자동차기계과': '자동차',
  '친환경자동차과': '자동차',
  '전기과': '전기',
  '스마트전기과': '전기',
  '스마트공간건축과': '건축',
  '스마트공간과': '건축',
  '건설과': '건설',
  '섬유소재과': '섬유',
  '스마트융합섬유과': '섬유',
  '바이오화학과': '화학',
  '화학공업과': '화학',
};

const getShortClassName = (major: string, classInfo: string, gradYear?: number) => {
  let shortMajor = MAJOR_MAP[major] || major;
  
  // 2028년 졸업생(현재 2학년)부터는 '건축' 대신 '공간'으로 표시
  if (gradYear && gradYear >= 2028 && shortMajor === '건축') {
    shortMajor = '공간';
  }
  
  return `${shortMajor} ${classInfo}`;
};

const SORT_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '자동차기계과',
  '스마트공간과',
  '건설과',
  '스마트공간건축과',
  '스마트전기과',
  '전기과',
  '바이오화학과',
  '화학공업과',
  '스마트융합섬유과',
  '섬유소재과'
];

const getCompanyTypeVariant = (type?: string, businessType?: string, careerAspiration?: string) => {
  // 1순위: 확정된 특수 상태 (채용진행, 현장실습, 도제OJT)
  if (businessType === '채용진행중') return 'bg-amber-100 text-amber-950 border-amber-500 border-x';
  if (businessType === '현장실습중') return 'bg-blue-400 text-white border-blue-500 border-x';
  if (businessType === '도제OJT') return 'bg-emerald-100 text-emerald-900 border-emerald-500 border-x';

  // 2순위: 취업 확정 상태
  if (businessType === '취업') {
    switch (type) {
      case '대기업':
      case '공기업': return 'bg-blue-600 text-white border-blue-700';
      case '공무원':
      case '부사관': return 'bg-indigo-700 text-white border-indigo-800';
      case '중견기업': return 'bg-purple-600 text-white border-purple-700';
      case '중소기업': return 'bg-cyan-500 text-white border-cyan-600';
      case '연계교육': return 'bg-orange-500 text-white border-orange-600';
      default: return 'bg-emerald-500 text-white border-emerald-600';
    }
  }

  // 3순위: [추가] 2학년 등 미취업자의 경우 '진로희망'을 기반으로 연한 색상 표시
  if (careerAspiration === '취업') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (careerAspiration === '진학') return 'bg-indigo-50 text-indigo-600 border-indigo-100';
  if (careerAspiration === '제외인정자') return 'bg-slate-100 text-slate-500 border-slate-200';

  return 'bg-white text-black border-gray-200';
};

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  currentSearchQuery: string;
}

function SearchHeader({ onSearch, currentSearchQuery }: SearchHeaderProps) {
  const [localValue, setLocalValue] = React.useState('');

  const handleSearch = () => {
    onSearch(localValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onSearch('');
  };

  return (
    <div className="flex items-center gap-2 px-1">
      <div className="relative flex items-center bg-white rounded-lg border-2 border-slate-200 focus-within:border-blue-500 shadow-sm px-3 h-11 w-full sm:w-[400px] group transition-all">
        <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 shrink-0" />
        <Input 
          type="text"
          placeholder="이름, 기업, 진로코스 등 검색..."
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-none bg-transparent shadow-none focus-visible:ring-0 text-[14px] font-medium placeholder:text-slate-400 h-full w-full pr-8"
        />
        {localValue && (
          <button 
            onClick={handleClear}
            className="absolute right-3 p-1 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </div>
      <button
        onClick={handleSearch}
        className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-2"
      >
        <Search className="h-4 w-4" />
        검색
      </button>
      {currentSearchQuery && (
        <span className="text-xs font-bold text-blue-600 animate-pulse hidden sm:inline bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
          "{currentSearchQuery}" 강조 중
        </span>
      )}
    </div>
  );
}

export function EmploymentStatusGrid({ allData, rankingMap, userProfile, baseYear }: EmploymentStatusGridProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const handleLoading = () => setIsLoading(true);
    window.addEventListener('employment-status-loading', handleLoading);
    return () => {
      window.removeEventListener('employment-status-loading', handleLoading);
    };
  }, []);

  React.useEffect(() => {
    setIsLoading(false);
  }, [allData]);

  const groupedData = React.useMemo(() => {
    const grouped: Record<string, StudentEmploymentData[]> = {};
    for (const student of allData) {
      const major = student.major || '';
      const classInfo = student.class_info || '';
      // 학년도별 명칭 변경 적용 (2028년 졸업생부터 공간으로 표시)
      const displayClassName = getShortClassName(major, classInfo, student.graduation_year);
      if (!grouped[displayClassName]) grouped[displayClassName] = [];
      grouped[displayClassName].push(student);
    }
    return grouped;
  }, [allData]);

  const majorOrderMap = React.useMemo(() => {
    const map = new Map(SORT_ORDER.map((m, i) => [MAJOR_MAP[m] || m, i]));
    // '공간'도 '건축'과 동일한 순서로 처리
    map.set('공간', map.get('건축') ?? 5);
    return map;
  }, []);


  const classNames = React.useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => {
      const majorA = a.split(' ')[0];
      const majorB = b.split(' ')[0];
      const orderA = majorOrderMap.get(majorA) ?? 999;
      const orderB = majorOrderMap.get(majorB) ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'ko');
    });
  }, [groupedData, majorOrderMap]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <GridLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 클라이언트 사이드 검색창 (독립된 상태 관리로 타이핑 렉 제거) */}
      <SearchHeader onSearch={setSearchQuery} currentSearchQuery={searchQuery} />

      <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-50/50 rounded-xl border border-slate-200 shadow-sm p-2 sm:p-4">
        <div className="flex gap-px bg-gray-300 border border-gray-300 min-w-max mx-auto shadow-sm">
          {classNames.map((className) => {
            const students = [...groupedData[className]].sort((a, b) => 
              (parseInt(a.student_number || '0')) - (parseInt(b.student_number || '0'))
            );
            const totalCount = students.length;

            return (
              <div key={className} className="flex flex-col bg-white w-[72px]">
                <div className="bg-[#f2f2f2] border-b border-gray-300 h-8 flex items-center justify-center font-bold text-[9px] sm:text-[10px] text-gray-700 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                  {className}
                </div>
                <div className="bg-emerald-500 text-white h-6 flex items-center justify-center font-bold text-[10.5px]">
                  {totalCount}
                </div>

                <div className="flex flex-col">
                  {students.map((student, idx) => (
                    <StudentGridCell 
                      key={student.id}
                      student={student}
                      idx={idx}
                      variant={getCompanyTypeVariant(student.company_type, student.business_type)}
                      rankingSummary={rankingMap[student.id]}
                      userProfile={userProfile}
                      searchQuery={searchQuery}
                      baseYear={baseYear}
                    />
                  ))}
                  {Array.from({ length: Math.max(0, 24 - students.length) }).map((_, i) => (
                    <div key={i} className="h-7 border-b border-gray-100 bg-white"></div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
