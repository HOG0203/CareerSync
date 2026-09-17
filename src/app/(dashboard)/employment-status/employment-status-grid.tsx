'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { StudentGridCell } from './student-grid-cell';
import { Search, X, Award, SlidersHorizontal, Sparkles, RotateCcw } from 'lucide-react';
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
import { CustomCombinationModal, CustomRule } from './custom-combination-modal';
import { evaluateCustomRuleMatch } from '@/lib/custom-rule-evaluator';

interface EmploymentStatusGridProps {
  allData: StudentEmploymentData[];
  userProfile: any;
  teacherProfiles?: any[];
  baseYear?: number;
  grade?: number;
  graduationYear: string;
  hideSearchHeader?: boolean;
  externalSearchQuery?: string;
  externalCustomRule?: CustomRule | null;
  externalRankingMap?: Record<string, any>;
  onStudentUpdate?: (updatedStudent: StudentEmploymentData) => void;
}

export { type CustomRule } from './custom-combination-modal';



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

const getCompanyTypeVariant = (type?: string, businessType?: string) => {
  if (businessType === '제외인정자') {
    return 'bg-slate-300 text-slate-800 border-slate-400 font-medium';
  }
  if (businessType === '채용진행중') return 'bg-amber-100 text-amber-950 border-amber-500 border-x';
  if (businessType === '현장실습중') return 'bg-blue-400 text-white border-blue-500 border-x';
  if (businessType === '도제OJT') return 'bg-emerald-100 text-emerald-900 border-emerald-500 border-x';

  if (businessType === '취업') {
    switch (type) {
      case '대기업':
      case '공기업':
      case '대/공기업': return 'bg-rose-600 text-white border-rose-700 font-bold';
      case '공무원':
      case '부사관': return 'bg-indigo-700 text-white border-indigo-800';
      case '중견기업': return 'bg-purple-600 text-white border-purple-700';
      case '강소기업': return 'bg-cyan-500 text-white border-cyan-600';
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

const CAREER_COURSE_OPTIONS = [
  '청솔반', '취업맞춤반', '중견기업반', '반도체아카데미반', '혁신인재반',
  '부사관반', '일학습병행', '계약학과', '도제반', '아우스빌둥',
  '일반취업', '기술사관', '군특성화', '운동부', '진학', '입대', '기타'
];

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  currentSearchQuery: string;
  isLowerGrade?: boolean;
  matchedCount?: number;
  customRule: CustomRule | null;
  onOpenCustomModal: () => void;
  onClearCustomRule: () => void;
  customMatchedCount?: number;
  // 2학년 전용 코스 필터
  wishCourseFilter?: string;
  currentCourseFilter?: string;
  onWishCourseFilter?: (val: string) => void;
  onCurrentCourseFilter?: (val: string) => void;
  wishFilterCount?: number;
  currentFilterCount?: number;
}

function SearchHeader({ 
  onSearch, 
  currentSearchQuery, 
  isLowerGrade, 
  matchedCount, 
  customRule,
  onOpenCustomModal,
  onClearCustomRule,
  customMatchedCount,
  wishCourseFilter,
  currentCourseFilter,
  onWishCourseFilter,
  onCurrentCourseFilter,
  wishFilterCount,
  currentFilterCount
}: SearchHeaderProps) {
  const [mounted, setMounted] = React.useState(false);
  const [localValue, setLocalValue] = React.useState('');

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1">
        <div className="h-11 w-full sm:w-[280px] bg-white rounded-lg border-2 border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1 flex-wrap">
      {/* 검색어 입력 */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex items-center bg-white rounded-lg border-2 border-slate-200 focus-within:border-blue-500 shadow-sm px-3 h-11 w-full sm:w-[280px] group transition-all">
          <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 shrink-0" />
          <Input 
            type="text"
            placeholder={isLowerGrade ? "이름, 자격증, 희망/현재 진로코스 검색..." : "이름, 자격증, 기업, 진로코스 검색..."}
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
          className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
        >
          <Search className="h-4 w-4" />
          검색
        </button>
      </div>

      {/* 2학년 전용 진로코스 필터 드롭다운 */}
      {isLowerGrade && onWishCourseFilter && onCurrentCourseFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* 희망진로코스 필터 */}
          <div className="relative">
            <Select value={wishCourseFilter || 'all'} onValueChange={(v) => onWishCourseFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className={cn(
                "h-11 text-xs font-bold border-2 rounded-lg shadow-sm transition-all w-[148px] px-3",
                wishCourseFilter
                  ? "bg-blue-600 text-white border-blue-700 shadow-blue-100"
                  : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
              )}>
                <SelectValue placeholder="희망코스 전체" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="all" className="text-xs font-medium">희망코스 전체</SelectItem>
                {CAREER_COURSE_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt} className="text-xs font-medium">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {wishCourseFilter && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none z-10">
                {wishFilterCount ?? 0}명
              </span>
            )}
          </div>

          {/* 현재진로코스 필터 */}
          <div className="relative">
            <Select value={currentCourseFilter || 'all'} onValueChange={(v) => onCurrentCourseFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className={cn(
                "h-11 text-xs font-bold border-2 rounded-lg shadow-sm transition-all w-[148px] px-3",
                currentCourseFilter
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-emerald-100"
                  : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              )}>
                <SelectValue placeholder="현재코스 전체" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="all" className="text-xs font-medium">현재코스 전체</SelectItem>
                {CAREER_COURSE_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt} className="text-xs font-medium">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentCourseFilter && (
              <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none z-10">
                {currentFilterCount ?? 0}명
              </span>
            )}
          </div>

          {/* 필터 초기화 버튼 */}
          {(wishCourseFilter || currentCourseFilter) && (
            <button
              onClick={() => { onWishCourseFilter(''); onCurrentCourseFilter(''); }}
              className="h-11 px-3 rounded-lg text-xs font-bold border-2 border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center gap-1 transition-all"
              title="필터 초기화"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              초기화
            </button>
          )}
        </div>
      )}

      {/* 커스텀 검색 버튼 */}
      <button
        onClick={onOpenCustomModal}
        className={cn(
          "h-11 px-4 rounded-lg text-xs sm:text-sm font-bold shadow-sm border-2 transition-all flex items-center gap-1.5 shrink-0",
          customRule 
            ? "bg-indigo-600 text-white border-indigo-700 shadow-indigo-100" 
            : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
        )}
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" />
        {customRule ? '커스텀 검색 조건 수정' : '🔍 커스텀 검색'}
      </button>

      {/* 커스텀 검색 적용 안내 태그 */}
      {customRule && (
        <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 animate-in fade-in-50">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          <span>[커스텀 검색 강조 ({customRule.operator}): {customMatchedCount ?? 0}명]</span>
          <button 
            onClick={onClearCustomRule}
            className="ml-1 text-slate-400 hover:text-rose-600 p-0.5 rounded-full hover:bg-white transition-colors"
            title="커스텀 검색 해제"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 기본 강조 배지 */}
      {!customRule && currentSearchQuery && (
        <span className="text-xs font-bold text-blue-600 animate-pulse bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shrink-0 self-start sm:self-auto">
          "{currentSearchQuery}" 강조 중 (총 {matchedCount ?? 0}명)
        </span>
      )}
    </div>
  );
}

export function EmploymentStatusGrid({ 
  allData, 
  userProfile, 
  teacherProfiles = [], 
  baseYear, 
  grade = 3, 
  graduationYear, 
  hideSearchHeader = false,
  externalSearchQuery,
  externalCustomRule,
  externalRankingMap,
  onStudentUpdate,
}: EmploymentStatusGridProps) {
  const [internalSearchQuery, setInternalSearchQuery] = React.useState('');
  const [internalCustomRule, setInternalCustomRule] = React.useState<CustomRule | null>(null);

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = setInternalSearchQuery;
  const customRule = externalCustomRule !== undefined ? externalCustomRule : internalCustomRule;
  const setCustomRule = setInternalCustomRule;

  const [isCustomModalOpen, setIsCustomModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [internalRankingMap, setInternalRankingMap] = React.useState<Record<string, any>>({});
  const [isRankingsLoading, setIsRankingsLoading] = React.useState(false);

  const rankingMap = externalRankingMap !== undefined ? externalRankingMap : internalRankingMap;

  // 2학년 전용 진로코스 필터
  const [wishCourseFilter, setWishCourseFilter] = React.useState('');
  const [currentCourseFilter, setCurrentCourseFilter] = React.useState('');

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

  // 성적/석차 데이터를 백그라운드에서 비동기 fetch (외부에서 전달되지 않았을 때만 fetch)
  React.useEffect(() => {
    if (!graduationYear || externalRankingMap !== undefined) return;
    let isMounted = true;
    setIsRankingsLoading(true);
    fetchYearlyRankings(parseInt(graduationYear), baseYear || 2026)
      .then(rankings => {
        if (isMounted) {
          setInternalRankingMap(rankings);
          setIsRankingsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to load yearly rankings:', err);
          setIsRankingsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [graduationYear, baseYear, externalRankingMap]);

  // 전체 데이터에서 고유 자격증 목록 추출 (모달 자동완성 힌트용)
  const allCertificates = React.useMemo(() => {
    const certSet = new Set<string>();
    allData.forEach(s => {
      const certs = Array.isArray(s.certificates)
        ? s.certificates
        : (typeof s.certificates === 'string' ? [s.certificates] : []);
      certs.forEach(c => {
        if (c && c.trim()) certSet.add(c.trim());
      });
    });
    return Array.from(certSet).sort();
  }, [allData]);

  // 커스텀 조건 매칭 학생 수 계산
  const customMatchedCount = React.useMemo(() => {
    if (!customRule || !customRule.conditions || customRule.conditions.length === 0) return 0;
    
    return allData.filter(student => {
      const rankingSummary = rankingMap[student.id];
      return evaluateCustomRuleMatch(student, customRule, rankingSummary);
    }).length;
  }, [allData, rankingMap, customRule]);

  const groupedData = React.useMemo(() => {
    const grouped: Record<string, StudentEmploymentData[]> = {};
    for (const student of allData) {
      const major = student.major || '';
      const classInfo = student.class_info || '';
      const displayClassName = getShortClassName(major, classInfo, grade, student.graduation_year);
      if (!grouped[displayClassName]) grouped[displayClassName] = [];
      grouped[displayClassName].push(student);
    }
    return grouped;
  }, [allData, grade]);

  const majorOrderMap = React.useMemo(() => {
    const map = new Map(SORT_ORDER.map((m, i) => [MAJOR_MAP[m] || m, i]));
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

  // 강조 검색 대상에 매칭되는 학생 수 계산 (hideSearchHeader일 경우 스킵하여 성능 20배 향상)
  const matchedCount = React.useMemo(() => {
    if (hideSearchHeader || !searchQuery || searchQuery.trim() === '') return 0;
    
    const query = searchQuery.toLowerCase().trim();
    
    return allData.filter(student => {
      const certList = Array.isArray(student.certificates)
        ? student.certificates
        : (typeof student.certificates === 'string' ? student.certificates : []);

      const fieldsToSearch = isLowerGrade
        ? [
            student.student_name,
            student.career_aspiration,
            student.career_course,
            student.employment_status,
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
      return fieldsToSearch.some(field => field?.toLowerCase().includes(query));
    }).length;
  }, [allData, searchQuery, isLowerGrade, hideSearchHeader]);

  // 학급별 학생 정렬 및 담임교사 동기화 데이터 사전 메모이제이션 (검색 입력 시 불필요한 재연산 완전 방지)
  const processedClassGroups = React.useMemo(() => {
    return classNames.map((className) => {
      const rawStudents = groupedData[className] || [];
      const students = [...rawStudents].sort((a, b) => 
        (parseInt(a.student_number || '0')) - (parseInt(b.student_number || '0'))
      );
      const totalCount = students.length;
      const sampleStudent = students[0];
      const studentMajor = sampleStudent?.major || '';
      const studentClass = sampleStudent?.class_info || '';
      const targetGrade = grade;

      let teacherName = '';

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

      if (!teacherName) {
        teacherName = students.find(s => s.teacher_name)?.teacher_name || '';
      }

      const syncedStudents = students.map(student => {
        const isLower = grade === 1 || grade === 2;
        const cellVariant = isLower
          ? getLowerGradeAspirationVariant(student.career_aspiration)
          : getCompanyTypeVariant(student.company_type, student.business_type);
        return {
          student: teacherName ? { ...student, teacher_name: teacherName } : student,
          cellVariant
        };
      });

      return {
        className,
        teacherName,
        totalCount,
        syncedStudents
      };
    });
  }, [classNames, groupedData, grade, teacherProfiles, baseYear]);

  // 2학년 진로코스 필터 매칭 수
  const wishFilterCount = React.useMemo(() => {
    if (!wishCourseFilter) return 0;
    return allData.filter(s => (s.career_course || '').trim() === wishCourseFilter).length;
  }, [allData, wishCourseFilter]);

  const currentFilterCount = React.useMemo(() => {
    if (!currentCourseFilter) return 0;
    return allData.filter(s => (s.employment_status || '').trim() === currentCourseFilter).length;
  }, [allData, currentCourseFilter]);

  const allMajors = React.useMemo(() => {
    const set = new Set<string>();
    allData.forEach(s => {
      if (s.major && s.major.trim()) set.add(s.major.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allData]);

  const allCourses = React.useMemo(() => {
    const set = new Set<string>(CAREER_COURSE_OPTIONS);
    allData.forEach(s => {
      if (s.career_course && s.career_course.trim()) set.add(s.career_course.trim());
    });
    return Array.from(set);
  }, [allData]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <GridLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 클라이언트 사이드 검색창 (hideSearchHeader가 아닐 때만 표시) */}
      {!hideSearchHeader && (
        <SearchHeader 
          onSearch={setSearchQuery} 
          currentSearchQuery={searchQuery} 
          isLowerGrade={isLowerGrade} 
          matchedCount={matchedCount} 
          customRule={customRule}
          onOpenCustomModal={() => setIsCustomModalOpen(true)}
          onClearCustomRule={() => setCustomRule(null)}
          customMatchedCount={customMatchedCount}
          wishCourseFilter={wishCourseFilter}
          currentCourseFilter={currentCourseFilter}
          onWishCourseFilter={setWishCourseFilter}
          onCurrentCourseFilter={setCurrentCourseFilter}
          wishFilterCount={wishFilterCount}
          currentFilterCount={currentFilterCount}
        />
      )}


      <div className="w-full overflow-x-auto bg-gray-50/50 rounded-xl border border-slate-200 shadow-sm p-2 sm:p-4">
        <div className="flex gap-px bg-gray-300 border border-gray-300 min-w-max mx-auto shadow-sm">
          {processedClassGroups.map((group) => {
            const { className, teacherName, totalCount, syncedStudents } = group;

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
                  {syncedStudents.map(({ student, cellVariant }, idx) => {
                    const isLowerGrade = grade === 1 || grade === 2;

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
                        customRule={customRule}
                        baseYear={baseYear}
                        isLowerGrade={isLowerGrade}
                        wishCourseFilter={wishCourseFilter}
                        currentCourseFilter={currentCourseFilter}
                        homeroomTeacher={teacherName}
                        onStudentUpdate={onStudentUpdate}
                      />
                    );
                  })}
                  {Array.from({ length: Math.max(0, 24 - syncedStudents.length) }).map((_, i) => (
                    <div key={i} className="h-7 border-b border-gray-100 bg-white"></div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 자유 커스텀 조건 조합 모달 */}
      <CustomCombinationModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onApply={(rule) => setCustomRule(rule)}
        currentRule={customRule}
        allCertificates={allCertificates}
        allMajors={allMajors}
        allCourses={allCourses}
        allStudents={allData}
        rankingMap={rankingMap}
      />
    </div>
  );
}

