'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddStudentModal } from './add-student-modal'

interface AddStudentButtonProps {
  baseYear: number
  majors: string[]
}

export function AddStudentButton({ baseYear, majors }: AddStudentButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <Button 
        size="sm" 
        className="h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shadow-xs"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="mr-1 sm:mr-1.5 h-3.5 w-3.5" />
        학생 추가
      </Button>

      <AddStudentModal 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        baseYear={baseYear}
        majors={majors}
      />
    </>
  )
}
