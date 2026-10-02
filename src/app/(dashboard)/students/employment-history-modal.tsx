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
import { Building2, Plus, Trash2, Save, Sparkles, Check, Info } from 'lucide-react';
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
  { label: '채용진행중', value: '채용진행중' },
  { label: '취업 (확정)', value: '취업' },
  { label: '퇴사/포기', value: '퇴사/포기' },
  { label: '제외인정자', value: '제외인정자' },
  { label: '기타', value: '기타' },
];

const COMPANY_TYPE_OPTIONS = [
  { label: '미지정', value: '미지정' },
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
            company_type: item.company_type || '미지정',
            business_type: item.business_type || '채용진행중',
            is_primary: Boolean(item.is_primary),
          }));
        }
      } catch (e) {}
    }

    // 이력이 아직 배열로 없는 경우, 기존 단일 취업처(company)로 1차 레코드 자동 구성
    if (initialList.length === 0) {
      const currentCompany = student.company || student.latest_training_company || '';
      // 회사가 없거나 취업현황이 미설정/미취업인 경우 기본값으로 '채용진행중' 설정
      const defaultStatus = (student.company && student.business_type && student.business_type !== '미취업')
        ? student.business_type
        : '채용진행중';

      initialList.push({
        order: 1,
        company: currentCompany,
        company_type: student.company_type || '미지정',
        business_type: defaultStatus,
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
      company_type: '미지정',
      business_type: '채용진행중',
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
        company_type: '미지정',
        business_type: '채용진행중',
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
      <DialogContent 
        className="w-[95vw] sm:max-w-3xl max-h-[95vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden z-[200]"
        overlayClassName="z-[190]"
      >
        {/* 모달 상단 헤더 (현장실습 모달과 동일한 화이트 클린 헤더) */}
        <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mr-6 sm:mr-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <DialogTitle className="text-base sm:text-xl font-extrabold flex items-center gap-2 text-slate-900 truncate">
                  취업 이력 관리
                  {!isAdmin && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] shrink-0 font-bold">
                      조회 전용 모드
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                  {student?.student_name} ({student?.major} {student?.class_info}반 {student?.student_number ? `${student.student_number}번` : ''})
                </DialogDescription>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-tighter mb-0.5">취업 이력</p>
              <p className="text-lg sm:text-2xl font-black text-blue-600">{records.length}건</p>
            </div>
          </div>
        </DialogHeader>

        {/* 메인 이력 목록 바디 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50/50">
          {/* 목록 헤더 & 추가 버튼 */}
          <div className="flex items-center justify-between border-b pb-3 sm:pb-4 border-slate-200">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
              <Building2 className="h-4 w-4 text-blue-600" />
              등록된 취업 목록 ({records.length}건)
            </h3>
            {isAdmin && (
              <Button size="sm" onClick={handleAddRecord} className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-8 sm:h-9 text-xs shadow-sm">
                <Plus className="h-3.5 w-3.5 mr-1" /> 취업처 추가
              </Button>
            )}
          </div>

          {/* 안내 배너 */}
          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-blue-50/80 border border-blue-100 rounded-xl flex items-center gap-2 text-xs text-blue-900">
            <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              처음 취업한 곳(포기/퇴사)과 재취업처를 모두 등록하면, 중학교별 취업현황에 <strong>다중 실적으로 집계</strong>됩니다.
            </span>
          </div>

          {/* 취업 이력 카드 목록 */}
          <div className="space-y-4 pb-6">
            {records.length > 0 ? (
              records.map((record, index) => {
                const isPrimary = index === primaryIndex;
                const matchingCompanies = getMatchingCompanies(record.company || '');

                return (
                  <div
                    key={index}
                    className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    {/* 카드 상단 바 */}
                    <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Badge variant="outline" className="bg-white font-bold border-slate-300 text-[10px] px-1.5 h-5 shrink-0">
                          {record.order}차 취업처
                        </Badge>
                        <span className="font-bold text-slate-800 truncate text-xs sm:text-sm">
                          {record.company || '취업처 미입력'}
                        </span>
                        {isPrimary ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 border text-[10px] flex items-center gap-1 font-bold">
                            <Check className="h-3 w-3" /> 대표 취업처
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(index)}
                            className="text-[10px] text-slate-500 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                          >
                            [대표 취업처 지정]
                          </button>
                        )}
                      </div>

                      {isAdmin && records.length > 1 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRecord(index)}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="이 취업 이력 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* 카드 본문 (핵심 3개 입력 필드: 취업현황 -> 기업구분 -> 취업처(회사명)) */}
                    <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-start">
                      {/* 1. 취업현황 */}
                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">취업현황</Label>
                        <Select
                          value={record.business_type || '채용진행중'}
                          onValueChange={(val) => handleChangeField(index, 'business_type', val)}
                          disabled={!isAdmin}
                        >
                          <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                            <SelectValue placeholder="취업현황" />
                          </SelectTrigger>
                          <SelectContent className="z-[150]">
                            {BUSINESS_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 2. 기업구분 */}
                      <div className="md:col-span-4 space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">기업구분</Label>
                        <Select
                          value={record.company_type || '미지정'}
                          onValueChange={(val) => handleChangeField(index, 'company_type', val)}
                          disabled={!isAdmin}
                        >
                          <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                            <SelectValue placeholder="기업구분" />
                          </SelectTrigger>
                          <SelectContent className="z-[150]">
                            {COMPANY_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 3. 취업처 (회사명) */}
                      <div className="md:col-span-5 space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                            onChange={(e) => handleChangeField(index, 'company', e.target.value)}
                            placeholder="회사명 입력..."
                            disabled={!isAdmin}
                            className="h-8 sm:h-9 text-xs sm:text-sm focus:ring-blue-500 pr-8"
                          />
                          <Building2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {/* 인라인 추천 뱃지 (빠른 클릭 칩: 선택 시 회사명 및 기업구분 자동 지정) */}
                        {record.company && matchingCompanies.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-1.5">
                            <span className="text-[9px] text-slate-400 font-bold self-center">추천:</span>
                            {matchingCompanies.slice(0, 5).map((comp: any) => (
                              <button
                                key={comp.id || comp.name}
                                type="button"
                                onClick={() => handleSelectRecommendedCompany(index, comp)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title={`${comp.name} 선택 시 기업구분(${comp.company_type || '지정'}) 자동 세팅`}
                              >
                                <span>{comp.name}</span>
                                {comp.company_type && (
                                  <span className="text-[9px] px-1 rounded bg-blue-200/80 text-blue-900 font-medium">
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
              })
            ) : (
              <div className="py-16 sm:py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl sm:rounded-3xl">
                <p className="text-slate-400 text-xs sm:text-sm">등록된 취업 이력이 없습니다.</p>
                <p className="text-slate-300 text-[10px] sm:text-xs mt-1">상단의 '취업처 추가' 버튼을 눌러 기록을 시작하세요.</p>
              </div>
            )}
          </div>
        </div>

        {/* 모달 하단 푸터 (현장실습 모달과 동일한 화이트 클린 푸터) */}
        <DialogFooter className="p-3 sm:p-4 bg-white border-t shrink-0 flex items-center justify-between sm:justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>총 {records.filter(r => (r.company || '').trim() !== '').length}건의 취업 이력이 중학교별 취업현황에 집계됩니다.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="h-8 sm:h-9 font-bold text-xs sm:text-sm">
              창 닫기
            </Button>
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-8 sm:h-9 px-4 sm:px-5 font-bold text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? '저장 중...' : '저장'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
