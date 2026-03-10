'use client';

import * as React from 'react';
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
import { Cell, Pie, PieChart, Legend, Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { StudentEmploymentData, MAJOR_SORT_ORDER } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, PieChart as PieChartIcon } from 'lucide-react';

const VIVID_COLORS = [
  '#2563eb', // 대/공기업 (Blue)
  '#4f46e5', // 공무원 (Indigo)
  '#7c3aed', // 중견/강소 (Purple)
  '#ea580c', // 가업승계 (Orange)
  '#0891b2', // 부사관 (Cyan)
  '#e11d48', // 아우스빌둥 (Rose)
  '#db2777', // 도제 (Pink)
  '#6366f1', // 진학 (Indigo-Standard) - 추가됨
  '#0d9488', // 군특성화 (Teal)
  '#65a30d', // 기술사관 (Lime)
  '#ca8a04', // 운동부 (Yellow)
  '#475569', // 특수교육 (Slate)
  '#8b5cf6', // 기타 (Violet)
];

// 범례 및 정렬 순서 정의 (취업 하위 -> 진학 -> 제외인정자 하위)
const COURSE_ORDER = [
  '대/공기업', '공무원', '중견/강소기업', '가업승계', '부사관', '아우스빌둥', '도제',
  '진학', // 진로희망이 진학인 경우
  '군특성화', '기술사관', '운동부', '특수교육대상자', '기타(직접입력)'
];

export default function CareerCourseChart({ 
  data, 
  grade,
  selectedMajor = 'all'
}: { 
  data: StudentEmploymentData[], 
  grade: number,
  selectedMajor?: string
}) {
  const [viewType, setViewType] = React.useState<'pie' | 'bar'>('pie');

  // 학생의 진로 코스를 결정하는 헬퍼 함수
  const getStudentCourse = (student: StudentEmploymentData) => {
    if (student.career_aspiration === '진학') return '진학';
    return student.special_notes || '미설정';
  };

  // 1. 도넛 차트용 전체 집계 데이터
  const formattedPieData = React.useMemo(() => {
    const counts = data.reduce((acc, student) => {
      const course = getStudentCourse(student);
      acc[course] = (acc[course] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => {
        if (a.name === '미설정') return 1;
        if (b.name === '미설정') return -1;
        const indexA = COURSE_ORDER.indexOf(a.name);
        const indexB = COURSE_ORDER.indexOf(b.name);
        
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return b.value - a.value;
      });
  }, [data]);

  // 2. 학과별 또는 반별 막대 차트용 데이터 집계
  const formattedBarData = React.useMemo(() => {
    const isFiltered = selectedMajor !== 'all';
    const groupKey = isFiltered ? 'class_info' : 'major';
    
    // 데이터가 존재하는 코스 목록 추출
    const existingCourses = Array.from(new Set(data.map(s => getStudentCourse(s))))
      .filter(c => data.some(s => getStudentCourse(s) === c))
      .sort((a, b) => {
        if (a === '미설정') return 1;
        if (b === '미설정') return -1;
        const indexA = COURSE_ORDER.indexOf(a);
        const indexB = COURSE_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b, 'ko');
      });

    const groups = Array.from(new Set(data.map((s: any) => s[groupKey]).filter(Boolean))).sort((a: any, b: any) => {
      if (!isFiltered) {
        const indexA = MAJOR_SORT_ORDER.indexOf(a);
        const indexB = MAJOR_SORT_ORDER.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      }
      return a.localeCompare(b, 'ko');
    });

    return {
        chartData: groups.map(group => {
            const groupStudents = data.filter((s: any) => s[groupKey] === group);
            const row: any = { group };
            existingCourses.forEach(course => {
                row[course] = groupStudents.filter(s => getStudentCourse(s) === course).length;
            });
            return row;
        }),
        courses: existingCourses
    };
  }, [data, selectedMajor]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = { value: { label: '학생 수' } };
    const activeCourses = Array.from(new Set(data.map(s => getStudentCourse(s))))
      .sort((a, b) => {
        if (a === '미설정') return 1;
        if (b === '미설정') return -1;
        const indexA = COURSE_ORDER.indexOf(a);
        const indexB = COURSE_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        return 0;
      });

    activeCourses.forEach((opt) => {
      const globalIdx = COURSE_ORDER.indexOf(opt);
      const color = opt === '미설정' ? '#cbd5e1' : VIVID_COLORS[globalIdx % VIVID_COLORS.length] || VIVID_COLORS[0];
      config[opt] = { label: opt, color };
    });
    return config;
  }, [data]);

  return (
    <Card className="flex flex-col border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-bold text-indigo-900">희망 진로 코스</CardTitle>
          <CardDescription>{selectedMajor === 'all' ? '전체 학과' : `${selectedMajor}`} 진로 코스(세부) 현황입니다.</CardDescription>
        </div>
        <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="w-auto">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="pie" className="px-2 py-1"><PieChartIcon className="h-3.5 w-3.5 mr-1" />분포</TabsTrigger>
            <TabsTrigger value="bar" className="px-2 py-1">
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              {selectedMajor === 'all' ? '학과별' : '반별'}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 pb-4 relative min-h-[300px]">
        {formattedPieData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground"><p className="text-sm font-medium">데이터가 없습니다.</p></div>
        ) : viewType === 'pie' ? (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px] w-full animate-in fade-in zoom-in-95 duration-300">
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={formattedPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="75%" paddingAngle={5}
                startAngle={180} endAngle={-180} strokeWidth={1} stroke="#fff" labelLine={true}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {formattedPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" align="center" iconType="circle" layout="horizontal" wrapperStyle={{ fontSize: '10px', paddingTop: '30px' }} />
            </PieChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full animate-in fade-in slide-in-from-right-4 duration-300">
            <BarChart 
              data={formattedBarData.chartData} 
              layout="vertical"
              margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
              categoryGap={15}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="group" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 600 }} 
                width={80}
                tickFormatter={(val) => selectedMajor !== 'all' ? (val.includes('반') ? val : `${val}반`) : val}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    labelFormatter={(label) => selectedMajor !== 'all' ? (label.includes('반') ? label : `${label}반`) : label} 
                  />
                } 
              />
              <Legend verticalAlign="bottom" align="center" iconType="circle" layout="horizontal" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              {formattedBarData.courses.map((opt, idx) => (
                <Bar key={opt} dataKey={opt} stackId="a" fill={chartConfig[opt]?.color} barSize={20} radius={idx === formattedBarData.courses.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
