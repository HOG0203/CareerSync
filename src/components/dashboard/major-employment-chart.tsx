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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { StudentEmploymentData } from '@/lib/data';

export default function MajorEmploymentChart({ data }: { data: StudentEmploymentData[] }) {
  const majors = Array.from(new Set(data.map((s) => s.major).filter(Boolean)));
  
  const chartData = majors.map((major) => {
    const majorStudents = data.filter((s) => s.major === major);
    const employedCount = majorStudents.filter(
      (s) => s.employment_status !== '미취업' && s.employment_status
    ).length;
    
    return {
      major,
      취업: employedCount,
      미취업: majorStudents.length - employedCount,
    };
  }).sort((a, b) => b.취업 - a.취업);

  const chartConfig = {
    취업: { label: '취업', color: '#93c5fd' },
    미취업: { label: '미취업', color: '#cbd5e1' },
  } satisfies ChartConfig;

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-blue-900">학과별 취업 현황</CardTitle>
        <CardDescription>학과별 취업자 및 미취업자 인원 비교</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="major" 
              type="category" 
              tick={{ fontSize: 11, fontWeight: 600 }} 
              width={80}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
            <Bar dataKey="취업" stackId="a" fill="var(--color-취업)" barSize={20} />
            <Bar dataKey="미취업" stackId="a" fill="var(--color-미취업)" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
