import { getCurrentUserProfile } from '@/lib/data';
import { checkTeachingSupportPermission } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { TravelExpenseClient } from './travel-expense-client';

export const metadata = {
  title: '여비 정산 신청 | 교수학습지원',
  description: '출장 여비 정산 신청서 [별지 제3호서식] 자동 작성 및 A4 공문서 출력',
};

export default async function TravelExpensePage() {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile || userProfile.role === 'student') {
    redirect('/dashboard');
  }

  const hasAccess = await checkTeachingSupportPermission('/teaching-support/travel-expense');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-0 print:p-0 print:m-0 print:block">
      <TravelExpenseClient userProfile={userProfile} />
    </div>
  );
}
