import type {
  CheckWxMetarResponse,
  CheckWxStationResponse,
  CheckWxFlightCategoryResponse,
  Coordinates
} from './types'

// Define the proxy base URL
const PROXY_BASE_URL = '/.netlify/functions/checkwx-proxy';

// Function to fetch data via the Netlify proxy
async function fetchViaProxy<T extends object>(checkWxEndpoint: string): Promise<T> {
  // Construct the proxy URL, encoding the target CheckWX endpoint
  const proxyUrl = `${PROXY_BASE_URL}?endpoint=${encodeURIComponent(checkWxEndpoint)}`;
  console.log(`Fetching via Proxy: ${proxyUrl} (targeting ${checkWxEndpoint})`); // Log proxy URL and target

  try {
    const response = await fetch(proxyUrl); // Make the request to the proxy function

    if (!response.ok) {
      // Attempt to get error details from the proxy response
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // Ignore if response body isn't JSON
      }
      const errorMessage = errorData?.error || `Proxy request failed with status: ${response.status} ${response.statusText}`;
      console.error('Proxy fetch error:', errorMessage, 'Status:', response.status);
      throw new Error(errorMessage);
    }

    const data: T = await response.json(); // Parse the JSON response from the proxy

    // Check for CheckWX API specific errors like { results: 0 }
    // CheckWX often returns data: [] for no results, but let's keep a check for the results property if it exists
    if (typeof data === 'object' && data !== null && 'results' in data && (data as any).results === 0) {
        console.warn(`CheckWX API returned 0 results via proxy for endpoint: ${checkWxEndpoint}`);
        // Depending on expected behavior, you might return data or throw an error
        // throw new Error(`No results found via proxy for: ${checkWxEndpoint}`);
    }

    return data; // Return the data from the CheckWX API (passed through the proxy)
  } catch (error) {
    console.error(`Error fetching via proxy for endpoint ${checkWxEndpoint}:`, error);
    // Re-throw the error to be caught by the calling function
    throw error;
  }
}

/**
 * Fetches the latest METAR report for a given ICAO code.
 * @param icao - The ICAO airport identifier.
 * @returns Promise resolving to the CheckWxMetarResponse.
 */
export async function fetchMetar(icao: string): Promise<CheckWxMetarResponse> {
  if (!icao || icao.length < 3 || icao.length > 4) {
    return Promise.reject(new Error('Invalid ICAO code format.'))
  }
  const endpoint = `/metar/${icao.toUpperCase()}/decoded`
  return fetchViaProxy<CheckWxMetarResponse>(endpoint)
}

/**
 * Fetches nearby stations based on coordinates via proxy
 * @param coords - The coordinates (latitude, longitude).
 * @param radius - The search radius in miles.
 * @param filter - Optional filter parameter ('A', 'H', 'G', 'S', 'W', 'O').
 * @returns Promise resolving to the CheckWxStationResponse.
 */
export async function fetchNearbyStations(
  coords: Coordinates,
  radius: number = 50, // Default radius
  filter: 'A' | 'H' | 'G' | 'S' | 'W' | 'O' = 'A' // Default filter 'A'
): Promise<CheckWxStationResponse> {
  // Correct CheckWX endpoint structure
  let endpoint = `/station/lat/${coords.latitude}/lon/${coords.longitude}/radius/${radius}`;
  if (filter) {
    endpoint += `?filter=${filter}`;
  }
  return fetchViaProxy<CheckWxStationResponse>(endpoint);
}

// Function to fetch flight category for a single ICAO via proxy
export async function fetchFlightCategory(icao: string): Promise<CheckWxFlightCategoryResponse> { // Use specific response type
   if (!icao || icao.length < 3 || icao.length > 4) {
    return Promise.reject(new Error('Invalid ICAO code format.'))
  }
  // Correct CheckWX endpoint structure
  const endpoint = `/metar/${icao}/flight/category`;
  return fetchViaProxy<CheckWxFlightCategoryResponse>(endpoint);
}
