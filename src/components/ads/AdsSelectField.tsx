import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { SelectOption } from '@/lib/ads-targeting-options'
import { cn } from '@/lib/utils'

type AdsSelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  hint?: string
  className?: string
}

export function AdsSelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  required = false,
  hint,
  className,
}: AdsSelectFieldProps) {
  const selected = options.find((option) => option.value === value)

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 bg-background">
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {selected?.hint || hint ? (
        <p className="text-xs text-muted-foreground">{selected?.hint || hint}</p>
      ) : null}
    </div>
  )
}
