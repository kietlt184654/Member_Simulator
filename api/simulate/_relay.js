const DEFAULT_TIMEOUT = 15000

function normalizeBaseUrl(u) {
  if (!u) return ''
  let s = String(u).trim()
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  // remove trailing slash
  return s.replace(/\/+$/,'')
}

function resolveTargetBaseUrl(req, defaultTarget = '') {
  // prefer query param, then header, then default env
  const q = (req.query && req.query.targetBaseUrl) || req.url && (new URL(req.url, 'http://localhost')).searchParams.get('targetBaseUrl')
  const header = req.headers && (req.headers['x-target-base-url'] || req.headers['x-target-baseurl'])
  return normalizeBaseUrl(q || header || defaultTarget || '')
}

function hasApiKey(req) {
  return Boolean(req.headers && (req.headers['x-api-key'] || req.headers['x-apiKey']))
}

async function relayUpstream({ targetBaseUrl, targetPath = '/', method = 'GET', apiKey, bearerToken, body }) {
  try {
    const base = normalizeBaseUrl(targetBaseUrl)
    if (!base) return { isError: true, status: 400, statusText: 'Bad Request', body: 'Missing target base URL' }
    const url = base + targetPath

    const headers = {}
    if (apiKey) headers['x-api-key'] = apiKey
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
    if (body != null) headers['Content-Type'] = 'application/json'

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    if (controller) setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller ? controller.signal : undefined,
    })

    const text = await res.text()
    let parsed = text
    try { parsed = text ? JSON.parse(text) : null } catch (e) { /* leave as text */ }

    const hdrObj = {}
    try { for (const [k,v] of res.headers) hdrObj[k] = v } catch(e){}

    return {
      status: res.status,
      statusText: res.statusText,
      headers: hdrObj,
      body: parsed,
      isError: !res.ok,
    }
  } catch (err) {
    return { isError: true, status: 502, statusText: 'Bad Gateway', body: String(err && err.message ? err.message : err) }
  }
}

function createChargingStationsPayload() {
  return {
    stations: [],
    message: 'sample payload',
  }
}

function createStationStatusPayload() {
  return {
    status: 'OK',
    stations: [],
  }
}

function createPlanRoutePayload(body) {
  // if caller provided a body, forward it; else return minimal placeholder
  return body || { waypoints: [] }
}

export {
  normalizeBaseUrl,
  resolveTargetBaseUrl,
  hasApiKey,
  relayUpstream,
  createChargingStationsPayload,
  createStationStatusPayload,
  createPlanRoutePayload,
}
