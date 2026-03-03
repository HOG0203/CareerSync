'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface AdminClassSelectorProps {
  availableGrades: number[];
  majors: string[];
  classes: string[];
  isAdmin?: boolean;
}

export default function AdminClassSelector({ availableGrades, majors, classes, isAdmin }: AdminClassSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터가 있으면 우선 사용, 없으면 3학년(목록에 있으면) 또는 첫 번째 항목 사용
  const currentGrade = searchParams.get('grade') || (availableGrades.includes(3) ? '3' : String(availableGrades[0] || '3'));
  const currentMajor = searchParams.get('major') || majors[0] || '';
  const currentClass = searchParams.get('class') || classes[0] || '';

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    // 학년이 바뀌면 학과/반 목록이 달라지므로 초기화
    if (key === 'grade' && isAdmin) {
      params.delete('major');
      params.delete('class');
    }
    // 학과가 바뀌면 반 목록이 달라지므로 초기화
    if (key === 'major' && isAdmin) {
      params.delete('class');
    }
    router.push(`/class-management?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-700 whitespace-nowrap uppercase tracking-wider">학년</span>
        <Select value={currentGrade} onValueChange={(v) => updateParam('grade', v)}>
          <SelectTrigger className="w-[120px] h-9 text-xs bg-white border-blue-200">
            <SelectValue placeholder="학년 선택" />
          </SelectTrigger>
          <SelectContent>
            {availableGrades.sort().map(grade => (
              <SelectItem key={grade} value={String(grade)} className="text-xs">{grade}학년</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-700 whitespace-nowrap uppercase tracking-wider">학과</span>
        <Select value={currentMajor} onValueChange={(v) => updateParam('major', v)} disabled={!isAdmin}>
          <SelectTrigger className={cn("w-[180px] h-9 text-xs bg-white border-blue-200", !isAdmin && "bg-slate-50 opacity-80")}>
            <SelectValue placeholder="학과 선택" />
          </SelectTrigger>
          <SelectContent>
            {majors.map(m => (
              <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-700 whitespace-nowrap uppercase tracking-wider">반</span>
        <Select value={currentClass} onValueChange={(v) => updateParam('class', v)} disabled={!isAdmin}>
          <SelectTrigger className={cn("w-[100px] h-9 text-xs bg-white border-blue-200", !isAdmin && "bg-slate-50 opacity-80")}>
            <SelectValue placeholder="반 선택" />
          </SelectTrigger>
          <SelectContent>
            {classes.sort().map(c => (
              <SelectItem key={c} value={c} className="text-xs">{c}반</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="ml-auto flex items-center gap-4">
        {isAdmin ? (
           <div className="text-[10px] text-blue-500 font-medium flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             관리자 권한: 모든 학반 조회가 가능합니다.
           </div>
        ) : (
           <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
             <Check className="w-3 h-3" />
             담당 학반 전용 모드
           </div>
        )}
      </div>
    </div>
  );
}
