export type SelectOption = { value: string; label: string; hint?: string }

export const META_CAMPAIGN_OBJECTIVES: Array<SelectOption & { adTypes: string[] }> = [
  { value: 'Get leads', label: 'Leads', hint: 'Collect sign-ups with forms or messages', adTypes: ['Lead Form Ad', 'Single Image Ad', 'Video Ad'] },
  { value: 'Send traffic to website', label: 'Traffic', hint: 'Send people to your website or landing page', adTypes: ['Website Conversion Ad', 'Single Image Ad', 'Carousel Ad'] },
  { value: 'Get messages', label: 'Engagement · Messages', hint: 'Start conversations on Messenger or Instagram', adTypes: ['Single Image Ad', 'Video Ad', 'Story / Reel Ad'] },
  { value: 'Increase sales', label: 'Sales', hint: 'Find people likely to purchase', adTypes: ['Website Conversion Ad', 'Carousel Ad', 'Video Ad'] },
  { value: 'Boost engagement', label: 'Engagement', hint: 'Get more likes, comments, and shares', adTypes: ['Engagement Ad', 'Single Image Ad', 'Video Ad'] },
  { value: 'Build awareness', label: 'Awareness', hint: 'Reach people most likely to remember your brand', adTypes: ['Single Image Ad', 'Video Ad', 'Story / Reel Ad'] },
]

export const META_AD_FORMATS: SelectOption[] = [
  { value: 'Single Image Ad', label: 'Single image', hint: 'One image in feed' },
  { value: 'Video Ad', label: 'Video', hint: 'Short video in feed' },
  { value: 'Carousel Ad', label: 'Carousel', hint: 'Multiple images or videos people swipe through' },
  { value: 'Story / Reel Ad', label: 'Stories or Reels', hint: 'Full-screen vertical placement' },
  { value: 'Lead Form Ad', label: 'Lead form', hint: 'Instant form inside Meta apps' },
  { value: 'Website Conversion Ad', label: 'Website conversions', hint: 'Optimize for site actions' },
  { value: 'Engagement Ad', label: 'Post engagement', hint: 'Boost an existing post' },
]

export const LOCATION_OPTIONS: SelectOption[] = [
  // Australia - country, states, and major cities
  { value: 'Australia', label: 'Australia (country)' },
  { value: 'Australia - Queensland', label: 'Queensland, Australia' },
  { value: 'Australia - New South Wales', label: 'New South Wales, Australia' },
  { value: 'Australia - Victoria', label: 'Victoria, Australia' },
  { value: 'Australia - Western Australia', label: 'Western Australia' },
  { value: 'Australia - South Australia', label: 'South Australia' },
  { value: 'Australia - Tasmania', label: 'Tasmania, Australia' },
  { value: 'Australia - Australian Capital Territory', label: 'ACT, Australia' },
  { value: 'Australia - Northern Territory', label: 'Northern Territory, Australia' },
  { value: 'Australia - Brisbane', label: 'Brisbane, Australia' },
  { value: 'Australia - Gold Coast', label: 'Gold Coast, Australia' },
  { value: 'Australia - Sunshine Coast', label: 'Sunshine Coast, Australia' },
  { value: 'Australia - Sydney', label: 'Sydney, Australia' },
  { value: 'Australia - Melbourne', label: 'Melbourne, Australia' },
  { value: 'Australia - Perth', label: 'Perth, Australia' },
  { value: 'Australia - Adelaide', label: 'Adelaide, Australia' },
  { value: 'Australia - Canberra', label: 'Canberra, Australia' },
  { value: 'Australia - Hobart', label: 'Hobart, Australia' },
  { value: 'Australia - Darwin', label: 'Darwin, Australia' },
  { value: 'Australia - Newcastle', label: 'Newcastle, Australia' },
  { value: 'Australia - Wollongong', label: 'Wollongong, Australia' },
  { value: 'Australia - Geelong', label: 'Geelong, Australia' },
  { value: 'Australia - Cairns', label: 'Cairns, Australia' },
  { value: 'Australia - Townsville', label: 'Townsville, Australia' },
  { value: 'Australia - Toowoomba', label: 'Toowoomba, Australia' },
  // New Zealand
  { value: 'New Zealand', label: 'New Zealand (country)' },
  { value: 'New Zealand - Auckland', label: 'Auckland, New Zealand' },
  { value: 'New Zealand - Wellington', label: 'Wellington, New Zealand' },
  // Other markets
  { value: 'United States', label: 'United States (country)' },
  { value: 'United Kingdom', label: 'United Kingdom (country)' },
  { value: 'Ireland', label: 'Ireland (country)' },
  { value: 'Canada', label: 'Canada (country)' },
  { value: 'Singapore', label: 'Singapore (country)' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates (country)' },
  { value: 'South Africa', label: 'South Africa (country)' },
  { value: 'India', label: 'India (country)' },
  { value: 'Philippines', label: 'Philippines (country)' },
  { value: 'Germany', label: 'Germany (country)' },
  { value: 'France', label: 'France (country)' },
  { value: 'Netherlands', label: 'Netherlands (country)' },
  { value: 'Spain', label: 'Spain (country)' },
  { value: 'Italy', label: 'Italy (country)' },
  { value: 'Worldwide - English speakers', label: 'Worldwide (English speakers)' },
]

export const AGE_RANGE_OPTIONS: SelectOption[] = [
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35-44', label: '35-44' },
  { value: '45-54', label: '45-54' },
  { value: '55-64', label: '55-64' },
  { value: '65+', label: '65+' },
  { value: '18-34', label: '18-34 (broad)' },
  { value: '25-54', label: '25-54 (core buyers)' },
  { value: '18-65+', label: '18-65+ (wide reach)' },
]

export const GENDER_OPTIONS: SelectOption[] = [
  { value: 'All', label: 'All genders' },
  { value: 'Women', label: 'Women' },
  { value: 'Men', label: 'Men' },
]

export const INDUSTRY_OPTIONS: SelectOption[] = [
  'Home services',
  'Health & wellness',
  'Beauty & personal care',
  'Real estate',
  'Fitness & gyms',
  'Restaurants & food',
  'E-commerce / retail',
  'Professional services',
  'Coaching & consulting',
  'Automotive',
  'Education & training',
  'SaaS / technology',
  'Trades & construction',
  'Events & entertainment',
  'Other',
].map((label) => ({ value: label, label }))

export const INTEREST_GROUPS: Array<{ group: string; options: SelectOption[] }> = [
  {
    group: 'Business & work',
    options: [
      { value: 'Small business owners', label: 'Small business owners' },
      { value: 'Entrepreneurship', label: 'Entrepreneurship' },
      { value: 'Marketing', label: 'Marketing' },
      { value: 'E-commerce', label: 'E-commerce' },
    ],
  },
  {
    group: 'Health & fitness',
    options: [
      { value: 'Fitness and wellness', label: 'Fitness and wellness' },
      { value: 'Weight loss', label: 'Weight loss' },
      { value: 'Yoga', label: 'Yoga' },
      { value: 'Nutrition', label: 'Nutrition' },
    ],
  },
  {
    group: 'Home & family',
    options: [
      { value: 'Home improvement', label: 'Home improvement' },
      { value: 'Interior design', label: 'Interior design' },
      { value: 'Parenting', label: 'Parenting' },
      { value: 'Real estate', label: 'Real estate' },
    ],
  },
  {
    group: 'Shopping',
    options: [
      { value: 'Online shopping', label: 'Online shopping' },
      { value: 'Luxury goods', label: 'Luxury goods' },
      { value: 'Fashion', label: 'Fashion' },
      { value: 'Beauty products', label: 'Beauty products' },
    ],
  },
]

export const DAILY_BUDGET_OPTIONS: SelectOption[] = [
  { value: '15', label: '$15/day - test budget' },
  { value: '25', label: '$25/day - cautious start' },
  { value: '35', label: '$35/day - recommended starter' },
  { value: '50', label: '$50/day - growth' },
  { value: '75', label: '$75/day - scale' },
  { value: '100', label: '$100/day - aggressive' },
]

export const PLACEMENT_OPTIONS: SelectOption[] = [
  { value: 'advantage', label: 'Advantage+ placements (recommended)', hint: 'Let Meta optimize placements' },
  { value: 'feed', label: 'Feeds only', hint: 'Facebook & Instagram feeds' },
  { value: 'stories', label: 'Stories & Reels', hint: 'Full-screen vertical' },
  { value: 'feed_stories', label: 'Feeds + Stories', hint: 'Balanced mix' },
]

export function parseInterestList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function formatInterestList(items: string[]): string {
  return items.join(', ')
}
