<script setup lang="ts">
import MetarViewer from './components/MetarViewer.vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NLoadingBarProvider, NNotificationProvider, NGlobalStyle } from 'naive-ui'
</script>

<template>
  <n-config-provider>
    <n-global-style />
    <n-loading-bar-provider>
      <n-message-provider>
        <n-notification-provider>
          <n-dialog-provider>
            <MetarViewer />
          </n-dialog-provider>
        </n-notification-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<style>
/* You can add global styles affecting the root App here if needed */
#app {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
