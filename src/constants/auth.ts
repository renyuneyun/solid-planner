export const AUTH_CONFIG = {
  // Common Solid identity providers
  identityProviders: {
    'Inrupt.net': 'https://inrupt.net',
    'Solid Community': 'https://solidcommunity.net',
    'Solid Web': 'https://solidweb.org',
  },
  // Default provider
  defaultProvider: 'https://solidcommunity.net',
  // Redirect URL after login (should match your app's URL)
  redirectUrl: window.location.href,
  // Client name that will be displayed on the login consent screen
  clientName: 'Weekly Tasks App',
}
