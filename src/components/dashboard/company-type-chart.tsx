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
import { Cell, Pie, PieChart, Legend, ResponsiveContainer } from 'recharts';
import { StudentEmploymentData } from '@/lib/types';

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
  // 취업여부가 '예'인 학생들만 대상으로 기업구분별 통계 산출
  const chartData = data.reduce((acc, student) => {
    if (student.business_type === '예') {
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
        <CardDescription>취업이 확정된 학생들의 기업 규모별 구성 현황이 표시됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4 relative">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground animate-in fade-in duration-500">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
            </div>
            <p className="text-sm font-medium">분석 가능한 데이터가 없습니다.</p>
            <p className="text-[11px] opacity-70 mt-1">학생들의 '취업여부'와 '기업구분' 설정이 필요합니다.</p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[350px] w-full"
          >
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
                innerRadius="45%"
                outerRadius="65%"
                paddingAngle={2}
                strokeWidth={1}
                stroke="#fff"
                labelLine={true}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {formattedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={VIVID_COLORS[index % VIVID_COLORS.length]} />
                ))}
              </Pie>
              <Legend 
                verticalAlign="bottom" 
                align="center" 
                iconType="circle" 
                layout="horizontal"
                wrapperStyle={{ fontSize: '11px', paddingTop: '30px' }}
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
