'use client'

import * as React from 'react'
import { X, ChevronRight, Award, BookUser, Phone, User, Save, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { normalizeCertificates } from './utils'
import { useToast } from '@/hooks/use-toast'

export const MobileDetailModal = ({ isOpen, onClose, data, columns, onSave, onAction, masterCompanies = [] }: any) => {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 모달이 열리거나 data가 변경될 때 로컬 폼 상태 초기화
  React.useEffect(() => {
    if (isOpen && data) {
      setFormData({ ...data });
    }
  }, [isOpen, data]);

  // 자격증 등 외부 피커로 data.certificates가 갱신될 경우 로컬 상태 동기화
  React.useEffect(() => {
    if (data?.certificates) {
      setFormData(prev => ({ ...prev, certificates: data.certificates }));
    }
  }, [data?.certificates]);

  if (!data) return null;

  const studentName = data.student_name || data.name || '학생';
  const metaParts = [
    data.major,
    data.class_info ? `${data.class_info}반` : '',
    data.student_number ? `${data.student_number}번` : ''
  ].filter(Boolean).join(' ');

  const actionColumns = columns.filter((c: any) => c.type === 'action');
  const fieldColumns = columns.filter((c: any) => c.type !== 'action');

  const updateField = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 하단 [저장 완료] 버튼 클릭 시 변경된 필드만 일괄 저장
  const handleSaveAll = async () => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const changedKeys = fieldColumns
        .map((c: any) => c.key)
        .filter((key: string) => {
          const currentVal = formData[key] === undefined || formData[key] === '' ? null : formData[key];
          const originalVal = data[key] === undefined || data[key] === '' ? null : data[key];
          return currentVal !== originalVal;
        });

      if (changedKeys.length === 0) {
        onClose();
        return;
      }

      for (const key of changedKeys) {
        await onSave(data.id, key, formData[key] ?? '');
      }

      toast({
        title: '저장 완료',
        description: `${studentName} 학생 정보가 저장되었습니다.`
      });
      onClose();
    } catch (err: any) {
      console.error('모바일 상세 저장 오류:', err);
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: err?.message || '저장 중 오류가 발생했습니다.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none rounded-2xl sm:rounded-3xl shadow-2xl bg-white">
        {/* 헤더: 시스템 표준 화이트 & 파스텔 배지 스타일 */}
        <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mr-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 font-extrabold text-sm shadow-xs">
                {String(studentName)[0] || <User className="h-5 w-5" />}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                    {studentName}
                  </DialogTitle>
                  {metaParts && (
                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 font-bold px-1.5 py-0.5">
                      {metaParts}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-slate-400 text-[11px] font-medium mt-0.5 flex items-center gap-1.5 truncate">
                  <span>상세 정보 및 수정</span>
                  {data.phone_number && (
                    <>
                      <span>•</span>
                      <a href={`tel:${data.phone_number}`} className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-bold">
                        <Phone className="h-3 w-3 text-indigo-500" />
                        {data.phone_number}
                      </a>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 본문 스크롤 영역 */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/60">
          {/* 상단 퀵 액션 (현장실습, 상담일지 등) */}
          {actionColumns.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {actionColumns.map((col: any) => {
                const isFieldTraining = col.key === 'field_training_action';
                return (
                  <Button
                    key={col.key}
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full h-11 border font-bold flex items-center justify-between px-3.5 rounded-xl shadow-xs transition-all",
                      isFieldTraining
                        ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-800 hover:bg-emerald-100"
                        : "bg-indigo-50/70 border-indigo-200/80 text-indigo-800 hover:bg-indigo-100"
                    )}
                    onClick={() => {
                      onClose();
                      onAction?.(data.id, col.key);
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        isFieldTraining ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                      )}>
                        {isFieldTraining ? <Award className="h-4 w-4" /> : <BookUser className="h-4 w-4" />}
                      </div>
                      <span className="text-xs sm:text-sm font-extrabold">{col.label} 열기</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </Button>
                );
              })}
            </div>
          )}

          {/* 데이터 필드 목록 */}
          <div className="space-y-3">
            {fieldColumns.map((col: any) => {
              const val = formData[col.key] !== undefined ? formData[col.key] : (data[col.key] || '');
              const resolvedOptions = typeof col.options === 'function' ? col.options(formData) : col.options;
              const isCompanyField = col.key === 'company';
              const companySearch = isCompanyField ? String(val ?? '').trim().toLowerCase() : '';
              const matchingCompanies = isCompanyField && masterCompanies && masterCompanies.length > 0
                ? masterCompanies.filter((c: any) => (c.name || '').toLowerCase().includes(companySearch)).slice(0, 6)
                : [];

              return (
                <div key={col.key} className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs">
                  <label className="text-xs font-bold text-slate-600 block">{col.label}</label>

                  {col.readOnly ? (
                    <div className="text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 min-h-10 flex items-center justify-between">
                      {col.key === 'phone_number' && val ? (
                        <a href={`tel:${val}`} className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline font-bold">
                          <span>{val}</span>
                          <Phone className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        </a>
                      ) : (
                        <span>{val || '-'}</span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">읽기 전용</span>
                    </div>
                  ) : col.type === 'multi-select' ? (
                    <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-white min-h-10 items-center">
                      {normalizeCertificates(val).map((cert, i) => (
                        <Badge key={i} variant="secondary" className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5">
                          {cert}
                        </Badge>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 ml-auto text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-2 rounded-md"
                        onClick={() => onSave(data.id, col.key, 'OPEN_PICKER')}
                      >
                        선택 / 수정
                      </Button>
                    </div>
                  ) : col.type === 'select' ? (
                    (() => {
                      const isInOptions = resolvedOptions?.some((o: any) => o.value === val);
                      const isOtherTrigger = val === '기타(직접입력)';
                      const isCustom = val && !isInOptions;
                      if (isOtherTrigger || isCustom) {
                        return (
                          <div className="relative">
                            <Input
                              autoFocus
                              value={isOtherTrigger ? '' : val || ''}
                              onChange={(e) => updateField(col.key, e.target.value)}
                              className="h-10 w-full bg-white pr-10 font-medium text-xs sm:text-sm border-slate-200"
                              placeholder="직접 입력..."
                            />
                            <button
                              type="button"
                              onClick={() => updateField(col.key, '')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <Select
                          value={isInOptions ? val : ''}
                          onValueChange={(v) => {
                            if (v === '기타(직접입력)') updateField(col.key, '기타(직접입력)');
                            else if (v === 'CLEARED') updateField(col.key, '');
                            else updateField(col.key, v);
                          }}
                        >
                          <SelectTrigger className="h-10 w-full bg-white border-slate-200 text-xs sm:text-sm">
                            <SelectValue placeholder="선택하세요..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CLEARED" className="text-rose-500 font-bold text-xs sm:text-sm">
                              선택 취소 (비우기)
                            </SelectItem>
                            {resolvedOptions?.map((o: any) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs sm:text-sm">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()
                  ) : col.type === 'date' ? (
                    <div className="flex gap-1.5">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-xs sm:text-sm h-10 font-medium border-slate-200 bg-white">
                            {val || '날짜 선택...'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={val ? new Date(val) : undefined}
                            onSelect={(date) => date && updateField(col.key, format(date, 'yyyy-MM-dd'))}
                            locale={ko}
                          />
                        </PopoverContent>
                      </Popover>
                      {val && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-slate-400 hover:text-rose-500 border-slate-200"
                          onClick={() => updateField(col.key, '')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Input
                          value={val || ''}
                          onChange={(e) => updateField(col.key, e.target.value)}
                          placeholder={isCompanyField ? "회사명 입력..." : ""}
                          className="h-10 w-full bg-white pr-10 font-medium text-xs sm:text-sm border-slate-200"
                        />
                        {val && (
                          <button
                            type="button"
                            onClick={() => updateField(col.key, '')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {isCompanyField && matchingCompanies.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-400 font-bold mr-0.5">추천:</span>
                          {matchingCompanies.map((comp: any) => (
                            <button
                              key={comp.id || comp.name}
                              type="button"
                              onClick={() => {
                                updateField(col.key, comp.name);
                                if (comp.company_type && formData.company_type !== comp.company_type) {
                                  updateField('company_type', comp.company_type);
                                }
                              }}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                            >
                              {comp.name} {comp.company_type ? `(${comp.company_type})` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터: 취소 & 저장 완료 버튼 (시스템 표준 폼 푸터 스타일) */}
        <DialogFooter className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-row gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 h-11 font-bold text-sm rounded-xl shadow-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={isSubmitting}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-11 font-bold text-sm rounded-xl shadow-md shadow-indigo-100 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                저장 완료
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
