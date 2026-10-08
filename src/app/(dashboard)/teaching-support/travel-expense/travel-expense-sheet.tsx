'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/travel-expense/travel-expense-sheet.tsx
// 학교 공식 양식 '[별지 제3호서식] 여비 정산 신청서' 100% 1:1 완벽 일치 렌더링 & 인쇄
// ==============================================================================

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TransportationRow {
  id: string;
  date: string; // 'YYYY. M. D.'
  transportType: string; // '자차', '버스', '기차' 등
  origin: string; // '대구'
  destination: string; // '경산'
  grade?: string; // 등급
  amount?: number | ''; // 금액
}

export interface TravelExpenseData {
  affiliation: string; // 소속
  position: string; // 직급(직위)
  applicantName: string; // 성명
  tripDateText: string; // 출장 일시
  tripDestination: string; // 출장(부임)지
  lodgingLimitAmount?: number | '';
  lodgingActualAmount?: number | '';
  lodgingExcessReason?: string;
  mealPaidAmount?: number | '';
  mealActualAmount?: number | '';
  mealExcessReason?: string;
  transportRows: TransportationRow[];
  fuelType?: string; // 차량 유종 (전기, 휘발유 등)
  passengerName?: string; // 차량 동승자
  attachmentText?: string; // 첨부 서류
  settlementDateText: string; // 신청일자
}

interface TravelExpenseSheetProps {
  data: TravelExpenseData;
  className?: string;
}

export function TravelExpenseSheet({ data, className }: TravelExpenseSheetProps) {
  // 운임 합계 계산
  const totalTransportAmount = React.useMemo(() => {
    return (data.transportRows || []).reduce((acc, row) => {
      const val = typeof row.amount === 'number' ? row.amount : parseInt(String(row.amount || 0), 10);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [data.transportRows]);

  // 최소 2개 행 보장 (출력 양식 높이 및 밸런스 유지)
  const displayRows = React.useMemo(() => {
    const rows = [...(data.transportRows || [])];
    while (rows.length < 2) {
      rows.push({
        id: `empty-${rows.length}`,
        date: '',
        transportType: '',
        origin: '',
        destination: '',
        grade: '',
        amount: ''
      });
    }
    return rows;
  }, [data.transportRows]);

  return (
    <div
      className={cn(
        "bg-white text-black font-serif print:font-serif mx-auto border border-slate-300 shadow-lg print:shadow-none print:border-none",
        "w-full max-w-[800px] p-6 sm:p-10 md:p-12 print:p-0 print:m-0 print:max-w-none print:w-full print:min-h-0",
        className
      )}
      style={{
        boxSizing: 'border-box',
        minHeight: '1000px',
        breakInside: 'avoid',
        pageBreakInside: 'avoid'
      }}
    >
      {/* 1. 좌측 상단 별지 서식 표기 */}
      <div className="flex justify-between items-baseline mb-6">
        <span className="text-[13px] tracking-tight font-medium text-black">
          [별지 제3호서식]
        </span>
      </div>

      {/* 2. 문서 타이틀 */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.4em] pl-[0.4em] text-black">
          여비 정산 신청서
        </h1>
      </div>

      {/* 3. 메인 신청서 테이블 (외곽 테두리 및 내부 격자) */}
      {/* 3. 메인 신청서 테이블 (원본 PDF 100% 1:1 완벽 일치 구조) */}
      <div className="border border-black border-collapse">
        <table className="w-full border-collapse text-[13px] text-center table-fixed">
          <colgroup>
            {/* 원본 좌표 기반 7개 열 비율 (총 479.2pt) */}
            {/* C0(구분): 43.5pt (9.1%) */}
            <col style={{ width: '9.2%' }} />
            {/* C1(일시/일자): 79.7pt (16.6%) */}
            <col style={{ width: '16.6%' }} />
            {/* C2(교통편/상한액): 58.4pt (12.2%) */}
            <col style={{ width: '12.2%' }} />
            {/* C3(출발지/실제소요): 49.9pt (10.4%) */}
            <col style={{ width: '10.4%' }} />
            {/* C4(도착지/비고): 58.4pt (12.2%) */}
            <col style={{ width: '12.2%' }} />
            {/* C5(등급/초과지출사유): 69.5pt (14.5%) */}
            <col style={{ width: '14.5%' }} />
            {/* C6(금액): 119.8pt (24.9%) */}
            <col style={{ width: '24.9%' }} />
          </colgroup>
          <tbody>
            {/* 1행: 소속, 직급, 성명 */}
            <tr className="border-b border-black h-10">
              <th className="border-r border-black font-normal bg-white tracking-widest px-1">
                소 속
              </th>
              <td colSpan={3} className="border-r border-black px-3 text-left font-normal text-[13px]">
                {data.affiliation || '대구공업고등학교'}
              </td>
              <th className="border-r border-black font-normal bg-white px-1 leading-tight text-[12px]">
                직 급<br />(직위)
              </th>
              <td className="border-r border-black px-2 text-center font-normal">
                {data.position || '교사'}
              </td>
              <td className="p-0">
                <div className="flex h-full items-center">
                  <span className="w-14 border-r border-black h-full flex items-center justify-center font-normal tracking-widest shrink-0">
                    성 명
                  </span>
                  <span className="flex-1 text-center font-normal px-2">
                    {data.applicantName || ''}
                  </span>
                </div>
              </td>
            </tr>

            {/* 2행: 출장(부임) 일정 - 일시 */}
            <tr className="border-b border-black border-dashed h-9">
              <th rowSpan={2} className="border-r border-black font-normal bg-white px-1 leading-snug">
                출 장<br />(부임)<br />일 정
              </th>
              <th className="border-r border-black border-dashed font-normal tracking-widest px-2 text-center">
                일 시
              </th>
              <td colSpan={5} className="px-3 text-left font-normal">
                {data.tripDateText || ''}
              </td>
            </tr>

            {/* 3행: 출장(부임) 일정 - 출장(부임)지 */}
            <tr className="border-b border-black h-9">
              <th className="border-r border-black border-dashed font-normal px-2 text-center text-[12.5px]">
                출장(부임)지
              </th>
              <td colSpan={5} className="px-3 text-left font-normal">
                {data.tripDestination || ''}
              </td>
            </tr>

            {/* 4행: 숙박비 */}
            <tr className="border-b border-black h-12">
              <th className="border-r border-black font-normal bg-white tracking-wider px-1">
                숙박비
              </th>
              {/* 상한액 라벨 칸 */}
              <th className="border-r border-black font-normal bg-white px-1 text-[11.5px] leading-tight text-center">
                상한액 또는<br />지급받은 선금
              </th>
              {/* 상한액 금액 기입란 */}
              <td className="border-r border-black px-2 text-right font-normal font-mono">
                {data.lodgingLimitAmount ? `${Number(data.lodgingLimitAmount).toLocaleString()}원` : ''}
              </td>
              {/* 실제 소요액 라벨 칸 */}
              <th className="border-r border-black font-normal bg-white px-1 leading-tight text-[12px]">
                실제<br />소요액
              </th>
              {/* 실제 소요액 금액 기입란 */}
              <td className="border-r border-black px-2 text-right font-normal font-mono">
                {data.lodgingActualAmount ? `${Number(data.lodgingActualAmount).toLocaleString()}원` : ''}
              </td>
              {/* 초과지출 사유 라벨 칸 */}
              <th className="border-r border-black border-dashed font-normal bg-white px-1 leading-tight text-[12px]">
                초과지출<br />사 유
              </th>
              {/* 초과지출 사유 내용 기입란 */}
              <td className="px-2 text-left text-xs font-normal">
                {data.lodgingExcessReason || ''}
              </td>
            </tr>

            {/* 5행: 식비 */}
            <tr className="border-b border-black h-13">
              <th className="border-r border-black font-normal bg-white tracking-widest px-1">
                식 비
              </th>
              {/* 지급받은 금액 라벨 칸 */}
              <th className="border-r border-black font-normal bg-white px-1 text-[12px] leading-tight text-center">
                지급받은 금액
              </th>
              {/* 지급받은 금액 기입란 */}
              <td className="border-r border-black px-2 text-right font-normal font-mono">
                {data.mealPaidAmount ? `${Number(data.mealPaidAmount).toLocaleString()}원` : ''}
              </td>
              {/* 실제 소요액 라벨 칸 (안내문구 포함) */}
              <th className="border-r border-black font-normal bg-white p-1 text-center">
                <div className="leading-tight text-[12px] mb-0.5">
                  실제<br />소요액
                </div>
                <div className="text-[9.5px] text-blue-600 font-normal leading-tight">
                  식사제공 제외<br />개인비용 사용시<br />작성
                </div>
              </th>
              {/* 실제 소요액 금액 기입란 */}
              <td className="border-r border-black px-2 text-right font-normal font-mono">
                {data.mealActualAmount ? `${Number(data.mealActualAmount).toLocaleString()}원` : ''}
              </td>
              {/* 초과지출 사유 라벨 칸 */}
              <th className="border-r border-black border-dashed font-normal bg-white px-1 leading-tight text-[12px]">
                초과지출<br />사 유
              </th>
              {/* 초과지출 사유 내용 기입란 */}
              <td className="px-2 text-left text-xs font-normal">
                {data.mealExcessReason || ''}
              </td>
            </tr>

            {/* 6행: 운임 헤더 행 */}
            <tr className="border-b border-black h-9 bg-white">
              <th
                rowSpan={displayRows.length + 2}
                className="border-r border-black font-normal bg-white tracking-widest px-1 align-middle"
              >
                운 임
              </th>
              <th className="border-r border-black font-normal tracking-widest">일 자</th>
              <th className="border-r border-black font-normal tracking-wider">교통편</th>
              <th className="border-r border-black font-normal tracking-wider">출발지</th>
              <th className="border-r border-black font-normal tracking-wider">도착지</th>
              <th className="border-r border-black font-normal tracking-wider text-[12.5px]">등 급</th>
              <th className="font-normal tracking-widest">금 액</th>
            </tr>

            {/* 7행+: 운임 데이터 행 (동적) */}
            {displayRows.map((r, idx) => (
              <tr 
                key={r.id || idx} 
                className={cn(
                  "h-8.5",
                  idx === displayRows.length - 1 ? "border-b border-black" : "border-b border-black border-dashed"
                )}
              >
                <td className="border-r border-black px-1 font-normal font-mono text-[12px]">
                  {r.date || ''}
                </td>
                <td className="border-r border-black px-1 font-normal">
                  {r.transportType || ''}
                </td>
                <td className="border-r border-black px-1 font-normal">
                  {r.origin || ''}
                </td>
                <td className="border-r border-black px-1 font-normal">
                  {r.destination || ''}
                </td>
                <td className="border-r border-black px-1 font-normal text-[12px]">
                  {r.grade || ''}
                </td>
                <td className="px-2 text-right font-normal font-mono text-[12.5px]">
                  {typeof r.amount === 'number'
                    ? r.amount.toLocaleString()
                    : (r.amount ? Number(r.amount).toLocaleString() : '')}
                </td>
              </tr>
            ))}

            {/* 운임 합계 행 */}
            <tr className="border-b border-black h-9">
              <th colSpan={5} className="border-r border-black font-normal tracking-[0.5em] text-center pr-4">
                합 계
              </th>
              <td className="px-2 text-right font-bold font-mono text-[13px]">
                {totalTransportAmount > 0 ? totalTransportAmount.toLocaleString() : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. 하단 규정 안내문, 특이사항, 첨부서류 및 서명 섹션 */}
        <div className="p-6 sm:p-8 space-y-5 text-[13px] leading-relaxed">
          <p className="text-left font-normal leading-relaxed text-black tracking-tight">
            ｢공무원여비규정｣ 제16조 제1항·제2항에 의하여 관계서류를 첨부하여 위와 같이 여비의 정산을 신청합니다.
          </p>

          {/* 비고 및 차량 정보 */}
          <div className="space-y-1 text-left font-normal pl-2">
            {data.fuelType && data.fuelType !== '해당없음' && (
              <p>※ 차량 유종 : {data.fuelType}</p>
            )}
            {data.passengerName && (
              <p>※ 차량 동승자 : {data.passengerName}</p>
            )}
            {(!data.fuelType || data.fuelType === '해당없음') && !data.passengerName && (
              <p className="invisible">※ 공란</p>
            )}
          </div>

          {/* 첨부 서류 */}
          <div className="text-left font-normal pl-2 pt-1">
            <p>첨 부 : {data.attachmentText || '하이패스 영수증 1부'}</p>
          </div>

          {/* 신청 일자 */}
          <div className="text-center pt-8 tracking-wider font-normal text-[14px]">
            {data.settlementDateText || `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월 ${new Date().getDate()}일`}
          </div>

          {/* 신청인 서명란 */}
          <div className="flex justify-end pr-6 sm:pr-10 pt-4 pb-2">
            <div className="flex items-center text-[14px] font-normal tracking-wide">
              <span className="tracking-[0.4em] mr-4">신 청 인</span>
              <span className="tracking-[0.4em] mr-4">성 명</span>
              <span className="font-semibold px-2 min-w-[70px] text-center underline underline-offset-4">
                {data.applicantName || '이호중'}
              </span>
              <span className="ml-3 tracking-normal">(인)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. 표 외부 하단 각주 (※ 규정 안내) */}
      <div className="mt-4 space-y-1 text-[11px] text-slate-700 font-normal leading-relaxed text-left pl-1">
        <p>
          ※ 정산하는 여비항목 중 식비와 준비금은 국외여행에 한하며, 숙박비는 국내여행에 한함(국외여행의 숙박비는 별지 제7호서식 사용)
        </p>
        <p>
          ※ 정산하는 여비항목 중 운임은 국내여행에 한함. 다만, 국내·외 항공운임은 별지 제5호 서식에 의함
        </p>
      </div>
    </div>
  );
}
