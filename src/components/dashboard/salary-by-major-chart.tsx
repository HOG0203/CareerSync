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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { StudentEmploymentData, MAJOR_SORT_ORDER } from '@/lib/types';

export default function SalaryByMajorChart({ data }: { data: StudentEmploymentData[] }) {
  const majors = Array.from(new Set(data.map((s) => s.major).filter(Boolean))).sort((a, b) => {
    const indexA = MAJOR_SORT_ORDER.indexOf(a as string);
    const indexB = MAJOR_SORT_ORDER.indexOf(b as string);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
  
  const chartData = majors.map((major) => {
    // 현재 데이터에 급여(salary) 정보가 없으므로 안전하게 0으로 처리하거나 추후 필드 추가 필요
    const majorStudents = data.filter(s => s.major === major && s.business_type === '예');
    const averageSalary = 0; 
    
    return {
      major,
      salary: averageSalary,
    };
  });

  const chartConfig = {
    salary: { label: '평균 급여 (만원)', color: '#10b981' },
  } satisfies ChartConfig;

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold">학과별 평균 급여</CardTitle>
        <CardDescription>학과별 취업 학생들의 평균 초봉 현황.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} opacity={0.3} />
            <XAxis type="number" hide />
            <YAxis dataKey="major" type="category" tick={{ fontSize: 12 }} width={80} axisLine={false} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="salary" fill="var(--color-salary)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
