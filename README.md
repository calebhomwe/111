# FitTrack

A calorie, macro, water and body-weight tracker that runs from a single file.

Open `index.html` in a browser and it works. No server, no build step, no
account, no network calls. Everything is stored in `localStorage` on the device
and nothing is ever uploaded — the typefaces are embedded as base64 rather than
linked precisely so that loading the page contacts nothing.

The same `index.html` is also the payload for an iOS and Android app, which adds
Apple Health and Health Connect sync.

## Using it

| | |
| --- | --- |
| **Today** | Log food across four meals, water, exercise and weight. Quick-add repeats your most-logged foods into the meal matching the time of day. |
| **Trends** | Seven-day calories against goal, macro split, and a 30-day weight line. Averages cover completed days, so a half-logged today doesn't drag them down. |
| **Settings** | Goals (with a Mifflin–St Jeor calculator), units, ten themes, device pairing, import and export. |

Keyboard: `a` adds food, `w` adds water, `←` / `→` change day.

### Themes

Ten, from one token contract — seven dark (Obsidian & Gold, Platinum Noir,
Emerald Club, Sapphire Royale, Bordeaux, Bronze Sand, Midnight) and three light
(Champagne, Rosé, Porcelain). Every one passes AAA for body text and AA for
secondary text.

Adding an eleventh is one CSS block plus one row in the `THEMES` array.

### Devices

| Source | Works in | Notes |
| --- | --- | --- |
| Health export file | every browser | Apple Health `export.xml`, or CSV from Garmin/Fitbit |
| BLE heart-rate strap | Chrome, Edge, Android Chrome | standard GATT `0x180D` |
| BLE weight scale | Chrome, Edge, Android Chrome | standard GATT `0x181D` |
| Apple Health | iOS app | native build only |
| Health Connect | Android app | native build only |

Web Bluetooth needs the app served over `localhost` or HTTPS — browsers withhold
it from `file://` pages even though those are secure contexts — and Safari and
Firefox don't implement it at all. The app detects this and says so rather than
offering a button that cannot work.

**A watch cannot be read from a browser.** Watches sync to a phone-side health
store over proprietary protocols and no web API reaches those, so watch data
arrives either through the export file or through the native build. See
[NOTES-native-health.md](NOTES-native-health.md).

## Development

```sh
npm install
npm test               # all suites
npm test security      # one suite: app | health | regressions | security
```

The tests drive the real app in Chromium — 64 assertions covering the logging
flows, the theme contract and its contrast floors, layout at phone width, file
import, the native bridge under five different conditions, every defect found in
review, and the stored-XSS payload. Any console error fails the run.

Worth running under a few timezones, since several past bugs only appeared away
from UTC:

```sh
TZ=Pacific/Auckland npm test
```

### Native builds

```sh
npm run sync:www       # copy index.html into www/
npx cap sync
npx cap open ios       # needs macOS + Xcode
npx cap open android   # needs Android Studio
```

`www/` is generated — edit `index.html` at the repo root.

`npm audit` reports three moderate advisories. All are in
`@capacitor/cli → xcode → uuid`, which is a dev dependency used to manipulate
the Xcode project; `npm audit --omit=dev` reports zero. Nothing ships.

## Layout

```
index.html                  the whole app
test/                       suites, harness and fixtures
scripts/build-www.mjs       copies index.html into www/ for Capacitor
capacitor.config.json
ios/ android/               native shells; both manifests are hand-edited
NOTES-native-health.md      why a browser can't read a watch, and what can
```

## Design

Instrument Serif for display, Inter for everything functional — the serif never
appears below 32px or in body copy, navigation or buttons. Radii are 8 and 12.
Motion is 120/180/280ms. One accent per theme, with macros drawn from a tonal
ramp rather than competing hues.

The Figma file carries the tokens as variables with `var(--x)` code syntax, the
type specimen, the four-mode colour sheet and the screens.
