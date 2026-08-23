'use client';

import * as React from 'react';
import { FullStudentEvaluation, RecordAuditMeta, evaluateContestList } from '@/lib/certification-calculator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { deleteStudentEvaluationItemAction } from './actions';
import { Printer, Edit3, Award, CheckSquare, Square, Info, Trash2, Lock, User, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EvidenceStructuredItem {
  text: string;
  category?: 'contest' | 'arts_sports' | 'industry_edu' | 'career_course' | 'major_club' | 'field_training' | 'skills_contest' | 'apprenticeship' | 'employed_early';
  subKeyOrId?: string;
  created_by?: RecordAuditMeta;
}

interface EvaluationSheetModalProps {
  evaluation: FullStudentEvaluation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditClick?: () => void;
  canEdit?: boolean;
  currentUserProfile?: any;
  isAdmin?: boolean;
  onDataMutated?: () => void;
}

export function EvaluationSheetModal({
  evaluation,
  open,
  onOpenChange,
  onEditClick,
  canEdit = false,
  currentUserProfile,
  isAdmin = false,
  onDataMutated,
}: EvaluationSheetModalProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  const [activeEvidence, setActiveEvidence] = React.useState<{
    title: string;
    sourceLabel?: string;
    value?: React.ReactNode | string[];
    formula?: string;
    details?: string[];
    structuredItems?: EvidenceStructuredItem[];
  } | null>(null);

  const [mobileViewMode, setMobileViewMode] = React.useState<'cards' | 'table'>('cards');

  if (!evaluation) return null;

  const d = evaluation.details;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-evaluation-sheet');
    if (!printContent) {
      window.print();
      return;
    }

    const oldIframe = document.getElementById('print-eval-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'print-eval-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>옥저인재 인증제 평가표 - ${evaluation.studentName}</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 12mm 10mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .print\\:hidden, button, [role="tooltip"] {
              display: none !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table {
              page-break-inside: auto;
              break-inside: auto;
              width: 100% !important;
              border-collapse: collapse !important;
            }
            th, td {
              border-color: #94a3b8 !important;
            }
          </style>
        </head>
        <body class="bg-white text-slate-900">
          <div style="max-width: 960px; margin: 0 auto; padding: 10px 0;">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 2000);
    }, 400);
  };

  const handleDeleteItem = async (
    category: 'contest' | 'arts_sports' | 'industry_edu' | 'career_course' | 'major_club' | 'field_training' | 'skills_contest' | 'apprenticeship' | 'employed_early' | 'all',
    subKeyOrId?: string,
    itemTitle?: string
  ) => {
    const confirmMsg = category === 'all'
      ? `정말로 [${evaluation.studentName}] 학생의 모든 인증제 평가 데이터를 초기화하시겠습니까?`
      : `[${itemTitle || '해당 실적'}] 항목을 삭제하시겠습니까?\n(삭제 시 점수가 자동으로 재계산됩니다)`;

    if (!window.confirm(confirmMsg)) return;

    const opKey = `${category}_${subKeyOrId || 'all'}`;
    setIsDeleting(opKey);

    try {
      const res = await deleteStudentEvaluationItemAction(evaluation.studentId, category, subKeyOrId);
      if (res.success) {
        toast({
          title: '항목 삭제 완료',
          description: '실적 항목이 안전하게 삭제되었으며 점수가 재산출되었습니다.',
        });
        if (onDataMutated) onDataMutated();
      } else {
        toast({
          title: '삭제 실패',
          description: res.error || '항목 삭제 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '오류 발생',
        description: err.message || '서버 통신 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const getRankBadgeClass = (rank: string) => {
    switch (rank) {
      case 'S': return 'bg-amber-500 text-white border-amber-600';
      case 'A': return 'bg-blue-600 text-white border-blue-700';
      case 'B': return 'bg-emerald-600 text-white border-emerald-700';
      case 'C': return 'bg-slate-600 text-white border-slate-700';
      default: return 'bg-rose-500 text-white border-rose-600';
    }
  };

  const CheckItem = ({ 
    checked, 
    label, 
    scoreText 
  }: { 
    checked: boolean; 
    label: string; 
    scoreText?: string; 
  }) => (
    <div className={cn(
      "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors mr-1 shrink-0 whitespace-nowrap",
      checked 
        ? "bg-indigo-50/90 text-indigo-900 font-bold border border-indigo-200" 
        : "text-slate-600 opacity-80"
    )}>
      {checked ? (
        <CheckSquare className="h-3.5 w-3.5 text-indigo-600 shrink-0 inline" />
      ) : (
        <Square className="h-3.5 w-3.5 text-slate-400 shrink-0 inline" />
      )}
      <span>{label}</span>
      {scoreText && <span className="text-[10px] text-indigo-700 font-extrabold ml-0.5">{scoreText}</span>}
    </div>
  );

  /**
   * 요소명 우측에 붙는 산출근거 호버 팝업 트리거 (모바일 탭 클릭 시 상세 모달 오픈)
   */
  const EvidenceTooltip = ({
    title,
    sourceLabel,
    value,
    formula,
    details,
    structuredItems,
  }: {
    title: string;
    sourceLabel?: string;
    value?: React.ReactNode | string[];
    formula?: string;
    details?: string[];
    structuredItems?: EvidenceStructuredItem[];
  }) => (
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveEvidence({
              title,
              sourceLabel,
              value,
              formula,
              details,
              structuredItems,
            });
          }}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/80 text-[10px] font-bold transition-all ml-1.5 print:hidden cursor-pointer shadow-2xs group shrink-0"
        >
          <Info className="h-3 w-3 text-indigo-600 group-hover:text-white" />
          <span className="font-extrabold text-[9px]">산출근거</span>
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        align="center" 
        sideOffset={6}
        className="hidden sm:block max-w-xs sm:max-w-md p-3.5 bg-slate-900 text-white border border-slate-700 shadow-2xl rounded-xl text-xs z-[99999]"
      >
        <div className="flex flex-col gap-2 text-left">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 gap-2">
            <span className="font-extrabold text-indigo-300 text-xs flex items-center gap-1.5">
              <span>📌</span>
              <span>{title} 산출 근거</span>
            </span>
            {sourceLabel && (
              <span className="text-[9px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                {sourceLabel}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] leading-snug">
              <span className="text-slate-400 mr-1.5 block text-[10px] font-medium mb-1">실제 입력 데이터:</span>
              <div className="font-medium text-slate-100 bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-1.5">
                {structuredItems && structuredItems.length > 0 ? (
                  structuredItems.map((item, i) => {
                    const itemCreator = item.created_by;
                    const canDeleteItem = isAdmin || (currentUserProfile?.id && itemCreator?.userId === currentUserProfile.id);
                    const opKey = `${item.category}_${item.subKeyOrId}`;

                    return (
                      <div key={i} className="flex items-center justify-between gap-2 bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                        <div className="flex items-start gap-1.5 min-w-0 flex-1">
                          <span className="text-indigo-400 font-bold shrink-0">•</span>
                          <div className="text-[11px] leading-tight break-words">
                            <span>{item.text}</span>
                            {itemCreator?.userName && (
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                ✍️ 등록자: {itemCreator.userName}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.category && item.subKeyOrId && (
                          <div className="shrink-0">
                            {canDeleteItem ? (
                              <button
                                type="button"
                                disabled={isDeleting === opKey}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item.category!, item.subKeyOrId, item.text);
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 hover:text-rose-100 hover:bg-rose-900/60 rounded border border-rose-800/50 cursor-pointer transition-colors"
                                title="이 실적 삭제 (본인/관리자 권한)"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>삭제</span>
                              </button>
                            ) : itemCreator?.userName ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500" title="작성자 및 관리자만 삭제 가능">
                                <Lock className="h-2.5 w-2.5" />
                                <span>잠금</span>
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : details && details.length > 0 ? (
                  details.map((itemText, i) => (
                    <div key={i} className="flex items-start gap-1.5 py-0.5">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span className="leading-tight font-medium text-slate-100">{itemText}</span>
                    </div>
                  ))
                ) : Array.isArray(value) && value.length > 0 ? (
                  value.map((v, i) => (
                    <div key={i} className="flex items-start gap-1.5 py-0.5">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span className="leading-tight font-medium text-slate-100">{v}</span>
                    </div>
                  ))
                ) : typeof value === 'string' && value.includes('\n') ? (
                  value.split('\n').map((line, i) => (
                    <div key={i} className="flex items-start gap-1.5 py-0.5">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span className="leading-tight font-medium text-slate-100">{line}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-300">{value || '취득 실적 없음'}</div>
                )}
              </div>
            </div>

            {formula && (
              <div className="text-[10px] text-emerald-300 bg-slate-950/80 p-2 rounded-lg font-mono border border-emerald-500/20 leading-relaxed">
                🧮 {formula}
              </div>
            )}

            {details && details.length > 0 && (
              <div className="text-[10px] text-slate-300 pt-1 border-t border-slate-800">
                <span className="text-slate-400 block mb-0.5 text-[9px]">취득 자격증 목록:</span>
                <div className="space-y-0.5 pl-1">
                  {details.map((d, i) => (
                    <div key={i} className="text-slate-200">• {d}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] p-0 max-h-[92vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-slate-100 bg-white print:max-w-none print:w-full print:max-h-none print:h-auto print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0 print:static print:transform-none">
        {/* 상단 툴바 (인쇄 시 숨김) */}
        <DialogHeader className="p-3.5 sm:p-5 bg-white border-b border-slate-100 flex flex-row items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 mr-2">
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 text-indigo-600 shadow-2xs">
              <Award className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="flex flex-col text-left min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-sm sm:text-lg font-black text-slate-900 truncate">
                  옥저인재 인증제 평가표
                </DialogTitle>
                <Badge className={cn("text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow-2xs", getRankBadgeClass(evaluation.rank))}>
                  {evaluation.rank}랭크 ({evaluation.totalScore}점)
                </Badge>
              </div>
              <p className="text-slate-500 text-[11px] sm:text-xs font-bold mt-0.5 truncate">
                {evaluation.studentName} • {evaluation.major} {evaluation.classInfo} {evaluation.studentNumber}번
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {canEdit && onEditClick && (
              <Button
                type="button"
                variant="outline"
                onClick={onEditClick}
                className="h-9 px-3.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200 font-extrabold rounded-xl gap-1.5 shadow-xs transition-all"
              >
                <Edit3 className="h-3.5 w-3.5 text-indigo-600" />
                <span>데이터 수동 수정</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="h-9 px-3.5 text-xs bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900 font-extrabold rounded-xl gap-1.5 border-slate-300 shadow-xs transition-all"
            >
              <Printer className="h-3.5 w-3.5 text-slate-700" />
              <span>평가표 인쇄 / PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* 모바일 뷰 전환 탭 (화면폭 < 768px 전용) */}
        <div className="block md:hidden px-3.5 pt-2.5 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="grid grid-cols-2 bg-slate-200/80 p-1 rounded-xl gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMobileViewMode('cards')}
              className={cn(
                "py-1.5 text-xs font-bold rounded-lg transition-all text-center",
                mobileViewMode === 'cards' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
              )}
            >
              📱 모바일 요약 카드
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('table')}
              className={cn(
                "py-1.5 text-xs font-bold rounded-lg transition-all text-center",
                mobileViewMode === 'table' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
              )}
            >
              📄 공식 서식(A4) 뷰
            </button>
          </div>
        </div>

        {/* 인쇄 및 스크롤 본문 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50 print:p-0 print:bg-white print:overflow-visible print:max-h-none print:h-auto pb-16 md:pb-6">
          
          {/* ========================================================================= */}
          {/* [모바일 전용] 4대 영역 요약 카드 뷰 (mobileViewMode === 'cards') */}
          {/* ========================================================================= */}
          {mobileViewMode === 'cards' && (
            <div className="block md:hidden space-y-3.5 print:hidden">
              
              {/* 상단 학생 요약 배너 */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 block">종합 판정 결과</span>
                    <span className="text-lg font-black text-indigo-700">{evaluation.totalScore}점 / 100점</span>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-black inline-block",
                      evaluation.isCertified ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                    )}>
                      {evaluation.isCertified ? "✨ 인증 대상 (70점↑)" : "인증 미달"}
                    </span>
                  </div>
                </div>

                {/* 4대 영역 점수 미니 바 */}
                <div className="grid grid-cols-4 gap-1.5 text-center pt-1 border-t border-slate-100">
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/70">
                    <span className="text-[9px] text-slate-400 block font-medium">직업공통</span>
                    <span className="font-extrabold text-slate-800 text-xs">{evaluation.vocationalCommonScore}점</span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/70">
                    <span className="text-[9px] text-slate-400 block font-medium">전공능력</span>
                    <span className="font-extrabold text-slate-800 text-xs">{evaluation.majorScore}점</span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/70">
                    <span className="text-[9px] text-slate-400 block font-medium">취업역량</span>
                    <span className="font-extrabold text-slate-800 text-xs">{evaluation.employmentScore}점</span>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/70">
                    <span className="text-[9px] text-slate-400 block font-medium">인성능력</span>
                    <span className="font-extrabold text-slate-800 text-xs">{evaluation.characterScore}점</span>
                  </div>
                </div>
              </div>

              {/* 1. 직업공통능력 (25점) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="bg-indigo-50/80 px-3.5 py-2.5 flex items-center justify-between border-b border-indigo-100">
                  <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>📘</span> 1. 직업공통능력 (최대 25점)
                  </span>
                  <Badge className="bg-indigo-600 text-white font-extrabold text-xs px-2 py-0.5">
                    {evaluation.vocationalCommonScore}점
                  </Badge>
                </div>
                <div className="p-3 space-y-2.5 divide-y divide-slate-100">
                  {/* 직업공통능력평가 (3/2/1학년 및 모의평가) */}
                  <div className="pt-2 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">직업공통능력평가 (총 17점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">
                        {(d.vocal3Grade?.score || 0) + (d.vocal2Grade?.score || 0) + (d.vocal1Grade?.score || 0) + (d.vocalMockGrade?.score || 0)}점
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div>3학년: <strong>{d.vocal3Grade?.displayText || '0점'}</strong> ({d.vocal3Grade?.score || 0}점)</div>
                      <div>2학년: <strong>{d.vocal2Grade?.displayText || '0점'}</strong> ({d.vocal2Grade?.score || 0}점)</div>
                      <div>1학년: <strong>{d.vocal1Grade?.displayText || '0점'}</strong> ({d.vocal1Grade?.score || 0}점)</div>
                      <div>모의평가: <strong>{d.vocalMockGrade?.displayText || '0점'}</strong> ({d.vocalMockGrade?.score || 0}점)</div>
                    </div>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="직업공통능력평가 학년별 등급 합계"
                        sourceLabel="직기초 평가"
                        details={[
                          `3학년: ${d.vocal3Grade?.displayText || '0점'} (${d.vocal3Grade?.score || 0}점)`,
                          `2학년: ${d.vocal2Grade?.displayText || '0점'} (${d.vocal2Grade?.score || 0}점)`,
                          `1학년: ${d.vocal1Grade?.displayText || '0점'} (${d.vocal1Grade?.score || 0}점)`,
                          `모의평가: ${d.vocalMockGrade?.displayText || '0점'} (${d.vocalMockGrade?.score || 0}점)`,
                        ]}
                        formula={`국어/영어/수리/문제해결 4개 영역 등급 합계 기반 차등 배점 (3학년 7점, 2학년 5점, 1학년 3점, 모의 2점)`}
                      />
                    </div>
                  </div>

                  {/* 컴퓨터관련자격 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">컴퓨터관련자격 (3점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.certComputer.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.certComputer.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="컴퓨터 관련 자격"
                        sourceLabel="자격증 DB"
                        details={d.certComputer.details?.certs}
                        formula={d.certComputer.details?.certs?.length >= 2 ? '2개 이상 취득 ➔ 3.0점 만점' : d.certComputer.details?.certs?.length === 1 ? '1개 취득 ➔ 2.0점' : '0점'}
                      />
                    </div>
                  </div>

                  {/* 정보기술자격 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">정보기술자격 (2점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.certInfoTech.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.certInfoTech.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="정보기술자격 (ITQ / PCT / DIAT·디지털정보활용능력)"
                        sourceLabel="자격증 DB"
                        details={d.certInfoTech.details?.certs}
                        formula={`1개당 0.5점: ${d.certInfoTech.details?.count || 0}개 취득 × 0.5 = ${d.certInfoTech.score}점 (최대 2.0점)`}
                      />
                    </div>
                  </div>

                  {/* 한국사능력검정 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">한국사능력검정 (3점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.certHistory.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.certHistory.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="한국사능력검정"
                        sourceLabel="자격증 DB"
                        value={d.certHistory.score > 0 ? d.certHistory.displayText : '한국사 자격 미취득 (0점)'}
                        formula={d.certHistory.score > 0 ? `${d.certHistory.displayText} ➔ ${d.certHistory.score}점` : '해당 없음'}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 전공능력 (25점) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="bg-indigo-50/80 px-3.5 py-2.5 flex items-center justify-between border-b border-indigo-100">
                  <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>🎓</span> 2. 전공능력 (최대 25점)
                  </span>
                  <Badge className="bg-indigo-600 text-white font-extrabold text-xs px-2 py-0.5">
                    {evaluation.majorScore}점
                  </Badge>
                </div>
                <div className="p-3 space-y-2.5 divide-y divide-slate-100">
                  {/* 전공기초자격 */}
                  <div className="pt-2 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">전공기초자격 (20점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.certMajorBasic.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.certMajorBasic.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="전공기초 자격증"
                        sourceLabel="자격증 DB"
                        details={d.certMajorBasic.details?.certs}
                        formula={d.certMajorBasic.details?.certs?.length >= 3 ? '3개 이상 취득 ➔ 20.0점 (만점)' : d.certMajorBasic.details?.certs?.length === 2 ? '2개 취득 ➔ 15.0점' : d.certMajorBasic.details?.certs?.length === 1 ? '1개 취득 ➔ 10.0점' : '0점'}
                      />
                    </div>
                  </div>

                  {/* 전공심화자격 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">전공심화자격 (5점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.certMajorAdvanced.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.certMajorAdvanced.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="전공심화 추가 자격증"
                        sourceLabel="자격증 DB"
                        details={d.certMajorAdvanced.details?.certs}
                        formula={d.certMajorAdvanced.details?.count >= 5 ? '5개 이상 취득 ➔ 5.0점 (만점)' : d.certMajorAdvanced.details?.count === 4 ? '4개 취득 ➔ 3.0점' : '0점'}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. 취업역량강화 (25점) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="bg-indigo-50/80 px-3.5 py-2.5 flex items-center justify-between border-b border-indigo-100">
                  <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>💼</span> 3. 취업역량강화 (최대 25점)
                  </span>
                  <Badge className="bg-indigo-600 text-white font-extrabold text-xs px-2 py-0.5">
                    {evaluation.employmentScore}점
                  </Badge>
                </div>
                <div className="p-3 space-y-2.5 divide-y divide-slate-100">
                  {/* 산학협력부 주관 교육 */}
                  <div className="pt-2 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">산학협력부 주관 교육 (10점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.industryEdu.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.industryEdu.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="산학협력부 주관 교육 및 설명회 이수 실적"
                        sourceLabel="산학교육 이수"
                        structuredItems={(evaluation.rawEvaluationData?.employment_details?.industry_edu_list || []).map((item, idx) => ({
                          text: `${item.title || '산학교육'} (${item.dateOrTerm || '일자 미입력'})`,
                          category: 'industry_edu' as const,
                          subKeyOrId: item.id || String(idx),
                          created_by: item.created_by,
                        }))}
                        formula={`${(evaluation.rawEvaluationData?.employment_details?.industry_edu_list || []).length}건 이수 ➔ ${d.industryEdu.score}점 (최대 10.0점)`}
                      />
                    </div>
                  </div>

                  {/* 취업역량강화반 / 동아리 / 기능경기대회 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">취업진로코스·동아리·기능대회 (10점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.careerCourse.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.careerCourse.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="취업진로코스 / 전공동아리 / 기능대회"
                        sourceLabel="취업역량"
                        structuredItems={[
                          ...Object.entries(evaluation.rawEvaluationData?.employment_details?.career_courses || {}).map(([t, c]) => ({
                            text: `취업코스 [${t}학기]: ${c}`,
                            category: 'career_course' as const,
                            subKeyOrId: t,
                            created_by: evaluation.rawEvaluationData?.employment_details?.career_courses_meta?.[t],
                          })),
                          ...Object.entries(evaluation.rawEvaluationData?.employment_details?.major_clubs || {}).map(([g, c]) => ({
                            text: `심화동아리 [${g}학년]: ${c}`,
                            category: 'major_club' as const,
                            subKeyOrId: g,
                            created_by: evaluation.rawEvaluationData?.employment_details?.major_clubs_meta?.[g],
                          })),
                          ...(evaluation.rawEvaluationData?.employment_details?.skills_contest?.name ? [{
                            text: `기능대회: ${evaluation.rawEvaluationData.employment_details.skills_contest.name} (${evaluation.rawEvaluationData.employment_details.skills_contest.level === 'national' ? '전국 5점' : '지방 2점'})`,
                            category: 'skills_contest' as const,
                            subKeyOrId: 'main',
                            created_by: evaluation.rawEvaluationData.employment_details.skills_contest.created_by,
                          }] : []),
                        ]}
                        formula={d.careerCourse.displayText}
                      />
                    </div>
                  </div>

                  {/* 현장실습 및 도제/조기취업 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">현장실습 및 도제·조기취업 (5점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.fieldTraining.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.fieldTraining.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="현장실습 / 도제 / 조기취업"
                        sourceLabel="현장실습"
                        structuredItems={[
                          ...(evaluation.rawEvaluationData?.employment_details?.field_training?.company ? [{
                            text: `현장실습: ${evaluation.rawEvaluationData.employment_details.field_training.company} 이수(5점)`,
                            category: 'field_training' as const,
                            subKeyOrId: 'main',
                            created_by: evaluation.rawEvaluationData.employment_details.field_training.created_by,
                          }] : []),
                          ...Object.entries(evaluation.rawEvaluationData?.employment_details?.apprenticeship || {}).map(([t, c]) => ({
                            text: `도제 OJT [${t}]: ${c}`,
                            category: 'apprenticeship' as const,
                            subKeyOrId: t,
                            created_by: evaluation.rawEvaluationData?.employment_details?.apprenticeship_meta?.[t],
                          })),
                          ...(evaluation.rawEvaluationData?.employment_details?.employed_early?.company ? [{
                            text: `조기취업: ${evaluation.rawEvaluationData.employment_details.employed_early.company} (5점)`,
                            category: 'employed_early' as const,
                            subKeyOrId: 'main',
                            created_by: evaluation.rawEvaluationData.employment_details.employed_early.created_by,
                          }] : []),
                        ]}
                        formula={`최대 5.0점 캡 적용 ➔ ${d.fieldTraining.score}점`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. 인성능력 (25점) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="bg-indigo-50/80 px-3.5 py-2.5 flex items-center justify-between border-b border-indigo-100">
                  <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>❤️</span> 4. 인성능력 (최대 25점)
                  </span>
                  <Badge className="bg-indigo-600 text-white font-extrabold text-xs px-2 py-0.5">
                    {evaluation.characterScore}점
                  </Badge>
                </div>
                <div className="p-3 space-y-2.5 divide-y divide-slate-100">
                  {/* 출결상황 */}
                  <div className="pt-2 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">출결상황 (10점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.attendance.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.attendance.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="출결상황 산출"
                        sourceLabel="나이스 출결"
                        value={[
                          `미인정 결석: ${evaluation.attendanceSummary?.absentUnexcused || 0}회`,
                          `미인정 지각: ${evaluation.attendanceSummary?.lateUnexcused || 0}회`,
                          `미인정 조퇴: ${evaluation.attendanceSummary?.earlyUnexcused || 0}회`,
                          `미인정 결과: ${evaluation.attendanceSummary?.outUnexcused || 0}회`
                        ]}
                        formula={`감점 수식: 10점 - (결석 ${evaluation.attendanceSummary?.absentUnexcused || 0} × 1점) - (기타미인정 ${(evaluation.attendanceSummary?.lateUnexcused || 0) + (evaluation.attendanceSummary?.earlyUnexcused || 0) + (evaluation.attendanceSummary?.outUnexcused || 0)} × 0.5점) = ${d.attendance.score}점`}
                      />
                    </div>
                  </div>

                  {/* 봉사활동 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">봉사활동 (5점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.volunteer.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.volunteer.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="봉사활동 점수 산출"
                        sourceLabel="나이스 봉사활동"
                        value={[
                          `교내 봉사활동: ${evaluation.rawEvaluationData?.volunteer_school_hours || 0}시간`,
                          `교외 봉사활동: ${evaluation.rawEvaluationData?.volunteer_outside_hours || 0}시간`,
                          `총 봉사활동 인정: ${Number(evaluation.rawEvaluationData?.volunteer_school_hours || 0) + Number(evaluation.rawEvaluationData?.volunteer_outside_hours || 0)}시간`
                        ]}
                        formula={`(교내 ${evaluation.rawEvaluationData?.volunteer_school_hours || 0}h × 0.025) + (교외 ${evaluation.rawEvaluationData?.volunteer_outside_hours || 0}h × 0.05) = ${Math.round(((Number(evaluation.rawEvaluationData?.volunteer_school_hours || 0) * 0.025) + (Number(evaluation.rawEvaluationData?.volunteer_outside_hours || 0) * 0.05)) * 10) / 10}점 (상한 5.0점) ➔ ${d.volunteer.score}점`}
                      />
                    </div>
                  </div>

                  {/* 운동부 및 관악부 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">운동부 및 관악부 (5점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.artsSports.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.artsSports.displayText}</p>
                    <div className="pt-0.5">
                      <EvidenceTooltip
                        title="운동부 및 관악부 참여 실적"
                        sourceLabel="예체능 활동"
                        structuredItems={Object.entries(evaluation.rawEvaluationData?.arts_contest_details?.arts_sports || {}).map(([term, deptName]) => ({
                          text: `${term}학기: ${deptName}`,
                          category: 'arts_sports' as const,
                          subKeyOrId: term,
                        }))}
                        formula={`참여 학기 수에 따른 배점 (최대 5.0점)`}
                      />
                    </div>
                  </div>

                  {/* 교내외 대회 */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">교내외 대회 참가 (5점)</span>
                      <span className="text-xs font-extrabold text-indigo-600">{d.schoolContests.score}점</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{d.schoolContests.displayText}</p>
                    <div className="pt-0.5">
                      {(() => {
                        const contestList = evaluation.rawEvaluationData?.arts_contest_details?.contest_list || [];
                        const contestEval = evaluateContestList(contestList);
                        return (
                          <EvidenceTooltip
                            title="교내외 대회 실적"
                            sourceLabel="대회/수상 실적"
                            structuredItems={contestEval.itemsWithStatus.map(c => {
                              const typeLabel = c.type === 'award' ? '입상' : '참가';
                              const scoreBadge = c.isSuperseded 
                                ? '입상 우선 적용(중복 0점)' 
                                : (c.type === 'award' ? '1점' : '0.5점');
                              const awardDetail = c.award && c.award !== '입상' && c.award !== '참가' ? `${c.award}, ${scoreBadge}` : scoreBadge;
                              const catLabel = c.category ? `[${c.category}] ` : '';
                              const dateLabel = c.dateOrTerm ? ` [${c.dateOrTerm}]` : '';

                              return {
                                text: `${catLabel}${typeLabel} - ${c.title} (${awardDetail})${dateLabel}`,
                                category: 'contest' as const,
                                subKeyOrId: c.id,
                                created_by: c.created_by,
                              };
                            })}
                            formula={`(입상 ${contestEval.effectiveAwardCount}건 × 1점) + (참가 ${contestEval.effectivePartCount}건 × 0.5점) = ${d.schoolContests.score}점 (최대 5.0점)`}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 등급 안내 5열 칩 */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 block">취득 점수별 등급 기준</span>
                <div className="grid grid-cols-5 gap-1 text-center text-xs">
                  <div className={cn("p-1.5 rounded-lg border", evaluation.rank === 'S' ? "bg-amber-100/90 border-amber-400 font-black text-amber-900" : "bg-slate-50 border-slate-200 text-slate-600")}>
                    <span className="block font-black text-amber-700 text-[11px]">S</span>
                    <span className="text-[9px]">81~100</span>
                  </div>
                  <div className={cn("p-1.5 rounded-lg border", evaluation.rank === 'A' ? "bg-blue-100/90 border-blue-400 font-black text-blue-900" : "bg-slate-50 border-slate-200 text-slate-600")}>
                    <span className="block font-black text-blue-700 text-[11px]">A</span>
                    <span className="text-[9px]">61~80</span>
                  </div>
                  <div className={cn("p-1.5 rounded-lg border", evaluation.rank === 'B' ? "bg-emerald-100/90 border-emerald-400 font-black text-emerald-900" : "bg-slate-50 border-slate-200 text-slate-600")}>
                    <span className="block font-black text-emerald-700 text-[11px]">B</span>
                    <span className="text-[9px]">41~60</span>
                  </div>
                  <div className={cn("p-1.5 rounded-lg border", evaluation.rank === 'C' ? "bg-slate-200 border-slate-400 font-black text-slate-900" : "bg-slate-50 border-slate-200 text-slate-600")}>
                    <span className="block font-black text-slate-700 text-[11px]">C</span>
                    <span className="text-[9px]">21~40</span>
                  </div>
                  <div className={cn("p-1.5 rounded-lg border", evaluation.rank === 'D' ? "bg-rose-100/90 border-rose-400 font-black text-rose-900" : "bg-slate-50 border-slate-200 text-slate-600")}>
                    <span className="block font-black text-rose-700 text-[11px]">D</span>
                    <span className="text-[9px]">20이하</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* [공식 서식 원본 테이블] (데스크톱 및 인쇄 시 100% 표시 / 모바일 table 모드) */}
          {/* ========================================================================= */}
          <div className={cn(
            "max-w-[960px] mx-auto bg-white p-4 sm:p-7 rounded-xl border border-slate-200/90 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-full text-slate-900",
            mobileViewMode === 'cards' ? "hidden md:block print:block" : "block"
          )} id="printable-evaluation-sheet">
            
            {/* 타이틀 및 헤더 */}
            <div className="text-center pb-4 mb-4 border-b-2 border-slate-900">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mb-1">
                옥저인재 인증제 평가표
              </h1>
              <p className="text-xs text-slate-500 font-medium">대구공업고등학교 옥저인재 인증 심사 평가표</p>
            </div>

            {/* 학생 인적사항 및 평가 결과 요약표 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-100/90 rounded-lg border border-slate-300 text-xs mb-3">
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">학과 / 학반</span>
                <span className="font-bold text-slate-900">{evaluation.major} ({evaluation.classInfo})</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">학번 / 성명</span>
                <span className="font-bold text-slate-900">{evaluation.studentNumber}번 {evaluation.studentName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">종합 취득 점수</span>
                <span className="font-extrabold text-indigo-700 text-sm">{evaluation.totalScore}점 / 100점</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">인증 판정 결과</span>
                <span className={cn(
                  "font-bold text-xs px-2 py-0.5 rounded-md inline-block mt-0.5",
                  evaluation.isCertified ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                )}>
                  {evaluation.isCertified ? "✨ 옥저인재 인증 대상" : "미달 (70점 미만)"}
                </span>
              </div>
            </div>

            {/* 마우스 호버 유도 안내 바 (화면 전용) */}
            <div className="flex items-center gap-2 p-2.5 px-3.5 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/60 rounded-lg border border-indigo-200/80 text-xs text-indigo-950 mb-3.5 print:hidden shadow-2xs">
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
              </span>
              <span className="font-bold text-[11px] leading-relaxed">
                💡 각 항목의 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[9px] font-black mx-1"><Info className="h-2.5 w-2.5" /> 산출근거</span> 버튼을 클릭하시면 <strong>실제 원본 데이터와 계산 공식 팝업</strong>을 바로 확인하실 수 있습니다.
              </span>
            </div>

            {/* 공식 평가표 메인 테이블 */}
            <TooltipProvider>
              <table className="w-full border-collapse border border-slate-400 text-xs text-left">
                <thead>
                  <tr className="bg-slate-200/90 text-slate-900 font-black text-center text-[11px]">
                    <th className="border border-slate-400 p-2 w-[13%]">영역</th>
                    <th className="border border-slate-400 p-2 w-[24%]">요소</th>
                    <th className="border border-slate-400 p-2">평가결과 및 취득 현황</th>
                    <th className="border border-slate-400 p-2 w-[11%]">취득점수</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. 직업공통능력 (25점) */}
                  <tr>
                    <td rowSpan={5} className="border border-slate-400 p-2.5 text-center font-black bg-slate-50/80 align-middle">
                      직업공통<br/>능력<br/>
                      <span className="text-indigo-700 font-extrabold text-[11px]">({evaluation.vocationalCommonScore} / 25점)</span>
                    </td>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">직업공통능력평가 (15점)</span>
                        <EvidenceTooltip
                          title="직업공통능력평가 영역별 등급"
                          sourceLabel="직기초 평가"
                          value={(() => {
                            const vDetails = evaluation.rawEvaluationData?.vocational_details;
                            const fmt = (gradeLabel: string, g?: any, fallback?: number) => {
                              if (!g && (!fallback || fallback <= 0)) {
                                return `${gradeLabel}: 20등급 (국어 미응시, 영어 미응시, 수리 미응시, 문제해결 미응시)`;
                              }
                              
                              if (g) {
                                const kVal = g.korean && g.korean > 0 ? g.korean : 5;
                                const eVal = g.english && g.english > 0 ? g.english : 5;
                                const mVal = g.math && g.math > 0 ? g.math : 5;
                                const pVal = g.problem && g.problem > 0 ? g.problem : 5;

                                const k = g.korean && g.korean > 0 ? `국어 ${g.korean}등급` : '국어 미응시(5등급)';
                                const e = g.english && g.english > 0 ? `영어 ${g.english}등급` : '영어 미응시(5등급)';
                                const m = g.math && g.math > 0 ? `수리 ${g.math}등급` : '수리 미응시(5등급)';
                                const p = g.problem && g.problem > 0 ? `문제해결 ${g.problem}등급` : '문제해결 미응시(5등급)';
                                
                                const sum = g.isCompleted === false ? 20 : (kVal + eVal + mVal + pVal);
                                return `${gradeLabel}: ${sum}등급 (${k}, ${e}, ${m}, ${p})`;
                              }

                              return `${gradeLabel}: ${fallback && fallback > 0 ? `${fallback}등급` : '20등급 (미입력 ➔ 5등급 기본)'}`;
                            };

                            return [
                              fmt('3학년 전국단위평가', vDetails?.grade3, evaluation.rawEvaluationData?.vocational_grade_3),
                              fmt('2학년 자가진단평가', vDetails?.grade2, evaluation.rawEvaluationData?.vocational_grade_2),
                              fmt('1학년 자가진단평가', vDetails?.grade1, evaluation.rawEvaluationData?.vocational_grade_1),
                            ];
                          })()}
                          formula={`합산 점수: 3학년(${d.vocal3Grade.score}점) + 2학년(${d.vocal2Grade.score}점) + 1학년(${d.vocal1Grade.score}점) = ${d.vocal3Grade.score + d.vocal2Grade.score + d.vocal1Grade.score}점`}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal mt-0.5">전국/자가진단 영역별 등급합</span>
                    </td>
                    <td className="border border-slate-400 p-1.5">
                      <div className="w-full overflow-hidden border border-slate-300 rounded bg-white">
                        <table className="w-full text-[10px] text-center border-collapse">
                          <thead>
                            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-300">
                              <th className="py-1 px-1.5 text-left w-[95px] border-r border-slate-200">구분</th>
                              <th className="py-1 px-1 border-r border-slate-200">4등급 이하</th>
                              <th className="py-1 px-1 border-r border-slate-200">7등급 이하</th>
                              <th className="py-1 px-1 border-r border-slate-200">10등급 이하</th>
                              <th className="py-1 px-1 border-r border-slate-200">13등급 이하</th>
                              <th className="py-1 px-1">16등급 이하</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {/* 3학년 전국단위평가 */}
                            <tr className="hover:bg-slate-50/60">
                              <td className="py-1 px-1.5 text-left font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                3학년 전국 (7점)
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal3Grade.checkedOptionIndex === 0 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal3Grade.checkedOptionIndex === 0 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>7점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal3Grade.checkedOptionIndex === 1 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal3Grade.checkedOptionIndex === 1 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>6점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal3Grade.checkedOptionIndex === 2 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal3Grade.checkedOptionIndex === 2 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>5점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal3Grade.checkedOptionIndex === 3 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal3Grade.checkedOptionIndex === 3 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>4점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5", d.vocal3Grade.checkedOptionIndex === 4 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal3Grade.checkedOptionIndex === 4 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>3점</span>
                                </span>
                              </td>
                            </tr>

                            {/* 2학년 자가진단평가 */}
                            <tr className="hover:bg-slate-50/60">
                              <td className="py-1 px-1.5 text-left font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                2학년 자가 (5점)
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal2Grade.checkedOptionIndex === 0 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal2Grade.checkedOptionIndex === 0 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>5점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal2Grade.checkedOptionIndex === 1 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal2Grade.checkedOptionIndex === 1 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>4점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal2Grade.checkedOptionIndex === 2 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal2Grade.checkedOptionIndex === 2 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>3점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal2Grade.checkedOptionIndex === 3 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal2Grade.checkedOptionIndex === 3 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>2점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5", d.vocal2Grade.checkedOptionIndex === 4 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal2Grade.checkedOptionIndex === 4 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>1점</span>
                                </span>
                              </td>
                            </tr>

                            {/* 1학년 자가진단평가 */}
                            <tr className="hover:bg-slate-50/60">
                              <td className="py-1 px-1.5 text-left font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                1학년 자가 (3점)
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal1Grade.checkedOptionIndex === 0 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal1Grade.checkedOptionIndex === 0 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>3점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal1Grade.checkedOptionIndex === 1 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal1Grade.checkedOptionIndex === 1 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>2.5점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal1Grade.checkedOptionIndex === 2 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal1Grade.checkedOptionIndex === 2 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>2점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5 border-r border-slate-200", d.vocal1Grade.checkedOptionIndex === 3 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal1Grade.checkedOptionIndex === 3 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>1.5점</span>
                                </span>
                              </td>
                              <td className={cn("py-1 px-0.5", d.vocal1Grade.checkedOptionIndex === 4 && "bg-indigo-50 font-bold text-indigo-900")}>
                                <span className="inline-flex items-center gap-0.5">
                                  {d.vocal1Grade.checkedOptionIndex === 4 ? <CheckSquare className="h-3 w-3 text-indigo-600 inline" /> : <Square className="h-3 w-3 text-slate-300 inline" />}
                                  <span>1점</span>
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.vocal3Grade.score + d.vocal2Grade.score + d.vocal1Grade.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">직업공통능력 모의평가 (2점)</span>
                        <EvidenceTooltip
                          title="모의평가 등급"
                          sourceLabel="모의평가"
                          value={evaluation.rawEvaluationData?.vocational_mock_grade ? `${evaluation.rawEvaluationData.vocational_mock_grade}등급 (${d.vocalMockGrade.score}점)` : '미입력 (0점)'}
                        />
                      </div>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <div className="flex items-center gap-1 flex-nowrap">
                        <CheckItem checked={d.vocalMockGrade.checkedOptionIndex === 0} label="4등급이하(2점)" />
                        <CheckItem checked={d.vocalMockGrade.checkedOptionIndex === 1} label="7등급이하(1.5점)" />
                        <CheckItem checked={d.vocalMockGrade.checkedOptionIndex === 2} label="10등급이하(1점)" />
                        <CheckItem checked={d.vocalMockGrade.checkedOptionIndex === 3} label="13등급이하(0.5점)" />
                      </div>
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.vocalMockGrade.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">컴퓨터관련자격 (3점)</span>
                        <EvidenceTooltip
                          title="컴퓨터 관련 자격"
                          sourceLabel="자격증 DB"
                          value={d.certComputer.details?.certs?.length > 0 ? `${d.certComputer.details.certs.join(', ')} (${d.certComputer.details.certs.length}개)` : '취득 자격 없음 (0점)'}
                          formula={d.certComputer.details?.certs?.length >= 2 ? '2개 이상 취득 ➔ 3.0점 만점' : d.certComputer.details?.certs?.length === 1 ? '1개 취득 ➔ 2.0점' : '0점'}
                          details={d.certComputer.details?.certs}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">컴활2급, 워드2급, GTQ2급 이상</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.certComputer.checkedOptionIndex === 0} label="2개 이상(3점)" />
                      <CheckItem checked={d.certComputer.checkedOptionIndex === 1} label="1개(2점)" />
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.certComputer.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">정보기술자격 (2점)</span>
                        <EvidenceTooltip
                          title="정보기술자격 (ITQ / PCT / DIAT·디지털정보활용능력)"
                          sourceLabel="자격증 DB"
                          value={d.certInfoTech.details?.certs?.length > 0 ? `${d.certInfoTech.details.certs.join(', ')} (${d.certInfoTech.details.count}개)` : '취득 자격 없음 (0점)'}
                          formula={`1개당 0.5점: ${d.certInfoTech.details?.count || 0}개 × 0.5 = ${d.certInfoTech.score}점 (최대 2.0점)`}
                          details={d.certInfoTech.details?.certs}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">ITQ(A), PCT(A), DIAT·디지털정보활용능력(고급) 최상등급 인정 (개당 0.5점, 최대 2점)</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.certInfoTech.score > 0} label={`1개당 0.5점 (${d.certInfoTech.details?.count || 0}개 취득)`} scoreText={`${d.certInfoTech.score}점`} />
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.certInfoTech.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">한국사능력검정 (3점)</span>
                        <EvidenceTooltip
                          title="한국사능력검정"
                          sourceLabel="자격증 DB"
                          value={d.certHistory.score > 0 ? d.certHistory.displayText : '한국사 자격 미취득 (0점)'}
                          formula={d.certHistory.score > 0 ? `${d.certHistory.displayText} ➔ ${d.certHistory.score}점` : '해당 없음'}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">상위 1개만 인정</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.certHistory.checkedOptionIndex === 0} label="1급(3점)" />
                      <CheckItem checked={d.certHistory.checkedOptionIndex === 1} label="2급(2점)" />
                      <CheckItem checked={d.certHistory.checkedOptionIndex === 2} label="3급(1점)" />
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.certHistory.score}점
                    </td>
                  </tr>

                  {/* 2. 전공능력 (25점) */}
                  <tr>
                    <td rowSpan={2} className="border border-slate-400 p-2 text-center font-black bg-slate-50/80 align-middle">
                      전공능력<br/>
                      <span className="text-indigo-700 font-extrabold text-[11px]">({evaluation.majorScore} / 25점)</span>
                    </td>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">전공기초자격 (20점)</span>
                        <EvidenceTooltip
                          title="전공기초 자격증"
                          sourceLabel="자격증 DB"
                          value={d.certMajorBasic.details?.certs?.length > 0 ? `${d.certMajorBasic.details.certs.join(', ')} (${d.certMajorBasic.details.certs.length}개)` : '전공 자격 없음 (0점)'}
                          formula={d.certMajorBasic.details?.certs?.length >= 3 ? '3개 이상 취득 ➔ 20.0점 (만점)' : d.certMajorBasic.details?.certs?.length === 2 ? '2개 취득 ➔ 15.0점' : d.certMajorBasic.details?.certs?.length === 1 ? '1개 취득 ➔ 10.0점' : '0점'}
                          details={d.certMajorBasic.details?.certs}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">학과별 전공 필수 자격증 (타학과 인정)</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.certMajorBasic.checkedOptionIndex === 0} label="3개 이상(20점)" />
                      <CheckItem checked={d.certMajorBasic.checkedOptionIndex === 1} label="2개(15점)" />
                      <CheckItem checked={d.certMajorBasic.checkedOptionIndex === 2} label="1개(10점)" />
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.certMajorBasic.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">전공심화자격 (5점)</span>
                        <EvidenceTooltip
                          title="전공심화 추가 자격증"
                          sourceLabel="자격증 DB"
                          value={d.certMajorAdvanced.details?.certs?.length > 0 ? `${d.certMajorAdvanced.details.certs.join(', ')} (총 ${d.certMajorAdvanced.details.count}개)` : '추가 자격 없음 (0점)'}
                          formula={d.certMajorAdvanced.details?.count >= 5 ? '5개 이상 취득 ➔ 5.0점 (만점)' : d.certMajorAdvanced.details?.count === 4 ? '4개 취득 ➔ 3.0점' : '0점'}
                          details={d.certMajorAdvanced.details?.certs}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">추가 전공 필수 자격증</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.certMajorAdvanced.checkedOptionIndex === 0} label="5개 이상(5점)" />
                      <CheckItem checked={d.certMajorAdvanced.checkedOptionIndex === 1} label="4개(3점)" />
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.certMajorAdvanced.score}점
                    </td>
                  </tr>

                  {/* 3. 취업역량강화 (25점) */}
                  <tr>
                    <td rowSpan={3} className="border border-slate-400 p-2 text-center font-black bg-slate-50/80 align-middle">
                      취업역량<br/>강화<br/>
                      <span className="text-indigo-700 font-extrabold text-[11px]">({evaluation.employmentScore} / 25점)</span>
                    </td>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">취업진로교육참여 (10점)</span>
                        <EvidenceTooltip
                          title="산학협력부 교육이수"
                          sourceLabel="산학협력부"
                          structuredItems={((evaluation.rawEvaluationData?.employment_details?.industry_edu_list || [])).map((e, idx) => ({
                            text: `[${idx + 1}회] ${e.title}${e.dateOrTerm ? ` (${e.dateOrTerm})` : ''}`,
                            category: 'industry_edu' as const,
                            subKeyOrId: e.id,
                            created_by: e.created_by,
                          }))}
                          value={(() => {
                            const eduList = evaluation.rawEvaluationData?.employment_details?.industry_edu_list;
                            const count = evaluation.rawEvaluationData?.industry_edu_count || eduList?.length || 0;
                            return `${count}회 이수 (${count * 1.0}점)`;
                          })()}
                          formula={`1회당 1.0점: ${evaluation.rawEvaluationData?.industry_edu_count || 0}회 × 1점 = ${d.industryEdu.score}점 (최대 10점)`}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">산학협력부 주관 교육이수 총 횟수</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.industryEdu.score > 0} label="1회당 1점 (최대 10점)" scoreText={`${d.industryEdu.score}점`} />
                      <span className="text-[10px] text-slate-400 block mt-0.5">※ 채용설명회, 채용박람회, 견학, 산학부 방과후 등 인정</span>
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.industryEdu.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">취업역량강화반 참여 (10점)</span>
                        <EvidenceTooltip
                          title="진로코스/동아리/기능대회"
                          sourceLabel="취업역량"
                          structuredItems={[
                            ...Object.entries(evaluation.rawEvaluationData?.employment_details?.career_courses || {}).map(([t, c]) => ({
                              text: `취업코스 [${t}학기]: ${c}`,
                              category: 'career_course' as const,
                              subKeyOrId: t,
                              created_by: evaluation.rawEvaluationData?.employment_details?.career_courses_meta?.[t],
                            })),
                            ...Object.entries(evaluation.rawEvaluationData?.employment_details?.major_clubs || {}).map(([g, c]) => ({
                              text: `심화동아리 [${g}학년]: ${c}`,
                              category: 'major_club' as const,
                              subKeyOrId: g,
                              created_by: evaluation.rawEvaluationData?.employment_details?.major_clubs_meta?.[g],
                            })),
                            ...(evaluation.rawEvaluationData?.employment_details?.skills_contest?.name ? [{
                              text: `기능대회: ${evaluation.rawEvaluationData.employment_details.skills_contest.name} (${evaluation.rawEvaluationData.employment_details.skills_contest.level === 'national' ? '전국 5점' : '지방 2점'})`,
                              category: 'skills_contest' as const,
                              subKeyOrId: 'main',
                              created_by: evaluation.rawEvaluationData.employment_details.skills_contest.created_by,
                            }] : []),
                          ]}
                          formula={d.careerCourse.displayText}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">진로코스/동아리/기능대회</span>
                    </td>
                    <td className="border border-slate-400 p-2 space-y-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block">① 취업 진로 코스 (청솔, 맞춤, 반도체, 혁신, 군특, 도제 등):</span>
                        <div className="flex items-center gap-1 flex-nowrap mt-0.5">
                          <CheckItem checked={d.careerCourse.checkedOptionIndex === 0} label="4학기(10점)" />
                          <CheckItem checked={d.careerCourse.checkedOptionIndex === 1} label="3학기(8점)" />
                          <CheckItem checked={d.careerCourse.checkedOptionIndex === 2} label="2학기(6점)" />
                          <CheckItem checked={d.careerCourse.checkedOptionIndex === 3} label="1학기(4점)" />
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 space-y-1">
                        <div>
                          <span className="text-[10px] font-bold text-slate-600 block">② 전공심화동아리 활동:</span>
                          <div className="flex items-center gap-1 flex-nowrap mt-0.5">
                            <CheckItem checked={Number(evaluation.rawEvaluationData?.major_club_years || 0) >= 3} label="3개학년(5점)" />
                            <CheckItem checked={Number(evaluation.rawEvaluationData?.major_club_years || 0) === 2} label="2개학년(4점)" />
                            <CheckItem checked={Number(evaluation.rawEvaluationData?.major_club_years || 0) === 1} label="1개학년(3점)" />
                          </div>
                        </div>
                        <div className="pt-1 border-t border-slate-200/80">
                          <span className="text-[10px] font-bold text-slate-600 block">③ 기능경기대회 입상:</span>
                          <div className="flex items-center gap-1 flex-nowrap mt-0.5">
                            <CheckItem checked={evaluation.rawEvaluationData?.skills_contest_level === 'national'} label="전국기능대회(5점)" />
                            <CheckItem checked={evaluation.rawEvaluationData?.skills_contest_level === 'regional'} label="지방기능대회(2점)" />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.careerCourse.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">현장실습 참여 (최대 5점)</span>
                        <EvidenceTooltip
                          title="현장실습 / 도제 / 조기취업"
                          sourceLabel="현장실습"
                          structuredItems={[
                            ...(evaluation.rawEvaluationData?.employment_details?.field_training?.company ? [{
                              text: `현장실습: ${evaluation.rawEvaluationData.employment_details.field_training.company} 이수(5점)`,
                              category: 'field_training' as const,
                              subKeyOrId: 'main',
                              created_by: evaluation.rawEvaluationData.employment_details.field_training.created_by,
                            }] : []),
                            ...Object.entries(evaluation.rawEvaluationData?.employment_details?.apprenticeship || {}).map(([t, c]) => ({
                              text: `도제 OJT [${t}]: ${c}`,
                              category: 'apprenticeship' as const,
                              subKeyOrId: t,
                              created_by: evaluation.rawEvaluationData?.employment_details?.apprenticeship_meta?.[t],
                            })),
                            ...(evaluation.rawEvaluationData?.employment_details?.employed_early?.company ? [{
                              text: `조기취업: ${evaluation.rawEvaluationData.employment_details.employed_early.company} (5점)`,
                              category: 'employed_early' as const,
                              subKeyOrId: 'main',
                              created_by: evaluation.rawEvaluationData.employment_details.employed_early.created_by,
                            }] : []),
                          ]}
                          formula={`최대 5.0점 캡 적용 ➔ ${d.fieldTraining.score}점`}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">현장실습/도제OJT/취업확정</span>
                    </td>
                    <td className="border border-slate-400 p-2 space-y-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block">① 현장실습 이수:</span>
                        <CheckItem checked={!!evaluation.rawEvaluationData?.field_training_completed} label="현장실습 이수(5점)" />
                      </div>
                      <div className="pt-1 border-t border-slate-200">
                        <span className="text-[10px] font-bold text-slate-600 block">② 도제 OJT 참여 기간:</span>
                        <CheckItem checked={Number(evaluation.rawEvaluationData?.apprenticeship_semesters || 0) >= 4} label="4학기(5점)" />
                        <CheckItem checked={Number(evaluation.rawEvaluationData?.apprenticeship_semesters || 0) === 3} label="3학기(4점)" />
                        <CheckItem checked={Number(evaluation.rawEvaluationData?.apprenticeship_semesters || 0) === 2} label="2학기(3점)" />
                        <CheckItem checked={Number(evaluation.rawEvaluationData?.apprenticeship_semesters || 0) === 1} label="1학기(2점)" />
                      </div>
                      <div className="pt-1 border-t border-slate-200">
                        <span className="text-[10px] font-bold text-slate-600 block">③ 취업확정:</span>
                        <CheckItem checked={!!evaluation.rawEvaluationData?.employed_early} label="취업확정(5점)" />
                      </div>
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.fieldTraining.score}점
                    </td>
                  </tr>

                  {/* 4. 인성능력 (25점) */}
                  <tr>
                    <td rowSpan={4} className="border border-slate-400 p-2 text-center font-black bg-slate-50/80 align-middle">
                      인성능력<br/>
                      <span className="text-indigo-700 font-extrabold text-[11px]">({evaluation.characterScore} / 25점)</span>
                    </td>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">출결상황 (10점)</span>
                        <EvidenceTooltip
                          title="출결상황 산출"
                          sourceLabel="나이스 출결"
                          value={[
                            `미인정 결석: ${evaluation.attendanceSummary?.absentUnexcused || 0}회`,
                            `미인정 지각: ${evaluation.attendanceSummary?.lateUnexcused || 0}회`,
                            `미인정 조퇴: ${evaluation.attendanceSummary?.earlyUnexcused || 0}회`,
                            `미인정 결과: ${evaluation.attendanceSummary?.outUnexcused || 0}회`
                          ]}
                          formula={`감점 수식: 10점 - (결석 ${evaluation.attendanceSummary?.absentUnexcused || 0} × 1점) - (기타미인정 ${(evaluation.attendanceSummary?.lateUnexcused || 0) + (evaluation.attendanceSummary?.earlyUnexcused || 0) + (evaluation.attendanceSummary?.outUnexcused || 0)} × 0.5점) = ${d.attendance.score}점`}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">10점 - 미인정결석x1 - 기타미인정x0.5</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <span className="font-semibold text-slate-800">{d.attendance.displayText}</span>
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.attendance.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">교내외봉사활동 (5점)</span>
                        <EvidenceTooltip
                          title="봉사활동 점수 산출"
                          sourceLabel="나이스 봉사활동"
                          value={[
                            `교내 봉사활동: ${evaluation.rawEvaluationData?.volunteer_school_hours || 0}시간`,
                            `교외 봉사활동: ${evaluation.rawEvaluationData?.volunteer_outside_hours || 0}시간`,
                            `총 봉사활동 인정: ${Number(evaluation.rawEvaluationData?.volunteer_school_hours || 0) + Number(evaluation.rawEvaluationData?.volunteer_outside_hours || 0)}시간`
                          ]}
                          formula={`(교내 ${evaluation.rawEvaluationData?.volunteer_school_hours || 0}h × 0.025) + (교외 ${evaluation.rawEvaluationData?.volunteer_outside_hours || 0}h × 0.05) = ${Math.round(((Number(evaluation.rawEvaluationData?.volunteer_school_hours || 0) * 0.025) + (Number(evaluation.rawEvaluationData?.volunteer_outside_hours || 0) * 0.05)) * 10) / 10}점 (상한 5.0점) ➔ ${d.volunteer.score}점`}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">200시간 이상(5점), 미만 공식</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.volunteer.checkedOptionIndex === 0} label="200시간 이상(5점)" />
                      <CheckItem checked={d.volunteer.checkedOptionIndex === 1} label="200시간 미만 (교내x0.025, 교외x0.05)" scoreText={`${d.volunteer.score}점`} />
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.volunteer.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">예체능활동 참여점수 (5점)</span>
                        <EvidenceTooltip
                          title="운동부 / 관악부 활동"
                          sourceLabel="예체능부"
                          structuredItems={Object.entries(evaluation.rawEvaluationData?.arts_contest_details?.arts_sports || {}).map(([t, dept]) => ({
                            text: `[${t}학기] ${dept}`,
                            category: 'arts_sports' as const,
                            subKeyOrId: t,
                            created_by: evaluation.rawEvaluationData?.arts_contest_details?.arts_sports_meta?.[t],
                          }))}
                          formula={`6학기(5점), 5학기(4점), 4학기(3점), 3학기(2점), 2학기(1점) ➔ ${d.artsSports.score}점`}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">운동부 및 관악부 참여 기간</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <div className="flex items-center gap-1 flex-nowrap">
                        <CheckItem checked={d.artsSports.checkedOptionIndex === 0} label="6학기(5점)" />
                        <CheckItem checked={d.artsSports.checkedOptionIndex === 1} label="5학기(4점)" />
                        <CheckItem checked={d.artsSports.checkedOptionIndex === 2} label="4학기(3점)" />
                        <CheckItem checked={d.artsSports.checkedOptionIndex === 3} label="3학기(2점)" />
                        <CheckItem checked={d.artsSports.checkedOptionIndex === 4} label="2학기(1점)" />
                      </div>
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.artsSports.score}점
                    </td>
                  </tr>

                  <tr>
                    <td className="border border-slate-400 p-2 font-bold align-middle">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="truncate">교내외 대회 참가 (최대 5점)</span>
                        {(() => {
                          const contestList = evaluation.rawEvaluationData?.arts_contest_details?.contest_list || [];
                          const contestEval = evaluateContestList(contestList);
                          return (
                            <EvidenceTooltip
                              title="교내외 대회 실적"
                              sourceLabel="대회/수상 실적"
                              structuredItems={contestEval.itemsWithStatus.map(c => {
                                const typeLabel = c.type === 'award' ? '입상' : '참가';
                                const scoreBadge = c.isSuperseded 
                                  ? '입상 우선 적용(중복 0점)' 
                                  : (c.type === 'award' ? '1점' : '0.5점');
                                const awardDetail = c.award && c.award !== '입상' && c.award !== '참가' ? `${c.award}, ${scoreBadge}` : scoreBadge;
                                const catLabel = c.category ? `[${c.category}] ` : '';
                                const dateLabel = c.dateOrTerm ? ` [${c.dateOrTerm}]` : '';

                                return {
                                  text: `${catLabel}${typeLabel} - ${c.title} (${awardDetail})${dateLabel}`,
                                  category: 'contest' as const,
                                  subKeyOrId: c.id,
                                  created_by: c.created_by,
                                };
                              })}
                              formula={`(입상 ${contestEval.effectiveAwardCount}건 × 1점) + (참가 ${contestEval.effectivePartCount}건 × 0.5점) = ${d.schoolContests.score}점 (동일 대회 입상 시 입상 우선 인정 / 최대 5.0점)`}
                            />
                          );
                        })()}
                      </div>
                      <span className="block text-[10px] text-slate-500 font-normal">입상 건당 1점, 참가 건당 0.5점 (동일 대회 입상 우선)</span>
                    </td>
                    <td className="border border-slate-400 p-2">
                      <CheckItem checked={d.schoolContests.score > 0} label={d.schoolContests.displayText} scoreText={`${d.schoolContests.score}점`} />
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-bold text-indigo-700 align-middle">
                      {d.schoolContests.score}점
                    </td>
                  </tr>

                {/* 합계 행 */}
                <tr className="bg-indigo-50/80 font-black">
                  <td colSpan={2} className="border border-slate-400 p-3 text-center text-sm text-slate-900">
                    합 계 (100점 만점)
                  </td>
                  <td className="border border-slate-400 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        ◾ 졸업 시 70점 이상 학생에게 대구공고 옥저인재 인증서 발급
                      </span>
                      <span className={cn(
                        "text-xs px-2.5 py-1 rounded font-black",
                        evaluation.isCertified ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-800"
                      )}>
                        {evaluation.isCertified ? "인증서 발급 대상" : "인증 미달"}
                      </span>
                    </div>
                  </td>
                  <td className="border border-slate-400 p-3 text-center text-base font-black text-indigo-700">
                    {evaluation.totalScore}점
                  </td>
                </tr>
              </tbody>
            </table>
            </TooltipProvider>

            {/* 하단 취득 점수별 등급표 (공식 서식 1:1) */}
            <div className="mt-5 border border-slate-400 rounded overflow-hidden">
              <div className="bg-slate-200/90 text-center py-1.5 font-bold text-xs border-b border-slate-400 text-slate-800">
                구분 : 취득 점수별 등급표
              </div>
              <div className="grid grid-cols-5 text-center text-xs">
                <div className={cn("p-2 border-r border-slate-400", evaluation.rank === 'S' && "bg-amber-100/80 font-black")}>
                  <span className="block font-black text-amber-700">S랭크</span>
                  <span className="text-[11px] text-slate-600">81~100점</span>
                </div>
                <div className={cn("p-2 border-r border-slate-400", evaluation.rank === 'A' && "bg-blue-100/80 font-black")}>
                  <span className="block font-black text-blue-700">A랭크</span>
                  <span className="text-[11px] text-slate-600">61~80점</span>
                </div>
                <div className={cn("p-2 border-r border-slate-400", evaluation.rank === 'B' && "bg-emerald-100/80 font-black")}>
                  <span className="block font-black text-emerald-700">B랭크</span>
                  <span className="text-[11px] text-slate-600">41~60점</span>
                </div>
                <div className={cn("p-2 border-r border-slate-400", evaluation.rank === 'C' && "bg-slate-200/80 font-black")}>
                  <span className="block font-black text-slate-700">C랭크</span>
                  <span className="text-[11px] text-slate-600">21~40점</span>
                </div>
                <div className={cn("p-2", evaluation.rank === 'D' && "bg-rose-100/80 font-black")}>
                  <span className="block font-black text-rose-700">D랭크</span>
                  <span className="text-[11px] text-slate-600">20점 이하</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* [모바일 전용] 하단 고정 액션 바 */}
        <div className="block md:hidden p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shrink-0 print:hidden shadow-lg z-20">
          <div className="grid grid-cols-2 gap-2">
            {canEdit && onEditClick ? (
              <Button
                type="button"
                variant="outline"
                onClick={onEditClick}
                className="h-10 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-extrabold rounded-xl gap-1.5 border-indigo-200 justify-center"
              >
                <Edit3 className="h-4 w-4 text-indigo-600" />
                <span>실적 수동 수정</span>
              </Button>
            ) : (
              <div className="h-10 flex items-center justify-center gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200 select-none">
                <Lock className="h-3.5 w-3.5" />
                <span>조회 전용 모드</span>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="h-10 text-xs bg-white text-slate-800 hover:bg-slate-50 font-extrabold rounded-xl gap-1.5 border-slate-300 justify-center shadow-xs"
            >
              <Printer className="h-4 w-4 text-slate-700" />
              <span>평가표 인쇄 / PDF</span>
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>

    {/* [모바일/터치 전용] 산출근거 상세 팝업 다이얼로그 */}
    <Dialog open={!!activeEvidence} onOpenChange={(open) => !open && setActiveEvidence(null)}>
        <DialogContent className="max-w-md w-[92vw] p-4 sm:p-5 rounded-2xl bg-slate-900 text-white border border-slate-700 shadow-2xl z-[99999]">
          {activeEvidence && (
            <div className="flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 gap-2">
                <DialogTitle className="font-extrabold text-indigo-300 text-sm flex items-center gap-1.5">
                  <span>📌</span>
                  <span>{activeEvidence.title} 산출 근거</span>
                </DialogTitle>
                {activeEvidence.sourceLabel && (
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {activeEvidence.sourceLabel}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="text-slate-400 block text-[11px] font-medium">실제 입력 데이터:</span>
                <div className="font-medium text-slate-100 bg-slate-950/70 p-3 rounded-xl border border-slate-800 max-h-52 overflow-y-auto space-y-1.5">
                  {activeEvidence.structuredItems && activeEvidence.structuredItems.length > 0 ? (
                    activeEvidence.structuredItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-1.5 py-0.5">
                        <span className="text-indigo-400 font-bold shrink-0">•</span>
                        <div className="text-xs leading-snug break-words">
                          <span>{item.text}</span>
                          {item.created_by?.userName && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              ✍️ 등록자: {item.created_by.userName}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : activeEvidence.details && activeEvidence.details.length > 0 ? (
                    activeEvidence.details.map((itemText, i) => (
                      <div key={i} className="flex items-start gap-1.5 py-0.5">
                        <span className="text-indigo-400 font-bold shrink-0">•</span>
                        <span className="leading-tight text-xs text-slate-100">{itemText}</span>
                      </div>
                    ))
                  ) : Array.isArray(activeEvidence.value) && activeEvidence.value.length > 0 ? (
                    activeEvidence.value.map((v, i) => (
                      <div key={i} className="flex items-start gap-1.5 py-0.5">
                        <span className="text-indigo-400 font-bold shrink-0">•</span>
                        <span className="leading-tight text-xs text-slate-100">{v}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-300 text-xs">{activeEvidence.value || '취득 실적 없음'}</div>
                  )}
                </div>
              </div>

              {activeEvidence.formula && (
                <div className="text-[11px] text-emerald-300 bg-slate-950/90 p-2.5 rounded-xl font-mono border border-emerald-500/20 leading-relaxed">
                  🧮 {activeEvidence.formula}
                </div>
              )}

              <Button
                type="button"
                onClick={() => setActiveEvidence(null)}
                className="mt-1 h-9 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
              >
                닫기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
