export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
    credentialsKey: process.env.NODE_CREDENTIALS_KEY || '',
    public: {
      appName: 'Konga',
      buildDate: process.env.NUXT_PUBLIC_BUILD_DATE || ''
    }
  },
  nitro: {
    esbuild: {
      options: {
        target: 'esnext'
      }
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  }
})
