# METAR Viewer

A simple Vue.js application to view METAR reports using the CheckWX API.

## Project Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

2.  **Configure API Key:**
    -   Copy the `.env.example` file to a new file named `.env`.
    -   Open the `.env` file and replace `YOUR_CHECKWX_API_KEY_HERE` with your actual CheckWX API key.
    ```env
    VITE_CHECKWX_API_KEY=YOUR_ACTUAL_KEY
    ```
    -   You can get a free API key from [CheckWX](https://www.checkwx.com/api).

3.  **Run Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

4.  **Build for Production:**
    ```bash
    npm run build
    # or
    yarn build
    # or
    pnpm build
    ```

## Tech Stack

-   Vue 3 (Composition API with `<script setup>`)
-   TypeScript
-   Vite
-   Naive UI
-   CheckWX API
