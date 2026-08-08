// Mavjud mahalliy (regex) tahlilchi — src/lib/voiceParse.js — bitta
// gapdan bitta mahsulot/miqdor ajratadi va ko'p punktli gaplarni
// ("3 ta somsa, 2 ta non sotildi") tushunmaydi. Bu funksiya shu holatlar
// uchun AI-asosli ko'p-punktli tahlil qo'shadi — mahalliy parser
// o'chirilmaydi, tarmoq yo'q paytda hamon zaxira sifatida ishlaydi.
//
// Oddiy foydalanuvchi JWT'i bilan ishlaydi (Owner/Baker/Cashier — kim
// ovoz bilan savdo/ishlab chiqarish qaydini kiritayotgan bo'lsa) — RLS
// orqali faqat o'z kompaniyasi mahsulotlarini ko'radi.

import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: "Avtorizatsiyadan o'tilmagan" }, 401)

    const { transcript } = await req.json()
    if (!transcript || typeof transcript !== 'string') {
      return json({ error: 'Matn kerak' }, 400)
    }

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, unit')
    if (productsError) return json({ error: productsError.message }, 400)
    if (!products || products.length === 0) return json({ items: [] }, 200)

    const allowedIds = products.map((p) => p.id)
    const productList = products.map((p) => `${p.id}=${p.name}`).join(', ')

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      tools: [
        {
          name: 'extract_items',
          description: "Nutqdan aytilgan mahsulot va miqdorlarni ajratib olish.",
          input_schema: {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['product_id', 'quantity'],
                  properties: {
                    product_id: { type: 'string', enum: allowedIds },
                    quantity: { type: 'number', exclusiveMinimum: 0 },
                  },
                },
              },
            },
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_items' },
      messages: [
        {
          role: 'user',
          content:
            `Mahsulotlar ro'yxati: ${productList}.\n` +
            `Nutq: "${transcript}"\n` +
            `Har bir aytilgan mahsulot va miqdorni ajrat. Faqat ro'yxatdagi ` +
            `product_id'lardan foydalan, ro'yxatda yo'q narsani o'ylab topma.`,
        },
      ],
    })

    const toolBlock = aiResponse.content.find((b: any) => b.type === 'tool_use') as any
    const rawItems: Array<{ product_id?: string; quantity?: number }> = toolBlock?.input?.items || []

    // Server tomonda ikkinchi tekshiruv — har bir product_id ro'yxatda
    // ekanini tasdiqlaymiz, modelga to'liq ishonmaymiz.
    const items = rawItems
      .filter((i) => i.product_id && allowedIds.includes(i.product_id) && Number(i.quantity) > 0)
      .map((i) => ({ productId: i.product_id, quantity: Number(i.quantity) }))

    return json({ items }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : "Noma'lum xato" }, 500)
  }
})
