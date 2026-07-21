"use client"

// import { ToasterProvider } from "./toaster-provider"
import { ToasterProviderAlt as ToasterProvider } from "./toaster-provider-alt"

interface ClientLayoutProps {
  children: React.ReactNode
  className?: string
}

export function ClientLayout({ children, className }: ClientLayoutProps) {
  return (
    <>
      <div className={className}>
        {children}
      </div>
      <ToasterProvider />
    </>
  )
}

