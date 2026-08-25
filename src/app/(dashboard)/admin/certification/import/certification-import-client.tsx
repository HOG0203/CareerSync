'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  HeartHandshake, 
  Award, 
  Briefcase, 
  Trophy,
  Loader2
} from 'lucide-react';

const CardLoadingFallback = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-white/60 border border-slate-200/80 rounded-2xl min-h-[300px]">
    <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
    <p className="text-sm font-semibold text-slate-600">{title} 모듈 로딩 중...</p>
  </div>
);

const VolunteerImportCard = dynamic(
  () => import('./volunteer-import-card').then(m => m.VolunteerImportCard),
  { loading: () => <CardLoadingFallback title="봉사활동 업로더" />, ssr: false }
);

const VocationalImportCard = dynamic(
  () => import('./vocational-import-card').then(m => m.VocationalImportCard),
  { loading: () => <CardLoadingFallback title="직공통 평가 업로더" />, ssr: false }
);

const EmploymentImportCard = dynamic(
  () => import('./employment-import-card').then(m => m.EmploymentImportCard),
  { loading: () => <CardLoadingFallback title="취업역량 업로더" />, ssr: false }
);

const ArtsContestImportCard = dynamic(
  () => import('./arts-contest-import-card').then(m => m.ArtsContestImportCard),
  { loading: () => <CardLoadingFallback title="예체능/대회실적 업로더" />, ssr: false }
);

interface CertificationImportClientProps {
  isAdmin: boolean;
  userProfile: any;
  baseYear: number;
}

export function CertificationImportClient({
  isAdmin,
  userProfile,
  baseYear,
}: CertificationImportClientProps) {
  const [activeTab, setActiveTab] = React.useState('volunteer');
  // 방문한 탭만 로드하여 최초 페이지 진입 시 불필요한 대용량 DB 쿼리 동시 실행 방지 (5~10배 속도 향상)
  const [visitedTabs, setVisitedTabs] = React.useState<Set<string>>(new Set(['volunteer']));

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setVisitedTabs((prev) => {
      const next = new Set(prev);
      next.add(newTab);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full max-w-7xl mx-auto">
      {/* 부문별 일괄 등록 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl h-auto mb-6">
          <TabsTrigger 
            value="volunteer" 
            className="flex items-center gap-2 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all"
          >
            <HeartHandshake className="h-4 w-4 text-emerald-600" />
            <span>1. 나이스 봉사활동</span>
          </TabsTrigger>

          <TabsTrigger 
            value="vocal" 
            className="flex items-center gap-2 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm transition-all"
          >
            <Award className="h-4 w-4 text-indigo-600" />
            <span>2. 직공통 평가 등급</span>
          </TabsTrigger>

          <TabsTrigger 
            value="employment" 
            className="flex items-center gap-2 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all"
          >
            <Briefcase className="h-4 w-4 text-blue-600" />
            <span>3. 취업역량 & 산학교육</span>
          </TabsTrigger>

          <TabsTrigger 
            value="contest" 
            className="flex items-center gap-2 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm transition-all"
          >
            <Trophy className="h-4 w-4 text-amber-600" />
            <span>4. 예체능 & 대회실적</span>
          </TabsTrigger>
        </TabsList>

        {/* 탭 1: 나이스 봉사활동 일괄 등록 */}
        <TabsContent value="volunteer" className="m-0 focus-visible:outline-none">
          {visitedTabs.has('volunteer') && (
            <VolunteerImportCard
              isAdmin={isAdmin}
              userProfile={userProfile}
              baseYear={baseYear}
            />
          )}
        </TabsContent>

        {/* 탭 2: 직업공통능력평가 등급 일괄 등록 */}
        <TabsContent value="vocal" className="m-0 focus-visible:outline-none">
          {visitedTabs.has('vocal') && (
            <VocationalImportCard
              isAdmin={isAdmin}
              userProfile={userProfile}
              baseYear={baseYear}
            />
          )}
        </TabsContent>

        {/* 탭 3: 취업역량 & 산학협력 일괄 등록 */}
        <TabsContent value="employment" className="m-0 focus-visible:outline-none">
          {visitedTabs.has('employment') && (
            <EmploymentImportCard
              isAdmin={isAdmin}
              userProfile={userProfile}
              baseYear={baseYear}
            />
          )}
        </TabsContent>

        {/* 탭 4: 예체능 & 대회 실적 일괄 등록 */}
        <TabsContent value="contest" className="m-0 focus-visible:outline-none">
          {visitedTabs.has('contest') && (
            <ArtsContestImportCard
              isAdmin={isAdmin}
              userProfile={userProfile}
              baseYear={baseYear}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

