import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="자격증 취득 현황을 불러오는 중입니다..." />;
}