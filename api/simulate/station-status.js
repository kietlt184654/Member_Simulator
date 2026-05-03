import {
  resolveTargetBaseUrl,
  hasApiKey,
  relayUpstream,
  createStationStatusPayload,
} from './_relay.js'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,x-target-base-url')
}

export default async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res)
    return res.status(204).end()
  }

  setCors(res)
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const defaultTarget = process.env.SIMULATOR_TARGET_BASE_URL || ''
  const targetBaseUrl = resolveTargetBaseUrl(req, defaultTarget)
  if (!targetBaseUrl) return res.status(400).json({ message: 'Missing target base URL.' })
  if (!hasApiKey(req)) return res.status(400).json({ message: 'x-api-key header is required.' })

  const bearerToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const result = await relayUpstream({
    targetBaseUrl,
    targetPath: '/api/StationStatus',
    method: 'GET',
    apiKey: req.headers['x-api-key'],
    bearerToken,
  })

  if (result.isError && result.status === 404) {
    result.body = createStationStatusPayload()
    result.status = 200
    result.statusText = 'OK'
    result.isError = false
  }

  res.status(result.status || 200).json(result)
}
