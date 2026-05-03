# EV API Key Playground

Frontend playground for third-party member integration testing against EV backend APIs.

Main features:
- Input Base URL and API key once, then test all member APIs.
- 3 API tabs: CalculateRange, EstimateChargingCost, GetStationAmenities.
- cURL preview, response status/headers/body, response time, copy JSON.
- Error grouping for 401, 403, 404, 429, 500 and quota hint for 429.
- Optional Authorization Bearer token header (off by default).
- Built-in Server Relay Simulator mode for stable quota testing.
- Light/Dark theme toggle and responsive UI.

## 1. Run Local

1. Install dependencies:

```bash
npm install
```

2. Create env file from sample:

```bash
copy .env.example .env
```

3. Start frontend + simulator relay together (recommended):

```bash
npm run dev:full
```

Alternative: run frontend only:

```bash
npm run dev
```

4. Open shown local URL (usually http://localhost:5173).

## 2. Configure Base URL

Set default backend endpoint in .env:

```env
VITE_API_BASE_URL=https://your-ev-backend-domain.com
VITE_SIMULATOR_URL=http://localhost:8787
```

You can override it directly from the Base URL field in UI and click Save.
For quota-accurate simulation, keep relay mode enabled and ensure Simulator URL points to your local relay service.

## 3. Input API Key

1. Enter API key in API key field.
2. Click Save.
3. Optional: enable Add Authorization Bearer token checkbox and input token.

All requests always include x-api-key.

## 4. Test 3 APIs

### CalculateRange
- Method: POST
- Path: /api/RangeCalculation/calculate
- Required body: currentLat, currentLon, currentBatteryPercent, vehicleCode

### EstimateChargingCost
- Method: POST
- Path: /api/ChargingCalculation/estimate
- Required body: stationId, currentSocPercent, targetSocPercent
- Optional body: connectorTypeId, vehicleCode, batteryCapacityKwh
- Validation: currentSocPercent must be smaller than targetSocPercent

### GetStationAmenities
- Method: GET
- Path: /api/Amenities/station/{stationId}

For each tab:
1. Keep sample payload or edit fields.
2. Review cURL preview.
3. Click Execute.
4. Check status, headers, body JSON, and response time.

## Relay Simulator Architecture

When Relay mode is ON:
1. Frontend sends request to local simulator service.
2. Simulator calls target EV backend server-to-server.
3. UI displays upstream response and resolved request URL.

This avoids browser-origin rewrite/CORS side effects and is more reliable for quota decrement verification.

## cURL Examples

### 1) CalculateRange

```bash
curl -X POST "https://your-ev-backend-domain.com/api/RangeCalculation/calculate" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "currentLat": 10.8231,
    "currentLon": 106.6297,
    "currentBatteryPercent": 72,
    "vehicleCode": "VF8_PLUS"
  }'
```

### 2) EstimateChargingCost

```bash
curl -X POST "https://your-ev-backend-domain.com/api/ChargingCalculation/estimate" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "0f8fad5b-d9cb-469f-a165-70867728950e",
    "connectorTypeId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "vehicleCode": "VF8_PLUS",
    "batteryCapacityKwh": 82,
    "currentSocPercent": 25,
    "targetSocPercent": 80
  }'
```

### 3) GetStationAmenities

```bash
curl -X GET "https://your-ev-backend-domain.com/api/Amenities/station/0f8fad5b-d9cb-469f-a165-70867728950e" \
  -H "x-api-key: YOUR_API_KEY"
```
