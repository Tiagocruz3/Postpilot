export type ComposePlatform = 'facebook' | 'instagram' | 'linkedin' | 'x'

const PLATFORM_LIMITS: Record<ComposePlatform, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  x: 280,
}

const PLATFORM_GUIDE: Record<ComposePlatform, string> = {
  facebook:
    'Write for a Facebook Page feed post: approachable, clear, and engaging. Line breaks are fine when they help readability.',
  instagram:
    'Write for Instagram: concise caption with a strong hook in the first line. Conversational, visual-friendly, and authentic.',
  linkedin:
    'Write for LinkedIn: professional, credible, and human. Short paragraphs work well. Lead with insight, not hype.',
  x: 'Write for X (Twitter): one post only, maximum 280 characters. Direct, specific, and easy to scan.',
}

export const COMPOSE_STYLE_RULES = `Writing rules (strict):
- Never use em dashes (—) or en dashes (–). Use commas, periods, colons, or parentheses instead.
- Do not use bullet characters unless the platform truly needs a short list.
- Sound like a real person: warm, confident, and professional. No robotic filler, no hashtag spam, no "In today's world".
- No markdown, no JSON, no labels. Return only the post text.`

export function sanitizeComposeCopy(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function clampForPlatform(text: string, platform: ComposePlatform): string {
  const limit = PLATFORM_LIMITS[platform]
  if (text.length <= limit) {
    return text
  }
  const trimmed = text.slice(0, limit)
  const lastSpace = trimmed.lastIndexOf(' ')
  return (lastSpace > limit * 0.7 ? trimmed.slice(0, lastSpace) : trimmed).trim()
}

export function buildComposeSystemPrompt(platform: ComposePlatform): string {
  return `You are an expert social media copywriter for ${platform}.
${PLATFORM_GUIDE[platform]}
${COMPOSE_STYLE_RULES}`
}

export function buildDraftUserPrompt(platform: ComposePlatform, topic: string): string {
  return `Draft a complete ${platform} post about: ${topic}`
}

export function buildPolishUserPrompt(platform: ComposePlatform, draft: string): string {
  return `Rewrite this ${platform} post to be clearer and more engaging while keeping the same intent:\n\n${draft}`
}

export function buildImagePrompt(platform: ComposePlatform, postText: string, userHint?: string): string {
  const hint = userHint?.trim() ? ` Creative direction: ${userHint.trim()}` : ''
  return `Social media image for ${platform}. Post context: ${postText.slice(0, 400)}.${hint} Photorealistic or polished brand-safe visual, no text overlay, no watermarks.`
}

export function buildVideoPrompt(platform: ComposePlatform, postText: string, userHint?: string): string {
  const hint = userHint?.trim() ? ` ${userHint.trim()}` : ''
  return `Short vertical-friendly social clip for ${platform}. Scene inspired by: ${postText.slice(0, 300)}.${hint} Cinematic, natural motion, brand-safe, no on-screen text.`
}
