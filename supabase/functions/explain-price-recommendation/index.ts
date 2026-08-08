// price_recommendations qatoridagi raqamlar (tannarx, marja, tavsiya
// narxi) allaqachon Postgres trigger'ida (record_ingredient_price_change,
// 20260729090200_ingredient_cost_pricing.sql) hisoblangan. Bu funksiya
// FAQAT shu tayyor raqamlarga qisqa o'zbek tilida sabab-natija izohini
// qo'shadi — narxni o'zi hech qachon hisoblamaydi va yozmaydi.
//
// Owner JWT'i bilan ishlaydi — service role shart emas.
// price_recommendations'ning SELECT siyosati va set_recommendation_
// explanation() RPC'si allaqachon faqat Owner'ga ruxsat beradi, shuning
// uchun Manager bu funksiyani chaqirsa ham hech narsa qaytmaydi/yozilmaydi.

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

    const { recommendationIds } = await req.json()
    if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return json({ error: 'recommendationIds kerak' }, 400)
    }

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: recs, error: loadError } = await supabase
      .from('price_recommendations')
      .select('id, old_cost, new_cost, old_price, suggested_price, target_margin_pct, products(name)')
      .in('id', recommendationIds)
    if (loadError) return json({ error: loadError.message }, 400)

    for (const rec of recs || []) {
      const oldCost = Number(rec.old_cost)
      const newCost = Number(rec.new_cost)
      const costDeltaPct = oldCost > 0 ? (((newCost - oldCost) / oldCost) * 100).toFixed(1) : 'n/a'
      const productName = (rec as any).products?.name || 'mahsulot'

      let explanation = ''
      try {
        const aiResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content:
                `"${productName}" tannarxi ${oldCost} so'mdan ${newCost} so'mga o'zgardi ` +
                `(${costDeltaPct}%). Belgilangan marja: ${rec.target_margin_pct}%. Eski narx ` +
                `${rec.old_price} so'm, tavsiya etilgan yangi narx ${rec.suggested_price} so'm. ` +
                `Do'kon egasiga 1-2 gapda, o'zbek tilida, nima uchun aynan shu narx tavsiya ` +
                `etilayotganini tushuntir.`,
            },
          ],
        })
        const textBlock = aiResponse.content.find((b: any) => b.type === 'text') as any
        explanation = textBlock?.text?.trim() || ''
      } catch (aiError) {
        console.error('Anthropic xatosi:', aiError)
      }

      if (explanation) {
        await supabase.rpc('set_recommendation_explanation', {
          p_id: rec.id,
          p_explanation: explanation,
          p_model: 'claude-haiku-4-5',
        })
      }
    }

    return json({ ok: true }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : "Noma'lum xato" }, 500)
  }
})
