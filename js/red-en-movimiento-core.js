!(function (t) {
    "use strict";
    const n = 1440;
    const e = 6371008.8;
    function i(t, n, i, a) {
        const o = (n * Math.PI) / 180,
            r = (a * Math.PI) / 180,
            s = r - o,
            l = ((i - t) * Math.PI) / 180,
            u = Math.sin(s / 2) * Math.sin(s / 2) + Math.cos(o) * Math.cos(r) * Math.sin(l / 2) * Math.sin(l / 2);
        return 2 * e * Math.asin(Math.sqrt(u));
    }
    function a(t, n) {
        const e = t.cum,
            i = t.lonlat,
            a = e.length - 1;
        if (n <= 0) return { lon: i[0], lat: i[1] };
        if (n >= e[a]) return { lon: i[2 * a], lat: i[2 * a + 1] };
        let o = 0,
            r = a;
        for (; r - o > 1; ) {
            const t = (o + r) >> 1;
            e[t] <= n ? (o = t) : (r = t);
        }
        const s = e[r] - e[o],
            l = s > 0 ? (n - e[o]) / s : 0;
        return { lon: i[2 * o] + l * (i[2 * r] - i[2 * o]), lat: i[2 * o + 1] + l * (i[2 * r + 1] - i[2 * o + 1]) };
    }
    function o(t, e, i) {
        const o = e[2],
            r = o[1],
            s = o[o.length - 1];
        let l = i;
        if (((l < r || l > s) && (l = i + n), l < r || l > s)) return null;
        const u = t.offsets;
        for (let n = 0; n + 3 < o.length; n += 2) {
            const e = o[n + 1],
                i = o[n + 3];
            if (l >= e && l <= i) {
                const r = u[o[n]];
                return a(t, r + (i > e ? (l - e) / (i - e) : 0) * (u[o[n + 2]] - r));
            }
        }
        return a(t, u[o[o.length - 2]]);
    }
    function r(t) {
        const n = Math.max(1, t);
        return Math.min(1, 0.3 + (0.7 * Math.log2(n)) / Math.log2(24));
    }
    t.QuetrenAnimCore = {
        MINUTES_PER_DAY: n,
        prepareNetwork: function (t) {
            const a = {};
            let o = t.bbox && 4 === t.bbox.length ? t.bbox : null,
                r = Infinity,
                s = Infinity,
                l = -Infinity,
                u = -Infinity;
            for (let n = 0; n < t.features.length; n++) {
                const c = t.features[n],
                    d = c.properties || {},
                    m = c.geometry && c.geometry.coordinates;
                if (!m || m.length < 2) continue;
                const g = new Float64Array(2 * m.length),
                    p = new Float64Array(m.length);
                let f = 0;
                for (let e = 0; e < m.length; e++) {
                    (g[2 * e] = m[e][0]),
                        (g[2 * e + 1] = m[e][1]),
                        e > 0 && (f += i(g[2 * e - 2], g[2 * e - 1], g[2 * e], g[2 * e + 1])),
                        (p[e] = f),
                        (r = Math.min(r, g[2 * e])),
                        (s = Math.min(s, g[2 * e + 1])),
                        (l = Math.max(l, g[2 * e])),
                        (u = Math.max(u, g[2 * e + 1]));
                }
                a[d.slug] = { slug: d.slug, linea: d.linea, stations: d.stations, offsets: d.offsets, lonlat: g, cum: p };
            }
            return { bbox: o || [r, s, l, u], bySlug: a };
        },
        prepareBundle: function (t, n) {
            const e = t.bySlug,
                a = n.ramales.map(function (t) {
                    const a = e[t];
                    if (!a) throw new Error("ramal not found in network: " + t);
                    return a;
                });
            return Object.assign({}, n, { ramales: a, bbox: t.bbox });
        },
        pointAtDistance: a,
        tripPositionAt: o,
        activeTrainsAt: function (t, n, e) {
            const i = [],
                a = t.trips;
            for (let r = 0; r < a.length; r++) {
                const s = a[r],
                    l = t.ramales[s[0]];
                if (e && !e.has(l.linea)) continue;
                const u = o(l, s, n);
                u && i.push({ lon: u.lon, lat: u.lat, linea: l.linea, ramalIdx: s[0], tripIdx: r });
            }
            return i;
        },
        buildChains: function (t) {
            const h = t,
                M = t.trips.length,
                e = new Int32Array(M).fill(-1),
                a = {},
                o = [];
            for (let i = 0; i < M; i++) {
                const r = h.ramales[h.trips[i][0]];
                (a[r.linea] || (a[r.linea] = [])).push(i);
            }
            for (const l in a) {
                const u = a[l],
                    f = u.map(function (i) {
                        const s = h.trips[i],
                            d = h.ramales[s[0]],
                            m = s[2];
                        return {
                            i: i,
                            dir: s[1],
                            dep: d.stations[m[0]],
                            depMin: m[1],
                            arr: d.stations[m[m.length - 2]],
                            arrMin: m[m.length - 1],
                        };
                    }),
                    g = {};
                f.forEach(function (i) {
                    (g[i.dep] || (g[i.dep] = [])).push(i);
                });
                for (const c in g) g[c].sort(function (i, r) {
                    return i.depMin - r.depMin;
                });
                const p = f
                        .slice()
                        .sort(function (i, r) {
                            return (i.arrMin % n) - (r.arrMin % n);
                        }),
                    v = new Set(),
                    y = {};
                for (let i = 0; i < p.length; i++) {
                    const r = p[i],
                        s = (g[r.arr] || []).filter(function (i) {
                            const d = (((i.depMin - r.arrMin) % n) + n) % n;
                            return !v.has(i.i) && i.dir !== r.dir && d > 0 && d <= 30;
                        });
                    if (!s.length) continue;
                    let d = s[0],
                        m = (((d.depMin - r.arrMin) % n) + n) % n;
                    for (let c = 1; c < s.length; c++) {
                        const i = (((s[c].depMin - r.arrMin) % n) + n) % n;
                        i < m && ((m = i), (d = s[c]));
                    }
                    v.add(d.i), (y[r.i] = d.i);
                }
                const b = new Set(Object.values(y)),
                    x = u
                        .filter(function (i) {
                            return !b.has(i);
                        })
                        .sort(function (i, r) {
                            return h.trips[i][2][1] - h.trips[r][2][1];
                        });
                for (let i = 0; i < x.length; i++) {
                    const r = [];
                    let s = x[i];
                    for (; void 0 !== y[s]; ) r.push(s), (s = y[s]);
                    r.push(s);
                    const d = o.length;
                    o.push({ linea: l, trips: r });
                    for (let c = 0; c < r.length; c++) e[r[c]] = d;
                }
            }
            return { assign: e, chains: o };
        },
        makeProjection: function (t, n, e, i) {
            const a = i > 0 ? i : 0,
                o = n * (1 - 2 * a),
                r = e * (1 - 2 * a),
                s = 180 / Math.PI,
                l = function (t) {
                    const n = Math.max(-85, Math.min(85, t));
                    return s * Math.log(Math.tan(Math.PI / 4 + (n * Math.PI) / 360));
                },
                u = t[0],
                c = t[2],
                h = l(t[1]),
                f = l(t[3]),
                M = Math.min(o / (c - u), r / (f - h)),
                m = (n - (c - u) * M) / 2,
                d = (e - (f - h) * M) / 2;
            return function (t, n) {
                return { x: m + (t - u) * M, y: e - d - (l(n) - h) * M };
            };
        },
        haversineM: i,
        countsByMinute: function (t) {
            const e = {};
            t.ramales.forEach(function (t) {
                e[t.linea] || (e[t.linea] = new Uint16Array(n));
            });
            for (let i = 0; i < t.trips.length; i++) {
                const a = t.trips[i],
                    o = a[2],
                    r = o[1],
                    s = o[o.length - 1],
                    l = e[t.ramales[a[0]].linea];
                for (let t = Math.max(r, 0); t <= Math.min(s, 1439); t++) l[t]++;
                for (let t = Math.max(r - n, 0); t <= Math.min(s - n, 1439); t++) l[t]++;
            }
            return e;
        },
        tripEventsByMinute: function (t) {
            const e = [];
            for (let t = 0; t < n; t++) e.push([]);
            for (let i = 0; i < t.trips.length; i++) {
                const a = t.trips[i],
                    o = a[2],
                    r = t.ramales[a[0]].linea;
                e[o[1] % n].push({ linea: r, kind: "start" }), e[o[o.length - 1] % n].push({ linea: r, kind: "end" });
            }
            return e;
        },
        eventsInWindow: function (t, n, e) {
            const i = [];
            if (n === e) return i;
            const a = Math.floor(n) + 1,
                o = Math.floor(e),
                r = function (n, e) {
                    for (let a = n; a <= e; a++) {
                        const n = t[a];
                        for (let t = 0; t < n.length; t++) i.push({ minute: a, linea: n[t].linea, kind: n[t].kind });
                    }
                };
            return e > n ? r(a, Math.min(o, 1439)) : (r(a, 1439), r(0, o)), i;
        },
        pulseGain: r,
        createPulser: function (t, n) {
            const e = new Map();
            return {
                add: function (i, a, o) {
                    const r = (function (e) {
                            const i = n.indexOf(e);
                            return ((i < 0 ? 0 : i) / n.length) * t;
                        })(i),
                        s = Math.ceil((o - r) / t - 1e-9),
                        l = s * t + r,
                        u = i + "@" + s;
                    let c = e.get(u);
                    c || ((c = { time: l, linea: i, starts: 0, ends: 0 }), e.set(u, c)),
                        "end" === a ? c.ends++ : c.starts++;
                },
                drain: function (i) {
                    const a = [];
                    return (
                        e.forEach(function (n, o) {
                            if (n.time <= i + 1e-9) {
                                const i = n.starts + n.ends,
                                    s = {
                                        time: n.time,
                                        linea: n.linea,
                                        kind: n.starts >= n.ends ? "start" : "end",
                                        count: i,
                                        gain: r(i),
                                    };
                                a.push(s),
                                    i >= 12 && a.push(Object.assign({}, s, { time: n.time + t / 2 })),
                                    e.delete(o);
                            }
                        }),
                        a.sort(function (t, e) {
                            return t.time - e.time || n.indexOf(t.linea) - n.indexOf(e.linea);
                        }),
                        a
                    );
                },
            };
        },
        stepPulser: function (t, n, e, i, a) {
            return (
                n.forEach(function (e, o) {
                    t.add(e.linea, e.kind, i + ((o + 0.5) / n.length) * a);
                }),
                t.drain(i + a).filter(function (t) {
                    return e.has(t.linea);
                })
            );
        },
        trailingMinutes: function (t, e) {
            const i = [],
                a = Math.ceil(t - e),
                o = Math.floor(t);
            for (let e = a; e <= o; e++) i.push({ minute: ((e % n) + n) % n, age: t - e });
            return i;
        },
    };
})("undefined" != typeof window ? window : globalThis);
