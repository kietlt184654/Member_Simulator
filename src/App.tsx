import { useMemo, useState } from 'react'
import './App.css'
import {
  calculateRange,
  estimateChargingCost,
  getStationAmenities,
  buildCurlPreview,
  executeThroughSimulator,
  executeSimulatorRoute,
} from './api/client'
import { ApiResponsePanel } from './components/ApiResponsePanel'
import type {
  ApiExecutionResult,
  ApiSettings,
  ThemeMode,
  PlaygroundTab,
} from './types/api'
import type {
  CalculateRangeRequest,
  EstimateChargingCostRequest,
  GetStationAmenitiesRequest,
  PlanRouteRequest,
} from './types/endpoints'
import {
  createSampleCalculateRange,
  createSampleEstimateChargingCost,
  createSampleGetStationAmenities,
  createSamplePlanRoute,
  validateCalculateRange,
  validateEstimateChargingCost,
  validateGetStationAmenities,
  validatePlanRoute,
} from './utils/validation'

const ENV_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const ENV_SIMULATOR_URL = import.meta.env.VITE_SIMULATOR_URL ?? 'http://localhost:8787'

const STORAGE_KEYS = {
  baseUrl: 'ev-playground-base-url',
  apiKey: 'ev-playground-api-key',
  bearerEnabled: 'ev-playground-bearer-enabled',
  bearerToken: 'ev-playground-bearer-token',
  useRelay: 'ev-playground-use-relay',
  simulatorUrl: 'ev-playground-simulator-url',
  theme: 'ev-playground-theme',
} as const

function getStoredValue(key: string, fallback = ''): string {
  return localStorage.getItem(key) ?? fallback
}

function getStoredBoolean(key: string): boolean {
  return localStorage.getItem(key) === 'true'
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(
    (getStoredValue(STORAGE_KEYS.theme, 'light') as ThemeMode) || 'light',
  )
  const [baseUrl, setBaseUrl] = useState(getStoredValue(STORAGE_KEYS.baseUrl, ENV_BASE_URL))
  const [apiKey, setApiKey] = useState(getStoredValue(STORAGE_KEYS.apiKey))
  const [useBearer, setUseBearer] = useState(getStoredBoolean(STORAGE_KEYS.bearerEnabled))
  const [bearerToken, setBearerToken] = useState(getStoredValue(STORAGE_KEYS.bearerToken))
  const [useRelay, setUseRelay] = useState(
    localStorage.getItem(STORAGE_KEYS.useRelay) !== 'false',
  )
  const [simulatorUrl, setSimulatorUrl] = useState(
    getStoredValue(STORAGE_KEYS.simulatorUrl, ENV_SIMULATOR_URL),
  )
  const [globalMessage, setGlobalMessage] = useState('')

  const [activeTab, setActiveTab] = useState<PlaygroundTab>('CalculateRange')
  const [isLoading, setIsLoading] = useState(false)

  const [calculateRangeReq, setCalculateRangeReq] = useState<CalculateRangeRequest>(
    createSampleCalculateRange,
  )
  const [estimateReq, setEstimateReq] = useState<EstimateChargingCostRequest>(
    createSampleEstimateChargingCost,
  )
  const [amenitiesReq, setAmenitiesReq] = useState<GetStationAmenitiesRequest>(
    createSampleGetStationAmenities,
  )
  const [planRouteReq, setPlanRouteReq] = useState<PlanRouteRequest>(createSamplePlanRoute)

  const [validationError, setValidationError] = useState('')
  const [result, setResult] = useState<ApiExecutionResult | null>(null)

  const settings: ApiSettings = useMemo(
    () => ({
      baseUrl,
      apiKey,
      useBearer,
      bearerToken,
    }),
    [baseUrl, apiKey, useBearer, bearerToken],
  )

  const currentTarget = useMemo(() => {
    if (activeTab === 'CalculateRange') {
      return {
        kind: 'direct' as const,
        method: 'POST' as const,
        path: '/api/RangeCalculation/calculate',
        body: calculateRangeReq,
      }
    }

    if (activeTab === 'EstimateChargingCost') {
      return {
        kind: 'direct' as const,
        method: 'POST' as const,
        path: '/api/ChargingCalculation/estimate',
        body: estimateReq,
      }
    }

    if (activeTab === 'GetStationAmenities') {
      return {
        kind: 'direct' as const,
        method: 'GET' as const,
        path: `/api/Amenities/station/${amenitiesReq.stationId}`,
        body: undefined,
      }
    }

    if (activeTab === 'PlanRoute') {
      return {
        kind: 'simulator' as const,
        method: 'POST' as const,
        simulatorPath: '/simulate/routing/plan-route',
        path: '/api/Routing/plan-route',
        body: planRouteReq,
      }
    }

    if (activeTab === 'ChargingStationsAll') {
      return {
        kind: 'simulator' as const,
        method: 'GET' as const,
        simulatorPath: '/simulate/charging-stations/all',
        path: '/api/ChargingStations/all',
        body: undefined,
      }
    }

    return {
      kind: 'simulator' as const,
      method: 'GET' as const,
      simulatorPath: '/simulate/station-status',
      path: '/api/StationStatus',
      body: undefined,
    }
  }, [activeTab, amenitiesReq.stationId, calculateRangeReq, estimateReq, planRouteReq])

  const curlPreview = useMemo(() => {
    const headers = {
      'x-api-key': apiKey || '<API_KEY>',
      ...(useBearer && bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    }

    if (currentTarget.kind === 'simulator') {
      return buildCurlPreview({
        method: currentTarget.method,
        baseUrl: simulatorUrl,
        path: `${currentTarget.simulatorPath}?targetBaseUrl=${encodeURIComponent(baseUrl)}`,
        headers,
        body: currentTarget.body,
      })
    }

    return buildCurlPreview({
      method: currentTarget.method,
      baseUrl,
      path: currentTarget.path,
      headers,
      body: currentTarget.body,
    })
  }, [apiKey, baseUrl, bearerToken, currentTarget, simulatorUrl, useBearer])

  function saveConfig() {
    localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl)
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey)
    localStorage.setItem(STORAGE_KEYS.bearerEnabled, String(useBearer))
    localStorage.setItem(STORAGE_KEYS.bearerToken, bearerToken)
    localStorage.setItem(STORAGE_KEYS.useRelay, String(useRelay))
    localStorage.setItem(STORAGE_KEYS.simulatorUrl, simulatorUrl)
    localStorage.setItem(STORAGE_KEYS.theme, theme)
    setGlobalMessage('Configuration saved to browser storage.')
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEYS.baseUrl)
    localStorage.removeItem(STORAGE_KEYS.apiKey)
    localStorage.removeItem(STORAGE_KEYS.bearerEnabled)
    localStorage.removeItem(STORAGE_KEYS.bearerToken)
    localStorage.removeItem(STORAGE_KEYS.useRelay)
    localStorage.removeItem(STORAGE_KEYS.simulatorUrl)
    setBaseUrl(ENV_BASE_URL)
    setApiKey('')
    setUseBearer(false)
    setBearerToken('')
    setUseRelay(true)
    setSimulatorUrl(ENV_SIMULATOR_URL)
    setGlobalMessage('Configuration cleared. Base URL reset to env default.')
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem(STORAGE_KEYS.theme, nextTheme)
  }

  function resetCurrentTab() {
    setValidationError('')
    setResult(null)

    if (activeTab === 'CalculateRange') {
      setCalculateRangeReq(createSampleCalculateRange())
      return
    }

    if (activeTab === 'EstimateChargingCost') {
      setEstimateReq(createSampleEstimateChargingCost())
      return
    }

    if (activeTab === 'PlanRoute') {
      setPlanRouteReq(createSamplePlanRoute())
      return
    }

    setAmenitiesReq(createSampleGetStationAmenities())
  }

  async function executeCurrentTab() {
    setValidationError('')
    setGlobalMessage('')

    if (!apiKey.trim()) {
      setValidationError('Missing API key. Please enter x-api-key before executing any request.')
      return
    }

    if (!baseUrl.trim()) {
      setValidationError('Missing Base URL. Please enter API base URL before executing.')
      return
    }

    if (useRelay && !simulatorUrl.trim()) {
      setValidationError('Relay mode is enabled. Please provide Simulator URL.')
      return
    }

    let err = ''

    if (activeTab === 'CalculateRange') {
      err = validateCalculateRange(calculateRangeReq)
    } else if (activeTab === 'EstimateChargingCost') {
      err = validateEstimateChargingCost(estimateReq)
    } else if (activeTab === 'PlanRoute') {
      err = validatePlanRoute(planRouteReq)
    } else {
      err = validateGetStationAmenities(amenitiesReq)
    }

    if (err) {
      setValidationError(err)
      return
    }

    setIsLoading(true)
    try {
      if (activeTab === 'PlanRoute') {
        const response = await executeSimulatorRoute({
          simulatorUrl,
          simulatorPath: '/simulate/routing/plan-route',
          method: 'POST',
          targetBaseUrl: baseUrl,
          apiKey,
          bearerToken: useBearer ? bearerToken : undefined,
          body: planRouteReq,
        })
        setResult(response)
        return
      }

      if (activeTab === 'ChargingStationsAll') {
        const response = await executeSimulatorRoute({
          simulatorUrl,
          simulatorPath: '/simulate/charging-stations/all',
          method: 'GET',
          targetBaseUrl: baseUrl,
          apiKey,
          bearerToken: useBearer ? bearerToken : undefined,
        })
        setResult(response)
        return
      }

      if (activeTab === 'StationStatus') {
        const response = await executeSimulatorRoute({
          simulatorUrl,
          simulatorPath: '/simulate/station-status',
          method: 'GET',
          targetBaseUrl: baseUrl,
          apiKey,
          bearerToken: useBearer ? bearerToken : undefined,
        })
        setResult(response)
        return
      }

      if (useRelay) {
        const response = await executeThroughSimulator(simulatorUrl, {
          targetBaseUrl: baseUrl,
          targetPath: currentTarget.path,
          method: currentTarget.method,
          apiKey,
          bearerToken: useBearer ? bearerToken : undefined,
          body: currentTarget.body,
        })
        setResult(response)
        return
      }

      if (activeTab === 'CalculateRange') {
        const response = await calculateRange(settings, calculateRangeReq)
        setResult(response)
      } else if (activeTab === 'EstimateChargingCost') {
        const response = await estimateChargingCost(settings, estimateReq)
        setResult(response)
      } else {
        const response = await getStationAmenities(settings, amenitiesReq)
        setResult(response)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="backdrop" aria-hidden="true"></div>
      <header className="playground-header">
        <div className="title-wrap">
          <p className="eyebrow">Third-party Integration Sandbox</p>
          <h1>EV API Key Playground</h1>
        </div>

        <div className="header-grid">
          <label className="field">
            <span>Base URL</span>
            <input
              type="text"
              placeholder="https://api.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>

          <label className="field">
            <span>API key (x-api-key)</span>
            <input
              type="password"
              placeholder="Enter API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>

          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={useBearer}
              onChange={(e) => setUseBearer(e.target.checked)}
            />
            <span>Add Authorization Bearer token</span>
          </label>

          <label className="field">
            <span>Bearer token (optional)</span>
            <input
              type="password"
              placeholder="Enter bearer token"
              value={bearerToken}
              disabled={!useBearer}
              onChange={(e) => setBearerToken(e.target.value)}
            />
          </label>

          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={useRelay}
              onChange={(e) => setUseRelay(e.target.checked)}
            />
            <span>Use Server Relay Simulator (recommended for quota)</span>
          </label>

          <label className="field">
            <span>Simulator URL</span>
            <input
              type="text"
              placeholder="http://localhost:8787"
              value={simulatorUrl}
              disabled={!useRelay}
              onChange={(e) => setSimulatorUrl(e.target.value)}
            />
          </label>
        </div>

        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={saveConfig}>
            Save
          </button>
          <button type="button" className="btn" onClick={clearConfig}>
            Clear
          </button>
          <button type="button" className="btn" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
        {useRelay ? (
          <p className="relay-tip">
            Relay mode ON: request goes through simulator service first, then server-to-server to backend.
          </p>
        ) : null}
        {globalMessage ? <p className="hint">{globalMessage}</p> : null}
      </header>

      <main className="main-grid">
        <section className="api-card">
          <nav className="tabs" aria-label="API tabs">
            {(
              [
                'CalculateRange',
                'EstimateChargingCost',
                'GetStationAmenities',
                'PlanRoute',
                'ChargingStationsAll',
                'StationStatus',
              ] as PlaygroundTab[]
            ).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab)
                    setValidationError('')
                    setResult(null)
                  }}
                >
                  {tab}
                </button>
              ),
            )}
          </nav>

          {activeTab === 'CalculateRange' ? (
            <section className="panel" aria-label="Calculate Range request">
              <h2>POST /api/RangeCalculation/calculate</h2>
              <p className="hint">Sample payload is pre-filled. Update values then execute.</p>

              <div className="form-grid">
                <label className="field">
                  <span>currentLat</span>
                  <input
                    type="number"
                    value={calculateRangeReq.currentLat}
                    onChange={(e) =>
                      setCalculateRangeReq((prev) => ({
                        ...prev,
                        currentLat: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>currentLon</span>
                  <input
                    type="number"
                    value={calculateRangeReq.currentLon}
                    onChange={(e) =>
                      setCalculateRangeReq((prev) => ({
                        ...prev,
                        currentLon: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>currentBatteryPercent</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={calculateRangeReq.currentBatteryPercent}
                    onChange={(e) =>
                      setCalculateRangeReq((prev) => ({
                        ...prev,
                        currentBatteryPercent: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>vehicleCode</span>
                  <input
                    type="text"
                    value={calculateRangeReq.vehicleCode}
                    onChange={(e) =>
                      setCalculateRangeReq((prev) => ({
                        ...prev,
                        vehicleCode: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          {activeTab === 'PlanRoute' ? (
            <section className="panel" aria-label="Plan route request">
              <h2>POST /api/Routing/plan-route</h2>
              <p className="hint">Sample payload is pre-filled. Execute through simulator.</p>

              <div className="form-grid">
                <label className="field">
                  <span>startLat</span>
                  <input
                    type="number"
                    value={planRouteReq.startLat}
                    onChange={(e) =>
                      setPlanRouteReq((prev) => ({
                        ...prev,
                        startLat: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>startLon</span>
                  <input
                    type="number"
                    value={planRouteReq.startLon}
                    onChange={(e) =>
                      setPlanRouteReq((prev) => ({
                        ...prev,
                        startLon: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>endLat</span>
                  <input
                    type="number"
                    value={planRouteReq.endLat}
                    onChange={(e) =>
                      setPlanRouteReq((prev) => ({
                        ...prev,
                        endLat: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>endLon</span>
                  <input
                    type="number"
                    value={planRouteReq.endLon}
                    onChange={(e) =>
                      setPlanRouteReq((prev) => ({
                        ...prev,
                        endLon: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>currentBatteryPercent</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={planRouteReq.currentBatteryPercent}
                    onChange={(e) =>
                      setPlanRouteReq((prev) => ({
                        ...prev,
                        currentBatteryPercent: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>vehicleCode</span>
                  <input
                    type="text"
                    value={planRouteReq.vehicleCode}
                    onChange={(e) =>
                      setPlanRouteReq((prev) => ({
                        ...prev,
                        vehicleCode: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          {activeTab === 'ChargingStationsAll' ? (
            <section className="panel" aria-label="Get all charging stations request">
              <h2>GET /api/ChargingStations/all</h2>
              <p className="hint">No request body is needed. The simulator will relay and can fall back to sample data.</p>
            </section>
          ) : null}

          {activeTab === 'StationStatus' ? (
            <section className="panel" aria-label="Get station status request">
              <h2>GET /api/StationStatus</h2>
              <p className="hint">No request body is needed. Bearer token is optional and will be forwarded if enabled.</p>
            </section>
          ) : null}

          {activeTab === 'EstimateChargingCost' ? (
            <section className="panel" aria-label="Estimate charging cost request">
              <h2>POST /api/ChargingCalculation/estimate</h2>
              <p className="hint">connectorTypeId, vehicleCode, batteryCapacityKwh are optional fields.</p>
              <div className="form-grid">
                <label className="field">
                  <span>stationId (GUID)</span>
                  <input
                    type="text"
                    value={estimateReq.stationId}
                    onChange={(e) =>
                      setEstimateReq((prev) => ({
                        ...prev,
                        stationId: e.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>connectorTypeId (optional GUID)</span>
                  <input
                    type="text"
                    value={estimateReq.connectorTypeId ?? ''}
                    onChange={(e) =>
                      setEstimateReq((prev) => ({
                        ...prev,
                        connectorTypeId: e.target.value || undefined,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>vehicleCode (optional)</span>
                  <input
                    type="text"
                    value={estimateReq.vehicleCode ?? ''}
                    onChange={(e) =>
                      setEstimateReq((prev) => ({
                        ...prev,
                        vehicleCode: e.target.value || undefined,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>batteryCapacityKwh (optional)</span>
                  <input
                    type="number"
                    min={0}
                    value={estimateReq.batteryCapacityKwh ?? ''}
                    onChange={(e) =>
                      setEstimateReq((prev) => ({
                        ...prev,
                        batteryCapacityKwh: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>currentSocPercent</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={estimateReq.currentSocPercent}
                    onChange={(e) =>
                      setEstimateReq((prev) => ({
                        ...prev,
                        currentSocPercent: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>targetSocPercent</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={estimateReq.targetSocPercent}
                    onChange={(e) =>
                      setEstimateReq((prev) => ({
                        ...prev,
                        targetSocPercent: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            </section>
          ) : null}

          {activeTab === 'GetStationAmenities' ? (
            <section className="panel" aria-label="Get station amenities request">
              <h2>GET /api/Amenities/station/{'{stationId}'}</h2>
              <p className="hint">stationId must be a valid GUID.</p>
              <div className="form-grid">
                <label className="field">
                  <span>stationId (GUID)</span>
                  <input
                    type="text"
                    value={amenitiesReq.stationId}
                    onChange={(e) => setAmenitiesReq({ stationId: e.target.value })}
                  />
                </label>
              </div>
            </section>
          ) : null}

          <section className="panel">
            <h2>cURL preview</h2>
            <pre className="curl-box">{curlPreview}</pre>
          </section>

          {validationError ? <p className="error-banner">{validationError}</p> : null}

          <div className="action-row">
            <button type="button" className="btn btn-primary" onClick={executeCurrentTab} disabled={isLoading}>
              {isLoading ? 'Executing...' : 'Execute'}
            </button>
            <button type="button" className="btn" onClick={resetCurrentTab} disabled={isLoading}>
              Reset
            </button>
          </div>
        </section>

        <ApiResponsePanel result={result} />
      </main>
    </div>
  )
}

export default App
