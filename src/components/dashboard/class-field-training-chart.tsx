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

export default function ClassFieldTrainingChart({ data, majorName }: { data: StudentEmploymentData[], majorName: string }) {
  const classes = Array.from(new Set(data.map((s) => s.class_info).filter(Boolean))).sort();
  
  const chartData = classes.map((className) => {
    const classStudents = data.filter((s) => s.class_info === className);
    const trainingCount = classStudents.filter(s => s.has_field_training === 'O').length;
    
    return {
      className: `${className}반`,
      실시: trainingCount,
      미실시: classStudents.length - trainingCount,
    };
  });

  const chartConfig = {
    실시: { label: '실시', color: '#4ade80' },
    미실시: { label: '미실시', color: '#cbd5e1' },
  } satisfies ChartConfig;

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-amber-900">{majorName} 반별 현장실습 참여 현황</CardTitle>
        <CardDescription>현장실습 실시 여부에 따른 학반별 통계</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="className" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            <Bar dataKey="실시" stackId="a" fill="var(--color-실시)" />
            <Bar dataKey="미실시" stackId="a" fill="var(--color-미실시)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
