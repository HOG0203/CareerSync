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
import { StudentEmploymentData } from '@/lib/types';

export default function ClassEmploymentChart({ data, majorName }: { data: StudentEmploymentData[], majorName: string }) {
  const classes = Array.from(new Set(data.map((s) => s.class_info).filter(Boolean))).sort();
  
  const chartData = classes.map((className) => {
    const classStudents = data.filter((s) => s.class_info === className);
    const 취업 = classStudents.filter((s) => s.business_type === '예').length;
    const 미취업 = classStudents.filter((s) => s.business_type === '아니오').length;
    const 제외인정자 = classStudents.filter((s) => s.business_type === '제외인정자').length;
    
    return {
      className: `${className}반`,
      취업,
      미취업,
      제외인정자,
    };
  });

  const chartConfig = {
    취업: { label: '취업', color: '#10b981' },
    미취업: { label: '미취업', color: '#ef4444' },
    제외인정자: { label: '제외인정자', color: '#94a3b8' },
  } satisfies ChartConfig;

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-blue-900">{majorName} 학반별 취업 현황</CardTitle>
        <CardDescription>학반별 취업, 미취업 및 제외인정자 학생 인원 분포가 표시됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="className" 
              type="category" 
              tick={{ fontSize: 11, fontWeight: 600 }} 
              width={80}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
            <Bar dataKey="취업" stackId="a" fill="var(--color-취업)" barSize={20} />
            <Bar dataKey="미취업" stackId="a" fill="var(--color-미취업)" barSize={20} />
            <Bar dataKey="제외인정자" stackId="a" fill="var(--color-제외인정자)" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
