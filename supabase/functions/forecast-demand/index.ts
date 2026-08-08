// Ertangi kun uchun har bir mahsulotdan qancha tayyorlash kerakligini
// taklif qiladi. Raqamlar (o'rtacha, ishonch %) get_forecast_input() RPC
// orqali Postgres'da hisoblanadi — Claude faqat ±30% chegarada tuzatish
// va qisqa izoh qo'shadi; natija server tomonda yana bir bor qisqichga
// solinadi (modelga to'liq ishonilmaydi). Oddiy foydalanuvchi (Owner/
// Manager) JWT'i bilan chaqiriladi — service role shart emas, chunki
// get_forecast_input() va upsert_demand_forecast() RPC'lari o'z ichida
// rol tekshiruvini bajaradi.

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

function clamp(value: number, lo: number, hi: number) {
  return Math.min(Math.max(value, lo), hi)
}

// Asia/Tashkent — doim UTC+5, DST yo'q.
function tashkentTomorrow() {
  const tashkentNow = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const tomorrow = new Date(tashkentNow)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return {
    date: tomorrow.toISOString().slice(0, 10),
    weekday: tomorrow.getUTCDay(), // Postgres extract(dow) bilan bir xil: 0=yakshanba..6=shanba
  }
}

interface ForecastInputRow {
  product_id: string
  product_name: string
  unit: string
  weekday: number
  avg_quantity: number
  stddev_quantity: number
  sample_count: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: "Avtorizatsiyadan o'tilmagan" }, 401)

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: rows, error: rpcError } = await supabase.rpc('get_forecast_input', {
      p_lookback_days: 56,
    })
    if (rpcError) return json({ error: rpcError.message }, 400)

    const { date: forecastDate, weekday } = tashkentTomorrow()
    const groups = ((rows as ForecastInputRow[]) || []).filter((r) => r.weekday === weekday)

    const results = []
    for (const group of groups) {
      const baseline = Number(group.avg_quantity)
      const lo = Math.round(baseline * 0.7)
      const hi = Math.round(baseline * 1.3)
      // Namuna kam (<4 hafta) bo'lsa — isrofdan saqlanish uchun
      // o'rtachadan yuqoriga chiqarishga ruxsat berilmaydi.
      const hardCap = group.sample_count < 4 ? Math.round(baseline) : hi

      let adjustedQuantity = Math.round(baseline)
      let explanation = ''

      try {
        const aiResponse = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 300,
          tools: [
            {
              name: 'submit_forecast',
              description: 'Ertangi kun uchun tavsiya etilgan miqdor va qisqa sabab.',
              input_schema: {
                type: 'object',
                required: ['adjusted_quantity', 'explanation_uz'],
                properties: {
                  adjusted_quantity: { type: 'number', minimum: lo, maximum: hardCap },
                  explanation_uz: { type: 'string', maxLength: 220 },
                },
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'submit_forecast' },
          messages: [
            {
              role: 'user',
              content:
                `Mahsulot: ${group.product_name}. Haftaning shu kunidagi oxirgi ${group.sample_count} ` +
                `hafta o'rtachasi: ${baseline} ${group.unit}, standart og'ish: ${group.stddev_quantity}. ` +
                `Isrofni kamaytirishga ustuvorlik berib, ertangi kun uchun tavsiya etilgan miqdorni va ` +
                `qisqa (bir gap) sababni o'zbek tilida yoz.`,
            },
          ],
        })

        const toolBlock = aiResponse.content.find((b: any) => b.type === 'tool_use') as any
        const toolInput = toolBlock?.input || {}
        if (toolInput.adjusted_quantity != null) adjustedQuantity = Number(toolInput.adjusted_quantity)
        if (toolInput.explanation_uz) explanation = String(toolInput.explanation_uz)
      } catch (aiError) {
        console.error('Anthropic xatosi:', aiError)
      }

      // Server tomonda YANA BIR BOR qisqichga solinadi — modelga
      // ishonch 100% emas, bu ikkinchi himoya qatlami.
      const quantity = clamp(adjustedQuantity, lo, hardCap)
      const confidence = clamp(100 - (group.stddev_quantity / (baseline || 1)) * 100, 60, 95)

      const { data: saved, error: upsertError } = await supabase.rpc('upsert_demand_forecast', {
        p_product_id: group.product_id,
        p_forecast_date: forecastDate,
        p_suggested_quantity: quantity,
        p_confidence_pct: confidence,
        p_historical_avg: baseline,
        p_historical_stddev: group.stddev_quantity,
        p_explanation: explanation || null,
        p_model_used: 'claude-sonnet-5',
      })
      if (upsertError) {
        console.error('upsert_demand_forecast xatosi:', upsertError)
        continue
      }
      results.push(saved)
    }

    return json({ forecastDate, results }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : "Noma'lum xato" }, 500)
  }
})
