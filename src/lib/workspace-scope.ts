/** True when demo seed metrics should display for the active workspace. */
export function shouldUseDemoDashboardSeed(workspaceId: string | null | undefined): boolean {
  return workspaceId === 'demo-ws-1'
}
