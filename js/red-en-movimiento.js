!(function () {
    "use strict";
    const e = window.QuetrenAnimCore,
        n = ["habil", "sabado", "domingo"],
        t = [
            { slug: "mitre", label: "Mitre", abbr: "MI", varName: "--color-mitre" },
            { slug: "sarmiento", label: "Sarmiento", abbr: "SA", varName: "--color-sarmiento" },
            { slug: "roca", label: "Roca", abbr: "RO", varName: "--color-roca" },
            { slug: "belgrano-sur", label: "Belgrano Sur", abbr: "BS", varName: "--color-belgrano-sur" },
            { slug: "belgrano-norte", label: "Belgrano Norte", abbr: "BN", varName: "--color-belgrano-norte" },
            { slug: "san-martin", label: "San MartÃ­n", abbr: "SM", varName: "--color-sanmartin" },
            { slug: "urquiza", label: "Urquiza", abbr: "UR", varName: "--color-urquiza" },
            { slug: "tren-de-la-costa", label: "Tren de la Costa", abbr: "TC", varName: "--color-costa" },
        ],
        a = 120,
        r = new Intl.PluralRules("es"),
        o = {
            loadStatus: "loading",
            prepared: null,
            context: null,
            dayType: "habil",
            enabled: new Set(t.map((e) => e.slug)),
            minute: 0,
            playing: !1,
            rate: 57.6,
            lastFrameTime: null,
            project: null,
            dpr: 1,
            autoplayPending: !1,
            scrubbing: !1,
            pausedByScrub: !1,
            lastClockAnnounceAt: null,
            lastTrainCount: 0,
            counts: null,
            sparkMax: 0,
            events: null,
            soundOn: !1,
            soundEngine: null,
            soundPulser: null,
            fixedBbox: null,
            selected: [],
            chains: null,
            tripCode: null,
        },
        u = {};
    let i = null,
        l = null,
        s = null,
        c = {},
        d = null,
        m = 0;
    const g = {};
    let p = null,
        f = null;
    const y = new Promise(function (e) {
        f = e;
    });
    function h() {
            const e = getComputedStyle(document.documentElement),
                n = {
                    text: e.getPropertyValue("--ds2-text").trim(),
                    hairline: e.getPropertyValue("--ds2-hairline").trim(),
                    muted: e.getPropertyValue("--ds2-text-muted").trim(),
                    surface: e.getPropertyValue("--ds2-surface").trim(),
                };
        return (
            t.forEach(function (t) {
                n[t.slug] = e.getPropertyValue(t.varName).trim();
            }),
            n
        );
    }
    function b(e) {
        const n = ((Math.round(e) % 1440) + 1440) % 1440;
        return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
    }
    function E() {
        if (!o.fixedBbox) return;
        const n = u.stage.getBoundingClientRect(),
            t = Math.max(1, Math.round(n.width)),
            a = Math.max(1, Math.round(n.height));
        (o.dpr = Math.min(window.devicePixelRatio || 1, 2)),
            [u.canvas, i].forEach(function (e) {
                (e.width = Math.round(t * o.dpr)), (e.height = Math.round(a * o.dpr));
            }),
            (u.canvas.style.width = t + "px"),
            (u.canvas.style.height = a + "px"),
            (s = u.canvas.getContext("2d")),
            (l = i.getContext("2d")),
            [s, l].forEach(function (e) {
                e.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
            }),
            (o.project = e.makeProjection(o.fixedBbox, t, a, 0.04)),
            w();
    }
    function x(e, n) {
        e.beginPath();
        for (let t = 0; t < n.length; t++) {
            const a = o.project(n[t][0], n[t][1]);
            0 === t ? e.moveTo(a.x, a.y) : e.lineTo(a.x, a.y);
        }
        e.stroke();
    }
    function w() {
        if (!l || "ready" !== o.loadStatus) return;
        const e = i.width / o.dpr,
            n = i.height / o.dpr;
        l.clearRect(0, 0, e, n),
            (l.lineWidth = 1),
            (l.lineJoin = "round"),
            (l.lineCap = "round"),
            o.context &&
                ((l.strokeStyle = c.hairline),
                o.context.features.forEach(function (e) {
                    const n = e.geometry || {};
                    ("MultiLineString" === n.type ? n.coordinates : [n.coordinates]).forEach(function (e) {
                        e && e.length > 1 && x(l, e);
                    });
                })),
            o.prepared.ramales.forEach(function (e) {
                if (!o.enabled.has(e.linea)) return;
                l.strokeStyle = c[e.linea] || c.muted;
                const n = [];
                for (let t = 0; t < e.lonlat.length; t += 2) n.push([e.lonlat[t], e.lonlat[t + 1]]);
                x(l, n);
            });
            const H = 3,
                q = new Set();
            o.prepared.ramales.forEach(function (r) {
                if (!o.enabled.has(r.linea)) return;
                (l.strokeStyle = c[r.linea] || c.muted), (l.lineWidth = 1.5);
                for (let n = 0; n < r.offsets.length; n++) {
                    const t = e.pointAtDistance(r, r.offsets[n]),
                        a = o.project(t.lon, t.lat),
                        i = Math.round(a.x) + "," + Math.round(a.y);
                    if (q.has(i)) continue;
                    q.add(i);
                    const s = e.pointAtDistance(r, Math.max(0, r.offsets[n] - 40)),
                        d = e.pointAtDistance(r, Math.min(r.cum[r.cum.length - 1], r.offsets[n] + 40)),
                        m = o.project(s.lon, s.lat),
                        g = o.project(d.lon, d.lat),
                        p = g.x - m.x,
                        f = g.y - m.y,
                        h = Math.hypot(p, f) || 1,
                        u = (-f / h) * H,
                        y = (p / h) * H;
                    l.beginPath(), l.moveTo(a.x - u, a.y - y), l.lineTo(a.x + u, a.y + y), l.stroke();
                }
            });
    }
    function v() {
        if (!s || "ready" !== o.loadStatus) return;
        const n = u.canvas.width / o.dpr,
            t = u.canvas.height / o.dpr;
        s.clearRect(0, 0, n, t), s.drawImage(i, 0, 0, n, t);
        const r = e.activeTrainsAt(o.prepared, o.minute, o.enabled),
            G = new Set(o.selected),
            W = [];
        for (let e = 0; e < r.length; e++) {
            const n = r[e],
                t = o.project(n.lon, n.lat);
            (s.fillStyle = c[n.linea] || c.text),
                s.beginPath(),
                s.arc(t.x, t.y, 3, 0, 2 * Math.PI),
                s.fill(),
                o.tripCode &&
                    o.tripCode[n.tripIdx] &&
                    W.push({ x: t.x, y: t.y, code: o.tripCode[n.tripIdx], sel: G.has(n.tripIdx), linea: n.linea });
        }
        W.length && V(W, n, t);
        (o.lastTrainCount = r.length),
            (u.clock.textContent = b(o.minute)),
            (u.count.textContent = String(r.length)),
            (function (n) {
                if (!u.sparkLine || !o.counts || !o.sparkMax) return;
                const t = 72,
                    r = function (e) {
                        return 100 - Math.min(1, e / o.sparkMax) * t;
                    },
                    i = e.trailingMinutes(o.minute, a);
                let l = "";
                for (let e = 0; e < i.length; e++) {
                    l += (0 === e ? "M" : "L") + (a - i[e].age).toFixed(2) + " " + r(P(i[e].minute)).toFixed(2);
                }
                (l += "L120 " + r(n).toFixed(2)), u.sparkLine.setAttribute("d", l);
            })(r.length),
            (function (e) {
                if (!u.sparkDot || !o.sparkMax) return;
                const n = 72 * Math.min(1, e / o.sparkMax) + "%";
                (u.sparkDot.style.bottom = n), (u.count.style.bottom = n);
            })(r.length),
            (u.scrub.value = String(Math.round(o.minute))),
            u.scrub.setAttribute("aria-valuetext", b(o.minute)),
            Q(),
            o.playing && B(S(), { kind: "clock" });
    }
    function V(n, t, a) {
        s.font = '600 9px "QuetrenMonoDigits", monospace';
        s.textBaseline = "middle";
        const r = [];
        n.sort(function (n, t) {
            return (n.sel ? 1 : 0) - (t.sel ? 1 : 0);
        });
        for (let i = 0; i < n.length; i++) {
            const e = n[i],
                u = s.measureText(e.code).width + 6,
                l = 12;
            let d = Math.max(2, Math.min(t - u - 2, e.x + 5)),
                m = Math.max(2, Math.min(a - l - 2, e.y - l - 2));
            if (
                !e.sel &&
                r.some(function (n) {
                    return d < n.x + n.w && d + u > n.x && m < n.y + n.h && m + l > n.y;
                })
            )
                continue;
            r.push({ x: d, y: m, w: u, h: l }),
                s.beginPath(),
                s.roundRect ? s.roundRect(d, m, u, l, 6) : s.rect(d, m, u, l),
                e.sel
                    ? ((s.fillStyle = c[e.linea] || c.text), s.fill())
                    : ((s.fillStyle = c.surface || "#fff"),
                      s.fill(),
                      (s.strokeStyle = c[e.linea] || c.muted),
                      (s.lineWidth = 0.75),
                      s.stroke()),
                (s.fillStyle = e.sel ? c.surface || "#fff" : c[e.linea] || c.text),
                s.fillText(e.code, d + 3, m + l / 2 + 0.5);
        }
    }
    function S() {
        return (
            b(o.minute) +
            ", " +
            o.lastTrainCount +
            " " +
            ((e = o.lastTrainCount), "one" === r.select(e) ? "tren en circulaciÃ³n" : "trenes en circulaciÃ³n")
        );
        var e;
    }
    function P(e) {
        let n = 0;
        return (
            o.enabled.forEach(function (t) {
                const a = o.counts && o.counts[t];
                a && (n += a[e]);
            }),
            n
        );
    }
    function k(n) {
        const t = Number(n);
        o.minute = ((t % e.MINUTES_PER_DAY) + e.MINUTES_PER_DAY) % e.MINUTES_PER_DAY;
    }
    function M() {
        return window.AudioContext || window.webkitAudioContext || null;
    }
    function A() {
        o.soundEngine && "running" === o.soundEngine.context.state && o.soundEngine.context.suspend(),
            (o.soundPulser = null);
    }
    function T() {
        o.soundOn && o.playing && o.soundEngine && o.soundEngine.context.resume();
    }
    function B(e, n) {
        if (u.announcer && !o.scrubbing) {
            if (n && "clock" === n.kind) {
                const e = performance.now();
                if (null !== o.lastClockAnnounceAt && e - o.lastClockAnnounceAt < 1e4) return;
                o.lastClockAnnounceAt = e;
            }
            u.announcer.textContent = e;
        }
    }
    function C(e) {
        u.message && (u.message.textContent = e);
    }
    function U(n) {
        return String(n).replace(/[&<>"']/g, function (e) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[e];
        });
    }
    function z(e) {
        const n = [];
        for (let t = 0; t + 1 < e.length; t += 2) n.push({ station: e[t], minute: e[t + 1] });
        return n;
    }
    function J() {
        if (!u.servicesList) return;
        const e = o.selected.length;
        (u.servicesCount.hidden = 0 === e),
            (u.servicesCount.textContent = String(e)),
            (u.servicesToggle.hidden = "ready" !== o.loadStatus),
            (u.servicesEmpty.hidden = 0 !== e);
        u.servicesList.innerHTML = o.selected
            .map(function (n) {
                const r = o.prepared.trips[n],
                    a = o.prepared.ramales[r[0]],
                    i = z(r[2]),
                    s =
                        t.find(function (e) {
                            return e.slug === a.linea;
                        }) || { label: a.linea, varName: "" },
                    c = i
                        .map(function (e) {
                            return (
                                '<li class="rem-stop" data-minute="' +
                                e.minute +
                                '"><span class="rem-stop-time">' +
                                b(e.minute) +
                                '</span><span class="rem-stop-name">' +
                                U(a.stations[e.station]) +
                                "</span></li>"
                            );
                        })
                        .join("");
                return (
                    '<li class="rem-card" data-trip="' +
                    n +
                    '" style="--rem-card-line: var(' +
                    s.varName +
                    ')"><div class="rem-card-head">' +
                    (o.tripCode && o.tripCode[n] ? '<span class="rem-card-code">' + U(o.tripCode[n]) + "</span>" : "") +
                    '<span class="rem-card-dot" aria-hidden="true"></span><div class="rem-card-route"><strong>' +
                    U(s.label) +
                    "</strong><span>" +
                    U(a.stations[i[0].station]) +
                    " → " +
                    U(a.stations[i[i.length - 1].station]) +
                    '</span></div><span class="rem-card-span">' +
                    b(i[0].minute) +
                    " – " +
                    b(i[i.length - 1].minute) +
                    '</span><button type="button" class="rem-card-close" aria-label="Quitar servicio de la selección">×</button></div><ol class="rem-card-stops">' +
                    c +
                    '<li class="rem-now" aria-hidden="true" hidden></li></ol></li>'
                );
            })
            .join("");
        Q();
    }
    function Q() {
        if (!u.servicesList || u.servicesPanel.hidden || !o.selected.length || "ready" !== o.loadStatus) return;
        const n = o.minute;
        u.servicesList.querySelectorAll(".rem-card").forEach(function (t) {
            const a = o.prepared.trips[+t.dataset.trip];
            if (!a) return;
            const i = z(a[2]),
                r = t.querySelectorAll(".rem-stop"),
                s = t.querySelector(".rem-now");
            if (!r.length || !s || i.length < 2) return;
            const d = i[0].minute,
                m = i[i.length - 1].minute;
            let g = -1;
            n >= d && n <= m
                ? (g = n)
                : n + e.MINUTES_PER_DAY >= d && n + e.MINUTES_PER_DAY <= m && (g = n + e.MINUTES_PER_DAY);
            const p = g >= 0;
            let f = -1,
                h = -1;
            if (p)
                for (let e = 0; e + 1 < i.length; e++)
                    if (g >= i[e].minute && g <= i[e + 1].minute) {
                        (f = e), (h = e + 1);
                        break;
                    }
            const c =
                !p &&
                ((n - m + e.MINUTES_PER_DAY) % e.MINUTES_PER_DAY) <=
                    ((d - n + e.MINUTES_PER_DAY) % e.MINUTES_PER_DAY);
            t.classList.toggle("rem-card--done", c);
            for (let e = 0; e < r.length; e++) {
                const n = (p && e <= f) || c;
                r[e].classList.toggle("rem-stop--past", n),
                    r[e].classList.toggle("rem-stop--next", p && e === h);
            }
            if (p && f >= 0) {
                const e = i[f].minute,
                    n = i[h].minute,
                    a = n > e ? (g - e) / (n - e) : 0,
                    o = r[f].offsetTop + (r[h].offsetTop - r[f].offsetTop) * a;
                (s.hidden = !1), (s.style.top = o + "px");
            } else s.hidden = !0;
        });
    }
    function X(n) {
        const t = o.selected.indexOf(n);
        -1 !== t
            ? o.selected.splice(t, 1)
            : ((o.selected.push(n)),
              (u.servicesPanel.hidden = !1),
              u.servicesToggle.setAttribute("aria-expanded", "true")),
            J();
    }
    function Y(n) {
        const a = Array(n.trips.length).fill(""),
            i = {};
        o.chains.chains.forEach(function (r, s) {
            (i[r.linea] || (i[r.linea] = [])).push({ n: s, dep: n.trips[r.trips[0]][2][1] });
        });
        for (const r in i) {
            const s =
                    t.find(function (e) {
                        return e.slug === r;
                    }) || null,
                d = s ? s.abbr : r.slice(0, 2).toUpperCase();
            i[r].sort(function (e, n) {
                return e.dep - n.dep;
            }).forEach(function (e, n) {
                const r = d + "-" + String(n + 1).padStart(2, "0");
                (o.chains.chains[e.n].code = r),
                    o.chains.chains[e.n].trips.forEach(function (n) {
                        a[n] = r;
                    });
            });
        }
        o.tripCode = a;
    }
    function I(n) {
        if (o.playing) {
            if (null !== o.lastFrameTime) {
                const a = n - o.lastFrameTime,
                    r = o.minute;
                k(o.minute + (a / 1e3) * o.rate),
                    (function (n, a, r) {
                        const u = o.soundEngine;
                        if (!o.soundOn || !u || !o.events || "running" !== u.context.state) return;
                        if (r > 250) return void (o.soundPulser = null);
                        o.soundPulser ||
                            (o.soundPulser = e.createPulser(
                                0.25,
                                t.map(function (e) {
                                    return e.slug;
                                })
                            ));
                        const i = e.eventsInWindow(o.events, n, a).filter(function (e) {
                                return o.enabled.has(e.linea);
                            }),
                            l = u.context.currentTime + 0.05,
                            s = r / 1e3,
                            c = e.stepPulser(o.soundPulser, i, o.enabled, l, s);
                        u.schedule(c);
                    })(r, o.minute, a);
            }
            (o.lastFrameTime = n), v(), (d = window.requestAnimationFrame(I));
        } else d = null;
    }
    function N(e) {
        (u.play.textContent = e ? "Pausar" : "Reproducir"), u.play.setAttribute("aria-pressed", e ? "true" : "false");
    }
    function L() {
        o.playing ||
            "ready" !== o.loadStatus ||
            ((o.playing = !0),
            (o.lastFrameTime = null),
            T(),
            N(!0),
            B("Reproduciendo, " + S()),
            (o.lastClockAnnounceAt = performance.now()),
            (d = window.requestAnimationFrame(I)));
    }
    function R() {
        const e = o.playing;
        return (
            (o.playing = !1),
            (o.lastFrameTime = null),
            A(),
            null !== d && (window.cancelAnimationFrame(d), (d = null)),
            N(!1),
            e && B("En pausa, " + S()),
            e
        );
    }
    function _(n) {
        return (
            g[n] ||
                (g[n] = (async function (n) {
                    const t = await fetch("/data/animation-bundle-" + n + ".json");
                    if (!t.ok) throw new Error("bundle fetch failed: " + t.status);
                    return e.prepareBundle(await t.json());
                })(n).catch(function (e) {
                    throw (delete g[n], e);
                })),
            g[n]
        );
    }
    async function j(t) {
        if (-1 === n.indexOf(t)) return;
        const a = ++m;
        let r,
            i,
            l = null,
            s = null;
        try {
            const n = await Promise.all([
                _(t),
                o.fixedBbox ? null : _("habil"),
                (p ||
                    (p = fetch("/data/amba-context.geojson")
                        .then(function (e) {
                            return e.ok ? e.json() : null;
                        })
                        .catch(function () {
                            return null;
                        })),
                p),
            ]);
            (r = n[0]),
                n[1] &&
                    !o.fixedBbox &&
                    ((o.fixedBbox = n[1].bbox),
                    (l = n[1]),
                    (s = e.countsByMinute(n[1])),
                    (o.sparkMax = (function (n) {
                        let t = 0;
                        for (let a = 0; a < e.MINUTES_PER_DAY; a++) {
                            let e = 0;
                            for (const t of Object.keys(n)) e += n[t][a];
                            t = Math.max(t, e);
                        }
                        return t;
                    })(s))),
                (i = n[2]);
        } catch (e) {
            if (a !== m) return;
            return void ("ready" === o.loadStatus
                ? C("No se pudo cargar el horario. Se mantiene el dÃ­a anterior.")
                : ((o.loadStatus = "failed"),
                  (o.autoplayPending = !1),
                  N(!1),
                  C("No se pudieron cargar los trenes."),
                  f()));
        }
        a === m &&
            (function (n, t, a, r) {
                const i = "ready" !== o.loadStatus;
                void (u.message && (u.message.textContent = "")),
                    (o.context = a),
                    (o.prepared = t),
                    (o.counts = r || e.countsByMinute(t)),
                    (o.events = e.tripEventsByMinute(t)),
                    (o.dayType = n),
                    (o.loadStatus = "ready"),
                    (o.soundPulser = null),
                    (o.chains = e.buildChains(t)),
                    Y(t),
                    (o.selected = []),
                    J(),
                    u.dayTypes.querySelectorAll("[data-day-type]").forEach(function (e) {
                        e.setAttribute("aria-pressed", e.dataset.dayType === n ? "true" : "false");
                    }),
                    E(),
                    v(),
                    i && (o.autoplayPending && ((o.autoplayPending = !1), L()), f());
            })(t, r, i, r === l ? s : null);
    }
    function F(e, n) {
        n ? o.enabled.add(e) : o.enabled.delete(e);
        const t = u.lineas.querySelector('[data-linea="' + e + '"]');
        t && t.setAttribute("aria-pressed", n ? "true" : "false"), w(), v();
    }
    function D() {
        function e() {
            if (!o.scrubbing) return;
            o.scrubbing = !1;
            const e = o.pausedByScrub ? "En pausa, " : "";
            (o.pausedByScrub = !1), "ready" === o.loadStatus && B(e + S());
        }
        u.play.addEventListener("click", function () {
            if ("loading" === o.loadStatus) return (o.autoplayPending = !o.autoplayPending), void N(o.autoplayPending);
            (o.autoplayPending = !1), o.playing ? R() : L();
        }),
            u.canvas.addEventListener("click", function (n) {
                if ("ready" !== o.loadStatus || !o.project) return;
                const t = u.canvas.getBoundingClientRect(),
                    a = n.clientX - t.left,
                    i = n.clientY - t.top,
                    r = window.QuetrenAnimCore.activeTrainsAt(o.prepared, o.minute, o.enabled);
                let s = null,
                    d = 196;
                for (let e = 0; e < r.length; e++) {
                    const t = o.project(r[e].lon, r[e].lat),
                        n = (t.x - a) * (t.x - a) + (t.y - i) * (t.y - i);
                    n < d && ((d = n), (s = r[e]));
                }
                s && X(s.tripIdx);
            }),
            u.servicesToggle.addEventListener("click", function () {
                const e = u.servicesPanel.hidden;
                (u.servicesPanel.hidden = !e),
                    u.servicesToggle.setAttribute("aria-expanded", e ? "true" : "false"),
                    e && J();
            }),
            u.servicesList.addEventListener("click", function (e) {
                const n = e.target.closest(".rem-card-close");
                if (!n) return;
                const t = +n.closest(".rem-card").dataset.trip,
                    a = o.selected.indexOf(t);
                -1 !== a && (o.selected.splice(a, 1), J());
            }),
            u.scrub.addEventListener("input", function () {
                (o.autoplayPending = !1), (o.scrubbing = !0), R() && (o.pausedByScrub = !0), k(u.scrub.value), v();
            }),
            u.scrub.addEventListener("change", e),
            u.scrub.addEventListener("pointercancel", e),
            u.scrub.addEventListener("blur", e),
            u.dayTypes.addEventListener("click", function (e) {
                const n = e.target.closest("[data-day-type]");
                n && j(n.dataset.dayType);
            }),
            window.addEventListener("resize", function () {
                E(), v();
            });
        new MutationObserver(function () {
            (c = h()), w(), v();
        }).observe(document.documentElement, { attributes: !0, attributeFilter: ["data-theme"] }),
            u.sound.addEventListener("click", function () {
                const e = M();
                e &&
                    window.QuetrenAnimSound &&
                    (o.soundEngine || (o.soundEngine = window.QuetrenAnimSound.createEngine(new e())),
                    (o.soundOn = !o.soundOn),
                    u.sound.setAttribute("aria-pressed", o.soundOn ? "true" : "false"),
                    o.soundOn ? T() : A());
            }),
            document.addEventListener("visibilitychange", function () {
                document.hidden ? A() : T();
            });
    }
    const O = (function () {
        if (
            ((u.stage = document.getElementById("rem-stage")),
            (u.canvas = document.getElementById("rem-canvas")),
            (u.clock = document.getElementById("rem-clock")),
            (u.count = document.getElementById("rem-count")),
            (u.sparkLine = document.getElementById("rem-spark-line")),
            (u.sparkDot = document.getElementById("rem-spark-dot")),
            (u.message = document.getElementById("rem-message")),
            (u.announcer = document.getElementById("rem-announcer")),
            (u.scrub = document.getElementById("rem-scrub")),
            (u.play = document.getElementById("rem-play")),
            (u.dayTypes = document.getElementById("rem-daytypes")),
            (u.lineas = document.getElementById("rem-lineas")),
            (u.sound = document.getElementById("rem-sound")),
            (u.servicesToggle = document.getElementById("rem-services-toggle")),
            (u.servicesPanel = document.getElementById("rem-services-panel")),
            (u.servicesList = document.getElementById("rem-services-list")),
            (u.servicesCount = document.getElementById("rem-services-count")),
            (u.servicesEmpty = document.getElementById("rem-services-empty")),
            !u.canvas)
        )
            return Promise.resolve();
        const e = "1" === new URLSearchParams(window.location.search).get("render");
        e && document.documentElement.classList.add("rem-render-mode"),
            (i = document.createElement("canvas")),
            (c = h()),
            t.forEach(function (e) {
                const n = document.createElement("button");
                (n.type = "button"),
                    (n.className = "rem-chip"),
                    (n.dataset.linea = e.slug),
                    (n.textContent = e.label),
                    n.setAttribute("aria-pressed", "true"),
                    n.style.setProperty("--rem-chip-color", "var(" + e.varName + ")"),
                    n.addEventListener("click", function () {
                        F(e.slug, "true" !== n.getAttribute("aria-pressed"));
                    }),
                    u.lineas.appendChild(n);
            }),
            D(),
            M() || (u.sound.hidden = !0);
        const n = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        return k(n ? 480 : 0), (o.autoplayPending = !n && !e), N(o.autoplayPending), j("habil"), y;
    })();
    window.__anim = {
        ready: O,
        setMinute: function (e) {
            R(), k(e);
        },
        getMinute: function () {
            return o.minute;
        },
        getDayType: function () {
            return o.dayType;
        },
        getLoadStatus: function () {
            return o.loadStatus;
        },
        render: v,
        project: function (e, n) {
            return o.project ? o.project(e, n) : null;
        },
        setDayType: j,
        setLinea: F,
        play: L,
        pause: R,
        renderAudio: async function (n) {
            const a = 48e3,
                r = n.frames / n.fps,
                u = new OfflineAudioContext(1, Math.ceil(r * a), a),
                i = window.QuetrenAnimSound.createEngine(u),
                l = r / e.MINUTES_PER_DAY,
                s = [];
            for (let n = 0; n < e.MINUTES_PER_DAY; n++) {
                const e = o.events[n];
                for (let t = 0; t < e.length; t++)
                    s.push({ time: n * l + ((t + 0.5) / e.length) * l, linea: e[t].linea, kind: e[t].kind });
            }
            const c = e.createPulser(
                0.25,
                t.map(function (e) {
                    return e.slug;
                })
            );
            for (let e = 0; e < s.length; e++) c.add(s[e].linea, s[e].kind, s[e].time);
            const d = c.drain(1 / 0);
            i.schedule(d);
            const m = (await u.startRendering()).getChannelData(0),
                g = new Int16Array(m.length);
            let p = 0;
            for (let e = 0; e < m.length; e++) {
                const n = Math.abs(m[e]);
                n > p && (p = n);
                const t = Math.max(-1, Math.min(1, m[e]));
                g[e] = t < 0 ? 32768 * t : 32767 * t;
            }
            const f = new Uint8Array(g.buffer);
            let y = "";
            for (let e = 0; e < f.length; e += 32768) y += String.fromCharCode.apply(null, f.subarray(e, e + 32768));
            return {
                sampleRate: a,
                samples: m.length,
                events: s.length,
                pulses: d.length,
                peak: p,
                pcmBase64: window.btoa(y),
            };
        },
    };
})();
