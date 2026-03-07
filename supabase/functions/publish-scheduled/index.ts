import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type Json = Record<string, unknown>

interface CarouselSlide {
  num: number
  cardPath?: string
  imagePath?: string
  cardStoragePath?: string
  bgImageStoragePath?: string
}

interface CarouselRow {
  id: string
  user_id: string
  workspace_id?: string | null
  expert_id?: string | null
  caption: string | null
  slides: CarouselSlide[] | null
}

interface MetaCredentials {
  token: string
  accountId: string
}

const API_VERSION = "v21.0"
const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`

function json(status: number, payload: Json) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function isDataUrl(value?: string): boolean {
  return !!value && value.startsWith("data:")
}

function isHttpUrl(value?: string): boolean {
  return !!value && /^https?:\/\//i.test(value)
}

async function graphPost(path: string, body: Json, token: string): Promise<Json> {
  const res = await fetch(`${GRAPH_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  const data = await res.json()
  if (!res.ok || data?.error) {
    throw new Error(`Graph API: ${data?.error?.message || res.statusText}`)
  }
  return data as Json
}

async function graphGet(path: string, token: string): Promise<Json> {
  const joiner = path.includes("?") ? "&" : "?"
  const res = await fetch(`${GRAPH_BASE}/${path}${joiner}access_token=${encodeURIComponent(token)}`)
  const data = await res.json()
  if (!res.ok || data?.error) {
    throw new Error(`Graph API: ${data?.error?.message || res.statusText}`)
  }
  return data as Json
}

async function waitForCarouselReady(mediaId: string, token: string): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const status = await graphGet(`${mediaId}?fields=status_code`, token)
    const code = String(status.status_code || "")
    if (code === "FINISHED" || code === "PUBLISHED") return
    if (code === "ERROR") throw new Error("Instagram: erro ao processar carrossel")
    await new Promise((r) => setTimeout(r, 2_000))
  }
}

async function publishCarousel(
  accountId: string,
  token: string,
  imageUrls: string[],
  caption: string,
): Promise<string> {
  const containerIds = await Promise.all(
    imageUrls.map(async (url) => {
      const data = await graphPost(`${accountId}/media`, { image_url: url, is_carousel_item: true }, token)
      return String(data.id)
    }),
  )

  const carousel = await graphPost(`${accountId}/media`, {
    media_type: "CAROUSEL",
    children: containerIds.join(","),
    caption,
  }, token)

  const carouselId = String(carousel.id)
  await waitForCarouselReady(carouselId, token)

  const published = await graphPost(`${accountId}/media_publish`, { creation_id: carouselId }, token)
  return String(published.id)
}

async function uploadDataUrlAsJpg(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  carouselId: string,
  slideNum: number,
  dataUrl: string,
): Promise<string> {
  const [, base64] = dataUrl.split(",")
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const storagePath = `${userId}/cron-${carouselId}/slide-${slideNum}.jpg`

  const { error: uploadError } = await supabase.storage
    .from("carousel-images")
    .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true })
  if (uploadError) throw new Error(`Storage upload falhou: ${uploadError.message}`)

  const { data: signed, error: signedError } = await supabase.storage
    .from("carousel-images")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
  if (signedError || !signed?.signedUrl) {
    throw new Error(`Falha ao assinar imagem: ${signedError?.message || "sem URL assinada"}`)
  }
  return signed.signedUrl
}

async function resolveSlideUrl(
  supabase: ReturnType<typeof createClient>,
  carousel: CarouselRow,
  slide: CarouselSlide,
): Promise<string | null> {
  if (isDataUrl(slide.cardPath)) {
    return uploadDataUrlAsJpg(supabase, carousel.user_id, carousel.id, slide.num, slide.cardPath!)
  }
  if (isHttpUrl(slide.cardPath)) {
    return slide.cardPath!
  }
  if (slide.cardStoragePath) {
    const { data: signed, error } = await supabase.storage
      .from("carousel-images")
      .createSignedUrl(slide.cardStoragePath, 60 * 60 * 24 * 7)
    if (error || !signed?.signedUrl) {
      throw new Error(`Falha ao assinar card (${slide.cardStoragePath}): ${error?.message || "sem URL"}`)
    }
    return signed.signedUrl
  }

  if (isDataUrl(slide.imagePath)) {
    return uploadDataUrlAsJpg(supabase, carousel.user_id, carousel.id, slide.num, slide.imagePath!)
  }
  if (isHttpUrl(slide.imagePath)) {
    return slide.imagePath!
  }
  if (slide.bgImageStoragePath) {
    const { data: signed, error } = await supabase.storage
      .from("carousel-images")
      .createSignedUrl(slide.bgImageStoragePath, 60 * 60 * 24 * 7)
    if (error || !signed?.signedUrl) {
      throw new Error(`Falha ao assinar bg (${slide.bgImageStoragePath}): ${error?.message || "sem URL"}`)
    }
    return signed.signedUrl
  }

  return null
}

async function resolveMetaCredentials(
  supabase: ReturnType<typeof createClient>,
  carousel: CarouselRow,
): Promise<MetaCredentials | null> {
  let token = ""
  let accountId = ""

  if (carousel.expert_id) {
    const { data: expertById } = await supabase
      .from("experts")
      .select("ig_access_token, ig_account_id")
      .eq("id", carousel.expert_id)
      .maybeSingle()
    token = (expertById as Record<string, string> | null)?.ig_access_token || ""
    accountId = (expertById as Record<string, string> | null)?.ig_account_id || ""
  }

  if (!token || !accountId) {
    const { data: expertByUser } = await supabase
      .from("experts")
      .select("ig_access_token, ig_account_id")
      .eq("user_id", carousel.user_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    token = token || (expertByUser as Record<string, string> | null)?.ig_access_token || ""
    accountId = accountId || (expertByUser as Record<string, string> | null)?.ig_account_id || ""
  }

  if ((!token || !accountId) && carousel.workspace_id) {
    const { data: expertByWorkspace } = await supabase
      .from("experts")
      .select("ig_access_token, ig_account_id")
      .eq("workspace_id", carousel.workspace_id)
      .limit(1)
      .maybeSingle()
    token = token || (expertByWorkspace as Record<string, string> | null)?.ig_access_token || ""
    accountId = accountId || (expertByWorkspace as Record<string, string> | null)?.ig_account_id || ""
  }

  token = token || Deno.env.get("META_GRAPH_API_TOKEN") || Deno.env.get("IG_TOKEN") || ""
  accountId = accountId || Deno.env.get("META_IG_ACCOUNT_ID") || Deno.env.get("IG_ACCOUNT_ID") || ""

  if (!token || !accountId) return null
  return { token, accountId }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET")
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json(401, { error: "Não autorizado" })
  }

  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")
  if (!url || !serviceKey) {
    return json(500, { error: "Supabase env não configurada" })
  }

  const supabase = createClient(url, serviceKey)

  const { data: pending, error } = await supabase
    .from("carousels")
    .select("id,user_id,workspace_id,expert_id,caption,slides")
    .is("deleted_at", null)
    .lte("scheduled_at", new Date().toISOString())
    .is("ig_post_id", null)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(25)

  if (error) return json(500, { error: error.message })
  if (!pending || pending.length === 0) return json(200, { processed: 0, results: [] })

  const results: Array<{ id: string; status: string }> = []

  for (const raw of pending as CarouselRow[]) {
    try {
      const slides = (raw.slides || []).slice().sort((a, b) => a.num - b.num)
      if (!slides.length || !raw.caption) {
        results.push({ id: raw.id, status: "sem_imagens_ou_caption" })
        continue
      }

      const imageUrls: string[] = []
      for (const slide of slides) {
        const maybeUrl = await resolveSlideUrl(supabase, raw, slide)
        if (maybeUrl) imageUrls.push(maybeUrl)
      }
      if (!imageUrls.length) {
        results.push({ id: raw.id, status: "sem_urls_publicaveis" })
        continue
      }

      const meta = await resolveMetaCredentials(supabase, raw)
      if (!meta) {
        results.push({ id: raw.id, status: "credenciais_meta_ausentes" })
        continue
      }

      const postId = await publishCarousel(meta.accountId, meta.token, imageUrls, raw.caption)

      const { error: updateErr } = await supabase
        .from("carousels")
        .update({
          ig_post_id: postId,
          published_at: new Date().toISOString(),
        })
        .eq("id", raw.id)
        .eq("user_id", raw.user_id)
        .is("deleted_at", null)
      if (updateErr) throw new Error(updateErr.message)

      results.push({ id: raw.id, status: "publicado" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro_desconhecido"
      results.push({ id: raw.id, status: `erro: ${message}` })
    }
  }

  return json(200, { processed: results.length, results })
})
