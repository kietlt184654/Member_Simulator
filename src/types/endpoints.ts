export interface CalculateRangeRequest {
  currentLat: number
  currentLon: number
  currentBatteryPercent: number
  vehicleCode: string
}

export interface EstimateChargingCostRequest {
  stationId: string
  connectorTypeId?: string
  vehicleCode?: string
  batteryCapacityKwh?: number
  currentSocPercent: number
  targetSocPercent: number
}

export interface GetStationAmenitiesRequest {
  stationId: string
}

export interface PlanRouteRequest {
  startLat: number
  startLon: number
  endLat: number
  endLon: number
  currentBatteryPercent: number
  vehicleCode: string
}

export interface StationStatusRequest {
  bearerToken?: string
}

export type CalculateRangeResponse = Record<string, unknown>
export type EstimateChargingCostResponse = Record<string, unknown>
export type GetStationAmenitiesResponse = Record<string, unknown>
export type PlanRouteResponse = Record<string, unknown>
export type ChargingStationsResponse = Record<string, unknown>[]
export type StationStatusResponse = {
  Data: unknown[]
  Count: number
  Timestamp: string
}
