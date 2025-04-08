import type {
  CheckWxMetarResponse,
  CheckWxStationResponse,
  CheckWxFlightCategoryResponse,
  Coordinates
} from './types'

const BASE_URL = 'https://api.checkwx.com'
const API_KEY = import.meta.env.VITE_CHECKWX_API_KEY

async function fetchCheckWx<T>(endpoint: string): Promise<T> {
  if (!API_KEY || API_KEY === 'YOUR_CHECKWX_API_KEY_HERE') {
    throw new Error(
      'CheckWX API Key is missing. Please set VITE_CHECKWX_API_KEY in your .env file.'
    )
  }

  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'X-API-Key': API_KEY,
    Accept: 'application/json'
  }

  try {
    const response = await fetch(url, { headers })

    if (!response.ok) {
      let errorData: any = { message: `HTTP error! status: ${response.status}` }
      try {
        // Try to parse error details from CheckWX if available
        errorData = await response.json()
      } catch (e) {
        // Ignore if error response is not JSON
      }
      throw new Error(
        `API Error: ${errorData?.error || response.statusText || errorData.message}`
      )
    }

    const data: T = await response.json()
    // CheckWX specific check for no results
    if ('results' in data && data.results === 0) {
      // Distinguish between no METAR and no Station
      if (endpoint.includes('/metar/')) {
        throw new Error('No METAR data found for this station.')
      } else if (endpoint.includes('/station/')) {
        throw new Error('No stations found for the given coordinates.')
      }
    }
    return data
  } catch (error) {
    console.error('Fetch CheckWX Error:', error)
    if (error instanceof Error) {
      throw error // Re-throw known errors
    } else {
      throw new Error('An unknown network error occurred.') // Wrap unknown errors
    }
  }
}

/**
 * Fetches the latest METAR report for a given ICAO code.
 * @param icao - The ICAO airport identifier.
 * @returns Promise resolving to the CheckWxMetarResponse.
 */
export function fetchMetar(icao: string): Promise<CheckWxMetarResponse> {
  if (!icao || icao.length < 3 || icao.length > 4) {
    return Promise.reject(new Error('Invalid ICAO code format.'))
  }
  const endpoint = `/metar/${icao.toUpperCase()}/decoded`
  return fetchCheckWx<CheckWxMetarResponse>(endpoint)
}

/**
 * Fetches nearby stations based on latitude and longitude.
 * @param coords - The coordinates (latitude, longitude).
 * @param radius - The search radius in miles.
 * @param filter - Optional filter parameter ('A', 'H', 'G', 'S', 'W', 'O').
 * @returns Promise resolving to the CheckWxStationResponse.
 */
export function fetchNearbyStations(
  coords: Coordinates,
  radius: number = 50, // Default radius
  filter?: 'A' | 'H' | 'G' | 'S' | 'W' | 'O' // Optional filter parameter
): Promise<CheckWxStationResponse> {
  const { latitude, longitude } = coords
  let endpoint = `/station/lat/${latitude}/lon/${longitude}/radius/${radius}`
  if (filter) {
    endpoint += `?filter=${filter}`
  }
  return fetchCheckWx<CheckWxStationResponse>(endpoint)
}

// Function to fetch flight category for a single ICAO from CheckWX API
export function fetchFlightCategory(icao: string): Promise<CheckWxFlightCategoryResponse> {
  const endpoint = `/metar/${icao}/flight/category`;
  return fetchCheckWx<CheckWxFlightCategoryResponse>(endpoint);
}
