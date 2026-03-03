'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MessageSquare, Calendar, Send, Loader2, Edit2, Trash2, X, Check } from 'lucide-react'
import { getCounselingLogs, addCounselingLog, getAcademicHistory, updateCounselingLog, deleteCounselingLog } from './actions'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface CounselingModalProps {
  isOpen: boolean
  onClose: () => void
  student: {
    id: string
    student_name: string
    major: string
    class_info: string
    student_number: string
  } | null
}

export function CounselingModal({ isOpen, onClose, student }: CounselingModalProps) {
  const [logs, setLogs] = React.useState<any[]>([])
  const [history, setHistory] = React.useState<any[]>([])
  const [newLog, setNewLog] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  
  // 수정 모드 상태
  const [editingLogId, setEditingLogId] = React.useState<string | null>(null)
  const [editContent, setEditContent] = React.useState('')
  
  const { toast } = useToast()
  const supabase = createClient()

  const fetchData = React.useCallback(async () => {
    if (!student) return
    setIsLoading(true)
    const [logsRes, historyRes, { data: { user } }] = await Promise.all([
      getCounselingLogs(student.id),
      getAcademicHistory(student.id),
      supabase.auth.getUser()
    ])
    
    if (logsRes.data) setLogs(logsRes.data)
    if (historyRes.data) setHistory(historyRes.data)
    if (user) setCurrentUserId(user.id)
    
    setIsLoading(false)
  }, [student, supabase])

  React.useEffect(() => {
    if (isOpen && student) {
      fetchData()
      setNewLog('')
      setEditingLogId(null)
    }
  }, [isOpen, student, fetchData])

  const handleSubmit = async () => {
    if (!student || !newLog.trim()) return
    setIsSubmitting(true)
    const result = await addCounselingLog(student.id, newLog)
    
    if (result.success) {
      toast({ title: '상담 일지 저장 완료', description: '새로운 상담 기록이 리스트에 즉시 반영되었습니다.' })
      setNewLog('')
      await fetchData()
    } else {
      toast({ variant: 'destructive', title: '저장 실패', description: result.error })
    }
    setIsSubmitting(false)
  }

  const handleUpdateLog = async (logId: string) => {
    if (!editContent.trim()) return
    setIsSubmitting(true)
    const result = await updateCounselingLog(logId, editContent)
    
    if (result.success) {
      toast({ title: '상담 일지 수정 완료' })
      setEditingLogId(null)
      await fetchData()
    } else {
      console.error('상담 일지 수정 실패 상세:', result.error)
      toast({ variant: 'destructive', title: '수정 실패', description: result.error })
    }
    setIsSubmitting(false)
  }

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('이 상담 기록을 삭제하시겠습니까?')) return
    
    setIsSubmitting(true)
    const result = await deleteCounselingLog(logId)
    
    if (result.success) {
      toast({ title: '상담 일지 삭제 완료' })
      await fetchData()
    } else {
      toast({ variant: 'destructive', title: '삭제 실패', description: result.error })
    }
    setIsSubmitting(false)
  }

  if (!student) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] h-[90vh] sm:h-[650px] p-0 overflow-hidden flex flex-col border-none shadow-2xl rounded-2xl sm:rounded-lg">
        <DialogHeader className="p-5 sm:p-6 bg-blue-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg shrink-0">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold truncate">
                {student.student_name} <span className="font-normal opacity-80 text-base sm:text-lg">상담 일지</span>
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-[10px] sm:text-xs mt-1 truncate font-medium">
                {isLoading ? (
                  <span className="animate-pulse italic">정보 불러오는 중...</span>
                ) : (
                  <>
                    {history.length > 0 ? `${Math.max(...history.map(h => h.grade))}학년 ` : ''}
                    {student.major} {student.class_info}반 {student.student_number}번
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 학적 이력 바 */}
        {history.length > 0 && (
          <div className="bg-slate-50/80 border-b px-4 sm:px-6 py-2 flex items-center gap-3 overflow-x-auto shrink-0 scrollbar-hide">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 border-r pr-3 border-slate-200">History</span>
            <div className="flex items-center gap-2">
              {history.sort((a, b) => b.grade - a.grade).map((h) => {
                const gradeColor = h.grade === 3 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                   h.grade === 2 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                   'bg-emerald-100 text-emerald-700 border-emerald-200';
                return (
                  <div key={h.id} className={cn("flex items-center rounded-full px-2.5 py-0.5 gap-1.5 shrink-0 border shadow-sm", gradeColor)}>
                    <span className="text-[10px] font-black">{h.grade}학년</span>
                    <span className="text-[9px] font-bold opacity-80">{h.major} {h.class_info}반 {h.student_number}번</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-slate-50 relative overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-xs">상담 내역을 불러오는 중...</p>
                </div>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="relative pl-4 border-l border-blue-200 py-0.5">
                    <div className="absolute -left-[4.5px] top-2 h-2 w-2 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                    <div className="bg-white rounded-lg p-2.5 shadow-sm border border-slate-200 hover:border-blue-200 transition-colors group">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {log.author_name} 선생님
                          </span>
                          {log.updated_at && (
                            <span className="text-[8px] text-slate-400 font-medium italic">
                              (수정됨: {format(new Date(log.updated_at), 'yy.MM.dd HH:mm', { locale: ko })})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                            {format(new Date(log.created_at), 'yy.MM.dd HH:mm', { locale: ko })}
                          </div>
                          {/* 본인 작성글인 경우 수정/삭제 버튼 노출 */}
                          {currentUserId === log.author_id && !editingLogId && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingLogId(log.id); setEditContent(log.content); }}
                                className="p-1 hover:bg-slate-100 rounded text-blue-500"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button 
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1 hover:bg-slate-100 rounded text-rose-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {editingLogId === log.id ? (
                        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                          <Textarea 
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[80px] text-[12px] focus:ring-blue-500"
                          />
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingLogId(null)}>
                              <X className="h-3 w-3 mr-1" /> 취소
                            </Button>
                            <Button size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700" onClick={() => handleUpdateLog(log.id)}>
                              <Check className="h-3 w-3 mr-1" /> 수정완료
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[12px] text-slate-600 leading-snug whitespace-pre-wrap">
                          {log.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">등록된 상담 내역이 없습니다.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 bg-white border-t shrink-0 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
              <Send className="h-3 w-3 text-blue-400" />
              NEW COUNSELING LOG
            </label>
            <Textarea 
              placeholder="상담 내용을 입력하세요..." 
              className="min-h-[100px] text-[12px] resize-none border-slate-200 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
              value={newLog}
              onChange={(e) => setNewLog(e.target.value)}
              disabled={!!editingLogId}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} className="h-9 px-5 text-xs font-medium text-slate-500">닫기</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !newLog.trim() || !!editingLogId}
                className="bg-blue-600 hover:bg-blue-700 h-9 px-8 text-xs font-bold shadow-lg shadow-blue-100 gap-2"
              >
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                기록 저장
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
