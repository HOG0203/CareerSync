/** Stops at the first failure and reports partial completion explicitly. */
export async function saveInOrder<T>(
  updates: T[],
  save: (update: T) => Promise<{ success: boolean; error?: string }>,
) {
  let savedCount = 0;
  for (const update of updates) {
    try {
      const result = await save(update);
      if (!result.success) throw new Error(result.error || '저장 실패');
      savedCount++;
    } catch (error) {
      const reason = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      return {
        success: false, savedCount, failedIndex: savedCount,
        error: `${updates.length}개 항목 중 ${savedCount}개 완료 후 중단되었습니다. 실패한 항목도 일부 반영되었을 수 있으므로 새로고침된 데이터를 확인해 주세요. ${reason}`,
      };
    }
  }
  return { success: true, savedCount };
}
