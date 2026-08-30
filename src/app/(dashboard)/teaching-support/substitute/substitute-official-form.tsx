'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/substitute-official-form.tsx
// 학교 공식 양식 '(양식)수업 교체 및 보강 신청서.pdf' 100% 1:1 완벽 일치 렌더링 & 인쇄
// ==============================================================================

import * as React from 'react';
import { SubstituteApplication, SubstituteItem } from '@/lib/substitute/types';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, CheckCircle2, Files, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubstituteOfficialFormProps {
  application?: SubstituteApplication;
  applications?: SubstituteApplication[];
  onBack?: () => void;
  onApprove?: (appId: string) => void;
  onApproveAll?: (appIds: string[]) => void;
  canApprove?: boolean;
}

// 날짜 포맷 헬퍼 (YYYY. M. D.)
const formatDate = (dStr?: string) => {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]}. ${parseInt(parts[1], 10)}. ${parseInt(parts[2], 10)}.`;
  }
  return dStr;
};

// 학과명 축약 헬퍼 (A4 공식 신청서 규격 출력용)
const formatDeptShortName = (rawDept?: string, classCode?: string) => {
  const trimmed = rawDept?.trim() || '';

  if (trimmed.includes('자동화기계') || trimmed === '기계과' || trimmed === '기계') return '기계';
  if (trimmed.includes('친환경자동차') || trimmed === '자동차과' || trimmed === '자동차') return '자동차';
  if (trimmed.includes('스마트공간건축') || trimmed === '건축과' || trimmed === '건축') return '건축';
  if (trimmed.includes('스마트공간') || trimmed === '공간과' || trimmed === '공간') return '공간';
  if (trimmed.includes('건설') || trimmed === '건설과') return '건설';
  if (trimmed.includes('스마트전기') || trimmed === '전기과' || trimmed === '전기') return '전기';
  if (trimmed.includes('바이오화학') || trimmed === '화학과' || trimmed === '화공과' || trimmed === '화공') return '화공';
  if (trimmed.includes('스마트융합섬유') || trimmed.includes('섬유소재') || trimmed === '섬유과' || trimmed === '섬유') return '섬유';

  if (trimmed.endsWith('과') && trimmed.length <= 4) {
    return trimmed.slice(0, -1);
  }

  if (trimmed) return trimmed;

  // 학반 코드 접두어 기준 추론 (예: 전32 -> 전기, 기11 -> 기계)
  const code = classCode?.trim() || '';
  if (code.startsWith('기')) return '기계';
  if (code.startsWith('차') || code.startsWith('자')) return '자동차';
  if (code.startsWith('전')) return '전기';
  if (code.startsWith('화') || code.startsWith('바')) return '화공';
  if (code.startsWith('섬') || code.startsWith('융')) return '섬유';
  if (code.startsWith('건')) return '건설';
  if (code.startsWith('공')) return '공간';
  if (code.startsWith('축')) return '건축';

  return '';
};

// 학반 포맷 헬퍼 (예: '전32' -> '3-2', '기11' -> '1-1', '자23' -> '2-3')
const formatClassGradeAndRoom = (rawClassCode?: string) => {
  if (!rawClassCode) return '';
  const trimmed = rawClassCode.trim();
  if (!trimmed) return '';

  if (/^\d+-\d+$/.test(trimmed)) return trimmed;

  const matchWithDept = trimmed.match(/[가-힣]*(\d)[-\s_]?(\d+)/);
  if (matchWithDept) return `${matchWithDept[1]}-${matchWithDept[2]}`;

  const matchKorean = trimmed.match(/(\d+)\s*학년\s*(\d+)\s*반/);
  if (matchKorean) return `${matchKorean[1]}-${matchKorean[2]}`;

  if (/^\d{2}$/.test(trimmed)) return `${trimmed[0]}-${trimmed[1]}`;

  return trimmed;
};

// 개별 A4 신청서 시트 컴포넌트 (원본 PDF와 100% 동일한 레이아웃 & 파스텔 컬러)
function SingleApplicationSheet({
  status,
  approvedBy,
  applicantTeacher,
  reason,
  applicationDate,
  periodText,
  items,
  isLast = false,
}: {
  status: string;
  approvedBy?: string;
  applicantTeacher: string;
  reason: string;
  applicationDate?: string;
  periodText: string;
  items: SubstituteItem[];
  isLast?: boolean;
}) {
  const appDate = applicationDate ? new Date(applicationDate) : new Date();
  const appYear = appDate.getFullYear();
  const appMonth = appDate.getMonth() + 1;
  const appDay = appDate.getDate();

  // 날짜순(수업일 -> 교시) 정렬
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const dateDiff = (a.sourceDate || '').localeCompare(b.sourceDate || '');
      if (dateDiff !== 0) return dateDiff;
      return (a.sourcePeriod || 0) - (b.sourcePeriod || 0);
    });
  }, [items]);

  // 원본 PDF와 동일하게 15행 고정
  const totalRows = Math.max(15, sortedItems.length);
  const rows = Array.from({ length: totalRows }, (_, i) => sortedItems[i] || null);

  return (
    <div className={cn(
      'bg-white p-8 sm:p-12 max-w-[850px] mx-auto border border-slate-200 shadow-md text-black font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none print:block',
      !isLast ? 'mb-10 print:mb-0 print:break-after-page' : ''
    )}>
      {/* 1. 문서 제목 (상단 중앙 박스 형태) */}
      <div className='flex justify-center mb-5 pt-2'>
        <div className='inline-block px-7 py-2 bg-slate-200/80 rounded-md shadow-xs'>
          <h1 className='text-2xl sm:text-3xl font-black text-center tracking-[0.35em] pl-3 text-black font-sans'>
            수업 교체 및 보강 신청서
          </h1>
        </div>
      </div>

      {/* 2. 우측 결재란 (수업계 / 부장) */}
      <div className='flex justify-end mb-4'>
        <div className='w-36 border border-black text-center text-xs shrink-0'>
          <div className='grid grid-cols-2 border-b border-black font-bold bg-white'>
            <div className='py-1 border-r border-black'>수업계</div>
            <div className='py-1'>부장</div>
          </div>
          <div className='grid grid-cols-2 h-14 bg-white'>
            <div className='border-r border-black flex items-center justify-center text-[11px] text-black'>
              &nbsp;
            </div>
            <div className='flex items-center justify-center text-[11px] text-black'>
              &nbsp;
            </div>
          </div>
        </div>
      </div>

      {/* 3. 신청 기본 정보 및 문구 */}
      <div className='space-y-1.5 text-[13px] font-sans text-black leading-relaxed mb-4'>
        <p className='flex items-baseline'>
          <span className='font-bold w-48 shrink-0'>수업교체 및 보강 신청 기간 :</span>
          <span className='font-bold'>{periodText}</span>
        </p>
        <p className='flex items-baseline'>
          <span className='font-bold w-48 shrink-0'>사유 :</span>
          <span className='font-bold'>{reason}</span>
        </p>
        <p className='text-center pt-2 font-medium'>
          위와 같은 사유에 의해 다음과 같이 <strong>(교체수업 / 보강수업)</strong>을 신청하오니 허가 바랍니다.
        </p>
        <div className='text-right pr-6 pt-1 space-y-1'>
          <p className='text-xs'>
            {appYear}년 {appMonth}월 {appDay}일
          </p>
          <p className='text-sm font-bold'>
            교사 : <span className='px-2'>{applicantTeacher}</span> (인)
          </p>
        </div>
      </div>

      {/* 4. 원본 PDF 100% 동일 3단 공식 신청 표 (파스텔 하늘/분홍/노랑 테마) */}
      <div className='overflow-x-auto'>
        <table className='w-full table-fixed border-collapse border border-black text-center text-[11px] leading-tight'>
          <thead>
            {/* 대분류 헤더 1행 */}
            <tr className='border-b border-black font-black text-xs'>
              <th colSpan={7} className='py-2 border-r border-black bg-[#b8d5ea] text-black'>
                신청 수업
              </th>
              <th colSpan={6} className='py-2 border-r border-black bg-[#f4c2be] text-black'>
                교체 수업
              </th>
              <th colSpan={2} className='py-2 bg-[#fed89b] text-black'>
                보강 수업
              </th>
            </tr>
            {/* 세부 항목 헤더 2행 (각 섹션별 동일한 파스텔 배경색 적용) */}
            <tr className='border-b border-black font-bold text-[10.5px]'>
              {/* 신청 수업 (7개 열 - 연하늘색 #b8d5ea) */}
              <th className='py-1.5 px-0.5 border-r border-black bg-[#b8d5ea] text-black w-[9%]'>날짜</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#b8d5ea] text-black w-[5%]'>요일</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#b8d5ea] text-black w-[5%]'>교시</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#b8d5ea] text-black w-[8%]'>학과</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#b8d5ea] text-black w-[7%]'>학반</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#b8d5ea] text-black w-[11%]'>교과목</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#b8d5ea] text-black w-[9%]'>수업교사</th>

              {/* 교체 수업 (6개 열 - 연분홍색 #f4c2be) */}
              <th className='py-1.5 px-0.5 border-r border-black bg-[#f4c2be] text-black w-[9%]'>날짜</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#f4c2be] text-black w-[5%]'>요일</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#f4c2be] text-black w-[5%]'>교시</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#f4c2be] text-black w-[11%]'>교과목</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#f4c2be] text-black w-[8%]'>교사</th>
              <th className='py-1.5 px-0.5 border-r border-black bg-[#f4c2be] text-black w-[5%]'> (인)</th>

              {/* 보강 수업 (2개 열 - 연노랑색 #fed89b) */}
              <th className='py-1.5 px-0.5 border-r border-black bg-[#fed89b] text-black w-[8%]'>교사</th>
              <th className='py-1.5 px-0.5 bg-[#fed89b] text-black w-[5%]'> (인)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, idx) => {
              if (!item) {
                // 빈 행 렌더링 (공식 서식 규격 15줄 유지)
                return (
                  <tr key={`empty-${idx}`} className='border-b border-black h-7'>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>

                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>
                    <td className='border-r border-black'>&nbsp;</td>

                    <td className='border-r border-black'>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                );
              }

              const isExchange = item.type === 'exchange';
              const isSubstitute = item.type === 'substitute';

              return (
                <tr key={item.id || idx} className='border-b border-black h-7 font-medium text-black'>
                  {/* 1) 신청 수업 */}
                  <td className='border-r border-black text-[10px] px-0.5'>
                    {item.sourceDate?.slice(5)}
                  </td>
                  <td className='border-r border-black'>{item.sourceDay}</td>
                  <td className='border-r border-black font-bold'>{item.sourcePeriod}</td>
                  <td className='border-r border-black font-bold text-[11px] px-0.5'>
                    {formatDeptShortName(item.deptName, item.classCode)}
                  </td>
                  <td className='border-r border-black font-bold'>{formatClassGradeAndRoom(item.classCode)}</td>
                  <td className='border-r border-black font-bold'>{item.subjectName}</td>
                  <td className='border-r border-black font-bold'>{item.originalTeacher || applicantTeacher}</td>

                  {/* 2) 교체 수업 */}
                  <td className='border-r border-black text-[10px] px-0.5'>
                    {isExchange ? item.targetDate?.slice(5) : ''}
                  </td>
                  <td className='border-r border-black'>
                    {isExchange ? item.targetDay : ''}
                  </td>
                  <td className='border-r border-black font-bold'>
                    {isExchange ? item.targetPeriod : ''}
                  </td>
                  <td className='border-r border-black font-bold'>
                    {isExchange ? (item.targetSubject || item.subjectName) : ''}
                  </td>
                  <td className='border-r border-black font-bold'>
                    {isExchange ? item.targetTeacher : ''}
                  </td>
                  <td className='border-r border-black text-[9px] text-slate-400'>
                    {isExchange ? '(인)' : ''}
                  </td>

                  {/* 3) 보강 수업 */}
                  <td className='border-r border-black font-bold'>
                    {isSubstitute ? item.substituteTeacher : ''}
                  </td>
                  <td className='text-[9px] text-slate-400'>
                    {isSubstitute ? '(인)' : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SubstituteOfficialForm({
  application,
  applications,
  onBack,
  onApprove,
  onApproveAll,
  canApprove = false,
}: SubstituteOfficialFormProps) {
  const appList = React.useMemo(() => {
    let raw: SubstituteApplication[] = [];
    if (applications && applications.length > 0) raw = [...applications];
    else if (application) raw = [application];
    else return [];

    // 신청서 목록 날짜순(신청 시작일 -> 신청번호) 정렬
    return raw.sort((a, b) => {
      const aDate = a.periodStart || a.items[0]?.sourceDate || '';
      const bDate = b.periodStart || b.items[0]?.sourceDate || '';
      const dateDiff = aDate.localeCompare(bDate);
      if (dateDiff !== 0) return dateDiff;
      return a.applicationNumber.localeCompare(b.applicationNumber);
    });
  }, [applications, application]);

  // 다중 출력 모드: 'consolidated' = 1장에 통합 출력, 'individual' = 신청서별 각각 출력
  const [viewMode, setViewMode] = React.useState<'consolidated' | 'individual'>(() => {
    return appList.length > 1 ? 'consolidated' : 'individual';
  });

  const handlePrint = () => {
    window.print();
  };

  if (appList.length === 0) {
    return (
      <div className='p-8 text-center bg-white rounded-2xl border border-slate-200'>
        <p className='text-sm font-bold text-slate-600'>출력할 신청서가 없습니다.</p>
        {onBack && (
          <Button onClick={onBack} className='mt-3' size='sm'>
            목록으로 돌아가기
          </Button>
        )}
      </div>
    );
  }

  // 1장 통합 모드용 집계 데이터 계산
  const consolidatedData = React.useMemo(() => {
    if (appList.length === 0) return null;

    const allItems: SubstituteItem[] = [];
    const reasonsSet = new Set<string>();
    const dates: string[] = [];

    appList.forEach(app => {
      if (app.reason) reasonsSet.add(app.reason);
      app.items.forEach(it => {
        allItems.push(it);
        if (it.sourceDate) dates.push(it.sourceDate);
        if (it.targetDate) dates.push(it.targetDate);
      });
    });

    // 수업 항목 날짜순(수업일 -> 교시) 정렬
    allItems.sort((a, b) => {
      const dateDiff = (a.sourceDate || '').localeCompare(b.sourceDate || '');
      if (dateDiff !== 0) return dateDiff;
      return (a.sourcePeriod || 0) - (b.sourcePeriod || 0);
    });

    dates.sort();
    const minDate = dates[0] || appList[0].periodStart;
    const maxDate = dates[dates.length - 1] || appList[0].periodEnd || minDate;

    let periodText = formatDate(minDate);
    if (minDate !== maxDate) {
      periodText = `${formatDate(minDate)} ~ ${formatDate(maxDate)}`;
    }

    const combinedReason = Array.from(reasonsSet).join(' / ');
    const isAllApproved = appList.every(a => a.status === 'approved');

    return {
      status: isAllApproved ? 'approved' : 'submitted',
      approvedBy: appList[0].approvedBy,
      applicantTeacher: appList[0].applicantTeacher,
      reason: combinedReason,
      applicationDate: appList[0].applicationDate,
      periodText,
      items: allItems,
    };
  }, [appList]);

  return (
    <div className='space-y-4'>
      {/* 인쇄 시 레이아웃, 헤더, 사이드바, 네비게이션 숨김 및 파스텔 배경색 강제 적용 CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm 15mm;
            }
            /* 상단 대공커리어싱크 프로필, 헤더, 사이드바, 모바일바, 풋터 등 레이아웃 전체 완전 숨김 */
            header,
            nav,
            aside,
            footer,
            [data-sidebar],
            .print\\:hidden {
              display: none !important;
            }
          }
        `,
      }} />

      {/* 상단 툴바 (화면 전용, 인쇄 시 숨김) */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden'>
        <div className='flex items-center gap-2 flex-wrap'>
          {onBack && (
            <Button
              variant='ghost'
              size='sm'
              onClick={onBack}
              className='h-9 px-3 text-xs font-bold gap-1 text-slate-600 hover:bg-slate-100 cursor-pointer'
            >
              <ArrowLeft className='h-4 w-4' />
              목록으로
            </Button>
          )}

          {appList.length === 1 ? (
            <>
              <span className='text-xs text-slate-500 font-bold'>
                신청 번호: <strong className='text-indigo-600 font-black'>{appList[0].applicationNumber}</strong>
              </span>
              <span className='text-xs px-2.5 py-0.5 rounded-full font-black bg-indigo-50 text-indigo-700 border border-indigo-200'>
                {appList[0].status === 'approved' ? '승인 완료' : appList[0].status === 'submitted' ? '제출 접수됨' : '작성 중'}
              </span>
            </>
          ) : (
            <div className='flex items-center gap-2'>
              <span className='text-xs font-black text-slate-900 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200 text-indigo-800'>
                총 {appList.length}건 선택됨 ({consolidatedData?.items.length}개 수업)
              </span>
              {/* 다중 출력 모드 스위처 */}
              <div className='flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs'>
                <button
                  type='button'
                  onClick={() => setViewMode('consolidated')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer',
                    viewMode === 'consolidated'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  <FileText className='h-3.5 w-3.5' />
                  1장에 통합 출력
                </button>
                <button
                  type='button'
                  onClick={() => setViewMode('individual')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-black transition-all flex items-center gap-1 cursor-pointer',
                    viewMode === 'individual'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  <Files className='h-3.5 w-3.5' />
                  신청서별 각각 출력 ({appList.length}장)
                </button>
              </div>
            </div>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            onClick={handlePrint}
            className='h-9 text-xs font-bold gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer'
          >
            <Printer className='h-4 w-4' />
            공식 신청서 A4 {appList.length > 1 ? (viewMode === 'consolidated' ? '1장 통합 인쇄' : `일괄 인쇄 (${appList.length}장)`) : '인쇄'}
          </Button>
        </div>
      </div>

      {/* 인쇄 본문 렌더링 */}
      {appList.length > 1 && viewMode === 'consolidated' && consolidatedData ? (
        /* 1) 다건 1장 통합 출력 시트 */
        <SingleApplicationSheet
          status={consolidatedData.status}
          approvedBy={consolidatedData.approvedBy}
          applicantTeacher={consolidatedData.applicantTeacher}
          reason={consolidatedData.reason}
          applicationDate={consolidatedData.applicationDate}
          periodText={consolidatedData.periodText}
          items={consolidatedData.items}
          isLast={true}
        />
      ) : (
        /* 2) 신청서별 각각 A4 시트 (다건인 경우 page-break로 연속 인쇄) */
        <div>
          {appList.map((app, idx) => {
            const startDay = app.items[0]?.sourceDay || '';
            const endDay = app.items[app.items.length - 1]?.sourceDay || '';
            const periodText = (app.periodStart === app.periodEnd || !app.periodEnd)
              ? `${formatDate(app.periodStart)}${startDay ? `(${startDay}요일)` : ''}`
              : `${formatDate(app.periodStart)}${startDay ? `(${startDay})` : ''} ~ ${formatDate(app.periodEnd)}${endDay ? `(${endDay})` : ''}`;

            return (
              <SingleApplicationSheet
                key={app.id}
                status={app.status}
                approvedBy={app.approvedBy}
                applicantTeacher={app.applicantTeacher}
                reason={app.reason}
                applicationDate={app.applicationDate}
                periodText={periodText}
                items={app.items}
                isLast={idx === appList.length - 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}