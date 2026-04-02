import { cn } from '../../../lib/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-sm border border-gray-100',
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  )
}
