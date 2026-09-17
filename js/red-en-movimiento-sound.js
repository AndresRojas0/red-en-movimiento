!(function (e) {
    "use strict";
    const n = {
            mitre: 523.25,
            sarmiento: 587.33,
            roca: 659.25,
            "belgrano-sur": 783.99,
            "belgrano-norte": 880,
            "san-martin": 1046.5,
            urquiza: 1174.66,
            "tren-de-la-costa": 1318.51,
        },
        t = { start: { octave: 1, seconds: 0.03, peak: 0.9 }, end: { octave: 0.5, seconds: 0.045, peak: 0.55 } },
        c = 0.003;
    e.QuetrenAnimSound = {
        PITCHES: n,
        createEngine: function (e) {
            const o = e.createGain();
            o.gain.value = 0.25;
            const a = e.createDynamicsCompressor();
            o.connect(a), a.connect(e.destination);
            const s = {};
            return (
                Object.keys(n).forEach(function (o) {
                    Object.keys(t).forEach(function (a) {
                        const r = t[a],
                            i = (function (e, n, t) {
                                const o = Math.ceil(n.seconds * t),
                                    a = new Float32Array(o),
                                    s = n.seconds / 5;
                                for (let r = 0; r < o; r++) {
                                    const o = r / t;
                                    let i = o < c ? o / c : Math.exp(-(o - c) / s);
                                    const u = n.seconds - o;
                                    u < 0.005 && (i *= Math.max(0, u / 0.005)),
                                        (a[r] = n.peak * i * Math.sin(2 * Math.PI * e * o));
                                }
                                return a;
                            })(n[o] * r.octave, r, e.sampleRate),
                            u = e.createBuffer(1, i.length, e.sampleRate);
                        u.copyToChannel(i, 0), (s[o + ":" + a] = u);
                    });
                }),
                {
                    context: e,
                    schedule: function (n) {
                        for (let t = 0; t < n.length; t++) {
                            const c = n[t],
                                a = s[c.linea + ":" + c.kind];
                            if (!a) continue;
                            const r = e.createBufferSource();
                            if (((r.buffer = a), "number" == typeof c.gain && 1 !== c.gain)) {
                                const n = e.createGain();
                                (n.gain.value = c.gain), r.connect(n), n.connect(o);
                            } else r.connect(o);
                            r.start(Math.max(c.time, e.currentTime));
                        }
                    },
                }
            );
        },
    };
})("undefined" != typeof window ? window : globalThis);
