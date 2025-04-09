<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted
} from 'vue';
import {
  NCard,
  NSpace,
  NInput,
  NButton,
  NIcon,
  NSpin,
  NAlert,
  NList,
  NListItem,
  NThing,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  useMessage,
  NDivider,
  NInputGroup,
  NCode,
  NConfigProvider,
  type GlobalThemeOverrides
} from 'naive-ui'
import {
  LocationOutline as LocationIcon,
  AirplaneOutline as AirplaneIcon
} from '@vicons/ionicons5';
import {
  fetchMetar,
  fetchNearbyStations,
  fetchFlightCategory
} from '../api';
import {
  processMetarData,
  getFlightCategoryTagType
} from '../utils';
import type {
  DecodedMetar,
  FlightCategory,
  CheckWxNearbyStation
} from '../types';

import WxVectorLogo from '../assets/WX Vector Clean.svg'; // Import the logo

// --- Interfaces ---
// Combine CheckWxNearbyStation with our optional flight category
interface NearbyAirportData extends CheckWxNearbyStation {
  flightCategory?: FlightCategory | 'Error' | null;
}

// --- Composables & Refs ---
const message = useMessage();

const icaoInput = ref<string>('')
const isLoadingMetar = ref(false)
const isLoadingLocation = ref(false)
const errorMessage = ref<string | null>(null)
const metarData = ref<DecodedMetar | null>(null)
const nearbyAirports = ref<NearbyAirportData[]>([])
const showNearbyAirports = ref(false)
const isMobile = ref(false)

// Computed property to disable button during loading
const isFetching = computed(() => isLoadingMetar.value || isLoadingLocation.value)

// Computed property to format cloud layers
const formattedClouds = computed(() => {
  if (!metarData.value?.ceilingAndClouds) return '';
  let clouds = metarData.value.ceilingAndClouds
    .replace(/ ft/g, "'") // Replace ' ft' with prime symbol
    .replace(/;/g, '') // Remove semicolons
    .replace(/ AGL/g, '') // Remove trailing AGL
    .replace(/, /g, '<br>'); // Add line breaks
  return clouds;
});

// --- Theme Overrides for Naive UI ---
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#3b82f6',
    primaryColorHover: '#2563eb',
    primaryColorPressed: '#1d4ed8',
    primaryColorSuppl: '#3b82f6' // Crucial for focus rings/shadows
  },
  Button: {
    // --- Primary Button Type (Blue) ---
    colorPrimary: '#3b82f6',          // base background
    colorPrimaryHover: '#2563eb',      // hover background
    colorPrimaryPressed: '#1d4ed8',    // pressed background
    colorPrimaryFocus: '#2563eb',      // focus background (match hover)
    textColorPrimary: '#FFFFFF',      // Text color
    textColorHoverPrimary: '#FFFFFF',
    textColorPressedPrimary: '#FFFFFF',
    textColorFocusPrimary: '#FFFFFF',
    borderPrimary: '1px solid #3b82f6', // Base border
    borderHoverPrimary: '1px solid #2563eb', // Hover border
    borderPressedPrimary: '1px solid #1d4ed8', // Pressed border
    borderFocusPrimary: '1px solid #2563eb', // Focus border - **Explicit Blue**
    rippleColorPrimary: 'rgba(59, 130, 246, 0.3)'
  },
  Input: {
    // --- Input Component ---
    borderHover: '1px solid #60a5fa', // Lighter blue on hover
    borderFocus: '1px solid #3b82f6', // Focus border - **Explicit Blue**
    boxShadowFocus: '0 0 0 2px rgba(59, 130, 246, 0.3)', // Focus shadow - **Explicit Blue**
    caretColor: '#3b82f6' // Caret color
  }
}

// --- Methods ---
const resetState = () => {
  errorMessage.value = null
  metarData.value = null
  nearbyAirports.value = []
  showNearbyAirports.value = false
}

const getMetar = async (icao: string) => {
  if (!icao) return
  resetState()
  isLoadingMetar.value = true
  icaoInput.value = icao

  try {
    const response = await fetchMetar(icao)
    if (response.results > 0) {
      metarData.value = processMetarData(response.data[0])
      if (!metarData.value) {
        throw new Error('Failed to process METAR data.')
      }
    } else {
      throw new Error(`No METAR data found for ${icao.toUpperCase()}.`)
    }
  } catch (error: any) {
    errorMessage.value = error.message || 'An unknown error occurred fetching METAR.'
    if (errorMessage.value) message.error(errorMessage.value)
  } finally {
    isLoadingMetar.value = false
  }
}

const handleGetMetarClick = () => {
  getMetar(icaoInput.value.trim().toUpperCase())
}

const handleAirportSelect = (icao: string) => {
  icaoInput.value = icao;
  getMetar(icao);
  showNearbyAirports.value = false;
}

const getLocationAndFindNearby = async () => {
  isLoadingLocation.value = true
  showNearbyAirports.value = false
  nearbyAirports.value = []
  errorMessage.value = null

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    const stationResponse = await fetchNearbyStations(coords, 50, 'A'); // 50 miles radius, filter for Airports
    const stations: CheckWxNearbyStation[] = stationResponse?.data || []; // Extract data array

    const airportCheckPromises = stations.map(async (station: CheckWxNearbyStation): Promise<NearbyAirportData | null> => {
      try {
        // 1. Check if METAR data exists
        const metarResponse = await fetchMetar(station.icao); // Check for METAR
        if (!metarResponse || metarResponse.results === 0) {
          // console.log(`No METAR data found for ${station.icao}, skipping category fetch.`);
          return null; // Skip stations without METAR
        }

        // 2. Fetch flight category only if METAR exists
        const categoryResponse = await fetchFlightCategory(station.icao);

        // Robust check: Ensure response structure is valid and flight_category exists
        if (typeof categoryResponse !== 'object' || 
            categoryResponse === null || 
            !Array.isArray(categoryResponse.data) || 
            categoryResponse.data.length === 0 || 
            !categoryResponse.data[0].flight_category) {
          // console.warn(`No valid flight category found for ${station.icao}`);
          return null; // Treat as failure, return null
        }

        // 3. If both succeed, extract the category and assert its type
        const category = categoryResponse.data[0].flight_category as FlightCategory;
        return { ...station, flightCategory: category };
      } catch (fetchError) {
        // console.warn(`Error fetching data for ${station.icao}:`, fetchError);
        // Indicate failure for this station
        return null;
      }
    });

    // Wait for all checks to complete
    const settledResults = await Promise.allSettled(airportCheckPromises);

    // Map and filter results
    nearbyAirports.value = settledResults
      .map(result => {
        // Only consider fulfilled promises with non-null values
        if (result.status === 'fulfilled' && result.value !== null) {
          return result.value; // Value is guaranteed to be NearbyAirportData here
        }
        return null; // Return null for rejected promises or those that resolved to null
      })
      .filter((airport): airport is NearbyAirportData => airport !== null) // Filter out all nulls
      .sort((a, b) => a.position.distance.miles - b.position.distance.miles);

    if (nearbyAirports.value.length > 0) {
      showNearbyAirports.value = true;
    } else {
      errorMessage.value = 'No airports found within 50 miles.';
      if (errorMessage.value) message.warning(errorMessage.value)
    }
  } catch (error: any) {
    if (error.code === error.PERMISSION_DENIED) {
      errorMessage.value = 'Geolocation permission denied.';
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      errorMessage.value = 'Location information is unavailable.';
    } else if (error.code === error.TIMEOUT) {
      errorMessage.value = 'Geolocation request timed out.';
    } else {
      errorMessage.value = 'Error finding nearby stations. See console.';
    }
    if (errorMessage.value) message.error(errorMessage.value);
  } finally {
    isLoadingLocation.value = false;
  }
};

watch(icaoInput, (newValue) => {
  if (metarData.value || showNearbyAirports.value) {
    const airportJustSelected = nearbyAirports.value.some(ap => ap.icao === newValue);
    if (!airportJustSelected) {
      resetState();
    }
  }
});

onMounted(() => {
  // Optional: Fetch location on mount?
  const mediaQuery = window.matchMedia('(max-width: 640px)');
  isMobile.value = mediaQuery.matches;
  mediaQuery.onchange = (event) => {
    isMobile.value = event.matches;
  }
})

</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-card
      class="main-metar-card"
      :bordered="false"
      size="large"
      style="max-width: 700px;"
    >
      <template #header>
        <n-space align="center" :wrap-item="false">
          <img :src="WxVectorLogo" alt="WX Vector Logo" class="header-logo" />
          <span class="header-title">WX Vector</span>
        </n-space>
      </template>
      <n-space vertical size="large">
        <n-spin :show="isFetching">
          <n-input-group>
            <n-input
              v-model:value="icaoInput"
              placeholder="e.g., KLAX, EGLL"
              clearable
              :disabled="isFetching"
              @input="icaoInput = $event.toUpperCase()"
              @keyup.enter="handleGetMetarClick"
              :input-props="{ autocapitalize: 'characters' }"
              aria-label="Enter Airport ICAO Code"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
            >
              <template #suffix>
                <n-button
                  text
                  style="font-size: 18px; margin-right: 5px;"
                  :loading="isLoadingLocation"
                  @click="getLocationAndFindNearby"
                  :disabled="isFetching"
                  title="Use My Location"
                  aria-label="Use My Location"
                >
                  <template #icon>
                    <n-icon :component="LocationIcon" />
                  </template>
                </n-button>
              </template>
            </n-input>
            <n-button
              type="primary"
              @click="handleGetMetarClick"
              :loading="isLoadingMetar"
              :disabled="isFetching || !icaoInput.trim()"
            >
              Get METAR
            </n-button>
          </n-input-group>
        </n-spin>

        <n-alert v-if="errorMessage && !isFetching && !metarData && !showNearbyAirports" title="Error" type="error" closable @close="errorMessage = null">
          {{ errorMessage }}
        </n-alert>

        <div v-if="showNearbyAirports && nearbyAirports.length > 0">
          <n-divider title-placement="left">Nearby Airports (Closest {{ nearbyAirports.length }})</n-divider>
          <n-list hoverable clickable bordered>
            <n-list-item v-for="airport in nearbyAirports" :key="airport.icao" style="cursor: pointer;" @click="handleAirportSelect(airport.icao)">
              <template #prefix>
                <n-tag size="small" :bordered="false" :type="getFlightCategoryTagType(airport.flightCategory)"> {{ airport.flightCategory || 'N/A' }} </n-tag>
              </template>
              <n-thing :title="`${airport.name} (${airport.icao})`">
                <template #header>
                  <span style="font-size: 0.9em;">{{ airport.name }} ({{ airport.icao }})</span>
                </template>
                <template #description>
                  <span style="font-size: 0.9em;">
                    {{ airport.position.distance.miles.toFixed(1) }} miles away - {{ airport.city }}, {{ airport.state?.name || airport.country.code }}
                  </span>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </div>
        <div v-else-if="showNearbyAirports && nearbyAirports.length === 0 && !isLoadingLocation">
          <n-alert type="info" title="No Nearby Airports Found" :bordered="false">
            Could not find any airports within 50 miles of your location.
          </n-alert>
        </div>

        <div v-else-if="metarData && !isFetching">
          <!-- Use a <p> tag for the header instead of n-divider -->
          <p style="display: flex; align-items: center; font-size: 1.44em; gap: 6px; margin-bottom: 10px; font-weight: 500; color: #21367c;">
            <n-icon :component="AirplaneIcon" size="26" />
            <span>{{ metarData.airportName || 'Unknown Station' }} ({{ metarData.icao }})</span>
          </p>

          <!-- Flight Category and Report Age Tags -->
          <div style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
            <n-tag v-if="metarData.flightCategory" :type="metarData.flightCategory === 'VFR' ? 'success' :
                               metarData.flightCategory === 'MVFR' ? 'info' :
                               metarData.flightCategory === 'IFR' ? 'warning' :
                               metarData.flightCategory === 'LIFR' ? 'error' : 'default'" size="small">
              {{ metarData.flightCategory }}
            </n-tag>
            <n-tag v-if="metarData.reportAgeMinutes !== undefined" type="default" size="small" :bordered="false">
              Reported {{ metarData.reportAgeMinutes }} mins ago
            </n-tag>
          </div>

          <n-divider style="margin-top: 5px; margin-bottom: 10px;" />

          <div>
            <n-card
              v-if="metarData.rawText"
              size="small"
              embedded
              class="raw-metar-card"
            >
              <n-code
                :hljs="undefined"
                :code="metarData.rawText"
                word-wrap
              ></n-code>
            </n-card>
          </div>

          <template v-if="!isMobile">
            <n-descriptions
              v-if="metarData"
              label-placement="left"
              bordered
              :column="1"
              size="medium"
              class="metar-details-grid"
            >
              <n-descriptions-item label="Time">
                {{ metarData.observedTime }}
              </n-descriptions-item>
              <n-descriptions-item label="Wind">
                {{ metarData.wind }}
              </n-descriptions-item>
              <n-descriptions-item label="Visibility">
                {{ metarData.visibility }}
              </n-descriptions-item>
              <n-descriptions-item label="Clouds (AGL)">
                <span v-html="formattedClouds"></span>
              </n-descriptions-item>
              <n-descriptions-item label="Temperature">
                {{ metarData.temperature }}
              </n-descriptions-item>
              <n-descriptions-item label="Dewpoint">
                {{ metarData.dewpoint }}
              </n-descriptions-item>
              <n-descriptions-item label="Altimeter">
                {{ metarData.altimeter }}
              </n-descriptions-item>
              <n-descriptions-item label="Humidity">
                {{ metarData.humidity }}
              </n-descriptions-item>
              <n-descriptions-item label="Density Altitude">
                {{ metarData.densityAltitude }}
              </n-descriptions-item>
            </n-descriptions>
          </template>
          <template v-else>
            <div v-if="metarData" class="mobile-metar-details">
              <div><strong>Time:</strong> <span>{{ metarData.observedTime }}</span></div>
              <div><strong>Wind:</strong> <span>{{ metarData.wind }}</span></div>
              <div><strong>Visibility:</strong> <span>{{ metarData.visibility }}</span></div>
              <div><strong>Clouds (AGL)</strong> <span v-html="formattedClouds"></span></div>
              <div><strong>Temperature:</strong> <span>{{ metarData.temperature }}</span></div>
              <div><strong>Dewpoint:</strong> <span>{{ metarData.dewpoint }}</span></div>
              <div><strong>Altimeter:</strong> <span>{{ metarData.altimeter }}</span></div>
              <div><strong>Humidity:</strong> <span>{{ metarData.humidity }}</span></div>
              <div><strong>Density Altitude:</strong> <span>{{ metarData.densityAltitude }}</span></div>
            </div>
          </template>
        </div>
      </n-space>
    </n-card>
  </n-config-provider>
</template>

<style scoped>
.n-card {
  border-radius: 8px;
}

.n-list-item {
  cursor: pointer;
}

.n-list-item .n-thing-header {
  margin-bottom: 2px;
}

.n-list-item:hover {
  background-color: #f8f8f8;
}

ul {
  list-style-type: disc;
  padding-left: 20px;
  margin-top: 5px;
}
li {
  margin-bottom: 3px;
}

/* Nearby Stations List */
.nearby-stations-list {
  margin-top: 20px;
}

.metar-details-grid :deep(.n-descriptions-table-row .n-descriptions-item-content) {
  padding-bottom: 4px;
}

.nearby-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.raw-metar-card {
  margin-top: 10px; /* Ensure space above raw METAR */
  margin-bottom: 15px; /* Add space below raw METAR before the table */
}

.input-group {
  margin-bottom: 15px;
}

.header-logo {
  height: 60px; /* Adjust size as needed (32 * 2.5) */
  vertical-align: middle;
}

.header-title {
  font-size: 2.1em; /* Adjust size as needed */
  font-weight: bold;
  color: #21367c; /* Updated blue */
  vertical-align: middle;
}

.metar-details {
  margin-top: 15px;
}

.nearby-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap; /* Allow wrapping */
  gap: 8px; /* Space between items when wrapped */
}

.nearby-details {
  flex-grow: 1;
  min-width: 200px; /* Prevent details from becoming too narrow */
}

.nearby-action {
  margin-left: auto; /* Push button to the right */
}

.main-metar-card {
  margin: 20px auto; /* Center on desktop */
}

@media (max-width: 640px) {
  .main-metar-card {
    margin: 20px 10px; /* Apply mobile margins */
  }

  /* Styling for the simple mobile list */
  .mobile-metar-details div {
    padding: 8px 0; /* Add vertical padding */
    display: flex; /* Arrange label and value inline */
    justify-content: space-between; /* Push value to the right */
    align-items: baseline; /* Align text nicely */
    line-height: 1.4;
  }

  .mobile-metar-details div:not(:last-child) {
    border-bottom: 1px solid #eee; /* Light grey separator */
  }

  .mobile-metar-details strong {
    margin-right: 8px; /* Space between label and value */
    flex-shrink: 0; /* Prevent label from shrinking */
  }

  .mobile-metar-details span {
    text-align: right; /* Align value text to the right */
  }

  /* Ensure multi-line clouds render correctly in mobile view */
  .mobile-metar-details div span {
    line-height: 1.2; /* Adjust line height for multi-line content */
  }
}
</style>
