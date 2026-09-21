#!/usr/bin/env node
// Generates data/red-ferroviaria.geojson (shared infrastructure) and rewrites the
// day-type bundles to carry operations only: { generated_at, day_type, ramales: [slug...], trips }.
// Ramal geometry (points/stations/offsets) must be identical across day types; the script
// fails loudly on any mismatch so the network file stays a single source of truth.
import { readFileSync, writeFileSync } from "node:fs";

const DAYS = ["habil", "sabado", "domingo"];
const dataDir = new URL("../data/", import.meta.url);

const bundles = Object.fromEntries(
    DAYS.map((day) => [day, JSON.parse(readFileSync(new URL(`animation-bundle-${day}.json`, dataDir), "utf8"))]),
);

const network = new Map();
for (const r of bundles.habil.ramales) network.set(r.slug, r);
for (const day of DAYS.slice(1)) {
    for (const r of bundles[day].ramales) {
        const ref = network.get(r.slug);
        if (!ref) {
            network.set(r.slug, r);
            continue;
        }
        const same =
            ref.linea === r.linea &&
            JSON.stringify(ref.points) === JSON.stringify(r.points) &&
            JSON.stringify(ref.stations) === JSON.stringify(r.stations) &&
            JSON.stringify(ref.offsets) === JSON.stringify(r.offsets);
        if (!same) {
            console.error(`geometry mismatch for ramal "${r.slug}" between habil and ${day}`);
            process.exit(1);
        }
    }
}

const features = [];
let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
for (const [slug, r] of network) {
    const coordinates = [];
    for (let i = 0; i < r.points.length; i += 2) {
        const lon = r.points[i] / 1e5,
            lat = r.points[i + 1] / 1e5;
        coordinates.push([lon, lat]);
        minLon = Math.min(minLon, lon);
        minLat = Math.min(minLat, lat);
        maxLon = Math.max(maxLon, lon);
        maxLat = Math.max(maxLat, lat);
    }
    features.push({
        type: "Feature",
        properties: { slug, linea: r.linea, stations: r.stations, offsets: r.offsets },
        geometry: { type: "LineString", coordinates },
    });
}

const geojson = {
    type: "FeatureCollection",
    bbox: [minLon, minLat, maxLon, maxLat],
    features,
};
writeFileSync(new URL("../data/red-ferroviaria.geojson", dataDir), JSON.stringify(geojson, null, 2));

for (const day of DAYS) {
    const b = bundles[day];
    const slugs = b.ramales.map((r) => r.slug);
    for (const slug of slugs)
        if (!network.has(slug)) {
            console.error(`bundle ${day} references unknown ramal "${slug}"`);
            process.exit(1);
        }
    const slim = { generated_at: b.generated_at, day_type: b.day_type, ramales: slugs, trips: b.trips };
    writeFileSync(new URL(`animation-bundle-${day}.json`, dataDir), JSON.stringify(slim));
}

const kb = (p) => (readFileSync(new URL(p, dataDir)).length / 1024).toFixed(0);
console.log(`red-ferroviaria.geojson: ${features.length} ramales`);
console.log(`bundles: habil ${kb("animation-bundle-habil.json")} KB, sabado ${kb("animation-bundle-sabado.json")} KB, domingo ${kb("animation-bundle-domingo.json")} KB`);
