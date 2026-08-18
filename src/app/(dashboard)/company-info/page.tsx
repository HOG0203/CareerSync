'use client';

import * as React from 'react';
import { 
  getCompanies, 
  getCompanyDetails, 
  upsertCompany, 
  deleteCompany,
  getUnregisteredCompanies,
  CompanyData,
  UnregisteredCompanyData 
} from './actions';
import { 
  Search, 
  Building2, 
  MapPin, 
  Briefcase, 
  TrendingUp, 
  Users, 
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Factory,
  Clock,
  Wallet,
  Gift,
  Award,
  BookOpen,
  Info,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { StudentPopover } from '@/components/dashboard/student-popover';
import { fetchYearlyRankings } from '@/app/(dashboard)/employment-status/actions';
import { ImportCompanyModal } from './import-company-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CompanyInfoPage() {
  const router = useRouter();
  const [companies, setCompanies] = React.useState<CompanyData[]>([]);
  const [selectedCompany, setSelectedCompany] = React.useState<any>(null);
  const [search, setSearch] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isTeacher, setIsTeacher] = React.useState(false);
  
  // 모바일 탭 상태
  const [mobileTab, setMobileTab] = React.useState<'list' | 'details'>('list');

  // 정렬 상태 (취업생 현황: 기본 졸업연도 내림차순)
  const [employeeSort, setEmployeeSort] = React.useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'graduation_year', direction: 'desc' });
  const [traineeSort, setTraineeSort] = React.useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'student_name', direction: 'asc' });

  // 편집 및 일괄등록 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState<CompanyData | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { toast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    checkRole();
  }, []);

  // 검색어 변경 시 자동 검색 (Debounce)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      loadCompanies(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(data?.role === 'admin');
      setIsTeacher(data?.role === 'teacher');
    }
  };

  const [unregisteredCompanies, setUnregisteredCompanies] = React.useState<UnregisteredCompanyData[]>([]);
  const [unregisteredLoaded, setUnregisteredLoaded] = React.useState(false);
  const [companyFilterType, setCompanyFilterType] = React.useState<'registered' | 'unregistered'>('registered');

  // hover prefetch 캐시 (이미 prefetch한 기업은 중복 요청 방지)
  const prefetchedRef = React.useRef<Set<string>>(new Set());

  const loadCompanies = async (searchVal?: string) => {
    setIsLoading(true);
    // 초기 로드 시 등록 기업만 조회 (미등록 기업은 탭 클릭 시 지연 로드)
    const { data } = await getCompanies(searchVal);
    if (data) setCompanies(data);
    setIsLoading(false);
  };

  // 등록/수정/삭제/가져오기 시 등록/미등록 기업 전체 실시간 최신화
  const refreshAllCompanies = async (searchVal?: string) => {
    setIsLoading(true);
    const [{ data: regData }, unregData] = await Promise.all([
      getCompanies(searchVal),
      getUnregisteredCompanies()
    ]);
    if (regData) setCompanies(regData);
    if (unregData) setUnregisteredCompanies(unregData);
    setUnregisteredLoaded(true);
    setIsLoading(false);
    router.refresh();
  };

  // 미등록 기업 탭 클릭 시 지연 로드
  const handleUnregisteredTabClick = async () => {
    setCompanyFilterType('unregistered');
    if (!unregisteredLoaded) {
      const data = await getUnregisteredCompanies();
      if (data) setUnregisteredCompanies(data);
      setUnregisteredLoaded(true);
    }
  };

  // hover 시 상세 데이터 prefetch (캐시 워밍)
  const handleCompanyHover = (companyName: string) => {
    if (prefetchedRef.current.has(companyName)) return;
    prefetchedRef.current.add(companyName);
    // fire-and-forget: 서버 캐시에 워밍만 하면 됨
    getCompanyDetails(companyName).catch(() => {});
  };


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCompanies(search);
  };

  const [rankingMap, setRankingMap] = React.useState<Record<string, any>>({});
  const [isRankingsLoading, setIsRankingsLoading] = React.useState(false);

  const handleSelectCompany = async (companyName: string) => {
    // 모바일에서는 즉시 상세 탭으로 전환하여 클릭 피드백 제공
    setMobileTab('details');
    
    setIsDetailsLoading(true);
    setIsRankingsLoading(true);
    const details = await getCompanyDetails(companyName);
    setSelectedCompany(details);
    setIsDetailsLoading(false);

    if (details && (details.employees.length > 0 || details.trainees.length > 0)) {
      const allStudents = [...details.employees, ...details.trainees];
      const gradYears = Array.from(new Set(allStudents.map((s: any) => s.graduation_year).filter(Boolean)));
      
      const baseYear = details.baseYear || 2026;
      const rankingPromises = gradYears.map((gy: any) => fetchYearlyRankings(Number(gy), baseYear));
      const results = await Promise.all(rankingPromises);
      
      const combinedMap: Record<string, any> = {};
      results.forEach(resMap => {
        if (resMap) {
          Object.assign(combinedMap, resMap);
        }
      });
      setRankingMap(combinedMap);
    }
    setIsRankingsLoading(false);
  };

  const handleUpsert = async () => {
    if (!editingCompany?.name) {
      toast({ variant: 'destructive', title: '기업명 입력 필요', description: '기업체명은 필수 입력 항목입니다.' });
      return;
    }
    
    setIsSubmitting(true);
    const targetName = editingCompany.name;
    const { error } = await upsertCompany(editingCompany);
    if (error) {
      toast({ variant: 'destructive', title: '저장 실패', description: '기업 정보를 저장하는 중 오류가 발생했습니다.' });
    } else {
      toast({ title: '저장 완료', description: '기업 정보가 성공적으로 업데이트되었습니다.' });
      setIsEditModalOpen(false);
      await refreshAllCompanies(search);
      if (selectedCompany?.name === targetName || selectedCompany?.company?.name === targetName) {
        handleSelectCompany(targetName);
      }
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 기업 정보를 삭제하시겠습니까?')) return;
    
    const { error } = await deleteCompany(id);
    if (error) {
      toast({ variant: 'destructive', title: '삭제 실패' });
    } else {
      toast({ title: '삭제 완료' });
      setSelectedCompany(null);
      await refreshAllCompanies(search);
    }
  };

  // 데이터 정렬 로직
  const getSortedData = (data: any[], sort: { key: string, direction: 'asc' | 'desc' }) => {
    return [...data].sort((a, b) => {
      const aVal = a[sort.key] || '';
      const bVal = b[sort.key] || '';
      
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // 정렬 헤더 컴포넌트
  const SortHeader = ({ label, sortKey, currentSort, onSort }: { label: string, sortKey: string, currentSort: any, onSort: any }) => {
    const isActive = currentSort.key === sortKey;
    return (
      <th 
        className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
        onClick={() => onSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {label}
          <span className={cn(
            "text-slate-300 group-hover:text-slate-400 transition-colors",
            isActive && "text-blue-500"
          )}>
            {isActive ? (
              currentSort.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100" />
            )}
          </span>
        </div>
      </th>
    );
  };

  const handleSort = (type: 'employee' | 'trainee', key: string) => {
    if (type === 'employee') {
      setEmployeeSort(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      setTraineeSort(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    }
  };

  return (
    <div className="flex flex-col h-full gap-2.5 sm:gap-6">
      {/* 헤더 섹션 (모바일 반응형 공간 최적화) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Factory className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 shrink-0" />
            <span className="whitespace-nowrap shrink-0">업체정보</span>
            {isAdmin && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase whitespace-nowrap shrink-0">관리자 모드</span>
            )}
            {isTeacher && !isAdmin && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase whitespace-nowrap shrink-0">조회 모드</span>
            )}
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis">
            학교 협력 기업 상세 정보 및 취업/실습 현황 관리
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 sm:flex-initial h-8 sm:h-10 bg-white hover:bg-emerald-50 hover:text-emerald-700 border-emerald-300 text-emerald-800 font-bold gap-1 text-[11px] sm:text-sm px-2 sm:px-4 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" /> 업체 일괄 등록
            </Button>
            <Button 
              onClick={() => {
                setEditingCompany({ name: '' });
                setIsEditModalOpen(true);
              }}
              className="flex-1 sm:flex-initial h-8 sm:h-10 bg-blue-600 hover:bg-blue-700 font-bold gap-1 text-[11px] sm:text-sm px-2 sm:px-4 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> 신규 업체 등록
            </Button>
          </div>
        )}
      </div>

      {/* 모바일 전용 탭 스위처 (높이 슬림화) */}
      <div className="lg:hidden shrink-0">
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8.5 sm:h-10 p-0.5 sm:p-1 bg-slate-100 rounded-xl">
            <TabsTrigger value="list" className="rounded-lg font-bold text-[11px] sm:text-xs">업체 목록</TabsTrigger>
            <TabsTrigger value="details" className="rounded-lg font-bold text-[11px] sm:text-xs">상세 정보</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 flex-1 min-h-0">
        {/* 왼쪽: 업체 목록 및 통합 검색 */}
        <div className={cn(
          "lg:col-span-4 flex flex-col gap-3 min-h-0",
          mobileTab !== 'list' && "hidden lg:flex"
        )}>
          <Card className="flex-1 flex flex-col border-none shadow-md lg:h-[calc(100vh-130px)] lg:overflow-hidden bg-white rounded-2xl">
            <div className="p-3 sm:p-4 border-b space-y-2 bg-slate-50/50">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-slate-800">
                  <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>업체 리스트</span>
                  <span className="text-[9.5px] sm:text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-bold">
                    {companyFilterType === 'registered' ? `${companies.length}개` : `${unregisteredCompanies.length}개`}
                  </span>
                </div>
              </div>

              {/* 마스터 등록 기업 VS 학생 감지 미등록 기업 세그먼트 필터 */}
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-bold my-1">
                <button
                  type="button"
                  onClick={() => setCompanyFilterType('registered')}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 text-[11px]",
                    companyFilterType === 'registered' 
                      ? "bg-white text-slate-900 shadow-xs font-extrabold" 
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <span>등록 기업</span>
                  <span className="bg-slate-200/80 text-slate-700 text-[9.5px] px-1.5 py-0.2 rounded-full font-bold">
                    {companies.length}
                  </span>
                </button>
                
                <button
                  type="button"
                  onClick={handleUnregisteredTabClick}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-lg text-center transition-all flex items-center justify-center gap-1 text-[11px]",
                    companyFilterType === 'unregistered' 
                      ? "bg-amber-500 text-white shadow-xs font-extrabold" 
                      : "text-amber-800 hover:bg-amber-100/50"
                  )}
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>미등록</span>
                  {unregisteredCompanies.length > 0 && (
                    <span className={cn(
                      "text-[9.5px] px-1.5 py-0.2 rounded-full font-bold",
                      companyFilterType === 'unregistered' ? "bg-white/30 text-white" : "bg-amber-200 text-amber-900"
                    )}>
                      {unregisteredCompanies.length}
                    </span>
                  )}
                </button>
              </div>

              <form onSubmit={handleSearch} className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input 
                  placeholder="기업명 검색..." 
                  className="pl-8 pr-7 h-9 text-xs bg-white border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button 
                    type="button" 
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </form>
            </div>

            <CardContent className="p-0 flex-1 min-h-0 divide-y divide-slate-100 lg:overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                  <p className="text-xs font-medium text-slate-400">목록을 불러오는 중...</p>
                </div>
              ) : companyFilterType === 'registered' ? (
                /* 등록 기업 목록 */
                companies.length > 0 ? (
                  companies.map((company) => (
                    <div 
                      key={company.id} 
                      onClick={() => handleSelectCompany(company.name)}
                      onMouseEnter={() => handleCompanyHover(company.name)}
                      className={cn(
                        "p-3 sm:p-4 cursor-pointer hover:bg-slate-50 active:bg-blue-50/50 transition-all group relative border-l-4",
                        selectedCompany?.company?.name === company.name 
                          ? "bg-blue-50/80 border-blue-600 shadow-xs" 
                          : "border-transparent"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn(
                              "font-bold text-xs sm:text-sm truncate transition-colors",
                              selectedCompany?.company?.name === company.name ? "text-blue-700 font-extrabold" : "text-slate-900 group-hover:text-blue-600"
                            )}>
                              {company.name}
                            </p>

                            {/* 취업생 & 실습생 카운트 배지 */}
                            <div className="flex items-center gap-1 shrink-0">
                              {(company.employeeCount || 0) > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-blue-100/90 text-blue-700 border border-blue-200/80">
                                  취업 {company.employeeCount}
                                </span>
                              )}
                              {(company.traineeCount || 0) > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-emerald-100/90 text-emerald-700 border border-emerald-200/80">
                                  실습 {company.traineeCount}
                                </span>
                              )}
                              {(company.employeeCount || 0) === 0 && (company.traineeCount || 0) === 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-slate-100 text-slate-400 opacity-60">
                                  0명
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-[11px] text-slate-500">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                              selectedCompany?.company?.name === company.name ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {company.industry || '업종미지정'}
                            </span>
                            <span className="flex items-center gap-1 min-w-0 truncate text-slate-400 text-[10.5px]">
                              <MapPin className="h-3 w-3 shrink-0 text-slate-400" /> 
                              <span className="truncate">{company.location || '소재지미정'}</span>
                            </span>
                          </div>
                        </div>
                        <ChevronRight className={cn(
                          "h-4 w-4 shrink-0 transition-all duration-200",
                          selectedCompany?.company?.name === company.name ? "text-blue-600 translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"
                        )} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 text-slate-400">
                    <p className="text-sm">등록된 기업 검색 결과가 없습니다.</p>
                  </div>
                )
              ) : (
                /* 미등록 기업 목록 (학생 데이터 감지) */
                unregisteredCompanies.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase())).length > 0 ? (
                  unregisteredCompanies
                    .filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()))
                    .map((item) => {
                      const isSelected = selectedCompany?.name === item.name || selectedCompany?.company?.name === item.name;
                      return (
                        <div 
                          key={item.name}
                          onClick={() => handleSelectCompany(item.name)}
                          className={cn(
                            "p-3 sm:p-4 cursor-pointer hover:bg-amber-50/50 active:bg-amber-100/60 transition-all group relative border-l-4",
                            isSelected 
                              ? "bg-amber-50/90 border-amber-500 shadow-xs" 
                              : "border-transparent"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className={cn(
                                  "font-bold text-xs sm:text-sm truncate transition-colors",
                                  isSelected ? "text-amber-800 font-extrabold" : "text-slate-900 group-hover:text-amber-700"
                                )}>
                                  {item.name}
                                </p>
                                <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200 shrink-0 flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                                  미등록
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200/60 text-[10px]">
                                  취업생 감지 {item.totalCount}명
                                </span>
                              </div>
                            </div>
                            <ChevronRight className={cn(
                              "h-4 w-4 shrink-0 transition-all duration-200",
                              isSelected ? "text-amber-600 translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"
                            )} />
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-20 text-slate-400">
                    <p className="text-sm font-medium">감지된 미등록 취업 기업이 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">모든 학생 취업처가 마스터 DB에 정식 등록되어 있습니다. 🎉</p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 상세 정보 및 학생 현황 (데스크톱: Sticky 내부 스크롤, 모바일: 페이지 전체 외부 스크롤) */}
        <div className={cn(
          "lg:col-span-8 flex flex-col gap-6 lg:overflow-y-auto lg:sticky lg:top-[72px] self-start lg:h-[calc(100vh-130px)] custom-scrollbar pr-1",
          mobileTab !== 'details' && "hidden lg:flex"
        )}>
          {isDetailsLoading ? (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-dashed gap-4">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-medium">상세 데이터를 가져오고 있습니다...</p>
            </div>
          ) : selectedCompany ? (
            <div className="space-y-6">
              {/* 미등록 기업인 경우 경고 알림 및 정식 등록 액션 카드를 상단에 배치 */}
              {!selectedCompany.company ? (
                <Card className="border-amber-200 bg-amber-50/80 shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5 sm:mt-0">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                          <span>{selectedCompany.name}</span>
                          <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                            미등록 기업 감지
                          </span>
                        </h4>
                        <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                          학생 취업 현황에 취업으로 등록된 <strong>'{selectedCompany.name}'</strong> (취업생 {selectedCompany.employees.length}명) 기업이나, 아직 기업 마스터 DB에는 등록되지 않았습니다.
                        </p>
                      </div>
                    </div>

                    {isAdmin && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const nameToRegister = selectedCompany.name || selectedCompany.company?.name || '';
                          setEditingCompany({ name: nameToRegister });
                          setIsEditModalOpen(true);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 gap-1.5 h-9 w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4" />
                        마스터 DB에 정식 등록하기
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                /* 기업 기본 정보 카드 (등록 기업인 경우만 표시 - 모바일 반응형 최적화) */
                <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
                  <div className="h-2 bg-blue-600 w-full" />
                  <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                          <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
                          <CardTitle className="text-lg sm:text-2xl font-black text-slate-900 break-all">{selectedCompany.company?.name}</CardTitle>
                          <span className="bg-blue-100 text-blue-700 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                            {selectedCompany.company?.company_type || '기업형태'}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs sm:text-sm text-slate-500 font-medium pt-1 sm:pt-0">
                          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 shrink-0" /> {selectedCompany.company?.location || '소재지 미등록'}</span>
                          <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" /> {selectedCompany.company?.industry || '업종 미등록'}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setEditingCompany(selectedCompany.company);
                              setIsEditModalOpen(true);
                            }}
                            className="h-8 font-bold border-blue-200 text-blue-600 hover:bg-blue-50 text-xs px-3"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" /> 정보 수정
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(selectedCompany.company?.id)}
                            className="h-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 text-xs px-2"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-100/80">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3 text-blue-500" /> 채용 정보
                        </p>
                        <ul className="space-y-2.5 text-xs">
                          <li className="flex items-start justify-between gap-2">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">직무</span> 
                            <span className="font-bold text-slate-700 text-right min-w-0 break-all whitespace-pre-line">{selectedCompany.company?.job_description || '-'}</span>
                          </li>
                          <li className="flex items-start justify-between gap-2">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">급여</span> 
                            <span className="font-bold text-blue-600 text-right min-w-0 break-all whitespace-pre-line">{selectedCompany.company?.salary || '-'}</span>
                          </li>
                          <li className="flex items-start justify-between gap-2">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">상여</span> 
                            <span className="font-bold text-indigo-600 text-right min-w-0 break-all whitespace-pre-line">{selectedCompany.company?.bonus || '-'}</span>
                          </li>
                        </ul>
                      </div>
                      <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-100/80">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-emerald-500" /> 근무 환경
                        </p>
                        <ul className="space-y-2.5 text-xs">
                          <li className="flex items-start justify-between gap-2">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">근무시간</span> 
                            <span className="font-bold text-slate-700 text-right min-w-0 break-all whitespace-pre-line">{selectedCompany.company?.working_hours || '-'}</span>
                          </li>
                          <li className="flex items-start justify-between gap-2">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">고용형태</span> 
                            <span className="font-bold text-slate-700 text-right min-w-0 break-all whitespace-pre-line">{selectedCompany.company?.employment_type || '-'}</span>
                          </li>
                          <li className="flex items-start justify-between gap-2 flex-col pt-0.5">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">복리후생</span> 
                            <span className="font-medium text-slate-600 text-[11px] leading-relaxed break-all whitespace-pre-line bg-white/60 p-2 rounded-lg border border-slate-200/50 w-full mt-0.5">{selectedCompany.company?.welfare || '-'}</span>
                          </li>
                        </ul>
                      </div>
                      <div className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-100/80">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                          <Award className="h-3 w-3 text-amber-500" /> 자격/요구사항
                        </p>
                        <ul className="space-y-2.5 text-xs">
                          <li className="flex items-start justify-between gap-2">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">대상전공</span> 
                            <span className="font-bold text-slate-700 text-right min-w-0 break-all whitespace-pre-line">{selectedCompany.company?.required_major || '-'}</span>
                          </li>
                          <li className="flex items-start justify-between gap-2 flex-col pt-0.5">
                            <span className="text-slate-500 shrink-0 whitespace-nowrap">필수자격증</span> 
                            <span className="font-bold text-emerald-600 text-[11px] break-all whitespace-pre-line bg-white/60 p-2 rounded-lg border border-slate-200/50 w-full mt-0.5">{selectedCompany.company?.required_certificates || '-'}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    
                    {selectedCompany.company?.strengths && (
                      <div className="mt-3.5 sm:mt-4 p-3.5 sm:p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                          <Info className="h-3 w-3" /> 기업 특장점
                        </p>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                          {selectedCompany.company?.strengths}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 학생 현황 탭 (모바일 최적화) */}
              <Tabs defaultValue="employees" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-10 sm:h-12 p-1 bg-slate-100 rounded-xl">
                  <TabsTrigger value="employees" className="rounded-lg font-bold flex gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 취업생 현황 
                    <span className="bg-blue-500 text-white text-[9px] px-1.5 rounded-full">{selectedCompany.employees.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="trainees" className="rounded-lg font-bold flex gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 현장실습생 현황
                    <span className="bg-emerald-500 text-white text-[9px] px-1.5 rounded-full">{selectedCompany.trainees.length}</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="employees" className="mt-3 sm:mt-4">
                  <Card className="border-none shadow-xs">
                    <CardContent className="p-0 overflow-hidden rounded-xl">
                      {selectedCompany.employees.length > 0 ? (
                        <div className="w-full overflow-x-auto">
                          <table className="w-full text-xs sm:text-sm text-left">
                            <thead className="bg-slate-100/80 text-slate-600 text-[11px] sm:text-xs font-bold border-b border-slate-200">
                              <tr>
                                <SortHeader label="이름" sortKey="student_name" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                                <SortHeader label="졸업연도" sortKey="graduation_year" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                                <SortHeader label="학과" sortKey="major" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                                <SortHeader label="반/번호" sortKey="student_number" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {getSortedData(selectedCompany.employees, employeeSort).map((s: any) => (
                                <tr key={s.id} className="hover:bg-slate-50/90 transition-colors">
                                  <td className="px-2.5 sm:px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                                    <StudentPopover 
                                      student={s} 
                                      rankingSummary={rankingMap[s.id]} 
                                      isRankingsLoading={isRankingsLoading}
                                      baseYear={selectedCompany.baseYear || 2026}
                                    >
                                      <span className="hover:text-indigo-600 cursor-pointer underline decoration-indigo-300 underline-offset-2 transition-colors">
                                        {s.student_name}
                                      </span>
                                    </StudentPopover>
                                  </td>
                                  <td className="px-2 sm:px-4 py-3 font-semibold text-blue-700 whitespace-nowrap">
                                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200/60 text-[11px] sm:text-xs">
                                      {s.graduation_year ? `${s.graduation_year}년` : '-'}
                                    </span>
                                  </td>
                                  <td className="px-2 sm:px-4 py-3 font-semibold text-slate-800 text-xs sm:text-sm">
                                    {s.major}
                                  </td>
                                  <td className="px-2 sm:px-4 py-3 font-medium text-slate-600 text-xs whitespace-nowrap">
                                    {s.class_info}반 {s.student_number}번
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 sm:py-20 text-center text-slate-400 italic text-xs sm:text-sm">현재 취업한 학생이 없습니다.</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="trainees" className="mt-3 sm:mt-4">
                  <Card className="border-none shadow-xs">
                    <CardContent className="p-0 overflow-hidden rounded-xl">
                      {selectedCompany.trainees.length > 0 ? (
                        <div className="w-full overflow-x-auto">
                          <table className="w-full text-xs sm:text-sm text-left">
                            <thead className="bg-slate-100/80 text-slate-600 text-[11px] sm:text-xs font-bold border-b border-slate-200">
                              <tr>
                                <SortHeader label="이름" sortKey="student_name" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                                <SortHeader label="학과" sortKey="major" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                                <SortHeader label="반/번호" sortKey="student_number" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                                <SortHeader label="상태" sortKey="hiring_status" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {getSortedData(selectedCompany.trainees, traineeSort).map((s: any) => (
                                <tr key={s.id} className="hover:bg-slate-50/90 transition-colors">
                                  <td className="px-2.5 sm:px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                                    <StudentPopover 
                                      student={s} 
                                      rankingSummary={rankingMap[s.id]} 
                                      isRankingsLoading={isRankingsLoading}
                                      baseYear={selectedCompany.baseYear || 2026}
                                    >
                                      <span className="hover:text-indigo-600 cursor-pointer underline decoration-indigo-300 underline-offset-2 transition-colors">
                                        {s.student_name}
                                      </span>
                                    </StudentPopover>
                                  </td>
                                  <td className="px-2 sm:px-4 py-3 font-semibold text-slate-800 text-xs sm:text-sm">
                                    {s.major}
                                  </td>
                                  <td className="px-2 sm:px-4 py-3 font-medium text-slate-600 text-xs whitespace-nowrap">
                                    {s.class_info}반 {s.student_number}번
                                  </td>
                                  <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black shadow-2xs",
                                      s.hiring_status === '채용전환' ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    )}>
                                      {s.hiring_status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 sm:py-20 text-center text-slate-400 italic text-xs sm:text-sm">현재 실습 중인 학생이 없습니다.</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center group">
              <div className="p-6 bg-slate-50 rounded-full mb-6 group-hover:scale-110 transition-transform">
                <Search className="h-12 w-12 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">업체를 선택해주세요</h3>
              <p className="text-slate-500 max-w-sm">
                왼쪽 리스트에서 기업을 선택하거나 검색하여 상세 정보와 소속 학생 현황을 확인하세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 업체 정식 등록 / 정보 수정 모달 (앱 통합 테마 스타일 적용) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] p-0 border-none shadow-2xl rounded-2xl overflow-hidden flex flex-col z-[200]">
          <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div className="flex flex-col text-left min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-xl font-black flex items-center gap-2 text-slate-900 truncate">
                  {editingCompany?.id ? '기업 정보 수정' : '신규 업체 등록'}
                  <span className="text-[10px] sm:text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                    {editingCompany?.id ? '마스터 DB 수정' : '신규 등록'}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-xs font-medium mt-0.5 truncate">
                  {editingCompany?.id 
                    ? `'${editingCompany.name || ''}' 기업의 상세 채용 및 근로 조건을 업데이트합니다.` 
                    : '기업 마스터 DB에 신규 기업 정보를 정식 등록합니다.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-white custom-scrollbar">
            {/* 기본 정보 Section */}
            <div className="space-y-2.5">
              <label className="text-xs font-black text-blue-600 uppercase flex items-center gap-1.5 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100/60 w-fit">
                <Building2 className="h-3.5 w-3.5 text-blue-500" /> 기본 정보
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">기업체명 <span className="text-rose-500">*</span></label>
                  <Input 
                    placeholder="기업체명 (예: CMA글로벌)" 
                    value={editingCompany?.name || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, name: e.target.value }))}
                    className="font-bold text-xs sm:text-sm h-9 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">소재지</label>
                  <Textarea 
                    placeholder="소재지 (예: 대구 달서구 성서공단로) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-blue-500"
                    value={editingCompany?.location || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">업종</label>
                  <Textarea 
                    placeholder="업종 (예: 제조업, 소프트웨어) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-blue-500"
                    value={editingCompany?.industry || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, industry: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">기업형태</label>
                  <Textarea 
                    placeholder="기업형태 (예: 중소기업, 강소기업) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-blue-500"
                    value={editingCompany?.company_type || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, company_type: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* 채용 및 근무조건 Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-black text-emerald-600 uppercase flex items-center gap-1.5 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-100/60 w-fit">
                <Briefcase className="h-3.5 w-3.5 text-emerald-500" /> 채용 및 근무조건
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">채용 직무</label>
                  <Textarea 
                    placeholder="직무 (예: 생산설비 제어 및 유지보수) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-emerald-500"
                    value={editingCompany?.job_description || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, job_description: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">급여 조건</label>
                  <Textarea 
                    placeholder="급여 (예: 연 3,000만원 이상) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-emerald-500"
                    value={editingCompany?.salary || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, salary: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">상여금</label>
                  <Textarea 
                    placeholder="상여 (예: 기본급 200%) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-emerald-500"
                    value={editingCompany?.bonus || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, bonus: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">근무시간</label>
                  <Textarea 
                    placeholder="근무시간 (예: 09:00 ~ 18:00 주5일) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-emerald-500"
                    value={editingCompany?.working_hours || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, working_hours: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">고용형태</label>
                  <Textarea 
                    placeholder="고용형태 (예: 정규직, 채용전환형) (엔터 줄바꿈 가능)" 
                    className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-emerald-500"
                    value={editingCompany?.employment_type || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, employment_type: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* 복리후생 및 요구역량 Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-black text-amber-600 uppercase flex items-center gap-1.5 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-100/60 w-fit">
                <Award className="h-3.5 w-3.5 text-amber-500" /> 복리후생 및 요구역량
              </label>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">복리후생 상세</label>
                  <Textarea 
                    placeholder="복리후생 상세 (예: 기숙사 제공, 통근버스, 기계/전기 교육 지원) (엔터 줄바꿈 가능)" 
                    className="min-h-[64px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-amber-500"
                    value={editingCompany?.welfare || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, welfare: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 mb-1 block">대상 전공</label>
                    <Textarea 
                      placeholder="대상 전공 (예: 스마트팩토리과, 전기과) (엔터 줄바꿈 가능)" 
                      className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-amber-500"
                      value={editingCompany?.required_major || ''} 
                      onChange={e => setEditingCompany(prev => ({ ...prev!, required_major: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 mb-1 block">필수 / 우대 자격증</label>
                    <Textarea 
                      placeholder="필수자격증 (예: 생산자동화기능사, 전기기능사) (엔터 줄바꿈 가능)" 
                      className="min-h-[44px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-amber-500"
                      value={editingCompany?.required_certificates || ''} 
                      onChange={e => setEditingCompany(prev => ({ ...prev!, required_certificates: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 block">기타 참고사항</label>
                  <Textarea 
                    placeholder="기타 참고사항 (엔터 입력으로 줄바꿈 가능)" 
                    className="min-h-[50px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-amber-500"
                    value={editingCompany?.etc || ''} 
                    onChange={e => setEditingCompany(prev => ({ ...prev!, etc: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* 기업 특장점 Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-black text-indigo-600 uppercase flex items-center gap-1.5 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100/60 w-fit">
                <Info className="h-3.5 w-3.5 text-indigo-500" /> 기업 특장점 (학생 안내용)
              </label>
              <Textarea 
                placeholder="기업 분위기, 성장 가능성, 구직 학생들에게 안내할 특장점 정보... (엔터 줄바꿈 가능)" 
                className="min-h-[80px] text-xs leading-relaxed rounded-xl border-slate-200 focus:border-indigo-500"
                value={editingCompany?.strengths || ''} 
                onChange={e => setEditingCompany(prev => ({ ...prev!, strengths: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-end gap-2 shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-100 text-xs h-9 px-4"
            >
              취소
            </Button>
            <Button 
              onClick={handleUpsert} 
              disabled={isSubmitting} 
              className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 text-xs h-9 px-6 gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{editingCompany?.id ? '수정사항 저장' : '신규 기업 등록'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 업체 일괄 등록 모달 */}
      <ImportCompanyModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={async () => {
          await refreshAllCompanies(search);
          if (selectedCompany) {
            const compName = selectedCompany.name || selectedCompany.company?.name;
            if (compName) handleSelectCompany(compName);
          }
        }}
      />
    </div>
  );
}
