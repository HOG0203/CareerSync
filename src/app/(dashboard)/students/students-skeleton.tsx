'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle2, Building2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 학생 취업 현황 시트 전용 스켈레톤 테이블
 */
export function StudentsTableSkeleton() {
  return (
    <div className="w-full h-full flex flex-col min-h-[440px] bg-white rounded-2xl overflow-hidden animate-in fade-in duration-200">
      {/* 엑셀식 시트 상단 헤더 스켈레톤 */}
      <div className="h-10 bg-slate-50/90 border-b border-slate-200 px-4 flex items-center gap-3 shrink-0 select-none">
        <div className="h-3.5 w-12 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-8 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-8 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-14 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-24 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-16 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-20 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-20 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-16 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-20 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-24 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-20 bg-slate-200 animate-pulse rounded" />
        <div className="h-3.5 w-28 bg-slate-200 animate-pulse rounded hidden sm:block" />
      </div>

      {/* 데이터 행 스켈레톤 (12행) */}
      <div className="flex-1 divide-y divide-slate-100 overflow-hidden">
        {Array.from({ length: 14 }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'h-9 px-4 flex items-center gap-3 select-none',
              idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
            )}
          >
            {/* 학과 */}
            <div className="h-3.5 w-12 bg-slate-200/80 animate-pulse rounded" />
            {/* 반 */}
            <div className="h-3.5 w-8 bg-slate-200/60 animate-pulse rounded" />
            {/* 번호 */}
            <div className="h-3.5 w-8 bg-slate-200/60 animate-pulse rounded" />
            {/* 성명 */}
            <div className="h-3.5 w-14 bg-slate-200/90 animate-pulse rounded font-bold" />
            {/* 휴대전화번호 */}
            <div className="h-3.5 w-24 bg-slate-100 animate-pulse rounded" />
            {/* 진로희망 */}
            <div className="h-3.5 w-16 bg-slate-200/60 animate-pulse rounded" />
            {/* 희망기업유형 */}
            <div className="h-3.5 w-20 bg-slate-200/60 animate-pulse rounded" />
            {/* 희망진로코스 */}
            <div className="h-3.5 w-20 bg-slate-200/60 animate-pulse rounded" />
            {/* 취업희망 */}
            <div className="h-3.5 w-16 bg-slate-100 animate-pulse rounded" />
            {/* 최종진로코스 */}
            <div className="h-3.5 w-20 bg-slate-200/60 animate-pulse rounded" />
            {/* 취업처 */}
            <div className="h-3.5 w-24 bg-slate-200/80 animate-pulse rounded" />
            {/* 사업체구분 */}
            <div className="h-3.5 w-20 bg-slate-100 animate-pulse rounded" />
            {/* 비고/자격증 */}
            <div className="h-3.5 w-28 bg-slate-200/50 animate-pulse rounded hidden sm:block" />
          </div>
        ))}
      </div>

      {/* 하단 상태바 스켈레톤 */}
      <div className="h-8 bg-slate-50 border-t border-slate-200/80 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="h-3 w-32 bg-slate-200/70 animate-pulse rounded" />
        <div className="h-3 w-20 bg-slate-200/70 animate-pulse rounded" />
      </div>
    </div>
  );
}

/**
 * 학생 취업 현황 전체 페이지 초기 로딩용 스켈레톤 (loading.tsx 대응)
 */
export function StudentsFullPageSkeleton() {
  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden animate-in fade-in duration-200">
      {/* 상단 타이틀 스켈레톤 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-2.5">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-100 animate-pulse shrink-0" />
            <div className="h-7 w-44 sm:w-56 bg-slate-200 animate-pulse rounded-lg" />
            <div className="h-6 w-28 bg-blue-100 animate-pulse rounded-full" />
          </div>
          <div className="h-3.5 w-72 sm:w-96 bg-slate-200/70 animate-pulse rounded" />
        </div>
      </div>

      {/* 4종 통계 카드 스켈레톤 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-sm font-bold text-slate-600">조회 학생수</p>
              <div className="h-7 w-16 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-sm font-bold text-slate-600">취업률</p>
              <div className="h-7 w-20 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-sm font-bold text-slate-600">현장실습 참여</p>
              <div className="h-7 w-16 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-sm font-bold text-slate-600">미연계 학생</p>
              <div className="h-7 w-16 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <HelpCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 툴바 스켈레톤 */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0">
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between flex-wrap">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              <div className="h-9 w-[110px] bg-slate-100 animate-pulse rounded-xl border border-slate-200/60" />
              <div className="h-9 w-[95px] bg-slate-100 animate-pulse rounded-xl border border-slate-200/60" />
              <div className="h-9 w-[130px] bg-slate-100 animate-pulse rounded-xl border border-slate-200/60" />
              <div className="h-9 w-[100px] bg-slate-100 animate-pulse rounded-xl border border-slate-200/60" />
              <div className="h-9 w-[130px] bg-slate-100 animate-pulse rounded-xl border border-slate-200/60" />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="h-9 w-full sm:w-56 bg-slate-100 animate-pulse rounded-xl border border-slate-200/60" />
              <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-xl border border-slate-200/60 shrink-0" />
              <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-xl border border-slate-200/60 shrink-0" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 메인 시트 영역 스켈레톤 */}
      <Card className="h-auto overflow-visible lg:flex-1 lg:min-h-0 lg:overflow-hidden shadow-sm border border-slate-200/80 bg-white flex flex-col rounded-2xl min-w-full mb-0">
        <CardContent className="h-auto overflow-visible lg:flex-1 lg:overflow-hidden p-0 relative flex flex-col lg:min-h-0">
          <StudentsTableSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
