import { cn } from '@/lib/utils'

interface AppLogoProps {
  /** 'icon' = just the square symbol; 'full' = icon + Ad Guru text (logo.png); 'auto' picks based on context */
  variant?: 'icon' | 'full'
  className?: string
  imgClassName?: string
  /** Used only in 'icon' fallback and aria-label */
  label?: string
}

/**
 * Renders the Ad Guru logo.
 * - variant="icon"  → shows favicon.svg (the speech-bubble mark alone)
 * - variant="full"  → shows logo.png (icon + "Ad Guru" wordmark)
 */
export function AppLogo({ variant = 'full', className, imgClassName, label = 'Ad Guru' }: AppLogoProps) {
  if (variant === 'icon') {
    return (
      <div className={cn('flex shrink-0 items-center justify-center', className)}>
        <img
          src="/favicon.svg"
          alt={label}
          className={cn('h-full w-full object-contain', imgClassName)}
          draggable={false}
        />
      </div>
    )
  }

  // Default brand lockup (mark + "Ad Guru" wordmark). Ships as an SVG so it stays
  // crisp at any size; drop a `logo.png` into /public and switch this src to use
  // the official raster artwork instead.
  return (
    <img
      src="/logo.svg"
      alt={label}
      className={cn('object-contain', imgClassName)}
      draggable={false}
    />
  )
}
