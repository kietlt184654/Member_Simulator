import type { ApiExecutionResult, ApiSettings } from '../types/api'
import type {
  CalculateRangeRequest,
  CalculateRangeResponse,
  EstimateChargingCostRequest,
  EstimateChargingCostResponse,
  GetStationAmenitiesRequest,
  GetStationAmenitiesResponse,
} from '../types/endpoints'

interface RequestOptions {
  method: 'GET' | 'POST'
  path: string
  settings: ApiSettings
  body?: unknown
}

interface SimulatorRouteOptions {
  simulatorUrl: string
  simulatorPath: string
  method: 'GET' | 'POST'
  targetBaseUrl: string
  apiKey: string
  bearerToken?: string
  body?: unknown
}

export interface RelayExecutePayload {
  targetBaseUrl: string
  targetPath: string
  method: 'GET' | 'POST'
  apiKey: string
  bearerToken?: string
  body?: unknown
}

interface CurlOptions {
  method: 'GET' | 'POST'
  baseUrl: string
  path: string
  headers: Record<string, string>
  body?: unknown
}

// Fallback simulator URL from Vite client env (set VITE_SIMULATOR_URL in Vercel)
const DEFAULT_SIMULATOR_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SIMULATOR_URL) || ''

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '')
  }

  return `https://${trimmed}`.replace(/\/+$/, '')
}

function toHeadersObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries())
}

function buildHeaders(settings: ApiSettings, method: 'GET' | 'POST'): HeadersInit {
  const headers: Record<string, string> = {
    'x-api-key': settings.apiKey,
  }

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json'
  }

  if (settings.useBearer && settings.bearerToken.trim()) {
    headers.Authorization = `Bearer ${settings.bearerToken.trim()}`
  }

  return headers
}

function toErrorGroup(status: number): string {
  if (status === 401) {
    return '401 Unauthorized'
  }
  if (status === 403) {
    return '403 Forbidden'
  }
  if (status === 404) {
    return '404 Not Found'
  }
  if (status === 429) {
    return '429 Too Many Requests'
  }
  if (status >= 500) {
    return '500 Internal Server Error'
  }

  return 'Request Error'
}

function parseBodyByType(contentType: string | null, raw: string): unknown {
  if (!raw) {
    return null
  }

  if (contentType?.toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(raw)
    } catch {
      return { message: raw }
    }
  }

  return { message: raw }
}

function htmlRoutingErrorResult(
  status: number,
  statusText: string,
  elapsedMs: number,
  headers: Record<string, string>,
  body: unknown,
  requestUrl: string,
): ApiExecutionResult {
  return {
    status,
    statusText,
    elapsedMs,
    headers,
    body,
    isError: true,
    errorGroup: 'Routing Error',
    errorMessage:
      'Received HTML instead of JSON. Request may be routed to a frontend host or wrong origin/path.',
    requestUrl,
  }
}

async function executeRequest<TResponse>(options: RequestOptions): Promise<ApiExecutionResult> {
  const { method, path, settings, body } = options
  const baseUrl = normalizeBaseUrl(settings.baseUrl)
  const url = `${baseUrl}${path}`

  const startedAt = performance.now()
  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(settings, method),
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    })

    const elapsedMs = Math.round(performance.now() - startedAt)
    const rawText = await response.text()
    const parsedBody = parseBodyByType(response.headers.get('content-type'), rawText) as TResponse
    const headersObj = toHeadersObject(response.headers)
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

    if (response.ok && contentType.includes('text/html')) {
      return htmlRoutingErrorResult(
        response.status,
        response.statusText,
        elapsedMs,
        headersObj,
        parsedBody,
        url,
      )
    }

    if (!response.ok) {
      return {
        status: response.status,
        statusText: response.statusText,
        elapsedMs,
        headers: headersObj,
        body: parsedBody,
        isError: true,
        errorGroup: toErrorGroup(response.status),
        errorMessage:
          response.status === 429
            ? 'Quota may be exhausted. Try another API key or wait for quota reset.'
            : 'API request failed.',
        requestUrl: url,
      }
    }

    return {
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      headers: headersObj,
      body: parsedBody,
      isError: false,
      requestUrl: url,
      transport: 'direct',
    }
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    const message = error instanceof Error ? error.message : 'Unknown network error'

    return {
      status: 0,
      statusText: 'Network Error',
      elapsedMs,
      headers: {},
      body: { message },
      isError: true,
      errorGroup: 'Network Error',
      errorMessage: 'Cannot reach API server. Check Base URL, CORS policy, and network.',
      requestUrl: url,
    }
  }
}

export async function executeThroughSimulator(
  simulatorUrl: string,
  payload: RelayExecutePayload,
): Promise<ApiExecutionResult> {
  const base = normalizeBaseUrl(simulatorUrl || String(DEFAULT_SIMULATOR_URL))
  const url = `${base}/simulate/execute`
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const elapsedMs = Math.round(performance.now() - startedAt)
    const rawText = await response.text()
    const parsedBody = parseBodyByType(response.headers.get('content-type'), rawText)

    if (!response.ok) {
      return {
        status: response.status,
        statusText: response.statusText,
        elapsedMs,
        headers: toHeadersObject(response.headers),
        body: parsedBody,
        isError: true,
        errorGroup: toErrorGroup(response.status),
        errorMessage: 'Simulator service returned an error.',
        requestUrl: url,
        transport: 'relay',
      }
    }

    return parsedBody as ApiExecutionResult
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    const message = error instanceof Error ? error.message : 'Unknown simulator error'

    return {
      status: 0,
      statusText: 'Simulator Network Error',
      elapsedMs,
      headers: {},
      body: { message },
      isError: true,
      errorGroup: 'Network Error',
      errorMessage: 'Cannot reach Simulator service. Start local relay server and verify URL.',
      requestUrl: url,
      transport: 'relay',
    }
  }
}

export async function executeSimulatorRoute(
  options: SimulatorRouteOptions,
): Promise<ApiExecutionResult> {
  const base = normalizeBaseUrl(options.simulatorUrl || String(DEFAULT_SIMULATOR_URL))
  const url = `${base}${options.simulatorPath}`
  const startedAt = performance.now()

  try {
    const response = await fetch(`${url}?targetBaseUrl=${encodeURIComponent(options.targetBaseUrl)}`, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        ...(options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {}),
      },
      body: options.method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
    })

    const elapsedMs = Math.round(performance.now() - startedAt)
    const rawText = await response.text()
    const parsedBody = parseBodyByType(response.headers.get('content-type'), rawText)

    if (!response.ok) {
      return {
        status: response.status,
        statusText: response.statusText,
        elapsedMs,
        headers: toHeadersObject(response.headers),
        body: parsedBody,
        isError: true,
        errorGroup: toErrorGroup(response.status),
        errorMessage: 'Simulator route returned an error.',
        requestUrl: `${url}?targetBaseUrl=${encodeURIComponent(options.targetBaseUrl)}`,
        transport: 'relay',
      }
    }

    return parsedBody as ApiExecutionResult
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    const message = error instanceof Error ? error.message : 'Unknown simulator route error'

    return {
      status: 0,
      statusText: 'Simulator Route Network Error',
      elapsedMs,
      headers: {},
      body: { message },
      isError: true,
      errorGroup: 'Network Error',
      errorMessage: 'Cannot reach Simulator route. Start the simulator service and verify URL.',
      requestUrl: `${url}?targetBaseUrl=${encodeURIComponent(options.targetBaseUrl)}`,
      transport: 'relay',
    }
  }
}

export function buildCurlPreview(options: CurlOptions): string {
  const normalizedBaseUrl = normalizeBaseUrl(options.baseUrl) || '<BASE_URL>'
  const url = `${normalizedBaseUrl}${options.path}`

  const headerLines = Object.entries(options.headers)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `  -H "${key}: ${value}"`)

  if (options.method === 'POST') {
    headerLines.push('  -H "Content-Type: application/json"')
  }

  const bodyPart =
    options.method === 'POST' ? ` \\\\\n  -d '${JSON.stringify(options.body ?? {}, null, 2)}'` : ''

  const headerPart = headerLines.join(' \\\\\n')

  return `curl -X ${options.method} "${url}" \\\\\n${headerPart}${bodyPart}`
}

export function calculateRange(
  settings: ApiSettings,
  body: CalculateRangeRequest,
): Promise<ApiExecutionResult> {
  return executeRequest<CalculateRangeResponse>({
    method: 'POST',
    path: '/api/RangeCalculation/calculate',
    settings,
    body,
  })
}

export function estimateChargingCost(
  settings: ApiSettings,
  body: EstimateChargingCostRequest,
): Promise<ApiExecutionResult> {
  return executeRequest<EstimateChargingCostResponse>({
    method: 'POST',
    path: '/api/ChargingCalculation/estimate',
    settings,
    body,
  })
}

export function getStationAmenities(
  settings: ApiSettings,
  params: GetStationAmenitiesRequest,
): Promise<ApiExecutionResult> {
  return executeRequest<GetStationAmenitiesResponse>({
    method: 'GET',
    path: `/api/Amenities/station/${params.stationId}`,
    settings,
  })
}

