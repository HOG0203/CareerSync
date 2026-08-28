export interface ColumnConfig {
  key: string
  label: string
  width: number
  type?: 'text' | 'select' | 'date' | 'multi-select' | 'action'
  options?: { label: string; value: string }[] | ((rowData: any) => { label: string; value: string }[])
  readOnly?: boolean
  variant?: (val: any) => string
}

export interface SpreadsheetTableProps {
  data: any[]
  columns: ColumnConfig[]
  onSave: (id: string, field: string, value: any) => Promise<{ success: boolean; error?: string }>
  onBulkSave: (updates: { id: string; field: string; value: any }[]) => Promise<{ success: boolean; error?: string }>
  onPromote?: (ids: string[]) => Promise<{ success: boolean; error?: string }>
  onDelete?: (ids: string[]) => Promise<{ success: boolean; error?: string }>
  onAction?: (id: string, key: string) => void
  selectedRowIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  groupHeaders?: { label: string; colSpan: number; className?: string }[]
  searchPlaceholder?: string
  masterCertificates?: any[]
  masterCompanies?: any[]
  rankingMap?: Record<string, any>
  isRankingsLoading?: boolean
  userProfile?: any
  disableNamePopover?: boolean
  baseYear?: number
  mobileInfoKeys?: string[]  // 모바일 카드에 표시할 필드 키 목록 (지정 시 자동 선택 대신 사용)
  pageType?: 'admin-students' | 'class-management' | 'students' // 페이지 유형별 전용 모바일 카드 렌더링
  hideCheckbox?: boolean
  hideSearch?: boolean
  onFilteredDataChange?: (data: any[] | null) => void
}


