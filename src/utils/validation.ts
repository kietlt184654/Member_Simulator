import type {
  CalculateRangeRequest,
  PlanRouteRequest,
  EstimateChargingCostRequest,
  GetStationAmenitiesRequest,
} from '../types/endpoints'

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isGuid(value: string): boolean {
  return GUID_REGEX.test(value.trim())
}

function inPercentRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}

export function createSampleCalculateRange(): CalculateRangeRequest {
  return {
    currentLat: 10.8231,
    currentLon: 106.6297,
    currentBatteryPercent: 72,
    vehicleCode: 'VF8_PLUS',
  }
}

export function createSampleEstimateChargingCost(): EstimateChargingCostRequest {
  return {
    stationId: '0f8fad5b-d9cb-469f-a165-70867728950e',
    connectorTypeId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    vehicleCode: 'VF8_PLUS',
    batteryCapacityKwh: 82,
    currentSocPercent: 25,
    targetSocPercent: 80,
  }
}

export function createSampleGetStationAmenities(): GetStationAmenitiesRequest {
  return {
    stationId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  }
}

export function createSamplePlanRoute(): PlanRouteRequest {
  return {
    startLat: 10.762622,
    startLon: 106.660172,
    endLat: 10.823099,
    endLon: 106.629664,
    currentBatteryPercent: 60,
    vehicleCode: 'VF8',
  }
}

export function validateCalculateRange(payload: CalculateRangeRequest): string {
  if (!Number.isFinite(payload.currentLat) || payload.currentLat < -90 || payload.currentLat > 90) {
    return 'currentLat must be a number between -90 and 90.'
  }

  if (!Number.isFinite(payload.currentLon) || payload.currentLon < -180 || payload.currentLon > 180) {
    return 'currentLon must be a number between -180 and 180.'
  }

  if (!inPercentRange(payload.currentBatteryPercent)) {
    return 'currentBatteryPercent must be between 0 and 100.'
  }

  if (!payload.vehicleCode.trim()) {
    return 'vehicleCode is required.'
  }

  return ''
}

export function validateEstimateChargingCost(payload: EstimateChargingCostRequest): string {
  if (!isGuid(payload.stationId)) {
    return 'stationId must be a valid GUID.'
  }

  if (payload.connectorTypeId && !isGuid(payload.connectorTypeId)) {
    return 'connectorTypeId must be a valid GUID when provided.'
  }

  if (!inPercentRange(payload.currentSocPercent)) {
    return 'currentSocPercent must be between 0 and 100.'
  }

  if (!inPercentRange(payload.targetSocPercent)) {
    return 'targetSocPercent must be between 0 and 100.'
  }

  if (payload.currentSocPercent >= payload.targetSocPercent) {
    return 'currentSocPercent must be smaller than targetSocPercent.'
  }

  if (
    payload.batteryCapacityKwh !== undefined &&
    (!Number.isFinite(payload.batteryCapacityKwh) || payload.batteryCapacityKwh <= 0)
  ) {
    return 'batteryCapacityKwh must be greater than 0 when provided.'
  }

  return ''
}

export function validateGetStationAmenities(payload: GetStationAmenitiesRequest): string {
  if (!isGuid(payload.stationId)) {
    return 'stationId must be a valid GUID.'
  }

  return ''
}

export function validatePlanRoute(payload: PlanRouteRequest): string {
  if (!Number.isFinite(payload.startLat) || payload.startLat < -90 || payload.startLat > 90) {
    return 'startLat must be a number between -90 and 90.'
  }

  if (!Number.isFinite(payload.startLon) || payload.startLon < -180 || payload.startLon > 180) {
    return 'startLon must be a number between -180 and 180.'
  }

  if (!Number.isFinite(payload.endLat) || payload.endLat < -90 || payload.endLat > 90) {
    return 'endLat must be a number between -90 and 90.'
  }

  if (!Number.isFinite(payload.endLon) || payload.endLon < -180 || payload.endLon > 180) {
    return 'endLon must be a number between -180 and 180.'
  }

  if (!inPercentRange(payload.currentBatteryPercent)) {
    return 'currentBatteryPercent must be between 0 and 100.'
  }

  if (!payload.vehicleCode.trim()) {
    return 'vehicleCode is required.'
  }

  return ''
}
