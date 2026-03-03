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
        className="h-9 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
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
