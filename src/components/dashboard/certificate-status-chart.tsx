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
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend
} from 'recharts';
import { StudentEmploymentData, MAJOR_SORT_ORDER } from '@/lib/types';

interface CertificateStatusChartProps {
  data: StudentEmploymentData[];
  type: 'major' | 'class';
  title: string;
}

export default function CertificateStatusChart({ data, type, title }: CertificateStatusChartProps) {
  // 1. 학과 또는 반 목록 추출 및 정렬
  const groups = Array.from(new Set(data.map((s) => type === 'major' ? s.major : s.class_info).filter(Boolean))).sort((a, b) => {
    if (type === 'major') {
      const indexA = MAJOR_SORT_ORDER.indexOf(a as string);
      const indexB = MAJOR_SORT_ORDER.indexOf(b as string);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    }
    return (a as string || '').localeCompare((b as string || ''), 'ko');
  });
  
  // 2. 데이터 집계 (학과/반 별로 자격증 개수 구간별 학생 수 카운트)
  const chartData = groups.map((groupName) => {
    const groupStudents = data.filter((s) => (type === 'major' ? s.major : s.class_info) === groupName);
    
    return {
      name: type === 'major' ? groupName : `${groupName}반`,
      '0개': groupStudents.filter(s => (s.certificates?.length || 0) === 0).length,
      '1개': groupStudents.filter(s => (s.certificates?.length || 0) === 1).length,
      '2개': groupStudents.filter(s => (s.certificates?.length || 0) === 2).length,
      '3개': groupStudents.filter(s => (s.certificates?.length || 0) === 3).length,
      '4개': groupStudents.filter(s => (s.certificates?.length || 0) === 4).length,
      '5개': groupStudents.filter(s => (s.certificates?.length || 0) === 5).length,
      '6개이상': groupStudents.filter(s => (s.certificates?.length || 0) >= 6).length,
    };
  });

  // 3. 차트 설정 (푸른색 -> 회색 그라데이션)
  const chartConfig = {
    '6개이상': { label: '6개 이상', color: '#1e3a8a' }, // Deep Blue
    '5개': { label: '5개', color: '#1d4ed8' },
    '4개': { label: '4개', color: '#3b82f6' },
    '3개': { label: '3개', color: '#60a5fa' },
    '2개': { label: '2개', color: '#93c5fd' },
    '1개': { label: '1개', color: '#bfdbfe' },
    '0개': { label: '0개', color: '#cbd5e1' },      // Slate Gray
  } satisfies ChartConfig;

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-blue-900">{title}</CardTitle>
        <CardDescription>보유한 자격증 개수에 따른 학생 인원 분포가 표시됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
            <XAxis 
              type="number" 
              domain={[0, 6]} 
              ticks={[0, 1, 2, 3, 4, 5, 6]}
              tick={{ fontSize: 10 }}
              hide
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fontSize: 11, fontWeight: 600 }} 
              width={80}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
            
            {/* 데이터 표시 순서 (0개가 가장 왼쪽, 6개이상이 가장 오른쪽) */}
            <Bar dataKey="0개" stackId="a" fill="var(--color-0개)" barSize={20} />
            <Bar dataKey="1개" stackId="a" fill="var(--color-1개)" barSize={20} />
            <Bar dataKey="2개" stackId="a" fill="var(--color-2개)" barSize={20} />
            <Bar dataKey="3개" stackId="a" fill="var(--color-3개)" barSize={20} />
            <Bar dataKey="4개" stackId="a" fill="var(--color-4개)" barSize={20} />
            <Bar dataKey="5개" stackId="a" fill="var(--color-5개)" barSize={20} />
            <Bar dataKey="6개이상" stackId="a" fill="var(--color-6개이상)" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
