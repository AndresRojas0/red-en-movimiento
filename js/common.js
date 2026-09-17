"serviceWorker" in navigator &&
    navigator.serviceWorker.register("/sw.js").catch((e) => {
        "true" === localStorage.getItem("DEBUG") && console.warn("SW registration failed:", e);
    });
const DEBUG = "true" === localStorage.getItem("DEBUG");
function debugLog(...e) {
    DEBUG && console.log(...e);
}
function yieldToMain() {
    return new Promise((e) => setTimeout(e, 0));
}
async function fetchData() {
    const e = Date.now(),
        [t, n] = await Promise.all([
            fetch(INFRA_URL, { cache: "default" }).then((e) => {
                if (!e.ok) throw new Error(`HTTP ${e.status} fetching ${e.url}`);
                return e.json();
            }),
            fetch(`${LIVE_URL}?t=${e}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }).then((e) => {
                if (!e.ok) throw new Error(`HTTP ${e.status} fetching ${e.url}`);
                return e.json();
            }),
        ]),
        r = { ...n, ramales: t.ramales, closed_stations: t.closed_stations };
    if (r.departures && r.ramales)
        for (const e of r.ramales)
            for (const t of e.stations || []) {
                const n = r.departures[t.slug],
                    i = n?.[e.slug];
                (t.next_trains_outbound = i?.next_trains_outbound ?? []),
                    (t.next_trains_inbound = i?.next_trains_inbound ?? []);
            }
    return r;
}
function injectTrainsIntoRamales(e, t) {
    const n = {};
    for (const t of e) {
        const e = t.ramal_slug;
        e && (n[e] || (n[e] = []), n[e].push(t));
    }
    for (const e of t) e.trains = n[e.slug] || [];
}
async function fetchTrainsForGerencia(e) {
    return e
        ? fetch(`${TRAINS_BASE_URL}${e}.json?t=${Date.now()}`, { cache: "no-store" })
              .then((e) => (e.ok ? e.json() : null))
              .catch(() => null)
        : null;
}
let lastDataHash = null,
    noChangeCount = 0,
    currentRefreshInterval = 3e4,
    consecutiveErrors = 0;
const MIN_REFRESH_INTERVAL = 3e4,
    MAX_REFRESH_INTERVAL = 3e5,
    BACKOFF_MULTIPLIER = 1.5,
    DIRECTION_ARROW_FULL_REGEX = /(â†’|â†)\s*a\s+(.+)/,
    DIRECTION_ARROW_SYMBOL_REGEX = /^(â†’|â†)/,
    MAX_RETRIES = 3,
    ERROR_RETRY_DELAY = 5e3;
let _closedStationsLookup = {};
function setClosedStationsLookup(e) {
    _closedStationsLookup = e || {};
}
function getStationClosureReason(e) {
    return (e && _closedStationsLookup[e.toLowerCase()]) || null;
}
function isStationClosed(e) {
    return null !== getStationClosureReason(e);
}
function resetSmartRefreshState() {
    (lastDataHash = null), (noChangeCount = 0), (currentRefreshInterval = 3e4), (consecutiveErrors = 0);
}
function hashData(e) {
    if (!e) return "null";
    return [e.updated_at || "", (e.ramales || []).length, (e.servicios || []).length, (e.alerts || []).length].join(
        "|"
    );
}
function isAbortError(e) {
    if (!e) return !1;
    if ("AbortError" === e.name) return !0;
    const t = e.message || "";
    return /aborted/i.test(t) || /the user aborted/i.test(t);
}
function isTransientNetworkError(e) {
    if (!e) return !1;
    const t = e.message || "";
    return (
        !!isAbortError(e) ||
        [
            /networkerror/i,
            /failed to fetch/i,
            /load failed/i,
            /network error/i,
            /net::err_/i,
            /timeout/i,
            /ECONNRESET/i,
            /ENOTFOUND/i,
            /ETIMEDOUT/i,
        ].some((e) => e.test(t))
    );
}
async function fetchDataSmart(e = 0) {
    try {
        const e = await fetchData(),
            t = hashData(e);
        if (
            (consecutiveErrors > 0 &&
                (debugLog("[Smart Refresh] Connection restored after error"), (consecutiveErrors = 0)),
            null === lastDataHash || t !== lastDataHash)
        )
            return (
                debugLog("[Smart Refresh] Data changed, resetting to 30s interval"),
                (lastDataHash = t),
                (noChangeCount = 0),
                (currentRefreshInterval = 3e4),
                { data: e, hasChanged: !0, interval: currentRefreshInterval }
            );
        noChangeCount++;
        const n = currentRefreshInterval;
        return (
            (currentRefreshInterval = Math.min(1.5 * currentRefreshInterval, 3e5)),
            debugLog(
                `[Smart Refresh] No change (${noChangeCount}x), interval: ${n / 1e3}s â†’ ${currentRefreshInterval / 1e3}s`
            ),
            (lastDataHash = t),
            { data: e, hasChanged: !1, interval: currentRefreshInterval }
        );
    } catch (t) {
        consecutiveErrors++;
        const n = isTransientNetworkError(t);
        if (isAbortError(t)) throw (debugLog("[Smart Refresh] Request aborted (likely page navigation)"), t);
        if (
            (n
                ? console.warn(`[Smart Refresh] Transient network error (${consecutiveErrors}/3):`, t.message)
                : console.error(`[Smart Refresh] Fetch error (${consecutiveErrors}/3):`, t.message),
            n && e < 3)
        ) {
            const t = 5e3 * (e + 1);
            return (
                debugLog(`[Smart Refresh] Retrying in ${t / 1e3}s...`),
                await new Promise((e) => setTimeout(e, t)),
                await fetchDataSmart(e + 1)
            );
        }
        throw (
            (e >= 3 && console.error("[Smart Refresh] Max retries exceeded, giving up"),
            new Error(`Failed to fetch data after 3 retries: ${t.message}`))
        );
    }
}
function updateTimestampOnly(e) {
    updateLastUpdatedTime(e), debugLog("[Smart Refresh] Updated timestamp only (no data changes)");
}
const STALE_BANNER_ID = "stale-data-banner";
function showStaleDataBanner(e, t) {
    if (!e || !e.parentNode) return;
    if (document.getElementById(STALE_BANNER_ID)) return;
    const n = document.createElement("div");
    (n.id = STALE_BANNER_ID),
        (n.className = "stale-data-banner"),
        n.setAttribute("role", "status"),
        n.setAttribute("aria-live", "polite");
    const r = document.createElement("span");
    (r.className = "stale-data-icon"), r.setAttribute("aria-hidden", "true"), (r.textContent = "âš ");
    const i = document.createElement("span");
    (i.className = "stale-data-message"), (i.textContent = "Estos datos pueden estar desactualizados.");
    const a = document.createElement("button");
    (a.type = "button"),
        (a.className = "stale-data-reload"),
        (a.textContent = "Recargar"),
        a.addEventListener("click", () => {
            window.location.reload();
        });
    const o = document.createElement("button");
    (o.type = "button"),
        (o.className = "stale-data-dismiss"),
        o.setAttribute("aria-label", "Cerrar aviso"),
        (o.textContent = "Ã—"),
        o.addEventListener("click", () => {
            if ((hideStaleDataBanner(), "function" == typeof t))
                try {
                    t();
                } catch (e) {
                    console.error("stale-data dismiss callback threw:", e);
                }
        }),
        n.appendChild(r),
        n.appendChild(i),
        n.appendChild(a),
        n.appendChild(o),
        e.parentNode.insertBefore(n, e);
}
function hideStaleDataBanner() {
    const e = document.getElementById(STALE_BANNER_ID);
    e && e.parentNode && e.parentNode.removeChild(e);
}
const NO_LIVE_DATA_PILL_ID = "no-live-data-pill";
function renderNoLiveDataPill(e, t) {
    if (!e) return;
    const n = e.querySelector("#no-live-data-pill");
    n && n.remove();
    const r = "function" == typeof noLiveDataCopy ? noLiveDataCopy(t) : null;
    if (!r) return;
    const i = document.createElement("p");
    (i.id = "no-live-data-pill"), (i.className = "no-live-data-pill"), (i.textContent = r), e.appendChild(i);
}
function handleSystemThemeChange(e) {
    localStorage.getItem("theme") ||
        (document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light"), updateThemeToggleA11y());
}
function initTheme() {
    const e = localStorage.getItem("theme"),
        t = window.matchMedia("(prefers-color-scheme: dark)"),
        n = e || (t.matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", n),
        updateThemeToggleA11y(),
        t.addEventListener("change", handleSystemThemeChange);
}
function toggleTheme() {
    const e = "dark" === document.documentElement.getAttribute("data-theme") ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", e), localStorage.setItem("theme", e), updateThemeToggleA11y();
}
function updateThemeToggleA11y() {
    const e = document.getElementById("theme-toggle");
    if (!e) return;
    const t = "dark" === document.documentElement.getAttribute("data-theme");
    e.setAttribute("aria-pressed", t ? "true" : "false"),
        e.setAttribute("title", t ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
}
function setupThemeToggle() {
    const e = document.getElementById("theme-toggle");
    e && e.addEventListener("click", toggleTheme);
}
function updateLastUpdatedTime(e, t = "last-updated-time") {
    const n = document.getElementById(t);
    if (n)
        if (e)
            try {
                const t = new Date(e),
                    r = new Date(),
                    i = Math.floor((r - t) / 1e3 / 60);
                let a;
                (a =
                    i < 1
                        ? "Hace menos de 1 minuto"
                        : 1 === i
                          ? "Hace 1 minuto"
                          : i < 60
                            ? `Hace ${i} minutos`
                            : t.toLocaleTimeString("es-AR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "America/Argentina/Buenos_Aires",
                              })),
                    (n.textContent = a);
            } catch (t) {
                console.error("Error parsing timestamp:", t), (n.textContent = e);
            }
        else n.textContent = "Desconocido";
}
function escapeHtml(e) {
    if (null == e) return "";
    const t = document.createElement("div");
    return (t.textContent = e), t.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function sanitizeServiceTypeClass(e) {
    return e
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
}
function linkifyText(e) {
    if (!e) return "";
    return escapeHtml(e).replace(
        /(\b(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*))/gi,
        (e) => {
            let t = e;
            if (e.match(/^https?:\/\//i)) {
                if (!e.match(/^(https?):\/\//i)) return e;
                t = e;
            } else t = `https://${e}`;
            return `<a href="${t}" target="_blank" rel="noopener noreferrer">${e}</a>`;
        }
    );
}
function sanitizeColor(e, t = "#fff3cd") {
    if (!e || "string" != typeof e) return t;
    e = e.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(e)) return e;
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/.test(e)) return e;
    if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*[\d.]+\s*)?\)$/.test(e)) return e;
    return [
        "white",
        "black",
        "red",
        "green",
        "blue",
        "yellow",
        "orange",
        "purple",
        "pink",
        "gray",
        "grey",
        "transparent",
    ].includes(e.toLowerCase())
        ? e
        : (console.warn(`Unsafe color detected: "${e}". Using fallback: ${t}`), t);
}
function parseHex(e) {
    return (
        3 === (e = e.replace("#", "").trim()).length && (e = e[0] + e[0] + e[1] + e[1] + e[2] + e[2]),
        {
            r: parseInt(e.substring(0, 2), 16) || 0,
            g: parseInt(e.substring(2, 4), 16) || 0,
            b: parseInt(e.substring(4, 6), 16) || 0,
        }
    );
}
function blendHexColors(e, t, n = "#ffffff") {
    const r = parseHex(e),
        i = parseHex(n),
        a = (e, n) => Math.round(e * t + n * (1 - t)),
        o = a(r.r, i.r),
        s = a(r.g, i.g),
        c = a(r.b, i.b),
        l = (e) => e.toString(16).padStart(2, "0");
    return `#${l(o)}${l(s)}${l(c)}`;
}
const ALERT_PREVIEW_MAX_LENGTH = 60;
function getStatusClass(e) {
    const t = e.toLowerCase();
    return t.includes("en hora") || t.includes("a tiempo") || t.includes("en marcha")
        ? "status-on-time"
        : t.includes("demorado") || t.includes("dem")
          ? "status-delayed"
          : t.includes("adelantado") || t.includes("adel")
            ? "status-early"
            : t.includes("cancelado")
              ? "status-cancelled"
              : t.includes("abordando")
                ? "status-boarding"
                : t.includes("saliÃ³") || t.includes("partiÃ³")
                  ? "status-departed"
                  : "status-unknown";
}
function getAlertIcon(e) {
    return e
        ? e.includes("warning")
            ? "âš ï¸"
            : e.includes("info")
              ? "â„¹ï¸"
              : e.includes("check")
                ? "âœ…"
                : e.includes("times") || e.includes("close")
                  ? "âŒ"
                  : e.includes("exclamation")
                    ? "â—"
                    : "âš ï¸"
        : "âš ï¸";
}
function getGtfsCauseName(e) {
    return (
        {
            OTHER_CAUSE: "Otra causa",
            TECHNICAL_PROBLEM: "Problema tÃ©cnico",
            STRIKE: "Huelga",
            DEMONSTRATION: "ManifestaciÃ³n",
            ACCIDENT: "Accidente",
            HOLIDAY: "Feriado",
            WEATHER: "Clima",
            MAINTENANCE: "Mantenimiento",
            CONSTRUCTION: "Obras",
            POLICE_ACTIVITY: "Actividad policial",
            MEDICAL_EMERGENCY: "Emergencia mÃ©dica",
        }[e] || e
    );
}
function getUrlParam(e) {
    return new URLSearchParams(window.location.search).get(e);
}
const SLUGIFY_CACHE_MAX_SIZE = 500,
    slugifyCache = new Map();
function slugify(e) {
    if (!e) return "";
    const t = e.toString();
    if (slugifyCache.has(t)) return slugifyCache.get(t);
    const n = t
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (slugifyCache.size >= 500) {
        const e = slugifyCache.keys().next().value;
        slugifyCache.delete(e);
    }
    return slugifyCache.set(t, n), n;
}
function isSameParentEntity(e, t) {
    if ("string" != typeof e || "string" != typeof t) return !1;
    const n = e.replace(/\/+$/, "") || "/",
        r = t.replace(/\/+$/, "") || "/",
        i = n.split("/").filter(Boolean),
        a = r.split("/").filter(Boolean);
    if (i.length < 2 || a.length < 2) return !1;
    const o = new Set(["ramal", "linea", "estacion"]);
    return !(i[0] !== a[0] || !o.has(i[0])) && i[1] === a[1];
}
let leafletPromise = null,
    leafletLoaded = !1;
async function loadLeaflet() {
    return window.L
        ? ((leafletLoaded = !0), window.L)
        : (leafletPromise || (leafletPromise = createLeafletLoadPromise()), leafletPromise);
}
function createLeafletLoadPromise() {
    return new Promise((e, t) => {
        let n = !1,
            r = !1,
            i = null;
        const a = () => {
                n && r && i && ((leafletLoaded = !0), e(i));
            },
            o = document.createElement("link");
        (o.rel = "stylesheet"),
            (o.href = "/leaflet.css"),
            (o.onload = () => {
                (n = !0), a();
            }),
            (o.onerror = () => {
                (leafletPromise = null), t(new Error("Failed to load Leaflet CSS"));
            }),
            document.head.appendChild(o);
        const s = document.createElement("script");
        (s.src = "/js/vendor/leaflet.js"),
            (s.onload = () => {
                window.L
                    ? ((i = window.L), (r = !0), a())
                    : ((leafletPromise = null), t(new Error("Leaflet loaded but L is not defined")));
            }),
            (s.onerror = () => {
                (leafletPromise = null), t(new Error("Failed to load Leaflet library"));
            }),
            document.head.appendChild(s);
    });
}
function isLeafletLoaded() {
    return leafletLoaded || !!window.L;
}
const WALKING_SPEED_M_PER_MIN = 80,
    BUENOS_AIRES_BOUNDS = { minLat: -36, maxLat: -34, minLng: -59.5, maxLng: -57.5 };
function isWithinBuenosAiresBounds(e, t) {
    return (
        e >= BUENOS_AIRES_BOUNDS.minLat &&
        e <= BUENOS_AIRES_BOUNDS.maxLat &&
        t >= BUENOS_AIRES_BOUNDS.minLng &&
        t <= BUENOS_AIRES_BOUNDS.maxLng
    );
}
function haversineDistance(e, t, n, r) {
    if (!(isFinite(e) && isFinite(t) && isFinite(n) && isFinite(r))) return NaN;
    const i = (e * Math.PI) / 180,
        a = (n * Math.PI) / 180,
        o = ((n - e) * Math.PI) / 180,
        s = ((r - t) * Math.PI) / 180,
        c = Math.sin(o / 2) ** 2 + Math.cos(i) * Math.cos(a) * Math.sin(s / 2) ** 2;
    return 6371e3 * (2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c)));
}
function estimateWalkingTime(e) {
    return Math.max(1, Math.ceil(e / 80));
}
function isMobileViewport() {
    return window.matchMedia("(max-width: 767px)").matches;
}
function extractAllStations(e) {
    if (!e || !e.ramales) return [];
    const t = new Map();
    for (const n of e.ramales)
        if (n.stations)
            for (const e of n.stations) {
                if (!e.location) continue;
                const r = parseFloat(e.location.lat),
                    i = parseFloat(e.location.lng);
                isNaN(r) || isNaN(i)
                    ? console.warn(`Skipping station ${e.nombre}: invalid coordinates`, {
                          lat: e.location.lat,
                          lng: e.location.lng,
                      })
                    : isWithinBuenosAiresBounds(r, i)
                      ? t.has(e.id) ||
                        t.set(e.id, {
                            id: e.id,
                            nombre: e.nombre,
                            slug: e.slug,
                            lat: r,
                            lng: i,
                            linea: n.gerencia,
                            ramal: n.nombre,
                        })
                      : console.warn(`Skipping station ${e.nombre}: coordinates outside Buenos Aires bounds`, {
                            lat: r,
                            lng: i,
                        });
            }
    return Array.from(t.values());
}
function findNearbyStations(e, t, n, r = 1e4, i = 3) {
    if (!n || 0 === n.length) return [];
    return n
        .map((n) => {
            const r = haversineDistance(e, t, n.lat, n.lng);
            return { station: n, distance: r, walkingTime: estimateWalkingTime(r) };
        })
        .filter(({ distance: e }) => !isNaN(e) && e <= r)
        .sort((e, t) => e.distance - t.distance)
        .slice(0, i);
}
function shortenRamalName(e, t) {
    if (!e) return "";
    const n = e.split(" - ");
    let r = n.length > 1 ? n[n.length - 1] : e;
    return r
        ? ((r = r.replace(/\(VÃ­a\s+/i, "(")), t && r.length > t && (r = r.substring(0, t - 1).trim() + "â€¦"), r)
        : e;
}
function formatRouteDisplay(e, t) {
    return e && t
        ? `${getStationDisplayName(e)} â†’ ${getStationDisplayName(t)}`
        : t
          ? getStationDisplayName(t)
          : "Desconocido";
}
function applyDisplayNamesToRoute(e) {
    if (!e || "string" != typeof e) return e;
    const t = e.split(" â†’ ");
    return 2 === t.length
        ? `${getStationDisplayName(t[0])} â†’ ${getStationDisplayName(t[1])}`
        : getStationDisplayName(e);
}
function getRouteDisplay(e) {
    return applyDisplayNamesToRoute(
        e.route_display || formatRouteDisplay(e.origin, e.terminus) || e.destination || "Desconocido"
    );
}
function stripLineSuffixFromRoute(e) {
    return e && "string" == typeof e
        ? e.replace(/\s*\((SM|Mitre|BN|Roca|Sarmiento|Urquiza|Belgrano Norte|Belgrano Sur|San MartÃ­n|LGM|LSM)\)/gi, "")
        : e;
}
function getCleanRouteDisplay(e) {
    return stripLineSuffixFromRoute(getRouteDisplay(e));
}
function extractBranchName(e, t) {
    if (!e || "string" != typeof e) return e || "";
    const n = e.split(" - ");
    if (2 !== n.length) return e;
    const [r, i] = n.map((e) => e.trim()),
        a = (t || "").toLowerCase(),
        o = a.includes(r.toLowerCase()),
        s = a.includes(i.toLowerCase());
    return o && !s ? i : s && !o ? r : i;
}
function renderBadge(e, t) {
    t || (t = { type: "solid", code: null });
    return `<span class="line-badge ${`line-${slugify(e)}`} ${"outlined" === t.type ? "outlined" : "solid"}">${escapeHtml(t.code || "")}</span>`;
}
function getServiceStatusBadge(e, t) {
    if (!e || "active" === e) return "";
    let n = "",
        r = "",
        i = "";
    switch (e) {
        case "suspended":
            (n = "service-status-suspended"), (r = "Sin servicio"), (i = "Este ramal no tiene servicio actualmente");
            break;
        case "limited":
            (n = "service-status-limited"), (r = "Servicio limitado"), (i = "Este ramal tiene servicio reducido");
            break;
        default:
            return "";
    }
    return `<span class="service-status-badge ${n}"${` title="${escapeHtml(t || i)}"`}>${r}</span>`;
}
function getServiceStatusBanner(e) {
    const t = e.service_status;
    if (!t || "active" === t) return "";
    let n = "",
        r = "",
        i = "";
    switch (t) {
        case "suspended":
            (n = "service-status-banner-suspended"), (r = "Servicio suspendido"), (i = "ðŸš«");
            break;
        case "limited":
            (n = "service-status-banner-limited"), (r = "Servicio limitado"), (i = "âš ï¸");
            break;
        default:
            return "";
    }
    let a = `<div class="service-status-banner ${n}">`;
    return (
        (a += `<div class="service-status-banner-title">${i} ${r}</div>`),
        e.service_notes && (a += `<div class="service-status-banner-notes">${escapeHtml(e.service_notes)}</div>`),
        e.schedule_restriction &&
            (a += `<div class="service-status-banner-schedule">${escapeHtml(e.schedule_restriction)}</div>`),
        (a += "</div>"),
        a
    );
}
function getSlugFromPath() {
    const e = window.location.pathname.split("/").filter((e) => e.length > 0);
    if (e.length >= 2) {
        const t = e[0];
        if ("ramal" === t || "estacion" === t || "linea" === t || "viaje" === t) return e[1];
    }
    return getUrlParam("slug");
}
function buildCleanUrl(e, t) {
    return t && "undefined" !== t
        ? `/${e}/${t}`
        : (console.error(`buildCleanUrl: Missing or invalid slug for type "${e}"`, {
              slug: t,
              stack: new Error().stack,
          }),
          "#");
}
function buildTrainUrl(e) {
    if (!e || !e.service_id) return console.error("buildTrainUrl: Missing service_id", e), "#";
    if (!e.gerencia)
        return (
            console.warn("buildTrainUrl: Missing gerencia, falling back to UUID-only format", e),
            `/tren/${e.service_id}`
        );
    const t = slugify(e.gerencia),
        n = e.service_number || e.numero;
    let r;
    if (n) r = `${t}-${n}`;
    else {
        r = `${t}-${e.service_id.substring(0, 8)}`;
    }
    return `/tren/${r}`;
}
function getArgentinaDateString(e = new Date()) {
    const t = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(e);
    return `${t.find((e) => "year" === e.type).value}-${t.find((e) => "month" === e.type).value}-${t.find((e) => "day" === e.type).value}`;
}
function getClockEmoji(e, t) {
    const n = e % 12 || 12;
    let r;
    r = t >= 30 ? n - 1 + 128348 : n - 1 + 128336;
    return String.fromCodePoint(r);
}
function updateClock() {
    const e = document.getElementById("clock");
    if (!e) return;
    const t = new Date(),
        n = t.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: !1,
            timeZone: "America/Argentina/Buenos_Aires",
        }),
        r = getClockEmoji(
            parseInt(
                t.toLocaleString("en-US", { hour: "numeric", hour12: !1, timeZone: "America/Argentina/Buenos_Aires" })
            ),
            parseInt(t.toLocaleString("en-US", { minute: "numeric", timeZone: "America/Argentina/Buenos_Aires" }))
        );
    e.textContent = `${r} ${n}`;
}
function initClock() {
    const e = document.getElementById("clock");
    if (!e) return void console.warn("Clock element not found, skipping clock initialization");
    const t = new Date(),
        n = t.getSeconds(),
        r = t.getMilliseconds(),
        i = 5 * Math.floor(n / 5),
        a = new Date(t);
    a.setSeconds(i, 0);
    const o = a.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: !1,
            timeZone: "America/Argentina/Buenos_Aires",
        }),
        s = getClockEmoji(
            parseInt(
                a.toLocaleString("en-US", { hour: "numeric", hour12: !1, timeZone: "America/Argentina/Buenos_Aires" })
            ),
            parseInt(a.toLocaleString("en-US", { minute: "numeric", timeZone: "America/Argentina/Buenos_Aires" }))
        );
    e.textContent = `${s} ${o}`;
    const c = 5 * (Math.floor(n / 5) + 1);
    setTimeout(
        () => {
            updateClock(), setInterval(updateClock, 5e3);
        },
        1e3 * (c - n) - r
    );
}
"undefined" != typeof module &&
    module.exports &&
    (module.exports = { getRouteDisplay: getRouteDisplay, formatRouteDisplay: formatRouteDisplay });
const DISMISSED_ALERTS_KEY = "quetren_dismissed_alerts";
function getEndOfDayTimestamp() {
    const e = new Date(),
        t = e
            .toLocaleString("en-US", {
                timeZone: "America/Argentina/Buenos_Aires",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !1,
            })
            .match(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/);
    if (!t) {
        const t = new Date(e);
        return t.setHours(23, 59, 59, 999), t.getTime();
    }
    const n = parseInt(t[1]) - 1,
        r = parseInt(t[2]),
        i = `${parseInt(t[3])}-${String(n + 1).padStart(2, "0")}-${String(r).padStart(2, "0")}T23:59:59.999-03:00`;
    return new Date(i).getTime();
}
function cleanupExpiredDismissedAlerts() {
    try {
        const e = localStorage.getItem(DISMISSED_ALERTS_KEY);
        if (!e) return;
        const t = JSON.parse(e),
            n = Date.now();
        let r = !1;
        for (const e in t) t[e] < n && (delete t[e], (r = !0));
        r &&
            (0 === Object.keys(t).length
                ? localStorage.removeItem(DISMISSED_ALERTS_KEY)
                : localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(t)));
    } catch (e) {
        console.error("Error cleaning up dismissed alerts:", e), localStorage.removeItem(DISMISSED_ALERTS_KEY);
    }
}
function isAlertDismissed(e) {
    try {
        const t = localStorage.getItem(DISMISSED_ALERTS_KEY);
        if (!t) return !1;
        const n = JSON.parse(t),
            r = n[e];
        return (
            !!r &&
            (r > Date.now() ||
                (delete n[e],
                0 === Object.keys(n).length
                    ? localStorage.removeItem(DISMISSED_ALERTS_KEY)
                    : localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(n)),
                !1))
        );
    } catch (e) {
        return console.error("Error checking dismissed alert:", e), !1;
    }
}
function dismissAlert(e) {
    try {
        const t = localStorage.getItem(DISMISSED_ALERTS_KEY),
            n = t ? JSON.parse(t) : {};
        return (n[e] = getEndOfDayTimestamp()), localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(n)), !0;
    } catch (e) {
        return console.error("Error dismissing alert:", e), !1;
    }
}
function filterDismissedAlerts(e) {
    return e && Array.isArray(e) ? e.filter((e) => !isAlertDismissed(e.id)) : [];
}
function getDismissedAlerts(e) {
    return e && Array.isArray(e) ? e.filter((e) => isAlertDismissed(e.id)) : [];
}
function undismissAlert(e) {
    try {
        const t = localStorage.getItem(DISMISSED_ALERTS_KEY);
        if (!t) return !1;
        const n = JSON.parse(t);
        return (
            !!n[e] &&
            (delete n[e],
            0 === Object.keys(n).length
                ? localStorage.removeItem(DISMISSED_ALERTS_KEY)
                : localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(n)),
            !0)
        );
    } catch (e) {
        return console.error("Error undismissing alert:", e), !1;
    }
}
function undismissAlerts(e) {
    try {
        const t = localStorage.getItem(DISMISSED_ALERTS_KEY);
        if (!t) return !1;
        const n = JSON.parse(t);
        let r = !1;
        return (
            e.forEach((e) => {
                n[e] && (delete n[e], (r = !0));
            }),
            r &&
                (0 === Object.keys(n).length
                    ? localStorage.removeItem(DISMISSED_ALERTS_KEY)
                    : localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(n))),
            r
        );
    } catch (e) {
        return console.error("Error undismissing alerts:", e), !1;
    }
}
let searchDropdownVisible = !1,
    searchSelectedIndex = -1,
    searchResults = [],
    tripModeActive = !1,
    tripOriginStation = null;
function renderSearchResultItem(e) {
    const t = e.type;
    let n = "",
        r = "",
        i = e.name;
    if ("trip" === t) {
        if (!e.origin || !e.destination)
            return DEBUG && console.warn("Malformed trip item missing origin/destination:", e), "";
        const t = "function" == typeof getStationContextName ? getStationContextName(e.origin.name, !0) : e.origin.name,
            n =
                "function" == typeof getStationContextName
                    ? getStationContextName(e.destination.name, !0)
                    : e.destination.name,
            r = e.origin.lines?.[0] || "",
            i = ("undefined" != typeof LINE_COLORS ? LINE_COLORS[r] : null) || DEFAULT_LINE_COLOR;
        return `\n            <div class="search-result-item search-result-trip" data-url="${escapeHtml(e.url)}" role="option" aria-label="Viaje de ${escapeHtml(t)} a ${escapeHtml(n)}" style="border-left-color: ${i};">\n                <div class="search-result-info">\n                    <div class="search-result-name">${escapeHtml(t)} â†’ ${escapeHtml(n)}</div>\n                    <div class="search-result-subtitle">Viaje</div>\n                </div>\n            </div>\n        `;
    }
    if (
        ((i = "station" === t && "function" == typeof getStationDisplayName ? getStationDisplayName(e.name) : e.name),
        "station" === t)
    ) {
        if (
            ((n = "EstaciÃ³n"),
            e.matchedAlias && (r = `coincide: ${e.matchedAlias}`),
            e.closedOnRamales && e.closedOnRamales.length > 0)
        ) {
            r =
                e.closedOnRamales.length === e.routes.length
                    ? r
                        ? `${r} â€¢ Cerrada`
                        : "Cerrada"
                    : r
                      ? `${r} â€¢ Cerrada parcial`
                      : "Cerrada parcial";
        }
    } else
        "line" === t
            ? ((n = "LÃ­nea"), (r = e.description || ""))
            : "route" === t && ((n = "Ramal"), (r = e.lineName || ""));
    let a = "";
    if ("station" === t && e.lines && e.lines.length > 0) {
        a = `<div class="search-badges">${e.lines
            .map((e) => {
                const t =
                    ("undefined" != typeof LINE_ABBREVIATIONS ? LINE_ABBREVIATIONS[e] : null) ||
                    e.substring(0, 2).toUpperCase();
                return `<span class="search-line-badge" style="background-color: ${("undefined" != typeof LINE_COLORS ? LINE_COLORS[e] : null) || "#666"};">${escapeHtml(t)}</span>`;
            })
            .join("")}</div>`;
    } else
        e.badge &&
            ("line" === t
                ? (a = renderBadge(e.name, e.badge))
                : "route" === t && (a = renderBadge(e.lineName, e.badge)));
    return `\n        <div class="search-result-item" data-url="${escapeHtml(e.url)}">\n            ${a}\n            <div class="search-result-info">\n                <div class="search-result-name">${escapeHtml(i)}</div>\n                <div class="search-result-subtitle">${escapeHtml(n)}${r ? ` â€¢ ${escapeHtml(r)}` : ""}</div>\n            </div>\n        </div>\n    `;
}
function buildQuickViajesBlockHtml(e) {
    if (!e || "station" !== e.type) return "";
    if ("function" != typeof getReachableTerminals || "function" != typeof getSearchData) return "";
    const t = getSearchData();
    if (!t) return "";
    const n = getReachableTerminals(e, t, 5);
    if (0 === n.length) return "";
    const r = e.url ? e.url.replace("/estacion/", "") : "";
    if (!r) return "";
    const i = "function" == typeof getStationDisplaySlug ? getStationDisplaySlug(r) : r;
    if (!i) return "";
    const a =
            "function" == typeof getStationContextName
                ? getStationContextName(e.name, !0)
                : "function" == typeof getStationDisplayName
                  ? getStationDisplayName(e.name)
                  : e.name,
        o = n
            .map((e) => {
                const t = "function" == typeof getStationDisplaySlug ? getStationDisplaySlug(e.slug) : e.slug;
                if (!t) return "";
                const n = `/viaje/${i}--a--${t}`,
                    r =
                        "function" == typeof getStationContextName
                            ? getStationContextName(e.name, !0)
                            : "function" == typeof getStationDisplayName
                              ? getStationDisplayName(e.name)
                              : e.name,
                    o = `Viaje desde ${a} a ${r}`,
                    s = e.lineName && "function" == typeof getLineColor ? getLineColor(e.lineName) : null,
                    c = s ? ` style="--line-color: ${escapeHtml(s)}"` : "";
                return `\n                <div class="search-result-item search-quick-viaje" data-url="${escapeHtml(n)}" role="option" aria-label="${escapeHtml(o)}"${c}>\n                    <div class="search-result-info">\n                        <div class="search-result-name">â†’ ${escapeHtml(r)}</div>\n                        <div class="search-result-subtitle">Viaje</div>\n                    </div>\n                </div>\n            `;
            })
            .join("");
    return `\n        <div class="search-section-header" role="presentation">Viajes desde ${escapeHtml(a)}</div>\n        ${o}\n    `;
}
function showSearchDropdown(e, t = !1) {
    const n = document.getElementById("search-dropdown");
    if (!n) return;
    if (0 === e.length)
        return void (t
            ? (n.classList.remove("visible"), (searchDropdownVisible = !1))
            : ((n.innerHTML = '<div class="search-no-results">No se encontraron resultados</div>'),
              n.classList.add("visible"),
              (searchDropdownVisible = !0)));
    let r = "";
    if (
        (t && (r += '<div class="search-section-header">BÃºsquedas recientes</div>'),
        e.forEach((e) => {
            r += renderSearchResultItem(e);
        }),
        !t)
    ) {
        const t = e.filter((e) => e && "station" === e.type);
        if (1 === t.length) {
            const e = buildQuickViajesBlockHtml(t[0]);
            e && (r += e);
        }
    }
    t && e.length > 0 && (r += '<div class="search-clear-recent">Limpiar historial</div>'),
        (n.innerHTML = r),
        n.classList.add("visible"),
        (searchDropdownVisible = !0),
        (searchSelectedIndex = -1);
    n.querySelectorAll(".search-result-item").forEach((t, n) => {
        t.addEventListener("click", () => {
            const r = t.getAttribute("data-url");
            r &&
                ("function" == typeof addRecentSearch && n < e.length && e[n] && addRecentSearch(e[n]),
                (window.location.href = r));
        });
    });
    const i = n.querySelector(".search-clear-recent");
    i &&
        i.addEventListener("click", () => {
            "function" == typeof clearRecentSearches && clearRecentSearches(), hideSearchDropdown();
        });
}
function hideSearchDropdown() {
    const e = document.getElementById("search-dropdown");
    e && (e.classList.remove("visible"), (searchDropdownVisible = !1), (searchSelectedIndex = -1));
}
function handleSearchInput(e) {
    const t = e.target.value.trim();
    if (tripModeActive) 0 === t.length ? showTripModeDropdown() : handleTripModeSearch(t);
    else if (0 !== t.length) {
        if ("function" == typeof detectTripQuery) {
            const e = detectTripQuery(t);
            if (e && "function" == typeof searchTrips) {
                const n = searchTrips(e.originQuery, e.destQuery);
                if (n.length > 0) {
                    const e = "function" == typeof search ? search(t, 6 - n.length) : [];
                    return (searchResults = [...n, ...e]), void showSearchDropdown(searchResults, !1);
                }
            }
        }
        if ("function" == typeof search) {
            const e = performance.now(),
                n = search(t, 8);
            debugLog(`Search took ${(performance.now() - e).toFixed(2)}ms`),
                (searchResults = n),
                showSearchDropdown(n, !1);
        }
    } else showFavoritesAndRecent();
}
function showFavoritesAndRecent() {
    const e = document.getElementById("search-dropdown");
    if (!e) return;
    let t = "";
    const n = [],
        r = "function" == typeof getFavorites ? getFavorites() : [];
    r.length > 0 &&
        ((t += '<div class="search-section-header">Favoritos</div>'),
        r.forEach((e) => {
            const r = convertFavoriteToSearchResult(e);
            r && (n.push(r), (t += renderSearchResultItem(r)));
        }));
    const i = "function" == typeof getRecentSearches ? getRecentSearches() : [];
    if (
        (i.length > 0 &&
            ((t += '<div class="search-section-header">BÃºsquedas recientes</div>'),
            i.forEach((e) => {
                n.push(e), (t += renderSearchResultItem(e));
            }),
            (t += '<div class="search-clear-recent">Limpiar historial</div>')),
        0 === n.length)
    )
        return e.classList.remove("visible"), void (searchDropdownVisible = !1);
    (searchResults = n),
        (e.innerHTML = t),
        e.classList.add("visible"),
        (searchDropdownVisible = !0),
        (searchSelectedIndex = -1);
    e.querySelectorAll(".search-result-item").forEach((e, t) => {
        e.addEventListener("click", () => {
            const i = e.getAttribute("data-url");
            if (i) {
                const e = window.location.pathname;
                if (e === i || e === `${i}/` || `${e}/` === i)
                    return hideSearchDropdown(), void document.getElementById("search-input")?.blur();
                if (isSameParentEntity(e, i))
                    return (
                        t >= r.length && "function" == typeof addRecentSearch && addRecentSearch(n[t]),
                        history.pushState(null, "", i),
                        window.dispatchEvent(new PopStateEvent("popstate")),
                        hideSearchDropdown(),
                        void document.getElementById("search-input")?.blur()
                    );
                t >= r.length && "function" == typeof addRecentSearch && addRecentSearch(n[t]),
                    (window.location.href = i);
            }
        });
    });
    const a = e.querySelector(".search-clear-recent");
    a &&
        a.addEventListener("click", () => {
            "function" == typeof clearRecentSearches && clearRecentSearches(), showFavoritesAndRecent();
        });
}
function convertFavoriteToSearchResult(e) {
    if (e.type === FAVORITE_TYPE.STATION) {
        const t = e.slug || e.id;
        let n = `/estacion/${"function" == typeof getStationDisplaySlug ? getStationDisplaySlug(t) : t}`;
        const r = e.direction || "all",
            i = "all" !== r && "both" !== r;
        if (i) {
            n += `/sentido-${slugify(r)}`;
        }
        return {
            type: "station",
            name: i ? `${e.name} â†’ ${"function" == typeof getStationShortName ? getStationShortName(r) : r}` : e.name,
            url: n,
            lines: e.gerencia ? [e.gerencia] : [],
        };
    }
    if (e.type === FAVORITE_TYPE.ROUTE) {
        return {
            type: "route",
            name: `${e.origin?.name || "Origen"} â†’ ${e.destination?.name || "Destino"}`,
            url: `/viaje/${e.origin?.slug || ""}--a--${e.destination?.slug || ""}`,
            lineName: e.gerencia,
        };
    }
    return null;
}
function handleSearchKeyDown(e) {
    if ("Escape" === e.key)
        return tripModeActive
            ? (e.preventDefault(), void exitTripMode())
            : searchDropdownVisible
              ? (e.preventDefault(), hideSearchDropdown(), void e.target.blur())
              : void e.target.blur();
    if (!searchDropdownVisible) return;
    const t = document.getElementById("search-dropdown");
    if (!t) return;
    const n = t.querySelectorAll(".search-result-item");
    if (0 !== n.length)
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault(),
                    (searchSelectedIndex = Math.min(searchSelectedIndex + 1, n.length - 1)),
                    updateSearchSelection(n);
                break;
            case "ArrowUp":
                e.preventDefault(),
                    (searchSelectedIndex = Math.max(searchSelectedIndex - 1, -1)),
                    updateSearchSelection(n);
                break;
            case "Enter":
                if ((e.preventDefault(), searchSelectedIndex < 0)) {
                    const e = t.querySelector(".search-result-item");
                    if (e) {
                        const t = e.getAttribute("data-url");
                        if (tripModeActive) {
                            const e = searchResults[0];
                            e && tripOriginStation && navigateToTrip(tripOriginStation, e);
                        } else
                            t &&
                                ("function" == typeof addRecentSearch &&
                                    searchResults.length > 0 &&
                                    addRecentSearch(searchResults[0]),
                                (window.location.href = t));
                    }
                } else if (searchSelectedIndex < n.length) {
                    const e = n[searchSelectedIndex];
                    if (tripModeActive) {
                        const n = t.querySelectorAll(".search-result-item"),
                            r = Array.from(n).indexOf(e);
                        if (r >= 0 && r < searchResults.length) {
                            const e = searchResults[r];
                            e && tripOriginStation && navigateToTrip(tripOriginStation, e);
                        }
                    } else {
                        const n = e.getAttribute("data-url");
                        if (n) {
                            const r = t.querySelectorAll(".search-result-item"),
                                i = Array.from(r).indexOf(e);
                            "function" == typeof addRecentSearch &&
                                i >= 0 &&
                                i < searchResults.length &&
                                searchResults[i] &&
                                addRecentSearch(searchResults[i]),
                                (window.location.href = n);
                        }
                    }
                }
                break;
            case "Tab":
                tripModeActive ? (e.preventDefault(), exitTripMode()) : hideSearchDropdown();
        }
}
function updateSearchSelection(e) {
    e.forEach((e, t) => {
        t === searchSelectedIndex
            ? (e.classList.add("selected"), e.scrollIntoView({ block: "nearest" }))
            : e.classList.remove("selected");
    });
}
function enterTripMode(e) {
    (tripModeActive = !0), (tripOriginStation = e);
    const t = document.getElementById("search-input");
    t && ((t.value = ""), (t.placeholder = `Destino desde ${getStationShortName(e.name)}...`), t.focus()),
        showTripModeDropdown(),
        debugLog("Entered trip mode with origin:", e.name);
}
function exitTripMode() {
    (tripModeActive = !1), (tripOriginStation = null);
    const e = document.getElementById("search-input");
    e && ((e.value = ""), (e.placeholder = "Buscar estaciÃ³n, viaje, lÃ­nea o ramal...")),
        hideSearchDropdown(),
        debugLog("Exited trip mode");
}
function showTripModeDropdown() {
    const e = document.getElementById("search-dropdown");
    if (!e || !tripOriginStation) return;
    const t = getStationDisplayName(tripOriginStation.name),
        n = getStationShortName(tripOriginStation.name),
        r = `\n        <div class="search-trip-header">\n            <div class="search-trip-origin">\n                <span class="search-trip-label">Origen:</span>\n                <span class="search-trip-station">${escapeHtml(t)}</span>\n            </div>\n            <button class="search-trip-cancel" aria-label="Cancelar planificaciÃ³n de viaje">âœ•</button>\n        </div>\n        <div class="search-section-header">BuscÃ¡ tu destino o seleccionÃ¡:</div>\n        <div class="search-result-item search-trip-go-station" data-url="/estacion/${escapeHtml(getStationDisplaySlug(tripOriginStation.slug || tripOriginStation.id))}">\n            <div class="search-result-info">\n                <div class="search-result-name">Ir a ${escapeHtml(n)}</div>\n                <div class="search-result-subtitle">Ver todos los trenes de la estaciÃ³n</div>\n            </div>\n        </div>\n    `;
    (e.innerHTML = r),
        e.classList.add("visible"),
        (searchDropdownVisible = !0),
        (searchSelectedIndex = -1),
        (searchResults = []);
    const i = e.querySelector(".search-trip-cancel");
    i &&
        i.addEventListener("click", (e) => {
            e.preventDefault(), e.stopPropagation(), exitTripMode();
        });
    const a = e.querySelector(".search-trip-go-station");
    a &&
        a.addEventListener("click", () => {
            const e = a.getAttribute("data-url");
            e && (window.location.href = e);
        });
}
function handleTripModeSearch(e) {
    const t = document.getElementById("search-dropdown");
    if (!t || !tripOriginStation) return;
    if ("function" != typeof search) return;
    const n = search(e, 15),
        r = new Set(
            (tripOriginStation.routes || tripOriginStation.ramales || []).map((e) =>
                "string" == typeof e ? e : e.slug || e.nombre || e
            )
        ),
        i = tripOriginStation.slug || tripOriginStation.id,
        a = n
            .filter((e) => {
                if ("station" !== e.type) return !1;
                if ((e.url?.replace("/estacion/", "") || e.id) === i) return !1;
                const t = e.routes || [];
                return 0 === r.size || 0 === t.length || t.some((e) => r.has(e));
            })
            .slice(0, 8);
    let o = `\n        <div class="search-trip-header">\n            <div class="search-trip-origin">\n                <span class="search-trip-label">Origen:</span>\n                <span class="search-trip-station">${escapeHtml(getStationDisplayName(tripOriginStation.name))}</span>\n            </div>\n            <button class="search-trip-cancel" aria-label="Cancelar planificaciÃ³n de viaje">âœ•</button>\n        </div>\n    `;
    0 === a.length
        ? (o += '<div class="search-no-results">No se encontraron destinos</div>')
        : ((o += '<div class="search-section-header">Destinos disponibles</div>'),
          a.forEach((e) => {
              o += renderSearchResultItem({ ...e, isDestination: !0 });
          })),
        (t.innerHTML = o),
        t.classList.add("visible"),
        (searchDropdownVisible = !0),
        (searchSelectedIndex = -1),
        (searchResults = a);
    const s = t.querySelector(".search-trip-cancel");
    s &&
        s.addEventListener("click", (e) => {
            e.preventDefault(), e.stopPropagation(), exitTripMode();
        });
    t.querySelectorAll(".search-result-item").forEach((e, t) => {
        e.addEventListener("click", () => {
            const e = a[t];
            e && navigateToTrip(tripOriginStation, e);
        });
    });
}
function navigateToTrip(e, t) {
    const n = `/viaje/${getStationDisplaySlug(e.slug || e.id)}--a--${t.url?.replace("/estacion/", "") || getStationDisplaySlug(t.slug || t.id)}`;
    window.location.href = n;
}
function isTripModeActive() {
    return tripModeActive;
}
function getTripOrigin() {
    return tripOriginStation;
}
function initSearch() {
    const e = document.getElementById("search-input"),
        t = document.getElementById("search-container");
    e && t
        ? (e.addEventListener("input", handleSearchInput),
          e.addEventListener("keydown", handleSearchKeyDown),
          e.addEventListener(
              "focus",
              () => {
                  "function" == typeof ensureSearchIndex && ensureSearchIndex();
              },
              { once: !0 }
          ),
          e.addEventListener("focus", () => {
              0 === e.value.trim().length && showFavoritesAndRecent();
          }),
          document.addEventListener("click", (e) => {
              t.contains(e.target) || hideSearchDropdown();
          }),
          window.addEventListener("popstate", () => {
              tripModeActive ? exitTripMode() : ((e.value = ""), hideSearchDropdown());
          }),
          debugLog("Search initialized"))
        : console.warn("Search elements not found, skipping search initialization");
}
function getStationDisplayName(e) {
    return e ? STATION_DISPLAY_NAMES[e] || e : "";
}
function getStationContextName(e, t) {
    if (!e) return "";
    const n = getStationDisplayName(e);
    return t && "undefined" != typeof STATION_CONTEXT_STRIP_PARENS && STATION_CONTEXT_STRIP_PARENS.includes(e)
        ? n.replace(/\s*\([^)]*\)$/, "")
        : n;
}
function getStationShortName(e) {
    if (!e) return "";
    const t = STATION_DISPLAY_NAMES[e] || e;
    return STATION_SHORT_NAMES[t] || STATION_SHORT_NAMES[e] || t;
}
function resolveStationSlug(e) {
    return e ? STATION_SLUG_ALIASES[e] || e : "";
}
function getStationDisplaySlug(e) {
    return e ? STATION_DISPLAY_SLUGS[e] || e : "";
}
function getLineColor(e) {
    if (!e) return "#9e9e9e";
    const t = e.trim();
    if (LINE_COLORS[t]) return LINE_COLORS[t];
    const n = t.toLowerCase();
    for (const [e, t] of Object.entries(LINE_COLORS)) if (e.toLowerCase() === n) return t;
    return debugLog(`Warning: No color found for line "${e}"`), "#9e9e9e";
}
function getLineAbbreviation(e, t = !1) {
    if (!e) return "";
    if (!t) return e;
    const n = e.trim();
    if (LINE_ABBREVIATIONS[n]) return LINE_ABBREVIATIONS[n];
    const r = n.toLowerCase();
    for (const [e, t] of Object.entries(LINE_ABBREVIATIONS)) if (e.toLowerCase() === r) return t;
    return debugLog(`Warning: No abbreviation found for line "${e}", using fallback`), n.substring(0, 2).toUpperCase();
}
function isTerminalStation(e) {
    if (!e) return !1;
    const t = e.trim().toLowerCase();
    for (const e of TERMINAL_STATIONS) if (e.toLowerCase() === t) return !0;
    return !1;
}
function getRamalTerminals(e) {
    if (!e || !e.stations || 0 === e.stations.length) return { left: "", right: "" };
    const t = (e) => e.seq ?? e.orden ?? 1 / 0,
        n = [...e.stations].sort((e, n) => t(e) - t(n));
    return { left: n[0]?.nombre || "", right: n[n.length - 1]?.nombre || "" };
}
function terminalsMatch(e, t) {
    return (
        !(!e || !t) &&
        (e === t ||
            !!e.startsWith(`${t} `) ||
            !!t.startsWith(`${e} (`) ||
            !("Buenos Aires" !== t || !e.includes("SÃ¡enz Viad")) ||
            !("Buenos Aires" !== e || !t.includes("SÃ¡enz Viad")))
    );
}
function extractTrainDestination(e) {
    let t = e.destination;
    if (e.direction) {
        const n = e.direction.match(/(?:â†’|â†)\s*a\s+(.+)/);
        n && n[1] && (t = n[1].trim());
    }
    return t || null;
}
function formatDirection(e) {
    if (!e || "string" != typeof e) return "";
    return `SENTIDO ${getStationContextName(e, !0).toUpperCase()}`;
}
const RELATIVE_TIME_CACHE_TTL_MS = 2e4,
    _formatRelativeTimeCache = new Map();
let _formatRelativeTimeCacheExpiry = 0;
function formatRelativeTime(e) {
    if (!e) return { relative: "", absolute: "", minutesUntil: null };
    const t = new Date().getTime();
    t > _formatRelativeTimeCacheExpiry &&
        (_formatRelativeTimeCache.clear(), (_formatRelativeTimeCacheExpiry = t + 2e4));
    const n = e instanceof Date ? e.getTime() : new Date(e).getTime(),
        r = isNaN(n) ? e : Math.floor(n / 6e4);
    if (_formatRelativeTimeCache.has(r)) return _formatRelativeTimeCache.get(r);
    const i = e instanceof Date ? e : new Date(e);
    if (isNaN(i.getTime())) {
        const e = { relative: "", absolute: "", minutesUntil: null };
        return _formatRelativeTimeCache.set(r, e), e;
    }
    const a = i.getTime() - t,
        o = Math.floor(a / 6e4);
    let s, c;
    try {
        s = new Intl.DateTimeFormat("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
            hour: "2-digit",
            minute: "2-digit",
            hour12: !1,
        }).format(i);
    } catch {
        s = i.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: !1 });
    }
    if (o < 0) c = "SaliÃ³";
    else if (0 === o) c = "Ahora";
    else if (1 === o) c = "en 1 min";
    else if (o < 60) c = `en ${o} min`;
    else {
        const e = Math.floor(o / 60),
            t = o % 60;
        c = 0 === t ? (1 === e ? "en 1 h" : `en ${e} h`) : `en ${e} h ${t} min`;
    }
    const l = { relative: c, absolute: s, minutesUntil: o };
    return _formatRelativeTimeCache.set(r, l), l;
}
function renderStatusBadge(e, t) {
    if (!e || "string" != typeof e) return "";
    const n = getStatusClass(e),
        r = e.toLowerCase();
    let i;
    return (
        (i =
            r.includes("en hora") || r.includes("a tiempo")
                ? "En hora"
                : r.includes("demorado") || r.includes("dem")
                  ? t && t > 0
                      ? `Demorado ${t} min`
                      : "Demorado"
                  : r.includes("adelantado") || r.includes("adel")
                    ? "Adelantado"
                    : r.includes("cancelado")
                      ? "Cancelado"
                      : r.includes("abordando")
                        ? "Abordando"
                        : r.includes("partiÃ³") || r.includes("saliÃ³")
                          ? "SaliÃ³"
                          : r.includes("en marcha")
                            ? "En marcha"
                            : e),
        `<span class="status-badge ${n}">${escapeHtml(i)}</span>`
    );
}
function formatTimeDisplay(e, t = {}) {
    const { compact: n = !1 } = t,
        { relative: r, absolute: i, minutesUntil: a } = formatRelativeTime(e);
    if (!i) return "";
    let o = "";
    null !== a && (0 === a ? (o = ' data-status="now"') : a < 0 && (o = ' data-status="departed"'));
    const s = n ? " time-display-compact" : "",
        c = null !== a ? `<span class="time-relative"${o}>${escapeHtml(r)}</span>` : "";
    return `<span class="time-display${s}"><span class="time-absolute">${escapeHtml(i)}</span>${c}</span>`;
}
function formatDirectionArrow(e, t) {
    if (!t || "string" != typeof t) return "";
    return `${"left" === e ? "â†" : "â†’"} sentido ${getStationContextName(t, !0)}`;
}
function formatTimeForDisplay(e) {
    if (!e) return "";
    if (5 === e.length && e.match(/^\d{2}:\d{2}$/)) return e;
    let t = e;
    if (14 === e.length && (e.includes("-03:00") || e.includes("+00:00"))) {
        t = `${new Date().toISOString().split("T")[0]}T${e}`;
    }
    const n = new Date(t);
    if (isNaN(n.getTime())) return e;
    try {
        const t = new Intl.DateTimeFormat("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                hour: "2-digit",
                minute: "2-digit",
                hour12: !1,
            }).formatToParts(n),
            r = t.find((e) => "hour" === e.type)?.value,
            i = t.find((e) => "minute" === e.type)?.value;
        return r && i ? `${r}:${i}` : (console.warn("Failed to extract time components, using original string:", e), e);
    } catch (t) {
        return console.error("Error formatting time:", t), e;
    }
}
function formatTimeWithFractions(e) {
    if (!e) return "??:??";
    let t = e;
    if (!e.includes("T")) {
        t = `${new Date().toISOString().split("T")[0]}T${e}`;
    }
    const n = new Date(t);
    if (isNaN(n.getTime())) return e;
    try {
        const t = new Intl.DateTimeFormat("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !1,
            }).formatToParts(n),
            r = t.find((e) => "hour" === e.type)?.value,
            i = t.find((e) => "minute" === e.type)?.value,
            a = parseInt(t.find((e) => "second" === e.type)?.value || "0");
        if (!r || !i) return console.warn("Failed to extract time components, using original string:", e), e;
        let o = "";
        return a >= 45 ? (o = "â€¯Â¾") : a >= 30 ? (o = "â€¯Â½") : a >= 15 && (o = "â€¯Â¼"), `${r}:${i}${o}`;
    } catch (t) {
        return console.error("Error formatting time:", t), e;
    }
}
function parseTimeToday(e) {
    if (!e) return null;
    try {
        if (e.includes("T") && /^\d{4}-\d{2}-\d{2}T/.test(e)) {
            const t = new Date(e);
            return isNaN(t.getTime()) ? (debugLog("parseTimeToday: Invalid full datetime:", e), null) : t;
        }
        const t = e.split("T").pop(),
            n = `${new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })}T${t}`,
            r = new Date(n);
        return isNaN(r.getTime()) ? (debugLog("parseTimeToday: Invalid legacy time format:", e), null) : r;
    } catch (t) {
        return debugLog("parseTimeToday: Parse error for", e, t), null;
    }
}
function isTimeInPast(e) {
    if (!e) return !1;
    const t = parseTimeToday(e);
    if (!t) return !1;
    return t < new Date();
}
function getCurrentOrNextStation(e) {
    if (!e.paradas || 0 === e.paradas.length) return null;
    const t = new Date();
    for (let n = 0; n < e.paradas.length; n++) {
        const r = e.paradas[n],
            i = r.predicted || r.scheduled;
        if (!i) continue;
        const a = new Date(i);
        if (a > t) {
            if (0 === n) return { type: "waiting", station: r.estacion };
            {
                const t = e.paradas[n - 1];
                return { type: "next", station: r.estacion, from: t.estacion };
            }
        }
        if (0 === n && t - a < 3e5) return { type: "waiting", station: r.estacion };
    }
    return { type: "arrived", station: e.paradas[e.paradas.length - 1].estacion };
}
function getFilteredTrainCount(e) {
    if (!e || 0 === e.length) return 0;
    const t = {};
    e.forEach((e) => {
        const n = e.terminus || e.destination || `service_${e.service_id || e.id}`;
        t[n] || (t[n] = { inTransit: [], waiting: [] });
        const r = getCurrentOrNextStation(e);
        "waiting" === r?.type ? t[n].waiting.push(e) : t[n].inTransit.push(e);
    });
    let n = 0;
    return (
        Object.values(t).forEach((e) => {
            (n += e.inTransit.length), (n += Math.min(1, e.waiting.length));
        }),
        n
    );
}
function calculateTrainPosition(e, t) {
    if (!e || !t || 0 === t.length) return null;
    const n = new Date(),
        r = e.paradas || [];
    if (0 === r.length)
        return {
            position_percent: 0,
            status: "unknown",
            currentStationIndex: -1,
            between: null,
            estimatedLocation: "Position unknown",
        };
    let i = -1,
        a = -1;
    for (let e = 0; e < r.length; e++) {
        const t = r[e],
            o = parseTimeToday(t.scheduled),
            s = parseTimeToday(t.predicted) || o;
        if (s && n < s) {
            (a = e), (i = e > 0 ? e - 1 : 0);
            break;
        }
    }
    if (-1 === a)
        return {
            position_percent: 100,
            status: "completed",
            currentStationIndex: r.length - 1,
            between: null,
            estimatedLocation: `At ${r[r.length - 1].estacion || "final station"}`,
        };
    if (-1 === i || 0 === i) {
        const e = parseTimeToday(r[0].predicted) || parseTimeToday(r[0].scheduled);
        if (e && n < e)
            return {
                position_percent: 0,
                status: "not-started",
                currentStationIndex: 0,
                between: null,
                estimatedLocation: `Not started - departs ${r[0].estacion || "first station"}`,
            };
    }
    const o = r[i],
        s = r[a],
        c = parseTimeToday(o.predicted) || parseTimeToday(o.scheduled),
        l = parseTimeToday(s.predicted) || parseTimeToday(s.scheduled);
    if (!c || !l)
        return {
            position_percent: 0,
            status: "unknown",
            currentStationIndex: i,
            between: null,
            estimatedLocation: "Position data unavailable",
        };
    const u = l - c,
        d = n - c,
        m = Math.max(0, Math.min(1, d / u)),
        g = r.length,
        f = 100 * (i / g + m / g);
    return {
        position_percent: Math.max(0, Math.min(100, f)),
        status: "between-stations",
        currentStationIndex: i,
        between: [o.estacion || "Unknown", s.estacion || "Unknown"],
        estimatedLocation: `Between ${o.estacion || "station"} and ${s.estacion || "station"}`,
    };
}
function detectTerminals(e) {
    if (!e || !e.estaciones || 0 === e.estaciones.length) return [];
    const t = [],
        n = e.estaciones,
        r = [...n].sort(
            (e, t) =>
                (void 0 !== e.seq ? e.seq : void 0 !== e.orden ? e.orden : 0) -
                (void 0 !== t.seq ? t.seq : void 0 !== t.orden ? t.orden : 0)
        );
    return (
        r.length > 0 && (t.push(r[0].nombre), r.length > 1 && t.push(r[r.length - 1].nombre)),
        n.forEach((e) => {
            e.es_cabecera && t.push(e.nombre);
        }),
        n.forEach((e) => {
            isTerminalStation(e.nombre) && t.push(e.nombre);
        }),
        [...new Set(t)]
    );
}
function generateFriendlySlug(e) {
    if (!e) return "unknown";
    if (e.gerencia && e.numero_servicio) {
        return `${getLineAbbreviation(e.gerencia, !0).toLowerCase()}-${e.numero_servicio}`;
    }
    if (e.equipment_id) return e.equipment_id.toLowerCase().replace(/[^a-z0-9]/g, "-");
    if (e.gerencia && e.service_id) {
        const t = getLineAbbreviation(e.gerencia, !0),
            n = e.service_id.substring(0, 8);
        return `${t.toLowerCase()}-${n}`;
    }
    return e.service_id ? e.service_id : "unknown";
}
function truncateTitle(e, t = 60) {
    if (!e || e.length <= t) return e || "QuÃ©Tren - Horarios de trenes en tiempo real";
    const n = " - Horarios de trenes en tiempo real";
    if (e.includes(n)) {
        const r = e.replace(n, "");
        if (r.length <= t) return r;
        e = r;
    }
    const r = "... - QuÃ©Tren";
    if (e.length > t) {
        const n = t - 13;
        return e.substring(0, n) + r;
    }
    return e;
}
function updatePageMetadata(e, t, n) {
    if (!e || "" === e.trim()) return void debugLog("SEO: Skipping metadata update - empty title");
    const r = truncateTitle(e);
    (document.title = r), debugLog(`SEO: Updated page title to "${r}" (${r.length} chars)`);
    const i = document.querySelector('meta[property="og:title"]');
    i && (i.setAttribute("content", r), debugLog("SEO: Updated og:title"));
    const a = document.querySelector('meta[name="twitter:title"]');
    a && (a.setAttribute("content", r), debugLog("SEO: Updated twitter:title"));
    let o = document.querySelector('meta[name="description"]');
    if (
        (o ||
            ((o = document.createElement("meta")),
            o.setAttribute("name", "description"),
            document.head.appendChild(o),
            debugLog("SEO: Created new meta description tag")),
        t && "" !== t.trim())
    ) {
        t.length > 160 &&
            debugLog(
                `SEO: Warning - meta description exceeds recommended length (${t.length} chars, optimal: 150-160)`
            ),
            o.setAttribute("content", t),
            debugLog(`SEO: Updated meta description (${t.length} chars)`);
        const e = document.querySelector('meta[property="og:description"]');
        e && (e.setAttribute("content", t), debugLog("SEO: Updated og:description"));
        const n = document.querySelector('meta[name="twitter:description"]');
        n && (n.setAttribute("content", t), debugLog("SEO: Updated twitter:description"));
    }
    if (n && "object" == typeof n) {
        if ("string" == typeof n.canonicalPath && n.canonicalPath.length > 0) {
            const e = buildCanonicalUrl(n.canonicalPath),
                t = document.getElementById("canonical");
            t && (t.setAttribute("href", e), debugLog(`SEO: Updated canonical to ${e}`));
            const r = document.querySelector('meta[property="og:url"]');
            r && (r.setAttribute("content", e), debugLog("SEO: Updated og:url"));
        }
        if ("boolean" == typeof n.indexable) {
            const e = document.getElementById("robots-meta");
            e &&
                (e.setAttribute("content", n.indexable ? "all" : "noindex"),
                debugLog("SEO: Updated robots meta to " + (n.indexable ? "all" : "noindex")));
        }
    }
}
function buildCanonicalUrl(e) {
    const t = ("undefined" != typeof window && window.location && window.location.origin) || "https://quetren.com";
    return e && "string" == typeof e ? t + (e.startsWith("/") ? e : "/" + e) : t + "/";
}
function addNoIndexMeta() {
    let e = document.querySelector('meta[name="robots"]');
    if (e) {
        "noindex" !== (e.getAttribute("content") || "")
            ? (e.setAttribute("content", "noindex"), debugLog("SEO: Updated robots meta to noindex"))
            : debugLog("SEO: noindex already present, skipping");
    } else
        (e = document.createElement("meta")),
            e.setAttribute("name", "robots"),
            e.setAttribute("content", "noindex"),
            document.head.appendChild(e),
            debugLog("SEO: Added noindex meta tag");
}
function injectBreadcrumbJsonLd(e) {
    const t = document.querySelector('script[type="application/ld+json"][data-breadcrumb]');
    t && t.remove();
    const n = document.createElement("script");
    (n.type = "application/ld+json"),
        n.setAttribute("data-breadcrumb", "true"),
        (n.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: e.map(function (e, t) {
                const n = { "@type": "ListItem", position: t + 1, name: e.name };
                return e.url && (n.item = e.url), n;
            }),
        })),
        document.head.appendChild(n);
}
function parseTrainSlug(e, t) {
    if (!e || !t || !t.servicios) return null;
    let n = null;
    if (e.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
        n = t.servicios.find((t) => t.service_id === e);
    else {
        const r = e.split("-");
        for (let e = r.length - 1; e >= 1; e--) {
            const i = r.slice(0, e).join("-"),
                a = r.slice(e).join("-"),
                o = parseInt(a, 10);
            if (!isNaN(o) && ((n = t.servicios.find((e) => slugify(e.gerencia) === i && e.service_number === o)), n))
                break;
            if (!n && ((n = t.servicios.find((e) => slugify(e.gerencia) === i && e.service_id.startsWith(a))), n))
                break;
        }
    }
    return n;
}
const VISIT_COUNT_KEY = "quetren_visit_count",
    VISIT_COUNT_SESSION_STAMP = "quetren_visit_counted",
    VISITS_BEFORE_PROMOTIONAL = 2;
function getVisitCount() {
    try {
        const e = localStorage.getItem(VISIT_COUNT_KEY);
        if (!e) return 0;
        const t = parseInt(e, 10);
        return !Number.isFinite(t) || t < 0 ? 0 : t;
    } catch {
        return 0;
    }
}
function incrementVisitCount() {
    try {
        if (sessionStorage.getItem("quetren_visit_counted")) return;
    } catch {
        return;
    }
    try {
        sessionStorage.setItem("quetren_visit_counted", "1");
    } catch {
        return;
    }
    try {
        const e = getVisitCount();
        localStorage.setItem(VISIT_COUNT_KEY, String(e + 1));
    } catch {}
}
"undefined" != typeof document &&
    ("loading" === document.readyState
        ? document.addEventListener("DOMContentLoaded", incrementVisitCount, { once: !0 })
        : incrementVisitCount());
const FAVORITES_KEY = "quetren_favorites",
    FAVORITE_TYPE = { STATION: "station", ROUTE: "route", RAMAL: "ramal", LINE: "line" };
function getFavorites() {
    try {
        const e = localStorage.getItem(FAVORITES_KEY);
        if (!e) return [];
        return JSON.parse(e).sort((e, t) => (t.addedAt || 0) - (e.addedAt || 0));
    } catch (e) {
        console.warn("Error reading favorites, clearing corrupted data:", e);
        try {
            localStorage.removeItem(FAVORITES_KEY);
        } catch {}
        return [];
    }
}
function addFavorite(e, t) {
    if (![FAVORITE_TYPE.STATION, FAVORITE_TYPE.ROUTE, FAVORITE_TYPE.RAMAL, FAVORITE_TYPE.LINE].includes(e))
        return { success: !1, error: "INVALID_TYPE" };
    try {
        const n = getFavorites();
        let r;
        if (e === FAVORITE_TYPE.STATION) {
            if (!t.id || !t.name || !t.gerencia) return { success: !1, error: "INVALID_DATA" };
            r = {
                type: FAVORITE_TYPE.STATION,
                id: t.id,
                name: t.name,
                gerencia: t.gerencia,
                direction: t.direction || "all",
                slug: t.slug || t.id,
                terminals: t.terminals || null,
                addedAt: Date.now(),
            };
        } else if (e === FAVORITE_TYPE.ROUTE) {
            if (!(t.origin && t.destination && t.gerencia && t.ramal)) return { success: !1, error: "INVALID_DATA" };
            const e = `${t.origin.slug}--a--${t.destination.slug}`;
            r = {
                type: FAVORITE_TYPE.ROUTE,
                id: e,
                origin: { slug: t.origin.slug, name: t.origin.name },
                destination: { slug: t.destination.slug, name: t.destination.name },
                gerencia: t.gerencia,
                ramal: t.ramal,
                addedAt: Date.now(),
            };
        } else if (e === FAVORITE_TYPE.RAMAL) {
            if (!t.slug || !t.name || !t.gerencia) return { success: !1, error: "INVALID_DATA" };
            r = {
                type: FAVORITE_TYPE.RAMAL,
                id: t.slug,
                slug: t.slug,
                name: t.name,
                gerencia: t.gerencia,
                gerencia_id: t.gerencia_id || null,
                addedAt: Date.now(),
            };
        } else if (e === FAVORITE_TYPE.LINE) {
            if (!t.slug || !t.name) return { success: !1, error: "INVALID_DATA" };
            r = {
                type: FAVORITE_TYPE.LINE,
                id: t.slug,
                slug: t.slug,
                name: t.name,
                gerencia_id: t.gerencia_id || null,
                addedAt: Date.now(),
            };
        }
        if (n.some((e) => e.type === r.type && e.id === r.id)) return { success: !1, error: "DUPLICATE" };
        n.push(r);
        const i = JSON.stringify(n);
        return i.length > 45e5
            ? { success: !1, error: "STORAGE_FULL" }
            : (localStorage.setItem(FAVORITES_KEY, i), { success: !0 });
    } catch (e) {
        return (
            console.error("Error adding favorite:", e),
            "QuotaExceededError" === e.name || 22 === e.code
                ? { success: !1, error: "QUOTA_EXCEEDED" }
                : { success: !1, error: "STORAGE_UNAVAILABLE" }
        );
    }
}
function removeFavorite(e, t) {
    try {
        const n = getFavorites(),
            r = n.length,
            i = n.filter((n) => !(n.type === e && n.id === t));
        return (
            i.length !== r &&
            (0 === i.length
                ? localStorage.removeItem(FAVORITES_KEY)
                : localStorage.setItem(FAVORITES_KEY, JSON.stringify(i)),
            !0)
        );
    } catch (e) {
        return console.error("Error removing favorite:", e), !1;
    }
}
function isFavorite(e, t) {
    try {
        return getFavorites().some((n) => n.type === e && n.id === t);
    } catch {
        return !1;
    }
}
function hasStationFavorites(e) {
    try {
        return getFavorites().some(
            (t) => t.type === FAVORITE_TYPE.STATION && (t.id === e || t.slug === e || t.id?.startsWith(`${e}--`))
        );
    } catch {
        return !1;
    }
}
function removeAllStationFavorites(e) {
    try {
        const t = getFavorites().filter(
            (t) => !(t.type === FAVORITE_TYPE.STATION && (t.id === e || t.slug === e || t.id?.startsWith(`${e}--`)))
        );
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(t));
    } catch {}
}
function getHighestAlertSeverity(e) {
    if (!e || 0 === e.length) return null;
    const t = { Alta: 3, Media: 2, Baja: 1 };
    let n = null,
        r = 0;
    for (const i of e) {
        const e = i.criticidad || "Media",
            a = t[e] || 0;
        a > r && ((r = a), (n = e));
    }
    return n;
}
function getSeverityClass(e) {
    switch (e) {
        case "Alta":
            return "severity-critical";
        case "Media":
        default:
            return "severity-warning";
        case "Baja":
            return "severity-info";
    }
}
function getCriticidadClassFromColor(e, t = "") {
    const n = (t || "").toLowerCase();
    if (n.includes("suspendido") || n.includes("interrumpido")) return "alert-warning";
    if (!e) return "alert-warning";
    const r = e.toLowerCase();
    return r.includes("f2dede")
        ? "alert-critical"
        : r.includes("fcf8e3") || r.includes("faebcc") || r.includes("d49532")
          ? "alert-warning"
          : r.includes("dff0d8") || r.includes("d9edf7")
            ? "alert-info"
            : "alert-warning";
}
function getMostSevereAlertClass(e) {
    let t = !1,
        n = !1;
    for (const r of e) {
        const e = getCriticidadClassFromColor(r.criticidad_color_fondo, r.contenido);
        "alert-critical" === e ? (t = !0) : "alert-warning" === e && (n = !0);
    }
    return t ? "alert-critical" : n ? "alert-warning" : "alert-info";
}
function getAlertIconBySeverity(e) {
    switch (e) {
        case "Alta":
            return "ðŸš¨";
        case "Media":
        default:
            return "âš ï¸";
        case "Baja":
            return "â„¹ï¸";
    }
}
function renderAlertsSummary(e, t) {
    if (!t) return;
    if (!e || 0 === e.length) return void t.classList.add("hidden");
    const n = getHighestAlertSeverity(e),
        r = getSeverityClass(n),
        i = getAlertIconBySeverity(n),
        a = 1 === e.length ? "1 alerta activa" : `${e.length} alertas activas`;
    (t.innerHTML = `\n        <button class="alerts-summary ${r}" aria-expanded="false" aria-controls="alerts-container">\n            <span class="alerts-summary-content">\n                <span class="alerts-summary-icon">${i}</span>\n                <span class="alerts-summary-text">${a}</span>\n            </span>\n            <span class="alerts-expand-icon" aria-hidden="true">â–¼</span>\n        </button>\n        <div id="alerts-container" class="alerts-container collapsed">\n            ${e.map((e) => renderAlertBanner(e)).join("")}\n        </div>\n    `),
        (t.dataset.expanded = "false"),
        t.classList.remove("hidden");
}
function renderAlertBanner(e) {
    const t = getAlertIcon(e.icono),
        n = getSeverityClass(e.criticidad || "Media"),
        r = escapeHtml(e.titulo || "Alerta"),
        i = e.descripcion ? escapeHtml(e.descripcion) : "";
    return `\n        <div class="alert-banner ${n}" data-alert-id="${escapeHtml(String(e.id))}">\n            <div class="alert-content">\n                <span class="alert-icon">${t}</span>\n                <div class="alert-text">\n                    <strong class="alert-title">${r}</strong>\n                    ${i ? `<p class="alert-description">${i}</p>` : ""}\n                </div>\n            </div>\n            <button class="alert-dismiss" aria-label="Ocultar alerta" data-dismiss-alert="${escapeHtml(String(e.id))}">Ã—</button>\n        </div>\n    `;
}
function setupAlertToggle(e) {
    if (!e) return;
    const t = e.querySelector(".alerts-summary");
    if (!t) return;
    t.addEventListener("click", () => {
        const n = "true" === e.dataset.expanded;
        (e.dataset.expanded = String(!n)), t.setAttribute("aria-expanded", String(!n));
        const r = t.querySelector(".alerts-expand-icon");
        r && (r.textContent = n ? "â–¼" : "â–²");
    }),
        t.addEventListener("keydown", (e) => {
            ("Enter" !== e.key && " " !== e.key) || (e.preventDefault(), t.click());
        });
    const n = e.querySelector(".alerts-container");
    n &&
        n.addEventListener("click", (r) => {
            const i = r.target.closest(".alert-dismiss");
            if (i) {
                const r = i.dataset.dismissAlert;
                if (r) {
                    dismissAlert(r);
                    const a = i.closest(".alert-banner");
                    a && a.remove();
                    const o = n.querySelectorAll(".alert-banner").length;
                    if (0 === o) e.classList.add("hidden");
                    else {
                        const e = t.querySelector(".alerts-summary-text");
                        e && (e.textContent = 1 === o ? "1 alerta activa" : `${o} alertas activas`);
                    }
                }
            }
        });
}
const _tabScrollState = new WeakMap(),
    TAB_SCROLL_DEBOUNCE_MS = 350;
function scrollTabIntoView(e, t = {}) {
    const { behavior: n = "smooth" } = t;
    if (!e) return;
    let r = e.closest('.tabs-container[role="tablist"]') || e.closest(".tabs-container") || e.closest(".tabs-radio");
    for (; r && r.scrollWidth <= r.clientWidth; ) {
        const e = r.parentElement;
        if (!e) break;
        r = e.closest(".tabs-container, .tabs-radio");
    }
    if (!r) return;
    if (_tabScrollState.get(r)) return;
    const i = r.getBoundingClientRect(),
        a = e.getBoundingClientRect(),
        o = a.left + a.width / 2 - (i.left + i.width / 2),
        s = r.scrollLeft + o,
        c = r.scrollWidth - r.clientWidth,
        l = Math.max(0, Math.min(s, c));
    _tabScrollState.set(r, !0),
        r.scrollTo({ left: l, behavior: n }),
        setTimeout(() => {
            _tabScrollState.delete(r);
        }, 350);
}
function findLoopRoute(e, t) {
    if ("undefined" == typeof LOOP_SERVICES) return null;
    if (!e || !t || e === t) return null;
    for (const [n, r] of Object.entries(LOOP_SERVICES)) {
        const i = r.stations.indexOf(e),
            a = r.stations.indexOf(t);
        if (-1 === i || -1 === a) continue;
        const o = r.stations.indexOf(r.loopPoint);
        if (i <= o !== a <= o)
            return {
                loopId: n,
                loop: r,
                originIdx: i,
                destIdx: a,
                crossesBranch: !0,
                loopPointIdx: o,
                clockwiseDistance: a > i ? a - i : r.stations.length - i + a,
                antiClockwiseDistance: i > a ? i - a : r.stations.length - a + i,
            };
    }
    return null;
}
function getOptimalLoopRoute(e, t) {
    const n = findLoopRoute(e, t);
    if (!n) return null;
    const r = n.clockwiseDistance <= n.antiClockwiseDistance,
        i = LOOP_SERVICES[r ? "bosques-via-quilmes" : "bosques-via-temperley"],
        a = i.stations.indexOf(e),
        o = i.stations.indexOf(t);
    let s;
    return (
        (s = o > a ? i.stations.slice(a, o + 1) : [...i.stations.slice(a), ...i.stations.slice(0, o + 1)]),
        {
            loop: i,
            direction: r ? "cw" : "acw",
            stations: s,
            loopPoint: i.loopPoint,
            crossesLoopPoint: s.includes(i.loopPoint),
        }
    );
}
function getLoopMembership(e) {
    if ("undefined" == typeof LOOP_SERVICES) return null;
    if (!e) return null;
    const t = { loops: [], branch: null };
    for (const [n, r] of Object.entries(LOOP_SERVICES)) r.stations.includes(e) && t.loops.push(n);
    if (0 === t.loops.length) return null;
    const n = LOOP_SERVICES["bosques-via-quilmes"];
    if (!n) return t;
    const r = n.stations.indexOf(e);
    return (
        "bosques" === e || "constitucion" === e || "santillan-y-kosteki" === e
            ? (t.branch = "shared")
            : -1 !== r && r <= n.branchBoundary.quilmesBranchEnd
              ? (t.branch = "quilmes")
              : (t.branch = "temperley"),
        t
    );
}
function pairTrainsAtJunction(e, t, n, r, i = 30) {
    if (!Array.isArray(e) || !Array.isArray(t)) return { pairs: [], unmatchedA: [], unmatchedB: [] };
    const a = t
            .map((e) => ({ train: e, minutes: r(e) }))
            .filter((e) => null != e.minutes)
            .sort((e, t) => e.minutes - t.minutes),
        o = new Set(),
        s = [],
        c = [];
    for (const t of e) {
        const e = n(t);
        let r = null;
        null != e && (r = a.find((t) => !o.has(t.train) && t.minutes >= e && t.minutes <= e + i)),
            r ? (o.add(r.train), s.push({ legA: t, legB: r.train, dwellMinutes: r.minutes - e })) : c.push(t);
    }
    return { pairs: s, unmatchedA: c, unmatchedB: t.filter((e) => !o.has(e)) };
}
function buildLoopStationsFromData(e, t) {
    if (!e || !t || !Array.isArray(t)) return [];
    const n = {};
    for (const t of e.ramales || [])
        for (const e of t.stations || []) {
            const t = slugify(e.nombre);
            n[t] || (n[t] = { ...e });
        }
    return t.map((e, t) => ({ ...n[e], seq: t, orden: t + 1, slug: e })).filter((e) => e.nombre);
}
function findSharedRamal(e, t, n) {
    if (!e || !t || !n) return null;
    const r = getOptimalLoopRoute(t, n);
    if (r && r.crossesLoopPoint)
        return {
            gerencia: { nombre: r.loop.gerencia, id: null },
            ramal: {
                id: r.loop.id,
                nombre: r.loop.nombre,
                slug: r.loop.id,
                gerencia: r.loop.gerencia,
                isLoop: !0,
                loopDirection: r.direction,
                from_terminal: r.loop.terminal,
                to_terminal: r.loop.terminal,
                stations: buildLoopStationsFromData(e, r.stations),
            },
            isLoopJourney: !0,
            loopInfo: r,
        };
    const i = e.ramales || [],
        a = (e) => e.next_trains_inbound?.length > 0 || e.next_trains_outbound?.length > 0;
    for (const e of i) {
        if (!e.stations) continue;
        const r = e.stations.find((e) => slugify(e.nombre) === t),
            i = e.stations.find((e) => slugify(e.nombre) === n);
        if (r && i && a(r) && a(i)) return { gerencia: { nombre: e.gerencia, id: e.gerencia_id }, ramal: e };
    }
    for (const e of i) {
        if (!e.stations) continue;
        const r = e.stations.some((e) => slugify(e.nombre) === t),
            i = e.stations.some((e) => slugify(e.nombre) === n);
        if (r && i) return { gerencia: { nombre: e.gerencia, id: e.gerencia_id }, ramal: e };
    }
    return null;
}
function findAllSharedRamales(e, t, n) {
    if (!e || !t || !n) return [];
    const r = e.ramales || [],
        i = (e) => e.next_trains_inbound?.length > 0 || e.next_trains_outbound?.length > 0,
        a = [],
        o = [];
    for (const e of r) {
        if (!e.stations) continue;
        const r = e.stations.find((e) => slugify(e.nombre) === t),
            s = e.stations.find((e) => slugify(e.nombre) === n);
        if (r && s) {
            const t = { gerencia: { nombre: e.gerencia, id: e.gerencia_id }, ramal: e };
            i(r) && i(s) ? a.push(t) : o.push(t);
        }
    }
    if (a.length > 0 || o.length > 0) return [...a, ...o];
    const s = getOptimalLoopRoute(t, n);
    return s && s.crossesLoopPoint
        ? [
              {
                  gerencia: { nombre: s.loop.gerencia, id: null },
                  ramal: {
                      id: s.loop.id,
                      nombre: s.loop.nombre,
                      slug: s.loop.id,
                      gerencia: s.loop.gerencia,
                      isLoop: !0,
                      loopDirection: s.direction,
                      from_terminal: s.loop.terminal,
                      to_terminal: s.loop.terminal,
                      stations: buildLoopStationsFromData(e, s.stations),
                  },
                  isLoopJourney: !0,
                  loopInfo: s,
              },
          ]
        : [];
}
function getTrainDirection(e, t, n) {
    if (!(e && e.stations && t && n)) return null;
    const r = [...e.stations].sort((e, t) => (e.seq ?? e.orden ?? 0) - (t.seq ?? t.orden ?? 0)),
        i = r.findIndex((e) => slugify(e.nombre) === t),
        a = r.findIndex((e) => slugify(e.nombre) === n);
    return -1 === i || -1 === a || i === a ? null : a > i ? "outbound" : "inbound";
}
function updateCanonicalUrl() {
    const e = `https://quetren.com${window.location.pathname}`,
        t = document.getElementById("canonical");
    t && (t.href = e);
    const n = document.querySelector('meta[property="og:url"]');
    n && n.setAttribute("content", e);
}
document.addEventListener("DOMContentLoaded", () => {
    initTheme(), setupThemeToggle(), initClock(), cleanupExpiredDismissedAlerts(), updateCanonicalUrl();
});
