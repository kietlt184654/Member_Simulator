export type ThemeMode = 'light' | 'dark'

export type PlaygroundTab =
  | 'CalculateRange'
  | 'EstimateChargingCost'
  | 'GetStationAmenities'
  | 'PlanRoute'
  | 'ChargingStationsAll'
  | 'StationStatus'

export interface ApiSettings {
  baseUrl: string
  apiKey: string
  useBearer: boolean
  bearerToken: string
}

export interface ApiExecutionResult {
  status: number
  statusText: string
  elapsedMs: number
  headers: Record<string, string>
  body: unknown
  isError: boolean
  errorGroup?: string
  errorMessage?: string
  requestUrl?: string
  transport?: 'direct' | 'relay'
}
