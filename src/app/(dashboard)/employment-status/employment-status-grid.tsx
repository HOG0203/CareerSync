'use client';

import * as React from 'react';
import { StudentEmploymentData } from '@/lib/data';
import { StudentGridCell } from './student-grid-cell';
import { Search, X, Award } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GridLoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchYearlyRankings } from './actions';

interface EmploymentStatusGridProps {
  allData: StudentEmploymentData[];
  userProfile: any;
  teacherProfiles?: any[];
  baseYear?: number;
  grade?: number;
  graduationYear: string;
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
  '전자기계과': '기계',
  '메카트로닉스과': '기계',
  '모바일전자과': '전자',
  '전자과': '전자',
  '디자인과': '디자인',
  '스마트디자인과': '디자인'
};

const getShortClassName = (major: string, classInfo: string, currentGrade: number = 3, gradYear?: number) => {
  let shortMajor = MAJOR_MAP[major] || major;
  
  // 2028년 졸업생(현재 2학년)부터는 '건축' 대신 '공간'으로 표시
  if (gradYear && gradYear >= 2028 && shortMajor === '건축') {
    shortMajor = '공간';
  }
  
  return `${shortMajor}${currentGrade}-${classInfo}`;
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
  if (businessType === '채용진행중') return 'bg-amber-100 text-amber-950 border-amber-500 border-x';
  if (businessType === '현장실습중') return 'bg-blue-400 text-white border-blue-500 border-x';
  if (businessType === '도제OJT') return 'bg-emerald-100 text-emerald-900 border-emerald-500 border-x';

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

  return 'bg-white text-black border-gray-200';
};

const getLowerGradeAspirationVariant = (aspiration?: string) => {
  if (!aspiration) return 'bg-white text-black border-gray-200';
  
  const normalized = aspiration.trim();
  
  if (normalized === '취업') return 'bg-emerald-500 text-white border-emerald-600';
  if (normalized === '진학') return 'bg-rose-500 text-white border-rose-600';
  if (normalized === '제외인정자') return 'bg-slate-400 text-white border-slate-500';
  
  return 'bg-white text-black border-gray-200';
};

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  currentSearchQuery: string;
  isLowerGrade?: boolean;
  matchedCount?: number;
  certFilter: string;
  onCertFilterChange: (val: string) => void;
}

function SearchHeader({ onSearch, currentSearchQuery, isLowerGrade, matchedCount, certFilter, onCertFilterChange }: SearchHeaderProps) {
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1">
      {/* 검색어 입력 */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex items-center bg-white rounded-lg border-2 border-slate-200 focus-within:border-blue-500 shadow-sm px-3 h-11 w-full sm:w-[320px] group transition-all">
          <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 shrink-0" />
          <Input 
            type="text"
            placeholder={isLowerGrade ? "이름, 자격증, 희망진로코스 검색..." : "이름, 자격증, 기업, 진로코스 검색..."}
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
          className="h-11 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
        >
          <Search className="h-4 w-4" />
          검색
        </button>
      </div>

      {/* 자격증 개수 필터 */}
      <div className="flex items-center gap-1.5 px-3 bg-white rounded-lg border-2 border-slate-200 h-11 w-full sm:w-[150px] shadow-sm">
        <Award className="h-5 w-5 text-slate-400 shrink-0" />
        <Select value={certFilter} onValueChange={onCertFilterChange}>
          <SelectTrigger className="w-full h-full text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
            <SelectValue placeholder="자격증 필터" />
          </SelectTrigger>
          <SelectContent position="popper" className="w-[150px]">
            <SelectItem value="all" className="text-xs font-medium">자격증: 전체</SelectItem>
            <SelectItem value="1+" className="text-xs font-medium">1개 이상</SelectItem>
            <SelectItem value="2+" className="text-xs font-medium">2개 이상</SelectItem>
            <SelectItem value="3+" className="text-xs font-medium">3개 이상</SelectItem>
            <SelectItem value="0" className="text-xs font-medium">자격증 없음</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 강조 배지 */}
      {(currentSearchQuery || certFilter !== 'all') && (
        <span className="text-xs font-bold text-blue-600 animate-pulse bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shrink-0 self-start sm:self-auto">
          {certFilter !== 'all' && `[자격증: ${certFilter === '0' ? '없음' : `${certFilter} 이상`}] `}
          {currentSearchQuery && `"${currentSearchQuery}" `}
          강조 중 (총 {matchedCount ?? 0}명)
        </span>
      )}
    </div>
  );
}

export function EmploymentStatusGrid({ allData, userProfile, teacherProfiles = [], baseYear, grade = 3, graduationYear }: EmploymentStatusGridProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [certFilter, setCertFilter] = React.useState('all');
  const [isLoading, setIsLoading] = React.useState(false);
  const [rankingMap, setRankingMap] = React.useState<Record<string, any>>({});
  const [isRankingsLoading, setIsRankingsLoading] = React.useState(false);

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

  // 성적/석차 데이터를 백그라운드에서 비동기 fetch
  React.useEffect(() => {
    if (!graduationYear) return;
    setIsRankingsLoading(true);
    fetchYearlyRankings(parseInt(graduationYear), baseYear || 2026)
      .then(rankings => {
        setRankingMap(rankings);
        setIsRankingsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load yearly rankings:', err);
        setIsRankingsLoading(false);
      });
  }, [graduationYear, baseYear]);

  const groupedData = React.useMemo(() => {
    const grouped: Record<string, StudentEmploymentData[]> = {};
    for (const student of allData) {
      const major = student.major || '';
      const classInfo = student.class_info || '';
      // 학년도별 명칭 변경 적용 (예: 기계3-1)
      const displayClassName = getShortClassName(major, classInfo, grade, student.graduation_year);
      if (!grouped[displayClassName]) grouped[displayClassName] = [];
      grouped[displayClassName].push(student);
    }
    return grouped;
  }, [allData, grade]);

  const majorOrderMap = React.useMemo(() => {
    const map = new Map(SORT_ORDER.map((m, i) => [MAJOR_MAP[m] || m, i]));
    // '공간'도 '건축'과 동일한 순서로 처리
    map.set('공간', map.get('건축') ?? 5);
    return map;
  }, []);

  const classNames = React.useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => {
      const matchA = a.match(/^([^\d]+)(\d+)-(\d+)$/);
      const matchB = b.match(/^([^\d]+)(\d+)-(\d+)$/);
      const majorA = matchA ? matchA[1] : a;
      const majorB = matchB ? matchB[1] : b;
      const orderA = majorOrderMap.get(majorA) ?? 999;
      const orderB = majorOrderMap.get(majorB) ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      const classNumA = matchA ? parseInt(matchA[3]) : 0;
      const classNumB = matchB ? parseInt(matchB[3]) : 0;
      return classNumA - classNumB;
    });
  }, [groupedData, majorOrderMap]);

  const isLowerGrade = grade === 1 || grade === 2;

  // 강조 검색 대상에 매칭되는 학생 수 계산
  const matchedCount = React.useMemo(() => {
    if ((!searchQuery || searchQuery.trim() === '') && certFilter === 'all') return 0;
    
    const query = searchQuery.toLowerCase().trim();
    
    return allData.filter(student => {
      // 1. 자격증 개수 필터 조건 확인
      const certsCount = student.certificates?.length || 0;
      let certMatch = true;
      if (certFilter === '1+') certMatch = certsCount >= 1;
      else if (certFilter === '2+') certMatch = certsCount >= 2;
      else if (certFilter === '3+') certMatch = certsCount >= 3;
      else if (certFilter === '0') certMatch = certsCount === 0;

      // 2. 검색어 필터 조건 확인 (개별 자격증 명칭도 포함)
      let searchMatch = true;
      if (searchQuery && searchQuery.trim() !== '') {
        const certList = Array.isArray(student.certificates)
          ? student.certificates
          : (typeof student.certificates === 'string' ? [student.certificates] : []);

        const fieldsToSearch = isLowerGrade
          ? [
              student.student_name,
              student.career_aspiration,
              student.career_course,
              student.special_notes,
              student.major,
              student.class_info,
              ...certList
            ]
          : [
              student.student_name,
              student.employment_status,
              student.company_type,
              student.business_type,
              student.company,
              student.latest_training_company,
              student.major,
              student.class_info,
              ...certList
            ];
        searchMatch = fieldsToSearch.some(field => field?.toLowerCase().includes(query));
      }

      return certMatch && searchMatch;
    }).length;
  }, [allData, searchQuery, certFilter, isLowerGrade]);


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
      <SearchHeader 
        onSearch={setSearchQuery} 
        currentSearchQuery={searchQuery} 
        isLowerGrade={isLowerGrade} 
        matchedCount={matchedCount} 
        certFilter={certFilter}
        onCertFilterChange={setCertFilter}
      />

      <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-50/50 rounded-xl border border-slate-200 shadow-sm p-2 sm:p-4">
        <div className="flex gap-px bg-gray-300 border border-gray-300 min-w-max mx-auto shadow-sm">
          {classNames.map((className) => {
            const students = [...groupedData[className]].sort((a, b) => 
              (parseInt(a.student_number || '0')) - (parseInt(b.student_number || '0'))
            );
            const totalCount = students.length;
            const sampleStudent = students[0];
            const studentMajor = sampleStudent?.major || '';
            const studentClass = sampleStudent?.class_info || '';
            const targetGrade = grade;

            let teacherName = '';

            // 1. 사용자 관리 DB (profiles)에서 현재 학년/학과/반에 배정된 담임 교사를 최우선 탐색
            if (teacherProfiles && teacherProfiles.length > 0) {
              const cleanM = (studentMajor || '').replace(/과|공업계/g, '').trim();
              const cleanC = (studentClass || '').replace(/반|학년/g, '').trim();
              const matchedT = teacherProfiles.find(t => {
                const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
                const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
                const isM = tMajor === cleanM || cleanM.includes(tMajor) || tMajor.includes(cleanM);
                const isC = tClass === cleanC;
                const isG = t.assigned_grade ? t.assigned_grade === targetGrade : (t.assigned_year ? t.assigned_year === ((baseYear || 2026) + (4 - targetGrade)) : true);
                return isM && isC && isG;
              });
              if (matchedT) {
                teacherName = matchedT.username || matchedT.full_name || '';
              }
            }

            // 2. 만약 profiles DB에 없으면 학생 데이터의 teacher_name 폴백 사용
            if (!teacherName) {
              teacherName = students.find(s => s.teacher_name)?.teacher_name || '';
            }

            return (
              <div key={className} className="flex flex-col bg-white w-[72px] shrink-0">
                {/* 학반 표기 (예: 기계3-1) */}
                <div className="bg-[#f2f2f2] border-b border-gray-300 h-7 flex items-center justify-center font-extrabold text-[10px] sm:text-[10.5px] text-gray-800 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                  {className}
                </div>

                {/* 바로 아래 담임교사 이름 표기 (예: 고홍석T) */}
                <div className="bg-indigo-50/90 border-b border-gray-300 h-5 flex items-center justify-center font-bold text-[9px] sm:text-[9.5px] text-indigo-700 px-0.5 text-center leading-tight whitespace-nowrap overflow-hidden">
                  {teacherName ? `${teacherName}T` : '미지정'}
                </div>

                {/* 인원수 배지 */}
                <div className="bg-sky-500 text-white h-5 flex items-center justify-center font-bold text-[9.5px]">
                  {totalCount}명
                </div>

                <div className="flex flex-col">
                  {students.map((student, idx) => {
                    const isLowerGrade = grade === 1 || grade === 2;
                    const cellVariant = isLowerGrade
                      ? getLowerGradeAspirationVariant(student.career_aspiration)
                      : getCompanyTypeVariant(student.company_type, student.business_type, student.career_aspiration);

                    return (
                      <StudentGridCell 
                        key={student.id}
                        student={student}
                        idx={idx}
                        variant={cellVariant}
                        rankingSummary={rankingMap[student.id]}
                        isRankingsLoading={isRankingsLoading}
                        userProfile={userProfile}
                        searchQuery={searchQuery}
                        certFilter={certFilter}
                        baseYear={baseYear}
                        isLowerGrade={isLowerGrade}
                      />
                    );
                  })}
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

