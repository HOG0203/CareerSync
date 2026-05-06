'use client';

import * as React from 'react';
import { 
  getCompanies, 
  getCompanyDetails, 
  upsertCompany, 
  deleteCompany,
  CompanyData 
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
  ArrowUpDown
} from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export default function CompanyInfoPage() {
  const [companies, setCompanies] = React.useState<CompanyData[]>([]);
  const [selectedCompany, setSelectedCompany] = React.useState<any>(null);
  const [search, setSearch] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  
  // 정렬 상태
  const [employeeSort, setEmployeeSort] = React.useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'student_name', direction: 'asc' });
  const [traineeSort, setTraineeSort] = React.useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'student_name', direction: 'asc' });

  // 편집 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState<CompanyData | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { toast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    checkAdmin();
    loadCompanies();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(data?.role === 'admin');
    }
  };

  const loadCompanies = async (searchVal?: string) => {
    setIsLoading(true);
    const { data } = await getCompanies(searchVal);
    if (data) setCompanies(data);
    setIsLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCompanies(search);
  };

  const handleSelectCompany = async (companyName: string) => {
    setIsDetailsLoading(true);
    const details = await getCompanyDetails(companyName);
    setSelectedCompany(details);
    setIsDetailsLoading(false);
    
    // 모바일에서는 스크롤 아래로 이동 로직 추가 가능
  };

  const handleUpsert = async () => {
    if (!editingCompany?.name) {
      toast({ variant: 'destructive', title: '기업명 입력 필요', description: '기업체명은 필수 입력 항목입니다.' });
      return;
    }
    
    setIsSubmitting(true);
    const { error } = await upsertCompany(editingCompany);
    if (error) {
      toast({ variant: 'destructive', title: '저장 실패', description: '기업 정보를 저장하는 중 오류가 발생했습니다.' });
    } else {
      toast({ title: '저장 완료', description: '기업 정보가 성공적으로 업데이트되었습니다.' });
      setIsEditModalOpen(false);
      loadCompanies(search);
      if (selectedCompany?.company?.name === editingCompany.name) {
        handleSelectCompany(editingCompany.name);
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
      loadCompanies(search);
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
    <div className="flex flex-col h-full gap-6">
      {/* 헤더 섹션 */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Factory className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            업체정보
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">
            학교 협력 기업 상세 정보 및 취업/실습 현황 관리
          </p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => {
              setEditingCompany({ name: '' });
              setIsEditModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 font-bold gap-2"
          >
            <Plus className="h-4 w-4" /> 신규 업체 등록
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* 왼쪽: 업체 목록 및 검색 */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
          <Card className="shrink-0">
            <CardContent className="p-4">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="기업명 검색..." 
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            </CardContent>
          </Card>

          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                업체 리스트
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium ml-auto">
                  {companies.length}개 업체
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                  <p className="text-xs font-medium text-slate-400">목록을 불러오는 중...</p>
                </div>
              ) : companies.length > 0 ? (
                <div className="divide-y">
                  {companies.map((company) => (
                    <div 
                      key={company.id}
                      onClick={() => handleSelectCompany(company.name)}
                      className={cn(
                        "p-4 cursor-pointer hover:bg-slate-50 transition-colors group",
                        selectedCompany?.company?.name === company.name && "bg-blue-50 border-r-4 border-blue-500"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate group-hover:text-blue-600">
                            {company.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded">{company.industry || '업종미지정'}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {company.location || '소재지미정'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <p className="text-sm">검색 결과가 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 상세 정보 및 학생 현황 */}
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-y-auto pr-1">
          {isDetailsLoading ? (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-dashed gap-4">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-medium">상세 데이터를 가져오고 있습니다...</p>
            </div>
          ) : selectedCompany ? (
            <div className="space-y-6">
              {/* 기업 기본 정보 카드 */}
              <Card className="border-none shadow-md overflow-hidden bg-white">
                <div className="h-2 bg-blue-600 w-full" />
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-2xl font-black text-slate-900">{selectedCompany.company?.name}</CardTitle>
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          {selectedCompany.company?.company_type || '기업형태'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-500" /> {selectedCompany.company?.location || '소재지 미등록'}</span>
                        <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-emerald-500" /> {selectedCompany.company?.industry || '업종 미등록'}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setEditingCompany(selectedCompany.company);
                            setIsEditModalOpen(true);
                          }}
                          className="h-8 font-bold border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> 정보 수정
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(selectedCompany.company?.id)}
                          className="h-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3" /> 채용 정보
                      </p>
                      <ul className="space-y-2 text-xs">
                        <li className="flex justify-between"><span className="text-slate-500">직무</span> <span className="font-bold text-slate-700">{selectedCompany.company?.job_description || '-'}</span></li>
                        <li className="flex justify-between"><span className="text-slate-500">급여</span> <span className="font-bold text-blue-600">{selectedCompany.company?.salary || '-'}</span></li>
                        <li className="flex justify-between"><span className="text-slate-500">상여</span> <span className="font-bold text-indigo-600">{selectedCompany.company?.bonus || '-'}</span></li>
                      </ul>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> 근무 환경
                      </p>
                      <ul className="space-y-2 text-xs">
                        <li className="flex justify-between"><span className="text-slate-500">근무시간</span> <span className="font-bold text-slate-700">{selectedCompany.company?.working_hours || '-'}</span></li>
                        <li className="flex justify-between"><span className="text-slate-500">고용형태</span> <span className="font-bold text-slate-700">{selectedCompany.company?.employment_type || '-'}</span></li>
                        <li className="flex justify-between flex-col gap-1">
                          <span className="text-slate-500">복리후생</span> 
                          <span className="font-medium text-slate-600 text-[11px] leading-tight line-clamp-2">{selectedCompany.company?.welfare || '-'}</span>
                        </li>
                      </ul>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Award className="h-3 w-3" /> 자격/요구사항
                      </p>
                      <ul className="space-y-2 text-xs">
                        <li className="flex justify-between"><span className="text-slate-500">대상전공</span> <span className="font-bold text-slate-700">{selectedCompany.company?.required_major || '-'}</span></li>
                        <li className="flex justify-between flex-col gap-1">
                          <span className="text-slate-500">필수자격증</span> 
                          <span className="font-bold text-emerald-600 text-[11px]">{selectedCompany.company?.required_certificates || '-'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  {selectedCompany.company?.strengths && (
                    <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Info className="h-3 w-3" /> 기업 특장점
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {selectedCompany.company?.strengths}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 학생 현황 탭 */}
              <Tabs defaultValue="employees" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-slate-100 rounded-xl">
                  <TabsTrigger value="employees" className="rounded-lg font-bold flex gap-2">
                    <Users className="h-4 w-4" /> 취업생 현황 
                    <span className="bg-blue-500 text-white text-[9px] px-1.5 rounded-full">{selectedCompany.employees.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="trainees" className="rounded-lg font-bold flex gap-2">
                    <GraduationCap className="h-4 w-4" /> 현장실습생 현황
                    <span className="bg-emerald-500 text-white text-[9px] px-1.5 rounded-full">{selectedCompany.trainees.length}</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="employees" className="mt-4">
                  <Card>
                    <CardContent className="p-0 overflow-hidden rounded-xl">
                      {selectedCompany.employees.length > 0 ? (
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase border-b">
                            <tr>
                              <SortHeader label="이름" sortKey="student_name" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                              <SortHeader label="졸업연도" sortKey="graduation_year" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                              <SortHeader label="학과" sortKey="major" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                              <SortHeader label="반/번호" sortKey="student_number" currentSort={employeeSort} onSort={(key: string) => handleSort('employee', key)} />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {getSortedData(selectedCompany.employees, employeeSort).map((s: any) => (
                              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900">{s.student_name}</td>
                                <td className="px-4 py-4 text-slate-500">{s.graduation_year}년</td>
                                <td className="px-4 py-4 font-medium text-slate-600">{s.major}</td>
                                <td className="px-4 py-4 text-slate-500">{s.class_info}반 {s.student_number}번</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="py-20 text-center text-slate-400 italic text-sm">현재 취업한 학생이 없습니다.</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="trainees" className="mt-4">
                  <Card>
                    <CardContent className="p-0 overflow-hidden rounded-xl">
                      {selectedCompany.trainees.length > 0 ? (
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase border-b">
                            <tr>
                              <SortHeader label="이름" sortKey="student_name" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                              <SortHeader label="졸업연도" sortKey="graduation_year" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                              <SortHeader label="학과" sortKey="major" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                              <SortHeader label="상태" sortKey="hiring_status" currentSort={traineeSort} onSort={(key: string) => handleSort('trainee', key)} />
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {getSortedData(selectedCompany.trainees, traineeSort).map((s: any) => (
                              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900">{s.student_name}</td>
                                <td className="px-4 py-4 text-slate-500">{s.graduation_year}년</td>
                                <td className="px-4 py-4 font-medium text-slate-600">{s.major}</td>
                                <td className="px-4 py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                                    s.hiring_status === '채용전환' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                                  )}>
                                    {s.hiring_status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="py-20 text-center text-slate-400 italic text-sm">현재 실습 중인 학생이 없습니다.</div>
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

      {/* 관리자 편집 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden flex flex-col">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="text-xl font-black">기업 상세 정보 편집</DialogTitle>
            <p className="text-slate-400 text-xs mt-1">기업의 최신 채용 및 기업 정보를 업데이트합니다.</p>
          </DialogHeader>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 bg-white">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase">기본 정보</label>
              <Input 
                placeholder="기업체명 (필수)" 
                value={editingCompany?.name || ''} 
                onChange={e => setEditingCompany(prev => ({ ...prev!, name: e.target.value }))}
                className="font-bold"
              />
              <Input 
                placeholder="소재지 (예: 대구 달서구)" 
                value={editingCompany?.location || ''} 
                onChange={e => setEditingCompany(prev => ({ ...prev!, location: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input 
                  placeholder="업종" 
                  value={editingCompany?.industry || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, industry: e.target.value }))}
                />
                <Input 
                  placeholder="기업형태" 
                  value={editingCompany?.company_type || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, company_type: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase">채용 및 근무조건</label>
              <Input 
                placeholder="직무 (예: 생산설비 제어)" 
                value={editingCompany?.job_description || ''} 
                onChange={e => setEditingCompany(prev => ({ ...prev!, job_description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input 
                  placeholder="급여" 
                  value={editingCompany?.salary || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, salary: e.target.value }))}
                />
                <Input 
                  placeholder="상여" 
                  value={editingCompany?.bonus || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, bonus: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input 
                  placeholder="근무시간" 
                  value={editingCompany?.working_hours || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, working_hours: e.target.value }))}
                />
                <Input 
                  placeholder="고용형태" 
                  value={editingCompany?.employment_type || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, employment_type: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-black text-slate-400 uppercase">복리후생 및 요구역량</label>
              <Input 
                placeholder="복리후생 상세" 
                value={editingCompany?.welfare || ''} 
                onChange={e => setEditingCompany(prev => ({ ...prev!, welfare: e.target.value }))}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  placeholder="대상 전공" 
                  value={editingCompany?.required_major || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, required_major: e.target.value }))}
                />
                <Input 
                  placeholder="필수/우대 자격증" 
                  value={editingCompany?.required_certificates || ''} 
                  onChange={e => setEditingCompany(prev => ({ ...prev!, required_certificates: e.target.value }))}
                />
              </div>
              <Input 
                placeholder="기타 참고사항" 
                value={editingCompany?.etc || ''} 
                onChange={e => setEditingCompany(prev => ({ ...prev!, etc: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-black text-slate-400 uppercase">기업 특장점 (추수지도 및 학생 안내용)</label>
              <Textarea 
                placeholder="기업의 분위기, 발전 가능성 등 특장점을 기록하세요..." 
                className="min-h-[100px]"
                value={editingCompany?.strengths || ''} 
                onChange={e => setEditingCompany(prev => ({ ...prev!, strengths: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t gap-2">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>취소</Button>
            <Button onClick={handleUpsert} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 font-bold px-8">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              정보 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
