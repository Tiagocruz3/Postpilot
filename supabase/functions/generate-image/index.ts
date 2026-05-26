import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  const body = await req.json().catch(() => ({}))
  const { prompt } = body

  const aiRes = await fetch(`${Deno.env.get('LOVABLE_AI_URL') || 'https://ai.lovable.dev/v1'}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  })

  const aiData = await aiRes.json()
  const url = aiData.data?.[0]?.url || ''

  return new Response(JSON.stringify({ url }), { headers: { 'Content-Type': 'application/json' } })
})
