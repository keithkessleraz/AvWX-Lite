// Based on CheckWX API Documentation (v1 - adjust if using a different version)

export interface CheckWxMetarResponse {
  results: number;
  data: CheckWxMetar[];
}

export interface CheckWxMetar {
  icao: string;
  observed: string; // ISO 8601 timestamp
  raw_text: string;
  station: CheckWxStationInfo;
  conditions?: CheckWxCondition[];
  wind?: CheckWxWind;
  visibility?: CheckWxVisibility;
  ceiling?: CheckWxCeiling;
  clouds?: CheckWxCloud[];
  temperature?: CheckWxTemperature;
  dewpoint?: CheckWxTemperature;
  humidity?: CheckWxHumidity;
  barometer?: CheckWxBarometer;
  flight_category?: string; // VFR, MVFR, IFR, LIFR
  remarks?: string; // Raw remarks string
  elevation?: {
    feet: number;
    meters: number;
  };
  // Add other fields as needed from the API response
}

export interface CheckWxStationInfo {
  name: string;
  geometry: { coordinates: [number, number]; type: string }; // [longitude, latitude]
  // Other station details if available
}

export interface CheckWxCondition {
  code: string;
  text: string;
}

export interface CheckWxWind {
  degrees: number;
  speed_kts: number;
  speed_mps?: number;
  speed_mph?: number;
  gust_kts?: number;
  // variable direction fields if present
}

export interface CheckWxVisibility {
  miles: string; // Can be a fraction like "1/4"
  miles_float: number;
  meters?: string;
  meters_float?: number;
}

export interface CheckWxCloud {
  code: string; // e.g., SCT, BKN, OVC, FEW
  text: string; // e.g., Scattered, Broken, Overcast, Few
  base_feet_agl?: number;
  base_meters_agl?: number;
}

export interface CheckWxCeiling extends CheckWxCloud {}

export interface CheckWxTemperature {
  celsius: number;
  fahrenheit: number;
}

export interface CheckWxHumidity {
  percent: number;
}

export interface CheckWxBarometer {
  hg: number; // Inches of Mercury
  hpa: number; // Hectopascals (QNH)
  kpa?: number;
  mb?: number;
}

// --- Station Lookup Response ---
export interface CheckWxStationResponse {
  results: number;
  data: CheckWxNearbyStation[];
}

export interface CheckWxNearbyStation {
  icao: string;
  name: string;
  city: string;
  state?: {
    code: string;
    name: string;
  };
  country: {
    code: string;
    name: string;
  };
  elevation: {
    feet: number;
    meters: number;
  };
  geometry: {
    coordinates: [number, number]; // [longitude, latitude]
    type: string;
  };
  position: {
    distance: {
      miles: number;
      meters: number;
    };
    // Include other position fields if needed later
  };
  type: string; // Type of station (e.g., "Airport", "Heliport")
  // Add other fields if needed
}

// --- Flight Category API Response ---
export interface CheckWxFlightCategory {
  icao: string;
  flight_category: string | null;
}

export interface CheckWxFlightCategoryResponse {
  results: number;
  data: CheckWxFlightCategory[];
}

// --- Internal Decoded Data Structure ---
export interface DecodedMetar {
  airportName: string;
  rawText: string; // Add the raw METAR string
  icao: string;
  observedTime: string; // Formatted string
  reportAgeMinutes: number;
  flightCategory: string;
  rawMetar: string;
  wind: string;
  visibility: string;
  ceilingAndClouds: string;
  temperature: string;
  dewpoint: string;
  altimeter: string;
  humidity: string;
  densityAltitude: string;
  weather?: string; // Added field for weather phenomena
}

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'Unknown';

// Type for Geolocation coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TagStyle { // Define and export TagStyle
  type: 'success' | 'info' | 'warning' | 'error' | 'default';
  style?: Record<string, string>;
}
