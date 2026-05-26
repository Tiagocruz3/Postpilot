export type DateDisplayStyle = 'short' | 'medium' | 'long' | 'full'
export type TimeFormat = '12h' | '24h'

export interface UserPreferences {
  displayName: string
  avatarUrl: string
  locale: string
  timeZone: string
  dateStyle: DateDisplayStyle
  timeFormat: TimeFormat
}

export const USER_PREFERENCES_STORAGE_KEY = 'postpilot.user-preferences'

export function getDefaultUserPreferences(): UserPreferences {
  const locale =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-AU'
  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC'

  return {
    displayName: '',
    avatarUrl: '',
    locale,
    timeZone,
    dateStyle: 'medium',
    timeFormat: '12h',
  }
}

export function loadUserPreferences(): UserPreferences {
  const defaults = getDefaultUserPreferences()
  const raw =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(USER_PREFERENCES_STORAGE_KEY)
      : null

  if (!raw) {
    return defaults
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    return {
      ...defaults,
      ...parsed,
    }
  } catch {
    return defaults
  }
}

export function mergeUserPreferences(preferences?: Partial<UserPreferences>): UserPreferences {
  return {
    ...getDefaultUserPreferences(),
    ...preferences,
  }
}

export function saveUserPreferences(preferences: UserPreferences) {
  localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

export function profileToUserPreferences(
  profile: {
    display_name?: string | null
    avatar_url?: string | null
    locale?: string | null
    time_zone?: string | null
    date_style?: DateDisplayStyle | null
    time_format?: TimeFormat | null
  },
  currentPreferences: UserPreferences
): UserPreferences {
  return mergeUserPreferences({
    ...currentPreferences,
    displayName: profile.display_name ?? currentPreferences.displayName,
    avatarUrl: profile.avatar_url ?? currentPreferences.avatarUrl,
    locale: profile.locale ?? currentPreferences.locale,
    timeZone: profile.time_zone ?? currentPreferences.timeZone,
    dateStyle: profile.date_style ?? currentPreferences.dateStyle,
    timeFormat: profile.time_format ?? currentPreferences.timeFormat,
  })
}

export function formatUserDateTime(
  value: string | number | Date,
  preferences: UserPreferences,
  options?: {
    includeDate?: boolean
    includeTime?: boolean
  }
) {
  const date = value instanceof Date ? value : new Date(value)
  const includeDate = options?.includeDate ?? true
  const includeTime = options?.includeTime ?? true

  const formatter = new Intl.DateTimeFormat(preferences.locale, {
    timeZone: preferences.timeZone,
    dateStyle: includeDate ? preferences.dateStyle : undefined,
    timeStyle: includeTime ? 'short' : undefined,
    hour12: includeTime ? preferences.timeFormat === '12h' : undefined,
  })

  return formatter.format(date)
}

export function getPreferredDisplayName(
  fallbackName: string | null | undefined,
  preferences: UserPreferences
) {
  return preferences.displayName.trim() || fallbackName || 'User'
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
