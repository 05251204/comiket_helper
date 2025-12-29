# Pebble Implementation Workplan (Status: Complete)

## Overview
Successfully implemented a Pebble watch app that syncs with the Comiket TSP Web App via Google Apps Script (GAS). The system allows viewing the next target circle and marking it as visited directly from the watch.

## Phase 1: Pebble UI Implementation (C) - [x] Done
- [x] Layout: Location (Top), Circle Name (Center), Stats (Bottom)
- [x] Communication: AppMessage buffer size increased to 1024 bytes for Japanese text support.
- [x] Buttons: SELECT and UP buttons both trigger the 'bought' action.
- [x] Memory: Implemented static buffers to persist string data for display.
- [x] Feedback: Vibration removed as per user request.

## Phase 2: PebbleKit JS Implementation (JS) - [x] Done
- [x] Data Fetching: Successfully fetches JSON from GAS (handling redirects).
- [x] Data Parsing: Adapted to GAS JSON structure (`wantToBuy` key, `account` field for name).
- [x] Logic: Implemented Nearest Neighbor TSP logic to determine the next target.
- [x] Sync:
    - Sends 'bought' status to GAS via POST.
    - Implemented a 3-second delay + re-fetch to ensure data consistency after updates.
- [x] Optimization:
    - Prioritizes `account` column for circle name display.
    - Polling interval set to 30 seconds.

## Phase 3: WebApp Synchronization - [ ] Future Work
- [ ] Implement periodic polling on the Web App side to reflect changes made from the Pebble automatically (currently requires manual refresh or action).

## Known Constraints & Bottlenecks
- **Latency**: Updates take ~3-5 seconds due to GAS cold start and spreadsheet write latency.
- **Battery**: 30-second polling reduces watch battery life to ~1-2 days.
- **Images**: Displaying circle cuts (images) is not implemented due to Pebble's hardware limitations (monochrome/memory) and slow transfer speeds.

## Build Instructions
```bash
cd pebble
docker run --rm -v $(pwd):/code -w /code rebble/pebble-sdk pebble build
# To install:
docker run --rm -v $(pwd):/code -w /code rebble/pebble-sdk pebble install --phone <PHONE_IP> pebble-app.pbw
```