const { normalizeBaseUrl } = require('./_relay')

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,x-target-base-url')
}

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res)
    return res.status(204).end()
  }

  setCors(res)
  const port = Number(process.env.SIMULATOR_PORT || 8787)
  res.json({ ok: true, service: 'ev-relay-simulator', port })
}
