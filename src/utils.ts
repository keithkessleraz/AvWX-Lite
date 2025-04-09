import type {
  CheckWxMetar,
  CheckWxBarometer,
  DecodedMetar,
  FlightCategory
} from './types'

/**
 * Calculates the age of the report in minutes.
 * @param observedTimeString ISO 8601 timestamp string.
 * @returns Age in minutes.
 */
function calculateReportAge(observedTimeString: string): number {
  // Ensure UTC interpretation (redundant if formatObservedTime already fixed, but safe)
  const utcString = observedTimeString.endsWith('Z')
    ? observedTimeString
    : observedTimeString + 'Z';
  const observedTime = new Date(utcString);
  const now = new Date()

  if (isNaN(observedTime.getTime())) {
    // console.error('Invalid date in calculateReportAge:', utcString); // Keep commented out for now
    return 0; // Return 0 for invalid dates
  }

  const diffMs = now.getTime() - observedTime.getTime()
  const ageMinutes = Math.round(diffMs / (1000 * 60))

  // Prevent negative age (temporary safeguard)
  return Math.max(0, ageMinutes);
}

/**
 * Formats the observed time string.
 * @param observedTimeString ISO 8601 timestamp string.
 * @returns Formatted date/time string.
 */
function formatObservedTime(observedTimeString: string): string {
  // Ensure the input string is treated as UTC
  const utcString = observedTimeString.endsWith('Z')
    ? observedTimeString
    : observedTimeString + 'Z'

  const date = new Date(utcString)

  // Check if the date is valid after parsing
  if (isNaN(date.getTime())) {
      console.error('Invalid date string provided:', observedTimeString);
      return 'Invalid Date';
  }

  // Get local hours/minutes using the Date object's conversion based on OS timezone
  const localHours = date.getHours() // Gets hour in local time (0-23)
  const localMinutes = date.getMinutes() // Gets minutes in local time (0-59)

  // Format local time manually to h:mm AM/PM
  const hours12 = localHours % 12 === 0 ? 12 : localHours % 12 // Convert 0/12 to 12 for AM/PM
  const ampm = localHours >= 12 ? 'PM' : 'AM'
  const formattedLocalMinutes = localMinutes.toString().padStart(2, '0')
  const localTimeString = `${hours12}:${formattedLocalMinutes} ${ampm}`

  // Get original UTC time string (e.g., "22:54")
  const utcHours = date.getUTCHours().toString().padStart(2, '0')
  const utcMinutes = date.getUTCMinutes().toString().padStart(2, '0')
  const utcTimeString = `${utcHours}:${utcMinutes}Z`

  // Combine them for clarity
  return `${localTimeString} (Local) / ${utcTimeString}` // Example: 3:54 PM (Local) / 22:54Z
}

/**
 * Formats wind information.
 * @param wind Wind data object.
 * @returns Formatted wind string.
 */
function formatWind(wind: CheckWxMetar['wind']): string {
  if (!wind) return 'Variable, Calm'
  let windStr = `${wind.degrees}° at ${wind.speed_kts} knots`
  if (wind.gust_kts) {
    windStr += `, gusting to ${wind.gust_kts} knots`
  }
  // Add handling for variable winds if API provides it (e.g., VRB)
  if (wind.degrees === 0 && wind.speed_kts === 0) {
    return 'Calm'
  } else if (wind.degrees === 0) {
    // Check API docs for how variable direction is represented if speed > 0
    windStr = `Variable at ${wind.speed_kts} knots${wind.gust_kts ? `, gusting to ${wind.gust_kts} knots` : ''}`
  }
  return windStr
}

/**
 * Formats visibility information.
 * @param visibility Visibility data object.
 * @returns Formatted visibility string.
 */
function formatVisibility(visibility: CheckWxMetar['visibility']): string {
  if (!visibility) return 'Not Reported'
  // Prefer float for clarity, fallback to string representation
  const miles = visibility.miles_float ?? parseFloat(visibility.miles)
  if (isNaN(miles)) return 'Not Reported'

  let visStr = `${visibility.miles} statute mile(s)`
  if (miles >= 10) {
    visStr = '10+ statute miles (Clear)'
  }
  if (visibility.meters_float) {
    visStr += ` (${visibility.meters_float} meters)`
  }
  return visStr
}

/**
 * Formats ceiling and cloud layers.
 * @param ceiling Ceiling data object.
 * @param clouds Array of cloud layers.
 * @returns Formatted ceiling/clouds string.
 */
function formatCeilingAndClouds(
  ceiling: CheckWxMetar['ceiling'],
  clouds: CheckWxMetar['clouds']
): string {
  let cloudsStr = 'Clear below 12,000 ft' // Default or check API for SKC/CLR
  const reportedLayers: string[] = []

  if (clouds && clouds.length > 0) {
    clouds.forEach((layer) => {
      let layerStr = layer.text // e.g., "Scattered"
      if (layer.base_feet_agl) {
        layerStr += ` at ${formatAltitude(layer.base_feet_agl)} AGL`
      }
      reportedLayers.push(layerStr)
    })
  }

  if (ceiling && ceiling.base_feet_agl) {
    // Check if ceiling layer is already in clouds list to avoid duplication
    const ceilingDesc = `${ceiling.text} at ${formatAltitude(ceiling.base_feet_agl)} AGL (Ceiling)`
    if (
      !reportedLayers.some((l) =>
        l.includes(`${ceiling.base_feet_agl} ft AGL`)
      )
    ) {
      reportedLayers.push(ceilingDesc)
    } else {
      // Mark existing layer as ceiling
      const index = reportedLayers.findIndex((l) =>
        l.includes(`${ceiling.base_feet_agl} ft AGL`)
      )
      if (index !== -1) {
        reportedLayers[index] += ' (Ceiling)'
      }
    }
  }

  if (reportedLayers.length > 0) {
    cloudsStr = reportedLayers.join('; ')
  } else if (ceiling) {
    // Handle cases where only ceiling is reported, though unusual
    cloudsStr = `${ceiling.text} at ${formatAltitude(ceiling.base_feet_agl)} AGL (Ceiling)`
  }

  // CheckWX might also return specific codes like NSC (No Significant Cloud) or CAVOK
  // You might need to handle those explicitly based on API response

  return cloudsStr
}

/**
 * Formats temperature/dewpoint.
 * @param temp Temperature data object.
 * @returns Formatted temperature string.
 */
function formatTempDew(
  temp: CheckWxMetar['temperature']
): string {
  if (!temp) return 'N/A'
  return `${temp.celsius}°C (${temp.fahrenheit}°F)`
}

/**
 * Formats altimeter/barometer reading.
 * @param barometer Barometer data object.
 * @returns Formatted altimeter string.
 */
function formatAltimeter(barometer: CheckWxBarometer | undefined): string {
  if (!barometer) return 'N/A'
  // Prefer inHg for US context, fallback to hPa
  if (barometer.hg) {
    return `${barometer.hg.toFixed(2)} inHg (${barometer.hpa} hPa)`
  }
  return `${barometer.hpa} hPa`
}

/**
 * Determines Flight Category based on visibility and ceiling.
 * Follows standard US definitions.
 * @param visibility Visibility object.
 * @param ceiling Ceiling object.
 * @returns FlightCategory string.
 */
function determineFlightCategory(
  visibility: CheckWxMetar['visibility'],
  ceiling: CheckWxMetar['ceiling']
): FlightCategory {
  const visMiles = visibility?.miles_float ?? 99
  const ceilFeet = ceiling?.base_feet_agl ?? 99999

  if (visMiles >= 5 && ceilFeet >= 3000) {
    return 'VFR'
  } else if (visMiles >= 3 && ceilFeet >= 1000) {
    return 'MVFR' // Marginal VFR
  } else if (visMiles >= 1 && ceilFeet >= 500) {
    return 'IFR'
  } else if (visMiles < 1 || ceilFeet < 500) {
    return 'LIFR' // Low IFR
  }
  return 'Unknown' // Should not happen with valid data
}

// Helper to format Humidity
function formatHumidity(percent: number | undefined): string {
  if (percent === undefined || percent === null) {
    return 'N/A';
  }
  return `${percent.toFixed(0)}%`;
}

// Helper to calculate Density Altitude
function calculateDensityAltitude(elevationFt: number | undefined, tempC: number | undefined, altimeterHg: number | undefined): string {
  // Ensure all inputs are valid numbers before proceeding
  if (elevationFt === undefined || tempC === undefined || altimeterHg === undefined ||
      isNaN(elevationFt) || isNaN(tempC) || isNaN(altimeterHg)) {
    return 'N/A'; // Need all inputs
  }

  // Assign to constants after check to satisfy TS
  const elev = elevationFt;
  const temp = tempC;
  const altHg = altimeterHg;

  // Pressure Altitude Calculation (approximation)
  const standardPressureHg = 29.92;
  const pressureAltitude = elev + (standardPressureHg - altHg) * 1000;

  // ISA Temperature Calculation (at pressure altitude)
  const isaTempC = 15 - (1.98 * (pressureAltitude / 1000)); // ~2C drop per 1000ft

  // Density Altitude Calculation
  const densityAltitude = pressureAltitude + (120 * (temp - isaTempC));

  return formatAltitude(Math.round(densityAltitude)); // Use helper and round
}

// Helper to format altitude numbers with commas and foot symbol
function formatAltitude(feet: number | null | undefined): string {
  if (typeof feet !== 'number' || isNaN(feet)) {
    return 'N/A';
  }
  return `${feet.toLocaleString('en-US')}'`;
}

/**
 * Processes the raw CheckWX METAR data into a display-friendly format.
 * @param metar Raw CheckWxMetar object.
 * @returns DecodedMetar object or null if input is invalid.
 */
export function processMetarData(
  metar: CheckWxMetar | null | undefined
): DecodedMetar | null {
  if (!metar) {
    return null
  }

  const flightCategory = determineFlightCategory(
    metar.visibility,
    metar.ceiling
  )

  const observedTime = formatObservedTime(metar.observed);
  const reportAgeMinutes = calculateReportAge(metar.observed);

  // Format Humidity
  const humidity = formatHumidity(metar.humidity?.percent);

  // Calculate Density Altitude
  const densityAltitude = calculateDensityAltitude(
    metar.elevation?.feet, // Use elevation from root METAR object
    metar.temperature?.celsius,
    metar.barometer?.hg
  );

  return {
    airportName: metar.station?.name || metar.icao,
    rawText: metar.raw_text || 'N/A',
    icao: metar.icao,
    observedTime: observedTime,
    reportAgeMinutes: reportAgeMinutes,
    flightCategory: metar.flight_category || flightCategory, // Prefer API's category if available
    wind: formatWind(metar.wind),
    visibility: formatVisibility(metar.visibility),
    ceilingAndClouds: formatCeilingAndClouds(metar.ceiling, metar.clouds),
    temperature: formatTempDew(metar.temperature),
    dewpoint: formatTempDew(metar.dewpoint),
    altimeter: formatAltimeter(metar.barometer),
    humidity: humidity,        // Added
    densityAltitude: densityAltitude, // Added
    rawMetar: metar.raw_text || 'Raw text not available'
  }
}

/**
 * Gets the Naive UI tag type corresponding to a flight category.
 * @param category The flight category string.
 * @returns Naive UI tag type ('success', 'info', 'warning', 'error', 'default').
 */
export function getFlightCategoryTagType(
  category: FlightCategory | string | null | undefined
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  if (!category) return 'default';

  switch (category.toUpperCase()) {
    case 'VFR':
      return 'success';
    case 'MVFR':
      return 'info';
    case 'IFR':
      return 'warning';
    case 'LIFR':
      return 'error';
    case 'UNKNOWN':
    default:
      return 'default';
  }
}

// Add any other utility functions below
