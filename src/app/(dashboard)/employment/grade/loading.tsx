import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="내신등급 계산기 데이터를 불러오는 중입니다..." />;
}
