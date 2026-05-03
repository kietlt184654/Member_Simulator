import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.SIMULATOR_PORT || 8787)
const defaultTargetBaseUrl = String(process.env.SIMULATOR_TARGET_BASE_URL || '').trim()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim()
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '')
  }

  return `https://${trimmed}`.replace(/\/+$/, '')
}

function toHeadersObject(headers) {
  return Object.fromEntries(headers.entries())
}

function toErrorGroup(status) {
  if (status === 401) return '401 Unauthorized'
  if (status === 403) return '403 Forbidden'
  if (status === 404) return '404 Not Found'
  if (status === 429) return '429 Too Many Requests'
  if (status >= 500) return '500 Internal Server Error'
  return 'Request Error'
}

function parseBodyByType(contentType, raw) {
  if (!raw) return null

  if (String(contentType || '').toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(raw)
    } catch {
      return { message: raw }
    }
  }

  return { message: raw }
}

function resolveTargetBaseUrl(req) {
  const fromHeader = String(req.get('x-target-base-url') || '').trim()
  const fromQuery = String(req.query.targetBaseUrl || '').trim()
  const fromBody = String(req.body?.targetBaseUrl || '').trim()

  return normalizeBaseUrl(fromHeader || fromQuery || fromBody || defaultTargetBaseUrl)
}

function getRelayHeaders(method, apiKey, bearerToken) {
  return {
    'x-api-key': String(apiKey || ''),
    ...(String(method).toUpperCase() === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
  }
}

async function relayUpstream({
  targetBaseUrl,
  targetPath,
  method,
  apiKey,
  bearerToken,
  body,
}) {
  if (!targetBaseUrl || !targetPath || !method || !apiKey) {
    return {
      status: 400,
      statusText: 'Bad Request',
      elapsedMs: 0,
      headers: {},
      body: {
        message: 'Missing required fields: targetBaseUrl, targetPath, method, apiKey',
      },
      isError: true,
      errorGroup: 'Request Error',
      errorMessage: 'Missing required fields for relay execution.',
      requestUrl: '',
      transport: 'relay',
    }
  }

  const normalizedBase = normalizeBaseUrl(targetBaseUrl)
  const url = `${normalizedBase}${targetPath}`
  const startedAt = performance.now()

  try {
    const upstreamResponse = await fetch(url, {
      method,
      headers: getRelayHeaders(method, apiKey, bearerToken),
      body: String(method).toUpperCase() === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    })

    const elapsedMs = Math.round(performance.now() - startedAt)
    const rawText = await upstreamResponse.text()
    const contentType = upstreamResponse.headers.get('content-type') || ''
    const parsedBody = parseBodyByType(contentType, rawText)
    const headers = toHeadersObject(upstreamResponse.headers)

    if (upstreamResponse.ok && contentType.toLowerCase().includes('text/html')) {
      return {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        elapsedMs,
        headers,
        body: parsedBody,
        isError: true,
        errorGroup: 'Routing Error',
        errorMessage:
          'Received HTML instead of JSON. Check target origin/path and reverse-proxy rules.',
        requestUrl: url,
        transport: 'relay',
      }
    }

    if (!upstreamResponse.ok) {
      return {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        elapsedMs,
        headers,
        body: parsedBody,
        isError: true,
        errorGroup: toErrorGroup(upstreamResponse.status),
        errorMessage:
          upstreamResponse.status === 429
            ? 'Quota may be exhausted. Try another API key or wait for quota reset.'
            : 'Upstream API request failed.',
        requestUrl: url,
        transport: 'relay',
      }
    }

    return {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      elapsedMs,
      headers,
      body: parsedBody,
      isError: false,
      requestUrl: url,
      transport: 'relay',
    }
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    const message = error instanceof Error ? error.message : 'Unknown relay error'

    return {
      status: 502,
      statusText: 'Relay Network Error',
      elapsedMs,
      headers: {},
      body: { message },
      isError: true,
      errorGroup: 'Network Error',
      errorMessage: 'Simulator cannot reach upstream backend URL.',
      requestUrl: url,
      transport: 'relay',
    }
  }
}

function createPlanRoutePayload(body) {
  return {
    startLat: Number(body?.startLat ?? 10.762622),
    startLon: Number(body?.startLon ?? 106.660172),
    endLat: Number(body?.endLat ?? 10.823099),
    endLon: Number(body?.endLon ?? 106.629664),
    currentBatteryPercent: Number(body?.currentBatteryPercent ?? 60),
    vehicleCode: String(body?.vehicleCode ?? 'VF8'),
  }
}

function createChargingStationsPayload() {
  return [
    {
      Id: 'st-001',
      Name: 'District 1 Central Station',
      Latitude: 10.7769,
      Longitude: 106.7009,
      Address: 'District 1, Ho Chi Minh City',
      Status: 'Active',
      ConnectorCount: 8,
      SupportedVehicles: ['VF8', 'VF9'],
    },
    {
      Id: 'st-002',
      Name: 'Thao Dien Express Hub',
      Latitude: 10.8042,
      Longitude: 106.7341,
      Address: 'Thu Duc City, Ho Chi Minh City',
      Status: 'Active',
      ConnectorCount: 12,
      SupportedVehicles: ['VF8', 'VF9', 'E34'],
    },
  ]
}

function createStationStatusPayload() {
  return {
    Data: [
      {
        StationId: 'st-001',
        Status: 'Available',
        LastUpdated: new Date().toISOString(),
      },
      {
        StationId: 'st-002',
        Status: 'Occupied',
        LastUpdated: new Date().toISOString(),
      },
    ],
    Count: 2,
    Timestamp: new Date().toISOString(),
  }
}

function hasApiKey(req) {
  return Boolean(String(req.get('x-api-key') || '').trim())
}

app.get('/simulate/health', (_req, res) => {
  res.json({ ok: true, service: 'ev-relay-simulator', port })
})

app.post('/simulate/routing/plan-route', async (req, res) => {
  const targetBaseUrl = resolveTargetBaseUrl(req)
  if (!targetBaseUrl) {
    res.status(400).json({ message: 'Missing target base URL.' })
    return
  }

  if (!hasApiKey(req)) {
    res.status(400).json({ message: 'x-api-key header is required.' })
    return
  }

  const bearerToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const result = await relayUpstream({
    targetBaseUrl,
    targetPath: '/api/Routing/plan-route',
    method: 'POST',
    apiKey: req.get('x-api-key'),
    bearerToken,
    body: createPlanRoutePayload(req.body),
  })

  res.status(result.status).json(result)
})

app.get('/simulate/charging-stations/all', async (req, res) => {
  const targetBaseUrl = resolveTargetBaseUrl(req)
  if (!targetBaseUrl) {
    res.status(400).json({ message: 'Missing target base URL.' })
    return
  }

  if (!hasApiKey(req)) {
    res.status(400).json({ message: 'x-api-key header is required.' })
    return
  }

  const bearerToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const result = await relayUpstream({
    targetBaseUrl,
    targetPath: '/api/ChargingStations/all',
    method: 'GET',
    apiKey: req.get('x-api-key'),
    bearerToken,
  })

  if (result.isError && result.status === 404) {
    result.body = createChargingStationsPayload()
    result.status = 200
    result.statusText = 'OK'
    result.isError = false
  }

  res.status(result.status).json(result)
})

app.get('/simulate/station-status', async (req, res) => {
  const targetBaseUrl = resolveTargetBaseUrl(req)
  if (!targetBaseUrl) {
    res.status(400).json({ message: 'Missing target base URL.' })
    return
  }

  if (!hasApiKey(req)) {
    res.status(400).json({ message: 'x-api-key header is required.' })
    return
  }

  const bearerToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const result = await relayUpstream({
    targetBaseUrl,
    targetPath: '/api/StationStatus',
    method: 'GET',
    apiKey: req.get('x-api-key'),
    bearerToken,
  })

  if (result.isError && result.status === 404) {
    result.body = createStationStatusPayload()
    result.status = 200
    result.statusText = 'OK'
    result.isError = false
  }

  res.status(result.status).json(result)
})

app.post('/simulate/execute', async (req, res) => {
  const { targetBaseUrl, targetPath, method, apiKey, bearerToken, body } = req.body || {}
  const result = await relayUpstream({
    targetBaseUrl,
    targetPath,
    method,
    apiKey,
    bearerToken,
    body,
  })

  res.status(result.status || 200).json(result)
})

app.listen(port, () => {
  console.log(`[simulator] running on http://localhost:${port}`)
})
