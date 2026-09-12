# Posted-Speed-Limit Data Source — Research Spike

**Linear:** DEV-61 (blocks DEV-35; owns speeding end-to-end for DEV-70) · **Date:** 2026-09-07
**Status:** desk research complete; empirical route test still to run (see [§8](#8-the-empirical-spike-still-to-run)).

> **Decision (2026-09-07).** No posted-limit data source is being integrated now. The free
> options aren't authoritative on the residential streets this app runs on, and a
> per-request commercial API can't sit under a permanently-free, every-drive feature (see
> [§5](#5-option-c-commercial-apis)/[§6](#6-cost-model)). Instead: **DEV-35 becomes a live
> speed *display*** on the drive timer plus a top-speed figure on each logged drive — the
> supervising adult, who is in the car, compares it to the posted signs. **Over-speed
> haptics are dropped; haptic feedback moves to DEV-34** (hard-brake / harsh-turn), whose
> trigger needs no external data. This doc's [§8](#8-the-empirical-spike-still-to-run)
> stays open as the question "is a free over-speed *flag* worth adding later?" — not a
> blocker for anything.
**Author note:** GPS speed is now plumbed — `startMileageTracking` in `src/utils/geo.js` emits
`speedMph` / `heading` per fix as of this branch. That covers the "how fast is the car going"
half. This doc is about the "what's the limit here" half.

---

## 1. TL;DR

**Recommendation: OpenStreetMap `maxspeed` + a statutory-default fallback
(`osm-legal-default-speeds`), resolved on-device from a bundled / CDN-cached regional
dataset. No per-drive calls to a commercial limit API.**

Three constraints decide it before coverage quality even enters the picture:

| Constraint | Consequence |
|---|---|
| **Permanently free feature** (DEV-10) — fires on every practice drive, no revenue attached | A per-request commercial data cost comes straight out of margin. The [cost model](#6-cost-model) is the whole argument. |
| **Privacy-first positioning** (DEV-10: "no third-party ad/analytics SDKs") — and the driver is a minor | Streaming a child's live GPS to HERE/TomTom/Google every few seconds every drive contradicts the pitch and is a new Privacy-Policy disclosure. On-device lookup avoids it entirely. |
| **Real-time alert** — a limit that resolves 3 s late is useless for an over-speed buzz | Favors a local dataset (zero-latency lookup) over any network round-trip in a moving car with patchy signal. |

Commercial APIs fail all three. Their ToS additionally forbid the persistent local caching
that would fix the latency and privacy problems (see [§5](#5-option-c-commercial-apis)).

OSM data is ODbL — bundling, caching, and redistribution are explicitly allowed with
attribution. The app **already** ships OSM (Leaflet tiles in `DriveMap.jsx`, disclosed in
Privacy Policy §6), so the licensing and processor story is settled.

---

## 2. The decision in one table

| | Explicit OSM `maxspeed` | + statutory defaults | Commercial API (HERE / TomTom / Google / AWS) |
|---|---|---|---|
| **Cost** | Free | Free | Per-request or per-MAU; Google Roads is Asset-Tracking-license only (~$10k/yr) |
| **US residential coverage** | Sparse & uneven (see [§3](#3-option-a-explicit-osm-maxspeed)) | **High** — fills gaps with the actual legal default for the road class + US state | Good, incl. residential + SLA |
| **Latency** | 0 (local) | 0 (local) | Network round-trip per lookup; bad in patchy signal |
| **Privacy** | No data leaves device | No data leaves device | Live child GPS to a third party; new disclosure |
| **Offline** | Works | Works | Breaks |
| **Licensing** | ODbL — bundle/cache OK, already used | Library BSD-3; data CC-BY-SA | ToS forbid persistent caching / building a local DB |
| **Correctness risk** | Low where present | Wrong in known edge cases: school zones, posted-below-default streets, arterials mis-tagged `residential` | Lower; still imperfect on minor roads |
| **Integration effort** | Medium (build/ship the dataset) | Medium + small library | Low to code, high to operate (keys, billing, quotas, monitoring) |

---

## 3. Option A: explicit OSM `maxspeed`

**What it is:** the `maxspeed` tag on OSM ways. Free, no API key, same data family as the
tiles already in the app.

**Coverage — the known weak point.** From taginfo (2026-09-07):

- `maxspeed` present on **22,096,005 ways worldwide**.
- `highway=residential` alone: **69,837,184 ways worldwide**.

So even if *every* tagged way were residential (it isn't — a large share is European
motorway / trunk / primary, plus residential streets in DE/NL/FR where StreetComplete
campaigns ran), explicit `maxspeed` still couldn't be on more than ~32% of residential
ways globally. The realistic US residential figure is well below that. Highways and major
arterials in the US are decently covered; residential and minor roads — **exactly where
this app is used during early practice** — frequently have nothing.

We don't have a clean US-only percentage. That's what [§8](#8-the-empirical-spike-still-to-run)
measures on real local routes.

**How you'd consume it:**

- **Spike:** Overpass API (online, rate-limited — fine for a one-off measurement, not for
  production per-user load).
- **Production:** a Geofabrik regional extract → `osmium`/`osmfilter` to pull drivable
  ways + `maxspeed` → ship as a compact dataset. Delivery options: a single-file
  **PMTiles** (Protomaps) archive range-requested from static hosting and cached offline,
  or a per-state download on first use. Full North America PBF (~14 GB) is a non-starter to
  bundle; a maxspeed-and-roads-only slice is far smaller.

**Verdict:** necessary but not sufficient on its own. Pair with §4.

---

## 4. Option B: explicit `maxspeed` + statutory defaults

**`osm-legal-default-speeds`** (westnordost) — infers the *legal default* limit from road
class + jurisdiction when no sign / no tag exists.

- **License:** library BSD-3-Clause; underlying wiki data CC-BY-SA. Fine to bundle.
- **Platforms:** Kotlin multiplatform with a **JavaScript target**; Maven
  `de.westnordost:osm-legal-default-speeds`. No first-class npm package — either use the
  JS build or consume the generated `legal_default_speeds.json` directly with a small
  interpreter. (Java fork: `chargetrip/osm-legal-speed`.)
- **US support:** yes — per-state via ISO codes (`US-CA`, `US-ND`, …), including the
  urban/rural distinction and highway-relation membership.
- **Confidence:** returns a "Certitude" level (`Exact` / `Fuzzy` / `FromMaxSpeed` /
  `Fallback`) — usable to decide whether a result is solid enough to drive a haptic.

**Why this changes the picture:** most US residential streets are *unposted* and legally
governed by the state's statutory default (commonly 25 mph; 20–30 depending on state).
So "no tag" → "state default for `highway=residential`" is **correct a large fraction of
the time**, not a guess. It converts DEV-61's core risk from "no limit ~70% of the drive"
into "right most of the time, wrong in a bounded set of known cases":

- school zones (time-dependent, often 15–20)
- streets posted *below* the default
- arterials mis-tagged `highway=residential`
- the handful of cities/states with atypical defaults

**Verdict:** this is the recommendation. Explicit tag when present; statutory default with
a confidence flag otherwise.

---

## 5. Option C: commercial APIs

| Provider | Free tier | Paid | Blocker for us |
|---|---|---|---|
| **Google Roads – Speed Limits** | — | Requires **Asset Tracking license ≈ $10,000/yr** | Priced out. Full stop. |
| **HERE** | ~30,000 transactions/mo (widely cited; some sources say 250k — inconsistent), CC required | ~$0.70–$0.88 / 1,000 for geocoding-class; speed-limit/route-match pricing behind sales. +6% since Apr 2026 | Per-request cost on a free feature; ToS limits caching |
| **TomTom** | Snap to Roads **2,500/mo**, Routing 20k/mo | Per-1,000 behind sales wall | Free tier is ~2–20 of our users; **ToS: no persistent caching, no building a local DB** |
| **AWS Location Service** | Small free tier | Pay-per-request; HERE/Esri data underneath | Same per-request + caching constraints; still third-party GPS egress |
| **Mapbox** (`maxspeed` annotation on Directions / Map Matching) | Generous MAU tier | Per-MAU | Data is **OSM-derived** — same underlying coverage as Option A/B, just via a paid API and network dependency |

**The caching trap:** TomTom and HERE ToS both prohibit persistently storing their limit
data or assembling it into a local database. So the one architecture that would fix
latency, offline, and privacy — pre-fetch a region and resolve locally — is contractually
off the table. You're locked into a live call per drive.

---

## 6. Cost model

Rough, but the shape is the point. Assume 20 practice drives/user/month × ~30 min =
600 min/user/month.

| Lookup strategy | Calls / user / month | HERE-class @ ~$0.70/1k | TomTom Snap free tier (2.5k/mo) |
|---|---|---|---|
| 1 call / 30 s of driving | ~1,200 | **~$0.84 / user / mo** | ~2 users |
| 1 call / road-segment change (cached until segment changes) | ~150–300 | ~$0.11–0.21 / user / mo | ~8–16 users |

Family Pack is a **one-time $9.99**. A recurring ~$0.10–0.85 **per user per month**, on a
feature that is free by definition and runs on every drive, is margin-negative at any
scale — plus a hard third-party uptime dependency and the privacy disclosure. Even the
optimistic row doesn't survive contact with a few thousand users.

OSM + defaults: **$0 marginal**, plus one-time dataset-build engineering and ~monthly
dataset refreshes.

---

## 7. Unknown / low-confidence limit policy

DEV-61 asks for this explicitly. Recommendation:

| Situation | Over-speed **haptic** (DEV-35) | Over-speed **flag** in the log (DEV-70) |
|---|---|---|
| Explicit `maxspeed`, or default at `Exact`/`Fuzzy` certitude | Fire at +5 mph | Record |
| Default at `Fallback` certitude only | **Don't fire** — a buzz has no room for an "estimate" caveat | Record as "estimated limit", visibly caveated |
| No road match / no data | **Don't fire** | Don't flag; optionally one-time per drive "limit data unavailable on parts of this route" note |

Principle: silence on unknown is safer than buzzing against a bad guess. The haptic
demands high confidence; the after-the-fact log can afford a labeled estimate.

---

## 8. The empirical spike still to run

Desk research says OSM+defaults is the right architecture. What it can't tell us is
*whether the resulting limits are actually right* on the residential streets this app runs
on. Measure that before committing:

1. **Capture traces.** 5–10 real local routes as GPS traces (the drive timer now records
   `speedMph`): residential-heavy, plus an arterial, a school zone, a highway on-ramp, a
   street you know is posted below the state default.
2. **Build the OSM side.** Pull a `maxspeed` + drivable-ways extract for the test
   area(s) (Overpass or a state Geofabrik extract). Snap each trace to roads.
3. **Resolve limits.** Explicit `maxspeed` where present; `osm-legal-default-speeds`
   otherwise, recording the certitude level.
4. **Score.** Per route: % of drive time with an explicit limit / default-only / nothing;
   and correctness vs. what the driver knows the real posted limit to be.
5. **One commercial comparison.** Run the same traces through **one** free tier (TomTom
   Snap to Roads, 2.5k/mo) for a correctness + latency baseline.
6. **Decide.** If OSM+defaults is right, say, >90% of drive time with an acceptable error
   band, ship it. If residential correctness is bad even *with* statutory defaults,
   revisit a paid fallback for the gaps only.

Deliverable: a short results table appended to this doc and a go/no-go on DEV-61.

---

## Sources

- [taginfo — `maxspeed`](https://taginfo.openstreetmap.org/keys/maxspeed) · [taginfo — `highway=residential`](https://taginfo.openstreetmap.org/tags/highway=residential)
- [osm-legal-default-speeds (westnordost)](https://github.com/westnordost/osm-legal-default-speeds) · [demo](https://westnordost.github.io/osm-legal-default-speeds/) · [chargetrip/osm-legal-speed fork](https://github.com/chargetrip/osm-legal-speed)
- [OSM Wiki — Default speed limits](https://wiki.openstreetmap.org/wiki/Default_speed_limits) · [OSM tags for routing/Maxspeed](https://wiki.openstreetmap.org/wiki/OSM_tags_for_routing/Maxspeed)
- [Google Roads API — Speed Limits](https://developers.google.com/maps/documentation/roads/speed-limits) (Asset Tracking license) · [Roads API billing](https://developers.google.com/maps/documentation/roads/usage-and-billing)
- [HERE pricing](https://www.here.com/get-started/pricing) · [HERE 2026 price increase](https://coordable.co/blog/here-geocoding-price-increase-2026/) · [HERE Fleet Telematics / speed limits guide](https://greymatter.com/content-hub/here-getting-started-with-speed-limits-and-fleet-telematics/)
- [TomTom pricing](https://docs.tomtom.com/pricing) · [TomTom developer T&Cs](https://developer.tomtom.com/terms-and-conditions) · [TomTom Traffic API usage limits FAQ](https://developer.tomtom.com/knowledgebase/apis/faq/traffic/are-there-any-limitations-or-usage-restrictions-for-the-traffic-api/) · [Unified Speed Restrictions](https://www.tomtom.com/products/unified-speed-restrictions/)
- [AWS Location Service — speed limit for a road span](https://docs.aws.amazon.com/location/latest/developerguide/calculate-routes-speed-limit-road.html)
- [Mapbox Navigation SDK — Speed limit](https://docs.mapbox.com/android/navigation/guides/ui-components/speed-limit/) · [Mapbox data sources](https://docs.mapbox.com/help/dive-deeper/mapbox-data-sources/)
