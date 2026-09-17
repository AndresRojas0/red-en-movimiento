const DEBUG_SEARCH = !1,
    SEARCH_INDEX_KEY = "quetren_search_index",
    SEARCH_INDEX_VERSION_KEY = "quetren_search_index_version",
    RECENT_SEARCHES_KEY = "quetren_recent_searches",
    MAX_RECENT_SEARCHES = 5,
    TRIP_MIN_QUERY_LENGTH = 5,
    TRIP_MAX_STATION_NAME_LENGTH = 50,
    TRIP_NGRAM_MIN_SCORE = 150,
    TRIP_NGRAM_MAX_WINDOW_WORDS = 3,
    TRIP_SEARCH_MAX_RESULTS = 3,
    TRIP_SEARCH_MIN_SCORE = 50,
    TRIP_ORIGIN_CANDIDATES = 5,
    TRIP_DEST_CANDIDATES = 10;
let searchIndex = null,
    pendingSearchData = null,
    searchIndexBuilt = !1;
function normalizeText(e) {
    return e
        ? e
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim()
        : "";
}
function slugify(e) {
    return e
        ? e
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9\s-]/g, "")
              .replace(/\s+/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-+|-+$/g, "")
        : "";
}
const SEARCH_ALIASES = {
    "j.l.suarez": "jose leon suarez",
    "gral. pacheco": "general pacheco",
    "gral. belgrano": "general belgrano",
    "dr. cabred": "doctor cabred",
    "ing. maschwitz": "ingeniero maschwitz",
    "v. ballester": "villa ballester",
    "v. adelina": "villa adelina",
    "v. de mayo": "villa de mayo",
    "s. miguel": "san miguel",
    "s. fernando": "san fernando",
    "s. isidro": "san isidro",
    "s. martin": "san martin",
    "b. mitre": "bartolome mitre",
    "cdad. universitaria": "ciudad universitaria",
};
function getExpandedSearchText(e, t) {
    const n = normalizeText(e),
        r = e.toLowerCase(),
        a = [n];
    for (const [e, t] of Object.entries(SEARCH_ALIASES))
        r.includes(e) && a.push(normalizeText(t)), r.includes(t) && a.push(normalizeText(e));
    if (t && Array.isArray(t)) for (const e of t) e.name && a.push(normalizeText(e.name));
    return { searchText: a.join(" "), segments: a };
}
function buildSearchIndex(e) {
    const t = { stations: [], lines: [], routes: [], version: e.updated_at || Date.now().toString() };
    if (!e.ramales) return t;
    const n = new Map();
    return (
        e.ramales.forEach((e) => {
            const t = e.gerencia,
                r = e.gerencia_id;
            n.has(t) || n.set(t, { id: r, nombre: t, ramales: [] }), n.get(t).ramales.push(e);
        }),
        n.forEach((e, n) => {
            t.lines.push({
                type: "line",
                id: e.id,
                name: n,
                description: `LÃ­nea ${n}`,
                searchText: normalizeText(`${n} linea`),
                segments: [normalizeText(n)],
                url: `/linea/${slugify(n)}`,
                badge: { type: "solid", color: window.LINEA_COLORS?.[n] || "#666" },
            }),
                e.ramales.forEach((e) => {
                    const r = e.nombre || e.descripcion || "";
                    t.routes.push({
                        type: "route",
                        id: e.id,
                        name: r,
                        lineName: n,
                        searchText: normalizeText(`${r} ${n}`),
                        segments: [normalizeText(r), normalizeText(n)],
                        url: `/ramal/${slugify(r)}`,
                        badge: e.badge || { type: "solid", color: window.LINEA_COLORS?.[n] || "#666" },
                    }),
                        e.stations &&
                            e.stations.forEach((e) => {
                                const a = t.stations.find((t) => t.id === e.id);
                                if (a)
                                    a.lines.includes(n) || a.lines.push(n),
                                        a.routes.includes(r) || a.routes.push(r),
                                        "closed" === e.station_status &&
                                            (a.closedOnRamales.includes(r) || a.closedOnRamales.push(r),
                                            !a.closureReason &&
                                                e.station_status_reason &&
                                                (a.closureReason = e.station_status_reason));
                                else {
                                    const a = e.aliases || [],
                                        s = getExpandedSearchText(e.nombre, a);
                                    t.stations.push({
                                        type: "station",
                                        id: e.id,
                                        name: e.nombre,
                                        searchText: s.searchText,
                                        segments: s.segments,
                                        url: `/estacion/${slugify(e.nombre)}`,
                                        lines: [n],
                                        routes: [r],
                                        aliases: a,
                                        closedOnRamales: "closed" === e.station_status ? [r] : [],
                                        closureReason: e.station_status_reason || null,
                                    });
                                }
                            });
                });
        }),
        t
    );
}
function loadSearchIndex(e) {
    const t = e.updated_at || "";
    if (localStorage.getItem(SEARCH_INDEX_VERSION_KEY) === t)
        try {
            const e = localStorage.getItem(SEARCH_INDEX_KEY);
            if (e) {
                return JSON.parse(e);
            }
        } catch (e) {
            false;
        }
    const n = buildSearchIndex(e);
    try {
        localStorage.setItem(SEARCH_INDEX_KEY, JSON.stringify(n)), localStorage.setItem(SEARCH_INDEX_VERSION_KEY, t);
    } catch (e) {
        if ("QuotaExceededError" === e.name)
            try {
                localStorage.removeItem(SEARCH_INDEX_KEY),
                    localStorage.removeItem(SEARCH_INDEX_VERSION_KEY),
                    localStorage.setItem(SEARCH_INDEX_KEY, JSON.stringify(n)),
                    localStorage.setItem(SEARCH_INDEX_VERSION_KEY, t);
            } catch {
                false;
            }
        else false;
    }
    return n;
}
function initializeSearch(e) {
    const t = e.updated_at || "";
    if (pendingSearchData && t === (pendingSearchData.updated_at || "")) return;
    (pendingSearchData = e), (searchIndexBuilt = !1);
    const n = () => ensureSearchIndex();
    "function" == typeof requestIdleCallback ? requestIdleCallback(n, { timeout: 2e3 }) : setTimeout(n, 200);
}
function ensureSearchIndex() {
    !searchIndexBuilt &&
        pendingSearchData &&
        ((searchIndex = loadSearchIndex(pendingSearchData)), (searchIndexBuilt = !0));
}
function search(e, t = 10) {
    if ((ensureSearchIndex(), !searchIndex || !e)) return [];
    const n = normalizeText(e),
        r = [];
    [...searchIndex.stations, ...searchIndex.lines, ...searchIndex.routes].forEach((e) => {
        const t = (function (e, t) {
            const n = e.searchText;
            if (n === t) return 1e3;
            if (n.startsWith(t)) return 500;
            if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(n)) return 300;
            if (n.includes(t)) return 100;
            if (e.segments) {
                const n = t.length + Math.max(t.length, 5);
                for (const r of e.segments)
                    for (let e = 0; e < r.length; e++) {
                        if (r[e] !== t[0]) continue;
                        let a = 1,
                            s = e + 1;
                        for (; s < r.length && a < t.length; s++) r[s] === t[a] && a++;
                        if (a === t.length && s - e <= n) return t.length;
                    }
            }
            return 0;
        })(e, n);
        if (t > 0) {
            const a = { ...e, score: t };
            if ("station" === e.type) {
                const t = (function (e, t) {
                    if (!e.aliases || !Array.isArray(e.aliases)) return null;
                    const n = normalizeText(e.name);
                    if (n.includes(t) || n.startsWith(t)) return null;
                    for (const n of e.aliases)
                        if (n.name) {
                            const e = normalizeText(n.name);
                            if (e.includes(t) || e.startsWith(t)) return n.name;
                        }
                    return null;
                })(e, n);
                t && (a.matchedAlias = t);
            }
            r.push(a);
        }
    });
    const a = { station: 1, route: 2, line: 3 };
    return (
        r.sort((e, t) => (t.score !== e.score ? t.score - e.score : (a[e.type] || 999) - (a[t.type] || 999))),
        r.slice(0, t)
    );
}
function getRecentSearches() {
    try {
        const e = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (e) return JSON.parse(e);
    } catch (e) {
        console.warn("Failed to load recent searches:", e);
    }
    return [];
}
function addRecentSearch(e) {
    try {
        let t = getRecentSearches();
        (t = t.filter((t) => !(t.type === e.type && t.id === e.id))),
            t.unshift({
                type: e.type,
                id: e.id,
                name: e.name,
                url: e.url,
                badge: e.badge,
                lines: e.lines,
                lineName: e.lineName,
                timestamp: Date.now(),
            }),
            (t = t.slice(0, 5)),
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(t));
    } catch (e) {
        console.warn("Failed to save recent search:", e);
    }
}
function clearRecentSearches() {
    try {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (e) {
        console.warn("Failed to clear recent searches:", e);
    }
}
const TRIP_SEPARATOR_REGEX = new RegExp("^(.{1,50}?)\\s+(a|hacia)\\s+(.{1,50})$", "i"),
    TRIP_INVERSE_SEPARATOR_REGEX = new RegExp("^(.{1,50}?)\\s+(desde|saliendo de)\\s+(.{1,50})$", "i");
function detectTripQuery(e) {
    if (!e || e.length < 5) return null;
    const t = e.match(TRIP_SEPARATOR_REGEX);
    if (t) {
        const e = t[1].trim(),
            n = t[3].trim(),
            r = /(?:^|\s)(de|desde|en)\s/i.test(e),
            a = /(?:^|\s)(de|desde)\s/i.test(n),
            s = e.trim().split(/\s+/).length > 3,
            i = n.trim().split(/\s+/).length > 3;
        if (e.length >= 2 && n.length >= 2 && !r && !a && !s && !i) return { originQuery: e, destQuery: n };
    }
    const n = e.match(TRIP_INVERSE_SEPARATOR_REGEX);
    if (n) {
        const e = n[1].trim(),
            t = n[3].trim(),
            r = /(?:^|\s)(a|hacia|hasta|para)\s/i.test(e),
            a = /(?:^|\s)(a|hacia|hasta|para)\s/i.test(t);
        if (t.length >= 2 && e.length >= 2 && !r && !a) return { originQuery: t, destQuery: e };
    }
    const r = detectTripByNgramScan(e);
    return r || null;
}
function detectTripByNgramScan(e) {
    if ((ensureSearchIndex(), !searchIndex)) return null;
    const t = normalizeText(e)
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);
    const n = [];
    for (let e = 1; e <= 3; e++)
        for (let r = 0; r <= t.length - e; r++) {
            const a = t.slice(r, r + e).join(" ");
            if (a.length < 3) continue;
            const s = search(a, 1);
            s.length > 0 &&
                "station" === s[0].type &&
                s[0].score >= 150 &&
                n.push({ station: s[0], windowText: a, startPos: r, endPos: r + e - 1, score: s[0].score, length: e });
        }
    n.sort((e, t) => (t.score !== e.score ? t.score - e.score : t.length - e.length));
    const r = [],
        a = new Set();
    for (const e of n) {
        let t = !1;
        for (let n = e.startPos; n <= e.endPos; n++)
            if (a.has(n)) {
                t = !0;
                break;
            }
        if (!t) {
            r.push(e);
            for (let t = e.startPos; t <= e.endPos; t++) a.add(t);
        }
    }
    const s = new Set(),
        i = [];
    for (const e of r) s.has(e.station.id) || (s.add(e.station.id), i.push(e));
    if (i.length <= 1) return null;
    let o, c;
    if (2 === i.length) (o = i[0]), (c = i[1]);
    else {
        const e = [];
        for (let t = 0; t < i.length; t++)
            for (let n = t + 1; n < i.length; n++)
                stationsShareRamal(i[t].station, i[n].station) && e.push([i[t], i[n]]);
        if (1 !== e.length) return null;
        [o, c] = e[0];
    }
    const l = new Set(["desde", "de"]),
        u = new Set(["a", "hacia", "hasta", "para"]),
        d = new Set(["saliendo de", "viniendo de", "arranco en", "estoy en"]);
    function h(e) {
        const n = e.startPos;
        if (n >= 2) {
            const e = t[n - 2] + " " + t[n - 1];
            if (d.has(e)) return "origin";
        }
        if (n >= 1) {
            const e = t[n - 1];
            if (l.has(e)) return "origin";
            if (u.has(e)) return "dest";
        }
        return null;
    }
    const f = h(o),
        g = h(c);
    let m, S;
    "origin" === f && "dest" === g
        ? ((m = o), (S = c))
        : "dest" === f && "origin" === g
          ? ((m = c), (S = o))
          : "origin" === f && "origin" !== g
            ? ((m = o), (S = c))
            : ("origin" === g && "origin" !== f) || ("dest" === f && "dest" !== g)
              ? ((m = c), (S = o))
              : ("dest" === g && "dest" !== f) || o.startPos <= c.startPos
                ? ((m = o), (S = c))
                : ((m = c), (S = o));
    const E = { originQuery: m.windowText, destQuery: S.windowText };
    return E;
}
function stationsShareRamal(e, t) {
    const n = e.routes || [],
        r = t.routes || [];
    return n.some((e) => r.includes(e));
}
function searchTrips(e, t, n = 3, r = 50) {
    if (!searchIndex) return [];
    const a = search(e, 5).filter((e) => "station" === e.type);
    if (0 === a.length) return [];
    const s = search(t, 10).filter((e) => "station" === e.type);
    if (0 === s.length) return [];
    const i = [],
        o = new Set();
    for (const e of a)
        if (!(e.score < r))
            for (const t of s) {
                if (t.id === e.id) continue;
                if (t.score < r) continue;
                if (!stationsShareRamal(e, t)) continue;
                const a = `${e.id}-${t.id}`;
                if (o.has(a)) continue;
                o.add(a);
                const s = e.url?.replace("/estacion/", "") || ("function" == typeof slugify ? slugify(e.name) : e.name),
                    c = t.url?.replace("/estacion/", "") || ("function" == typeof slugify ? slugify(t.name) : t.name);
                if (
                    (i.push({
                        type: "trip",
                        origin: e,
                        destination: t,
                        url: `/viaje/${s}--a--${c}`,
                        score: Math.min(e.score, t.score),
                    }),
                    i.length >= n)
                )
                    return i;
            }
    return i.sort((e, t) => t.score - e.score), i;
}
function getSearchData() {
    return pendingSearchData;
}
function getReachableTerminals(e, t, n = 5) {
    if (!e || !t || !Array.isArray(t.ramales)) return [];
    const r = e.routes || [];
    if (0 === r.length) return [];
    const a = e.url ? e.url.replace("/estacion/", "") : null,
        s = normalizeText(e.name || ""),
        i = [],
        o = new Set();
    for (const e of r) {
        const r = t.ramales.find((t) => t.nombre === e);
        if (!r || !Array.isArray(r.stations) || 0 === r.stations.length) continue;
        const c = (e) => e.seq ?? e.orden ?? 1 / 0,
            l = [...r.stations].sort((e, t) => c(e) - c(t)),
            u = [l[0], l[l.length - 1]],
            d = r.gerencia || null;
        for (const e of u) {
            if (!e || !e.nombre) continue;
            const t = e.slug || "";
            if (
                t &&
                (!a || t !== a) &&
                normalizeText(e.nombre) !== s &&
                !o.has(t) &&
                (o.add(t), i.push({ name: e.nombre, slug: t, lineName: d }), i.length >= n)
            )
                return i;
        }
    }
    return i;
}
"undefined" != typeof module &&
    module.exports &&
    (module.exports = {
        normalizeText: normalizeText,
        buildSearchIndex: buildSearchIndex,
        loadSearchIndex: loadSearchIndex,
        initializeSearch: initializeSearch,
        search: search,
        getRecentSearches: getRecentSearches,
        addRecentSearch: addRecentSearch,
        clearRecentSearches: clearRecentSearches,
        detectTripQuery: detectTripQuery,
        detectTripByNgramScan: detectTripByNgramScan,
        searchTrips: searchTrips,
        getReachableTerminals: getReachableTerminals,
        getSearchData: getSearchData,
    });
