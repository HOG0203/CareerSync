'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Trash2, Save, Sparkles, Check, Info, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  saveStudentEmploymentHistory, 
  getStudentEmploymentHistory, 
  getMasterCompaniesList,
  EmploymentHistoryItem 
} from '@/app/students/actions';

interface EmploymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any | null;
  isAdmin?: boolean;
  masterCompanies?: any[];
  onSaved?: (studentId: string, updatedRecords: EmploymentHistoryItem[], primaryRecord: EmploymentHistoryItem | null) => void;
}

const BUSINESS_TYPE_OPTIONS = [
  { label: '취업 (확정)', value: '취업' },
  { label: '채용진행중', value: '채용진행중' },
  { label: '퇴사/포기', value: '퇴사/포기' },
  { label: '제외인정자', value: '제외인정자' },
  { label: '기타', value: '기타' },
];

const COMPANY_TYPE_OPTIONS = [
  { label: '대기업', value: '대기업' },
  { label: '공기업', value: '공기업' },
  { label: '공무원', value: '공무원' },
  { label: '중견기업', value: '중견기업' },
  { label: '강소기업', value: '강소기업' },
  { label: '연계교육', value: '연계교육' },
  { label: '부사관', value: '부사관' },
  { label: '중소기업', value: '중소기업' },
  { label: '기타', value: '기타' },
];

export function EmploymentHistoryModal({
  isOpen,
  onClose,
  student,
  isAdmin = false,
  masterCompanies = [],
  onSaved,
}: EmploymentHistoryModalProps) {
  const { toast } = useToast();
  const [records, setRecords] = React.useState<EmploymentHistoryItem[]>([]);
  const [primaryIndex, setPrimaryIndex] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // 등록 기업 목록 (masterCompanies prop 또는 서버 비동기 로드)
  const [companiesList, setCompaniesList] = React.useState<any[]>(masterCompanies || []);
  
  // 자동완성 활성화된 레코드 인덱스
  const [activeDropdownIndex, setActiveDropdownIndex] = React.useState<number | null>(null);

  // masterCompanies 로드 및 백업 페치
  React.useEffect(() => {
    if (masterCompanies && masterCompanies.length > 0) {
      setCompaniesList(masterCompanies);
    } else if (isOpen) {
      getMasterCompaniesList()
        .then(data => {
          if (data && data.length > 0) {
            setCompaniesList(data);
          }
        })
        .catch(err => console.error('Failed to load registered companies:', err));
    }
  }, [masterCompanies, isOpen]);

  // 모달 열릴 때 학생 데이터로부터 초기 이력 목록 생성
  React.useEffect(() => {
    if (!isOpen || !student) {
      if (!isOpen) {
        const timer = setTimeout(() => {
          if (typeof document !== 'undefined') {
            document.body.style.pointerEvents = '';
          }
        }, 150);
        return () => clearTimeout(timer);
      }
      return;
    }

    // 1. student 객체(또는 remarks)로부터 로컬 1차 파싱
    let initialList: EmploymentHistoryItem[] = [];
    if (student.remarks && typeof student.remarks === 'string' && student.remarks.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(student.remarks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialList = parsed.map((item, idx) => ({
            order: item.order || idx + 1,
            company: item.company || '',
            company_type: item.company_type || '중견기업',
            business_type: item.business_type || '취업',
            is_primary: Boolean(item.is_primary),
          }));
        }
      } catch (e) {}
    }

    // 이력이 아직 배열로 없는 경우, 기존 단일 취업처(company)로 1차 레코드 자동 구성
    if (initialList.length === 0) {
      const currentCompany = student.company || student.latest_training_company || '';
      initialList.push({
        order: 1,
        company: currentCompany,
        company_type: student.company_type || '중견기업',
        business_type: student.business_type || '취업',
        is_primary: true,
      });
    }

    // 대표 취업처 인덱스 탐색
    let primeIdx = initialList.findIndex(r => r.is_primary);
    if (primeIdx === -1) {
      primeIdx = initialList.length - 1;
      initialList[primeIdx].is_primary = true;
    }

    setRecords(initialList);
    setPrimaryIndex(primeIdx >= 0 ? primeIdx : 0);

    // 2. 서버 DB 최신 데이터 비동기 확인
    let isSubscribed = true;
    setIsLoading(true);
    getStudentEmploymentHistory(student.id)
      .then(freshHistory => {
        if (isSubscribed && freshHistory && freshHistory.length > 0) {
          setRecords(freshHistory);
          const pIdx = freshHistory.findIndex(r => r.is_primary);
          setPrimaryIndex(pIdx >= 0 ? pIdx : freshHistory.length - 1);
        }
      })
      .catch(err => {
        console.error('Failed to load fresh employment history:', err);
      })
      .finally(() => {
        if (isSubscribed) setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [student, isOpen]);

  // 새로운 취업 이력 추가 (2차, 3차...)
  const handleAddRecord = () => {
    const nextOrder = records.length + 1;
    const newRecord: EmploymentHistoryItem = {
      order: nextOrder,
      company: '',
      company_type: '대기업',
      business_type: '취업',
      is_primary: false,
    };
    const nextList = [...records, newRecord];
    setRecords(nextList);
    setPrimaryIndex(nextList.length - 1);
  };

  // 특정 이력 삭제
  const handleDeleteRecord = (index: number) => {
    if (records.length <= 1) {
      setRecords([{
        order: 1,
        company: '',
        company_type: '대기업',
        business_type: '취업',
        is_primary: true,
      }]);
      setPrimaryIndex(0);
      return;
    }

    const nextList = records
      .filter((_, i) => i !== index)
      .map((item, idx) => ({ ...item, order: idx + 1 }));

    let newPrimary = primaryIndex;
    if (primaryIndex === index) {
      newPrimary = Math.max(0, nextList.length - 1);
    } else if (primaryIndex > index) {
      newPrimary = primaryIndex - 1;
    }

    setRecords(nextList);
    setPrimaryIndex(newPrimary);
  };

  // 필드 값 변경 (취업현황, 기업구분, 취업처)
  const handleChangeField = (index: number, field: keyof EmploymentHistoryItem, value: any) => {
    const nextList = [...records];
    nextList[index] = { ...nextList[index], [field]: value };
    setRecords(nextList);
  };

  // 추천 기업 선택 시 회사명 및 기업구분(company_type) 자동 연동
  const handleSelectRecommendedCompany = (index: number, companyObj: any) => {
    const nextList = [...records];
    const target = { ...nextList[index], company: companyObj.name || '' };

    // 등록 기업에 기업구분이 정의되어 있으면 기업구분도 함께 자동 세팅
    if (companyObj.company_type && COMPANY_TYPE_OPTIONS.some(o => o.value === companyObj.company_type)) {
      target.company_type = companyObj.company_type;
    }

    nextList[index] = target;
    setRecords(nextList);
    setActiveDropdownIndex(null);

    toast({
      title: '기업 정보 자동 반영',
      description: `${companyObj.name}이 입력되었으며, 기업구분이 [${companyObj.company_type || '지정'}]으로 자동 선택되었습니다.`,
    });
  };

  // 대표 취업처 지정
  const handleSetPrimary = (index: number) => {
    setPrimaryIndex(index);
  };

  // 유사 기업 검색 매칭 함수
  const getMatchingCompanies = (query: string) => {
    if (!query || !query.trim() || !companiesList || companiesList.length === 0) return [];
    const cleanQ = query.trim().toLowerCase().replace(/[\(\)㈜\s]/g, '');
    if (!cleanQ) return [];

    return companiesList
      .filter((c: any) => {
        const name = (c.name || '').toLowerCase();
        const cleanName = name.replace(/[\(\)㈜\s]/g, '');
        return name.includes(query.trim().toLowerCase()) || cleanName.includes(cleanQ);
      })
      .slice(0, 6);
  };

  // 저장 처리
  const handleSave = async () => {
    if (!student) return;

    const validRecords = records.filter(r => (r.company || '').trim() !== '');

    if (validRecords.length === 0 && records.some(r => (r.company || '').trim() === '')) {
      const confirmClear = confirm('입력된 취업처가 없습니다. 학생의 취업 정보를 비우시겠습니까?');
      if (!confirmClear) return;
    }

    const finalRecords = (validRecords.length > 0 ? validRecords : []).map((item, idx) => ({
      ...item,
      order: idx + 1,
      is_primary: idx === primaryIndex,
    }));

    setIsSaving(true);
    try {
      const res = await saveStudentEmploymentHistory(student.id, finalRecords);
      if (res.success) {
        toast({
          title: '저장 완료',
          description: `${student.student_name} 학생의 취업 이력(${finalRecords.length}건)이 성공적으로 반영되었습니다.`,
        });

        const primeRec = finalRecords.find(r => r.is_primary) || finalRecords[finalRecords.length - 1] || null;
        onSaved?.(student.id, finalRecords, primeRec);
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: res.error || '저장 중 오류가 발생했습니다.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err?.message || '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-200">
        {/* 모달 상단 헤더 */}
        <DialogHeader className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                <Building2 className="h-5 w-5 text-blue-200" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{student?.student_name || '학생'} 취업 이력 관리</span>
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-xs font-normal">
                    {student?.major || ''} {student?.class_info ? `${student.class_info}반` : ''} {student?.student_number ? `${student.student_number}번` : ''}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-200/80 mt-1">
                  처음 취업한 곳(포기/퇴사)과 재취업처를 모두 등록하면, 중학교별 취업현황에 2건 이상으로 집계되어 실적이 극대화됩니다.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 안내 팁 배너 */}
        <div className="px-5 py-2.5 bg-sky-50 border-b border-sky-100 flex items-center gap-2 text-xs text-sky-800">
          <Sparkles className="h-4 w-4 text-sky-600 shrink-0" />
          <span>
            <strong>기업체 정보(company-info)</strong>에 등록된 회사명을 입력하면 비슷한 이름의 기업과 <strong>기업구분</strong>이 자동 추천·입력됩니다.
          </span>
        </div>

        {/* 메인 이력 목록 바디 */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          {records.map((record, index) => {
            const isPrimary = index === primaryIndex;
            const matchingCompanies = getMatchingCompanies(record.company || '');
            const isDropdownOpen = activeDropdownIndex === index && matchingCompanies.length > 0;

            return (
              <div
                key={index}
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200 bg-white",
                  isPrimary
                    ? "border-blue-400 shadow-md ring-1 ring-blue-300"
                    : "border-slate-200 hover:border-slate-300 shadow-2xs"
                )}
              >
                {/* 각 차수 헤더 바 */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "font-bold text-xs px-2.5 py-0.5",
                        index === 0
                          ? "bg-slate-700 text-white"
                          : "bg-indigo-600 text-white"
                      )}
                    >
                      {record.order}차 취업처
                    </Badge>

                    {isPrimary ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 border text-xs flex items-center gap-1 font-semibold">
                        <Check className="h-3 w-3" /> 현재·대표 취업처
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        className="text-[11px] text-slate-500 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                      >
                        [대표 취업처로 지정]
                      </button>
                    )}
                  </div>

                  {records.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRecord(index)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="이 취업 이력 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* 3대 핵심 입력 필드: 취업현황, 기업구분, 취업처(회사명) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* 1. 취업현황 */}
                  <div className="md:col-span-3">
                    <Label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                      취업현황
                    </Label>
                    <Select
                      value={record.business_type}
                      onValueChange={(val) => handleChangeField(index, 'business_type', val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-slate-50/70 border-slate-200">
                        <SelectValue placeholder="취업현황" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. 기업구분 */}
                  <div className="md:col-span-4">
                    <Label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                      기업구분
                    </Label>
                    <Select
                      value={record.company_type}
                      onValueChange={(val) => handleChangeField(index, 'company_type', val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-slate-50/70 border-slate-200">
                        <SelectValue placeholder="기업구분" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 3. 취업처 (회사명) + 유사 기업 추천 기능 */}
                  <div className="md:col-span-5 relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-[11px] font-bold text-slate-600 block">
                        취업처 (회사명)
                      </Label>
                      {record.company && matchingCompanies.length > 0 && (
                        <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          추천 {matchingCompanies.length}건
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <Input
                        type="text"
                        value={record.company || ''}
                        onChange={(e) => {
                          handleChangeField(index, 'company', e.target.value);
                          setActiveDropdownIndex(index);
                        }}
                        onFocus={() => {
                          setActiveDropdownIndex(index);
                        }}
                        onBlur={() => {
                          // 드롭다운 클릭 이벤트가 먼저 실행될 수 있도록 200ms 지연
                          setTimeout(() => {
                            setActiveDropdownIndex(null);
                          }, 200);
                        }}
                        placeholder="예: 한국철도공사, 삼성전자..."
                        className="h-9 text-xs font-semibold text-slate-900 border-slate-200 focus:ring-blue-500 pr-8"
                      />
                      <Building2 className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* 플로팅 자동완성 드롭다운 메뉴 */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-[100] bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150">
                        <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            기업 정보(company-info) 등록 기업
                          </span>
                          <span className="text-[9px] text-slate-400 font-normal">선택 시 기업구분 자동 지정</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                          {matchingCompanies.map((comp: any) => (
                            <div
                              key={comp.id || comp.name}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectRecommendedCompany(index, comp);
                              }}
                              className="px-3 py-2 cursor-pointer hover:bg-blue-50/80 transition-colors flex items-center justify-between gap-2 text-left"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {comp.name}
                                </div>
                                {comp.location && (
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-2.5 w-2.5" />
                                    <span>{comp.location}</span>
                                    {comp.industry && <span>· {comp.industry}</span>}
                                  </div>
                                )}
                              </div>
                              {comp.company_type && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] font-bold px-2 py-0.5 shrink-0 bg-blue-50 text-blue-700 border-blue-200 border"
                                >
                                  {comp.company_type}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 인라인 추천 뱃지 (빠른 클릭 칩) */}
                    {record.company && matchingCompanies.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-2">
                        <span className="text-[10px] text-slate-400 font-bold self-center">추천:</span>
                        {matchingCompanies.slice(0, 3).map((comp: any) => (
                          <button
                            key={comp.id || comp.name}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectRecommendedCompany(index, comp);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition-colors flex items-center gap-1 shadow-2xs"
                            title={`${comp.name} 선택 시 기업구분(${comp.company_type || '지정'}) 자동 세팅`}
                          >
                            <span>{comp.name}</span>
                            {comp.company_type && (
                              <span className="text-[9px] px-1 rounded bg-indigo-200/80 text-indigo-900">
                                {comp.company_type}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 이력 추가 버튼 */}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddRecord}
            className="w-full py-5 border-dashed border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 text-slate-600 hover:text-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="h-4 w-4" />
            + 추가 취업 이력 등록 ({records.length + 1}차 취업처)
          </Button>
        </div>

        {/* 모달 하단 푸터 */}
        <DialogFooter className="p-4 bg-white border-t border-slate-100 flex items-center justify-between sm:justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>총 {records.filter(r => (r.company || '').trim() !== '').length}건의 취업 이력이 중학교별 취업현황에 집계됩니다.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm flex items-center gap-1.5"
            >
              {isSaving ? (
                <>저장 중...</>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  저장하기
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
