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
  // Client name that will be displayed on the login consent screen (used for dynamic registration)
  clientName: 'Solid Planner',
  // URL of the Solid OIDC Client ID Document (static client registration).
  // Derived at runtime from the app's origin + base path so it works for any deployment.
  // Falls back to undefined on localhost, where IdPs cannot fetch the document anyway,
  // which causes the library to fall back to dynamic registration using clientName.
  clientIdDocumentUrl:
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    !window.location.hostname.startsWith('127.')
      ? window.location.origin + import.meta.env.BASE_URL + 'clientid.json'
      : undefined,
}
