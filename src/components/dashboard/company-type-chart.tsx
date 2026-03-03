'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { StudentEmploymentData } from '@/lib/data';

// 선명하고 가독성 높은 원본 컬러 팔레트
const VIVID_COLORS = [
  '#2563eb', // Vivid Blue
  '#7c3aed', // Vivid Purple
  '#ea580c', // Vivid Orange
  '#16a34a', // Vivid Green
  '#dc2626', // Vivid Red
  '#475569', // Vivid Slate
  '#ca8a04', // Vivid Yellow
];

export default function CompanyTypeChart({ data }: { data: StudentEmploymentData[] }) {
  // 취업 확정자 또는 현장실습 참여자를 대상으로 통계 산출
  const chartData = data.reduce((acc, student) => {
    const isEmployed = student.employment_status !== '미취업' && !!student.employment_status;
    const isTraining = student.has_field_training === 'O';
    const hasCompany = !!student.company;

    // 2027년도 학생(현재 2학년 등)은 취업 확정 전이라도 실습이나 기업 배정 정보가 있을 수 있으므로 포함 범위 확대
    if (isEmployed || isTraining || hasCompany) {
      const type = student.company_type || '기타';
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const formattedData = Object.entries(chartData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const hasData = formattedData.length > 0;

  const chartConfig = {
    value: { label: '학생 수' },
  } satisfies ChartConfig;

  return (
    <Card className="flex flex-col border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-lg font-bold">기업 규모별 취업 분포</CardTitle>
        <CardDescription>취업 및 실습 예정 기업 유형별 통계</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0 relative">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground animate-in fade-in duration-500">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
            </div>
            <p className="text-sm font-medium">분석 가능한 데이터가 없습니다.</p>
            <p className="text-[11px] opacity-70 mt-1">기업 정보 또는 실습 정보 등록이 필요합니다.</p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[300px] w-full"
          >
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={formattedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="80%"
                strokeWidth={2}
                labelLine={true}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {formattedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={VIVID_COLORS[index % VIVID_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
