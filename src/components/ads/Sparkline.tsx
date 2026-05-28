import { useMemo } from 'react'
import { cn } from '@/lib/utils'

export type SparklineProps = {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  /** Show a faint baseline at the lowest value. */
  showBaseline?: boolean
  className?: string
}

export function Sparkline({
  values,
  width = 120,
  height = 28,
  stroke = '#1877F2',
  fill = 'rgba(24, 119, 242, 0.12)',
  showBaseline = true,
  className,
}: SparklineProps) {
  const { path, area } = useMemo(() => {
    if (!values || values.length === 0) return { path: '', area: '' }
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = Math.max(1, max - min)
    const stepX = values.length > 1 ? width / (values.length - 1) : 0
    const points = values.map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / range) * height
      return [x, y] as const
    })
    const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${path} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`
    return { path, area }
  }, [values, width, height])

  if (!path) {
    return (
      <div
        className={cn('flex items-center text-[10px] text-muted-foreground', className)}
        style={{ width, height }}
      >
        no data
      </div>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden
    >
      {showBaseline ? <line x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} stroke="currentColor" strokeOpacity="0.1" /> : null}
      <path d={area} fill={fill} stroke="none" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
