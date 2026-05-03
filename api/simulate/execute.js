const { relayUpstream } = require('./_relay')

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,x-target-base-url')
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res)
    return res.status(204).end()
  }

  setCors(res)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { targetBaseUrl, targetPath, method, apiKey, bearerToken, body } = req.body || {}
  const result = await relayUpstream({ targetBaseUrl, targetPath, method, apiKey, bearerToken, body })
  res.status(result.status || 200).json(result)
}
