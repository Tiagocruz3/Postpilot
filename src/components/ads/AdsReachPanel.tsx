import { Activity, Info } from 'lucide-react'
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  estimateReach,
  formatAbbrev,
  type ReachEstimateInputs,
} from '@/lib/ads-reach-estimator'

type AdsReachPanelProps = {
  inputs: ReachEstimateInputs
}

export function AdsReachPanel({ inputs }: AdsReachPanelProps) {
  const estimate = useMemo(() => estimateReach(inputs), [inputs])

  const ratio =
    estimate.audiencePool > 0 ? Math.min(1, ((estimate.min + estimate.max) / 2) / estimate.audiencePool) : 0
  const fillPercent = Math.round(ratio * 100)

  return (
    <Card className="border-[#1877F2]/20 bg-gradient-to-b from-[#1877F2]/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-[#1877F2]" />
          Estimated reach
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{estimate.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">people / campaign</p>
        </div>

        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1877F2] to-cyan-500 transition-all"
              style={{ width: `${Math.max(4, fillPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Audience pool</span>
            <span className="tabular-nums">{formatAbbrev(estimate.audiencePool)}</span>
          </div>
        </div>

        {estimate.notes.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-900 dark:text-amber-100">
            {estimate.notes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-1.5 leading-snug">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-[11px] leading-snug text-muted-foreground">
          Indicative estimate only. Based on selected targeting and budget, not live Meta data.
        </p>
      </CardContent>
    </Card>
  )
}
