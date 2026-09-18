# Native health sync — research notes

Why the browser build can't reach a watch, what can, and exactly what it costs.

## The constraint

`index.html` opened from disk is a web page. Three things follow, all verified in
Chromium rather than assumed:

| Check | Result |
| --- | --- |
| `window.isSecureContext` on `file://` | `true` |
| `navigator.bluetooth` on `file://` | **absent** |
| `navigator.bluetooth` on `http://localhost` | absent in headless; present in desktop Chrome/Edge |

So `file://` is a secure context but browsers still withhold Bluetooth from it.
Serving the app over `localhost` or HTTPS fixes that for Chrome, Edge and Android
Chrome. Safari and Firefox never expose Web Bluetooth at all.

Separately, and more importantly: **an Apple Watch, Garmin or Fitbit does not
expose its data over a GATT profile a browser can read.** Web Bluetooth reaches
standard profiles — heart rate `0x180D`, weight scale `0x181D` — which chest
straps and smart scales implement. Watches sync to a phone-side health store
(HealthKit, Health Connect) over proprietary protocols. There is no web API that
reads those stores. This is not a permissions problem; the capability does not
exist on the web platform.

## The only real path: a native shell

Wrap the same `index.html` in [Capacitor](https://capacitorjs.com) and talk to the
platform health store through a plugin.

### Plugin choice

| Package | Platforms | Licence | Notes |
| --- | --- | --- | --- |
| `capacitor-health` (mley) | HealthKit + Health Connect | open source | **chosen** — `8.2.0`, peer `@capacitor/core >=8.0.0` |
| `@capawesome-team/capacitor-health` | HealthKit + Health Connect | Insiders (paid) | ~20 data types, aggregation-first, no web impl |
| `@capgo/capacitor-health` | HealthKit + Google Fit | open source | Google Fit APIs shut down end of 2026 — avoid |
| `@perfood/capacitor-healthkit` | HealthKit only | open source | no Android |

Current `@capacitor/core` is `8.5.2`, so `capacitor-health@8.2.0` is compatible.

Google Fit is being retired at the end of 2026 and Health Connect is the Android
health store, so anything Fit-based is a dead end.

### API surface (`capacitor-health`)

```
isHealthAvailable()          -> { available: boolean }
checkHealthPermissions(req)  -> PermissionResponse
requestHealthPermissions(req)-> PermissionResponse
queryAggregated(req)         -> bucketed sums/averages
queryWorkouts(req)           -> workout list
queryRecords(req)            -> point-in-time records
openAppleHealthSettings()
openHealthConnectSettings()
showHealthConnectInPlayStore()
```

Permissions: `READ_STEPS`, `READ_WORKOUTS`, `WRITE_WORKOUTS`, `READ_ACTIVE_CALORIES`,
`READ_TOTAL_CALORIES`, `READ_DISTANCE`, `READ_HEART_RATE`, `READ_ROUTE`,
`READ_MINDFULNESS`, `READ_WEIGHT`, `READ_HEIGHT`, `READ_BODY_FAT`,
`READ_LEAN_BODY_MASS`.

Record types for `queryRecords`: `steps`, `weight`, `height`, `body-fat`,
`lean-body-mass`.

FitTrack needs three of these: `READ_WEIGHT` (weight card and trend),
`READ_ACTIVE_CALORIES` (the Exercise figure), `READ_WORKOUTS` (named sessions).

### Gotchas worth knowing before writing code

- **iOS timestamps must carry fractional seconds** — `2026-01-01T00:00:00.000Z`.
  A plain `toISOString()` already does this; hand-built strings will not.
- **Apple cannot report permission state.** HealthKit deliberately hides whether
  the user denied read access, so `requestHealthPermissions()` reports everything
  as granted. The only honest signal is whether a query returns rows. Never show
  "connected" off the back of the permission call.
- **Android rate-limits permission prompts.** After a couple of refusals the user
  must grant manually in the Health Connect app, so the UI needs a link to it —
  hence `openHealthConnectSettings()`.
- **`queryAggregated` does not accept body-composition types.** Weight goes
  through `queryRecords`.

### iOS setup

- HealthKit capability on the App ID, and the entitlement in the target.
- `Info.plist`: `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`.
  Both strings are shown verbatim in the consent sheet.
- Requires macOS + Xcode to build. Cannot be produced from this environment.

### Android setup

- `<uses-permission android:name="android.permission.health.READ_WEIGHT" />` and
  one line per type actually used. Declaring extras clutters the consent screen.
- `<queries><package android:name="com.google.android.apps.healthdata" /></queries>`
  so the app can see whether Health Connect is installed.
- A **privacy-policy rationale activity** is mandatory. Health Connect fires
  `ACTION_SHOW_PERMISSIONS_RATIONALE` when the user taps "Read privacy policy",
  and Play Console rejects health apps that do not handle it. Two declarations
  are needed: `PermissionsRationaleActivity` for Android 13 and below, and a
  `ViewPermissionUsageActivity` alias for 14+.
- Health Connect ships in the OS from Android 14; earlier versions install it
  from Play, which is what `showHealthConnectInPlayStore()` is for.

## How this lands in FitTrack

The deciding constraint is that `index.html` is one file with no build step, and
that is worth keeping — it is why the app runs from a double-click and stores
nothing off-device.

So the bridge does **not** import the plugin. Capacitor exposes registered
plugins at `window.Capacitor.Plugins.<Name>` at runtime in a native build, which
means the same unbundled `index.html` can feature-detect the bridge:

```js
const Health = window.Capacitor?.Plugins?.Health ?? null;
```

- In a browser: `null`. The Devices card shows Bluetooth and file import, exactly
  as before.
- In the native shell: present. The card adds "Sync from Apple Health" or
  "Sync from Health Connect", named for the platform it is actually running on.

No bundler, no duplicate codebase, one `index.html` for web and native.

### Build commands

```sh
npm install
npm run sync:www      # copy index.html into www/
npx cap add ios       # macOS + Xcode only
npx cap add android   # needs Android Studio to build, not to scaffold
npx cap sync
```

## What is verifiable here, and what is not

Verified in this environment: the web build, the capability detection on both
paths, the health-export importer against Apple Health XML and Garmin CSV
fixtures, and that the bridge degrades to `null` without throwing.

Not verifiable here: the iOS build (needs macOS/Xcode), the Android build (needs
the Android SDK), and the live HealthKit/Health Connect reads (need a device with
real data). Those are stubbed behind the capability check and cannot break the
web app, but they have not been run against a real health store.
