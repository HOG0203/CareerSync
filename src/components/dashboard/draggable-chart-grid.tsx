'use client';

import * as React from 'react';
import { GripVertical, RotateCcw, Move, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DraggableChartGridProps {
  storageKey: string;
  defaultKeys: string[];
  initialOrder?: string[];
  isAdmin?: boolean;
  onSaveOrder?: (newOrder: string[]) => Promise<any>;
  renderChart: (key: string) => React.ReactNode;
}

export function DraggableChartGrid({ 
  storageKey, 
  defaultKeys, 
  initialOrder, 
  isAdmin = false, 
  onSaveOrder, 
  renderChart 
}: DraggableChartGridProps) {
  const { toast } = useToast();

  const getEffectiveOrder = React.useCallback(() => {
    if (initialOrder && Array.isArray(initialOrder) && initialOrder.length === defaultKeys.length) {
      if (initialOrder.every(k => defaultKeys.includes(k))) {
        return initialOrder;
      }
    }
    return defaultKeys;
  }, [initialOrder, defaultKeys]);

  const [order, setOrder] = React.useState<string[]>(getEffectiveOrder);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // DB initialOrder 변경 시 동기화
  React.useEffect(() => {
    if (initialOrder && Array.isArray(initialOrder) && initialOrder.length === defaultKeys.length) {
      if (initialOrder.every(k => defaultKeys.includes(k))) {
        setOrder(initialOrder);
      }
    }
  }, [initialOrder, defaultKeys]);

  // 순서 변경 처리
  const updateOrder = async (newOrder: string[]) => {
    setOrder(newOrder);
    
    // 로컬 스토리지에 백업 저장
    try {
      localStorage.setItem(storageKey, JSON.stringify(newOrder));
    } catch (e) {
      console.error('Failed to save chart order to localStorage:', e);
    }

    // 관리자이면 서버 DB에도 전역 설정으로 저장
    if (isAdmin && onSaveOrder) {
      try {
        await onSaveOrder(newOrder);
        toast({ title: '차트 순서 저장 완료', description: '모든 사용자의 대시보드 그래프 위치가 변경되었습니다.' });
      } catch (err) {
        console.error('Failed to save chart order to server:', err);
      }
    }
  };

  // 초기화 처리
  const handleResetOrder = () => {
    updateOrder(defaultKeys);
  };

  const isModified = React.useMemo(() => {
    return JSON.stringify(order) !== JSON.stringify(defaultKeys);
  }, [order, defaultKeys]);

  // Drag & Drop 핸들러들 (관리자만 실행 가능)
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!isAdmin) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    if (!isAdmin) return;
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIdx) {
      setDraggedIndex(null);
      setDropTargetIndex(null);
      return;
    }

    const newOrder = [...order];
    const [movedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIdx, 0, movedItem);

    updateOrder(newOrder);
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const displayOrder = isMounted ? order : getEffectiveOrder();

  return (
    <div className="flex flex-col gap-3">
      {/* 툴바 안내 및 초기화 버튼 (관리자일 때만 표시) */}
      {isAdmin && isMounted && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50/80 px-3 py-1.5 rounded-xl border border-indigo-100/80 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>관리자 모드: 차트 우측 상단 손잡이(<GripVertical className="h-3.5 w-3.5 inline text-indigo-500" />)를 드래그하여 전체 사용자의 그래프 순서를 지정합니다.</span>
          </div>
          {isModified && (
            <button
              onClick={handleResetOrder}
              className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-3 py-1.5 rounded-xl border border-rose-200 transition-all shrink-0 active:scale-95 shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>순서 초기화</span>
            </button>
          )}
        </div>
      )}

      {/* 차트 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 overflow-hidden">
        {displayOrder.map((key, idx) => {
          const isDragging = isAdmin && draggedIndex === idx;
          const isTarget = isAdmin && dropTargetIndex === idx && draggedIndex !== idx;

          return (
            <div
              key={key}
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group transition-all duration-200 rounded-2xl",
                isDragging && "opacity-30 scale-[0.98] border-2 border-dashed border-indigo-400 shadow-inner",
                isTarget && "ring-2 ring-indigo-500 ring-offset-2 scale-[1.01] shadow-lg"
              )}
            >
              {/* 드래그 핸들 배지 (관리자에게만 표시) */}
              {isAdmin && isMounted && (
                <div 
                  className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1 px-2.5 py-1 bg-white/90 hover:bg-indigo-50 backdrop-blur border border-slate-200/80 rounded-xl text-[11px] font-bold text-slate-700 shadow-xs cursor-grab active:cursor-grabbing transition-all opacity-80 group-hover:opacity-100 select-none"
                  title="드래그하여 전체 사용자 차트 순서 변경"
                >
                  <GripVertical className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-[10px]">위치 이동</span>
                </div>
              )}

              {/* 차트 내용 */}
              {renderChart(key)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
