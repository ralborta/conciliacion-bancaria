'use client'

import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ProcessingStep } from '@/lib/types/conciliacion'

interface ProcessingModalProps {
  isOpen: boolean
  onClose: () => void
  steps: ProcessingStep[]
  currentStep: number
  progress: number
  status: string
}

export default function ProcessingModal({
  isOpen,
  onClose,
  steps,
  currentStep,
  progress,
  status
}: ProcessingModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">⚙️</div>
          <h3 className="text-xl font-semibold mb-2">Procesando Conciliación</h3>
          <p className="text-gray-500 text-sm mb-6">{status}</p>
          
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 animate-pulse"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Steps */}
          <div className="text-left space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 text-sm ${
                  index < currentStep ? 'text-green-600' : 
                  index === currentStep ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                <span className="w-5">
                  {index < currentStep ? '✅' : 
                   index === currentStep ? '⏳' : '⏳'}
                </span>
                <span>{step.name}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
