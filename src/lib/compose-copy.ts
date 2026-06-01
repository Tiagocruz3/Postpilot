export type ComposePlatform = 'facebook' | 'instagram' | 'linkedin' | 'x'

export const COMPOSE_PLATFORM_LABELS: Record<ComposePlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
}

export const COMPOSE_CHAR_LIMITS: Record<ComposePlatform, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  x: 280,
}

/** Strip em/en dashes and tidy spacing after AI or manual edits. */
export function sanitizeComposeCopy(text: string): string {
  return text
    .replace(/\s*[ - -]\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function platformLabel(platform: ComposePlatform) {
  return COMPOSE_PLATFORM_LABELS[platform]
}

export function buildVideoPrompt(
  platform: ComposePlatform,
  postText: string,
  userHint?: string,
  alternate = false,
) {
  const hint = userHint?.trim() ? ` ${userHint.trim()}` : ''
  const variation = alternate ? ' Show a clearly different scene and camera angle.' : ''
  return `Short vertical-friendly social clip for ${platform}. Scene inspired by: ${postText.slice(0, 300)}.${hint}${variation} Cinematic, natural motion, brand-safe, no on-screen text. Minimum duration: 15 seconds.`
}
