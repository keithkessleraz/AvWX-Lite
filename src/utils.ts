import type {
  CheckWxMetar,
  CheckWxBarometer,
  DecodedMetar,
  DecodedRemarks,
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
        layerStr += ` at ${layer.base_feet_agl} ft AGL`
      }
      reportedLayers.push(layerStr)
    })
  }

  if (ceiling && ceiling.base_feet_agl) {
    // Check if ceiling layer is already in clouds list to avoid duplication
    const ceilingDesc = `${ceiling.text} at ${ceiling.base_feet_agl} ft AGL (Ceiling)`
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
    cloudsStr = `${ceiling.text} at ${ceiling.base_feet_agl} ft AGL (Ceiling)`
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

/**
 * Basic METAR remarks decoder.
 * This is a simplified version and might not cover all possible remarks.
 * @param remarksString Raw remarks string from METAR.
 * @returns DecodedRemarks object.
 */
function decodeRemarks(remarksString: string | undefined): DecodedRemarks {
  const decoded: { [key: string]: string } = {}
  const plainLanguage = remarksString || 'No Remarks'

  if (!remarksString) {
    return { plainLanguage, decoded }
  }

  const parts = remarksString.split(' ')

  for (const part of parts) {
    if (part === 'AO1') {
      decoded.AutomatedObservationType = 'Automated station without precipitation discriminator'
    } else if (part === 'AO2') {
      decoded.AutomatedObservationType = 'Automated station with precipitation discriminator'
    } else if (part.startsWith('SLP')) {
      // Sea Level Pressure (e.g., SLP123 -> 1012.3 hPa)
      const slpDigits = part.substring(3)
      if (/^\d+$/.test(slpDigits)) {
        const pressureValue = parseInt(slpDigits, 10)
        const hpa = pressureValue / 10 + (pressureValue < 500 ? 1000 : 900)
        decoded.SeaLevelPressure = `${hpa.toFixed(1)} hPa`
      } else {
        decoded.SeaLevelPressure = `Unknown format (${part})`
      }
    } else if (part.startsWith('T') && part.length === 9) {
      // Precise Temperature/Dewpoint (e.g., T01280067)
      // T[sign][temp C * 10][sign][dew C * 10]
      const tempSign = part[1] === '1' ? '-' : ''
      const tempVal = parseInt(part.substring(2, 5), 10) / 10
      const dewSign = part[5] === '1' ? '-' : ''
      const dewVal = parseInt(part.substring(6, 9), 10) / 10
      decoded.PreciseTempDewpoint = `Temp: ${tempSign}${tempVal.toFixed(1)}°C, Dewpoint: ${dewSign}${dewVal.toFixed(1)}°C`
    } else if (part.match(/^PK WND (\d{3})(\d{2,3})\/(\d{2})(\d{2})$/)) {
      // Peak Wind (e.g., PK WND 28045/1515)
      const match = part.match(/^PK WND (\d{3})(\d{2,3})\/(\d{2})(\d{2})$/)
      if (match) {
        decoded.PeakWind = `Peak wind ${match[1]}° at ${match[2]} knots occurred at ${match[3]}${match[4]} Zulu`
      }
    } else if (part.match(/^VIS (\d+\/?\d*V\d+\/?\d*)$/)) {
      // Variable Visibility (e.g., VIS 1/2V2)
       const match = part.match(/^VIS (\d+\/?\d*V\d+\/?\d*)$/)
       if (match) {
         decoded.VariableVisibility = `Visibility variable between ${match[1].replace('V', ' and ')} statute miles`
       }
    }
    // Add more common remark decoders here...
    // e.g., PRESRR/PRESFR (Pressure Rising/Falling Rapidly)
    // e.g., TSNO (Thunderstorm information not available)
    // e.g., Pxxxx (Hourly precipitation amount)
    // e.g., 6xxxx (3/6 hour precipitation amount)
    // e.g., RVRNO (Runway Visual Range not available)
    // e.g., WSHFT (Wind Shift)
  }

  return { plainLanguage, decoded }
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

  return {
    airportName: metar.station?.name || 'Unknown Station',
    icao: metar.icao,
    observedTime: formatObservedTime(metar.observed),
    reportAgeMinutes: calculateReportAge(metar.observed),
    flightCategory: metar.flight_category || flightCategory, // Prefer API's category if available
    rawMetar: metar.raw_text,
    wind: formatWind(metar.wind),
    visibility: formatVisibility(metar.visibility),
    ceilingAndClouds: formatCeilingAndClouds(metar.ceiling, metar.clouds),
    temperature: formatTempDew(metar.temperature),
    dewpoint: formatTempDew(metar.dewpoint),
    altimeter: formatAltimeter(metar.barometer),
    remarks: decodeRemarks(metar.remarks)
  }
}

/**
 * Gets the color type for the Naive UI tag based on flight category.
 */
export function getFlightCategoryTagType(category: FlightCategory | string | null | undefined): 'success' | 'warning' | 'error' | 'info' {
  switch (category?.toUpperCase()) {
    case 'VFR':
      return 'success'
    case 'MVFR':
      return 'warning' // Or maybe 'info' depending on preference
    case 'IFR':
      return 'error'
    case 'LIFR':
      return 'error' // Often styled distinctly, but 'error' works
    default:
      return 'info'
  }
}
