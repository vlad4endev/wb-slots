"use client"

import { useToast } from "@/hooks/use-toast"
import { X } from "lucide-react"
import { useEffect } from "react"

export function SimpleToaster() {
  const { toasts, dismiss } = useToast()

  useEffect(() => {
    // Автоматически закрывать toast через 5 секунд
    toasts.forEach((toast) => {
      if (toast.id) {
        setTimeout(() => {
          dismiss(toast.id)
        }, 5000)
      }
    })
  }, [toasts, dismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg border p-4 shadow-lg 
            bg-white dark:bg-gray-800 
            border-gray-200 dark:border-gray-700
            animate-in slide-in-from-right-full
            ${toast.variant === 'destructive' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {toast.title && (
                <div className="font-semibold text-sm mb-1">
                  {toast.title}
                </div>
              )}
              {toast.description && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {toast.action && (
            <div className="mt-3">
              {toast.action}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

