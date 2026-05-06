import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Factory } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex flex-col h-full gap-6">
      {/* 헤더 섹션 스켈레톤 */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Factory className="h-7 w-7 sm:h-8 sm:w-8 text-slate-200" />
            <Skeleton className="h-8 w-32 sm:h-10 sm:w-40" />
          </div>
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* 왼쪽: 업체 목록 스켈레톤 */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
          <Card className="shrink-0">
            <CardContent className="p-4">
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>

          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="py-4 border-b">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="p-0 space-y-px">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-4 border-b border-slate-50">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 상세 정보 스켈레톤 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card className="border-none shadow-md overflow-hidden bg-white">
            <div className="h-2 bg-slate-100 w-full" />
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <Skeleton className="h-3 w-16 mb-4" />
                    <div className="space-y-3">
                      <div className="flex justify-between"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-20" /></div>
                      <div className="flex justify-between"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-20" /></div>
                      <div className="flex justify-between"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-20" /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-16 w-full" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl h-12">
              <Skeleton className="h-full w-full rounded-lg" />
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="h-12 bg-slate-50 border-b" />
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 border-b px-6 flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
