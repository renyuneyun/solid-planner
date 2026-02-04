/// <reference types="vite/client" />

export const AUTH_CONFIG = {
  // Common Solid identity providers
  identityProviders: {
    'Inrupt.net': 'https://inrupt.net',
    'Solid Community': 'https://solidcommunity.net',
    'Solid Web': 'https://solidweb.org',
  },
  // Default provider
  defaultProvider: 'https://solidcommunity.net',
  // Redirect URL after login (should match your app's URL including base path)
  // Uses BASE_URL from Vite config to handle apps deployed in subdirectories
  redirectUrl:
    typeof window !== 'undefined'
      ? window.location.origin + import.meta.env.BASE_URL
      : 'http://localhost:5173/',
  // Client name that will be displayed on the login consent screen
  clientName: 'Weekly Tasks App',
}
