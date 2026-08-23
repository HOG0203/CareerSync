'use client';

import * as React from 'react';
import { VolunteerImportCard } from './volunteer-import-card';
import { VocationalImportCard } from './vocational-import-card';
import { EmploymentImportCard } from './employment-import-card';
import { ArtsContestImportCard } from './arts-contest-import-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  HeartHandshake, 
  Award, 
  Briefcase, 
  Trophy 
} from 'lucide-react';

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

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full max-w-7xl mx-auto">
      {/* 부문별 일괄 등록 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
          <VolunteerImportCard
            isAdmin={isAdmin}
            userProfile={userProfile}
            baseYear={baseYear}
          />
        </TabsContent>

        {/* 탭 2: 직업공통능력평가 등급 일괄 등록 */}
        <TabsContent value="vocal" className="m-0 focus-visible:outline-none">
          <VocationalImportCard
            isAdmin={isAdmin}
            userProfile={userProfile}
            baseYear={baseYear}
          />
        </TabsContent>

        {/* 탭 3: 취업역량 & 산학협력 일괄 등록 */}
        <TabsContent value="employment" className="m-0 focus-visible:outline-none">
          <EmploymentImportCard
            isAdmin={isAdmin}
            userProfile={userProfile}
            baseYear={baseYear}
          />
        </TabsContent>

        {/* 탭 4: 예체능 & 대회 실적 일괄 등록 */}
        <TabsContent value="contest" className="m-0 focus-visible:outline-none">
          <ArtsContestImportCard
            isAdmin={isAdmin}
            userProfile={userProfile}
            baseYear={baseYear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
