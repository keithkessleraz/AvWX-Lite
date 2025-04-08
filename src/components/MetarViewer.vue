<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted
} from 'vue';
import { useBreakpoints } from '@vueuse/core'; // Import useBreakpoints
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
  NCode,
  useMessage,
  NDivider,
  NInputGroup
} from 'naive-ui'
import {
  LocationOutline as LocationIcon,
  AirplaneOutline as AirplaneIcon // Import Airplane icon
} from '@vicons/ionicons5' // Corrected import
import {
  fetchMetar,
  fetchNearbyStations,
  fetchFlightCategory
} from '@/api'
import {
  processMetarData,
  getFlightCategoryTagType 
} from '@/utils'
import type {
  CheckWxNearbyStation,
  DecodedMetar
} from '@/types'

// Interface for nearby airport data including flight category
interface NearbyAirportData extends CheckWxNearbyStation {
  flightCategory?: string | null 
}

// Reactive State
const icaoInput = ref<string>('')
const isLoadingMetar = ref(false)
const isLoadingLocation = ref(false)
const errorMessage = ref<string | null>(null)
const metarData = ref<DecodedMetar | null>(null)
const nearbyAirports = ref<NearbyAirportData[]>([]) 
const showNearbyAirports = ref(false)

// Setup breakpoints for responsiveness
const breakpoints = useBreakpoints({
  mobile: 640,
});
const isMobile = breakpoints.smaller('mobile');

const message = useMessage()

// Computed property to disable button during loading
const isFetching = computed(() => isLoadingMetar.value || isLoadingLocation.value)

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

    const stationsResponse = await fetchNearbyStations(
      { latitude: position.coords.latitude, longitude: position.coords.longitude },
      100, 
      'A' 
    );
    console.log('Filtered Stations Response (API Filter):', stationsResponse); 

    if (stationsResponse?.data && Array.isArray(stationsResponse.data)) {
      nearbyAirports.value = stationsResponse.data
        .sort((a, b) => a.position.distance.miles - b.position.distance.miles)
        .slice(0, 10);

      const categoryPromises = nearbyAirports.value.map(async (airport) => {
        try {
          const categoryResponse = await fetchFlightCategory(airport.icao)
          if (categoryResponse.results > 0 && categoryResponse.data.length > 0) {
            return categoryResponse.data[0].flight_category
          } else {
            console.warn(`No flight category data found for ${airport.icao}`)
            return 'N/A' 
          }
        } catch (catError) {
          console.error(`Error fetching flight category for ${airport.icao}:`, catError)
          return 'Error' 
        }
      })

      const categories = await Promise.all(categoryPromises)

      nearbyAirports.value = nearbyAirports.value.map((airport, index) => ({
        ...airport,
        flightCategory: categories[index]
      }))
      .filter(airport => airport.flightCategory !== 'Error'); 

      console.log('Nearby Airports with Categories (Errors removed):', nearbyAirports.value);
    }

    if (nearbyAirports.value.length === 0) {
      errorMessage.value = 'No airports found within 100 miles.';
      if (errorMessage.value) message.warning(errorMessage.value)
    } else {
      showNearbyAirports.value = true; 
    }
  } catch (error: any) {
    console.error(
      'Error during nearby stations process (geolocation or fetch):', // Clarified message
      error instanceof Error ? error.message : 'Non-Error object caught',
      error // Log the full error object/details for inspection
    );
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
})

</script>

<template>
  <n-card title="METAR Viewer" segmented :bordered="false" size="large">
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
                <n-tag size="tiny" :type="getFlightCategoryTagType(airport.flightCategory)" style="margin-right: 8px;">
                  {{ airport.flightCategory || 'N/A' }}
                </n-tag>
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
            Could not find any airports within 100 miles of your location. 
         </n-alert>
      </div>

      <div v-else-if="metarData && !isFetching">
        <!-- Use a <p> tag for the header instead of n-divider -->
        <!-- DEBUG: Simplified header with hardcoded text and explicit color -->
        <p style="display: flex; align-items: center; font-size: 1.2em; gap: 6px; margin-bottom: 10px; font-weight: 500;">
          <n-icon :component="AirplaneIcon" size="22" />
          <span>{{ metarData.airportName || 'Unknown Station' }} ({{ metarData.icao }})</span>
        </p>
 
        <!-- Flight Category and Report Age Tags -->
        <div style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
          <n-tag v-if="metarData.flightCategory" :type="getFlightCategoryTagType(metarData.flightCategory)" size="small">
            {{ metarData.flightCategory }}
          </n-tag>
          <n-tag v-if="metarData.reportAgeMinutes !== undefined" type="default" size="small" :bordered="false">
            Reported {{ metarData.reportAgeMinutes }} mins ago
          </n-tag>
        </div>
 
        <n-divider v-if="isMobile" style="margin-top: 15px; margin-bottom: 5px;" />
 
        <n-card
          v-if="metarData.rawText"
          size="small"
          embedded
          class="raw-metar-card"
          :style="{ marginBottom: '15px' }"
        >
          <code>{{ metarData.rawText }}</code>
        </n-card>

        <n-descriptions
          label-placement="left"
          bordered
          :column="isMobile ? 1 : 2"
          size="medium"
        >
          <n-descriptions-item label="Observed">
            {{ metarData.observedTime }}
          </n-descriptions-item>
          <n-descriptions-item label="Wind">
            {{ metarData.wind }}
          </n-descriptions-item>
          <n-descriptions-item label="Visibility">
            {{ metarData.visibility }}
          </n-descriptions-item>
          <n-descriptions-item label="Ceiling & Clouds">
            {{ metarData.ceilingAndClouds }}
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
        </n-descriptions>

        <div v-if="metarData.remarks.plainLanguage !== 'No Remarks'" style="margin-top: 20px;">
            <n-descriptions label-placement="top" bordered :column="1" size="small">
                <n-descriptions-item label="Remarks">
                    <n-code language="plaintext" :hljs="undefined" :code="metarData.remarks.plainLanguage" word-wrap></n-code>
                    <div v-if="Object.keys(metarData.remarks.decoded).length > 0" style="margin-top: 10px;">
                        <strong>Decoded Elements:</strong>
                        <ul>
                            <li v-for="(value, key) in metarData.remarks.decoded" :key="key">
                                <strong>{{ key }}:</strong> {{ value }}
                            </li>
                        </ul>
                    </div>
                </n-descriptions-item>
            </n-descriptions>
        </div>
      </div>
    </n-space>
  </n-card>
</template>

<style scoped>
.n-card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.n-list-item {
  cursor: pointer;
}

.n-list-item .n-thing-header {
  margin-bottom: 2px; /* Reduce space below title in list */
}

.n-list-item:hover {
  background-color: #f8f8f8; /* Subtle hover effect */
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
</style>
