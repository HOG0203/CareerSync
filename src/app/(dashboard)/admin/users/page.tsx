import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserTable } from './user-table';
import { CreateUserButton } from './create-user-button';
import { getProfiles, getGraduationYears, getAllStudentBaseData } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { UserCog } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin';
}

export default async function AdminUsersPage() {
  // 권한 체크 로직 임시 비활성화 상태 유지
  /*
  const isAdmin = await checkAdmin();
  if (!isAdmin) {
    redirect('/dashboard');
  }
  */

  const profiles = await getProfiles();
  const graduationYears = await getGraduationYears();
  const allBaseData = await getAllStudentBaseData();
  const settings = await getSystemSettings();
  
  // 학년도별 학과 및 반 정보 전체 매핑 데이터 생성
  const fullClassMapping: { year: number; major: string; className: string }[] = allBaseData
    .map(s => ({ 
      year: s.graduation_year || 0,
      major: s.major || '', 
      className: s.class_info || '' 
    }))
    .filter((v, i, a) => a.findIndex(t => t.year === v.year && t.major === v.major && t.className === v.className) === i)
    .filter(item => item.year && item.major && item.className);

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <UserCog className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            사용자 관리
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">시스템 접속 권한 및 담당 학반 정보를 관리합니다.</p>
        </div>
        <div className="w-full sm:w-auto">
          <CreateUserButton />
        </div>
      </div>

      <Card className="shadow-sm border-none bg-white rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b py-4 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg font-bold">계정 목록</CardTitle>
          <CardDescription className="text-xs">총 {profiles.length}명의 사용자가 등록되어 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <UserTable 
            initialProfiles={profiles} 
            graduationYears={graduationYears}
            fullClassMapping={fullClassMapping}
            baseYear={settings.baseYear}
          />
        </CardContent>
      </Card>
    </div>
  );
}
