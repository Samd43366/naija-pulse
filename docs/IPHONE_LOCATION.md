# iPhone location support

## Why location failed

iOS Safari requires two conditions:

1. The location request must come from a user gesture, such as tapping the Locate button.
2. The page must be served from a secure context (`https://`) or a local browser origin.

Opening the Vite dev server on an iPhone over a normal LAN URL such as `http://192.168.x.x:5173` fails the secure-context requirement. A permission prompt during initial page load is also unreliable on iOS.

## What changed in the app

- The geolocation hook no longer requests GPS automatically on iPhone/iPad.
- The Locate button is the explicit permission entry point.
- The hook recognizes iPhone, iPad, and touch-enabled iPadOS Safari.
- The UI displays the browser error instead of silently falling back.
- The existing map pin and manual area selection remain available when GPS cannot be used.

## How to test on a physical iPhone

Use one of these options:

- Deploy the frontend to an HTTPS preview environment.
- Run Vite with a trusted local HTTPS certificate and open the HTTPS LAN URL.
- Use a secure tunnel to the local Vite server.

When the page is open over HTTPS, tap the map Locate button, allow location access for the site, and tap it again if Safari has already denied the first request.

## Product fallback

Location is helpful but not required. A user can choose a city or area, tap the map to place a report pin, or use the default Lagos view. The UI should never present the fallback location as the user’s actual location.

