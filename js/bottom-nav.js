!(function () {
    "use strict";
    const e =
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m16 16 4 4"/></svg>';
    function t(e) {
        const t = (e || "/").replace(/\/+$/, "") || "/";
        return "/" === t || "/index.html" === t
            ? "inicio"
            : "/mapa" === t || "/mapa.html" === t
              ? "mapa"
              : "/mis-favoritos" === t || "/mis-favoritos.html" === t
                ? "favoritos"
                : null;
    }
    const a = [
        {
            key: "inicio",
            href: "/",
            label: "Inicio",
            iconFilled:
                '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3.172 2.343 12l1.414 1.414L5 12.172V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-7.828l1.243 1.242L21.657 12 12 3.172Z"/></svg>',
            iconOutline:
                '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z"/></svg>',
        },
        { key: "buscar", label: "Buscar", isTrigger: !0, iconFilled: e, iconOutline: e },
        {
            key: "mapa",
            href: "/mapa",
            label: "Mapa",
            iconFilled:
                '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Zm0 2.236 6 2V18.764l-6-2V5.236Z"/></svg>',
            iconOutline:
                '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M9 4 3.5 5.75v14.5L9 18.5l6 1.75 5.5-1.75V4.25L15 6 9 4Zm0 0v14.5m6-12.5v14"/></svg>',
        },
        {
            key: "favoritos",
            href: "/mis-favoritos",
            label: "Favoritos",
            iconFilled:
                '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2Z"/></svg>',
            iconOutline:
                '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="m12 2.8 2.84 5.76 6.35.92-4.6 4.48 1.09 6.34L12 17.27l-5.68 2.98 1.09-6.34-4.6-4.48 6.35-.92L12 2.8Z"/></svg>',
        },
    ];
    function n(e, t) {
        a.forEach((a) => {
            const n = (function (e) {
                const t = document.createElement(e.isTrigger ? "button" : "a");
                (t.className = "bottom-nav-item"),
                    t.setAttribute("data-nav-key", e.key),
                    e.isTrigger ? (t.type = "button") : (t.href = e.href);
                const a = document.createElement("span");
                (a.className = "bottom-nav-icon bottom-nav-icon-outline"),
                    a.setAttribute("aria-hidden", "true"),
                    (a.innerHTML = e.iconOutline);
                const n = document.createElement("span");
                (n.className = "bottom-nav-icon bottom-nav-icon-filled"),
                    n.setAttribute("aria-hidden", "true"),
                    (n.innerHTML = e.iconFilled);
                const r = document.createElement("span");
                return (
                    (r.className = "bottom-nav-label"),
                    (r.textContent = e.label),
                    t.appendChild(a),
                    t.appendChild(n),
                    t.appendChild(r),
                    t
                );
            })(a);
            a.key === t && (n.classList.add("is-active"), n.setAttribute("aria-current", "page")), e.appendChild(n);
        });
    }
    let r = null,
        o = null,
        i = null,
        c = !1,
        s = null,
        l = null,
        d = null,
        u = !1;
    function m() {
        const e = r.querySelector("#buscar-overlay-body");
        if (!e) return;
        const t = document.getElementById("search-container"),
            a = document.getElementById("search-input"),
            n = document.getElementById("search-dropdown");
        if (t && a && n)
            (l = { container: t, parent: t.parentNode, nextSibling: t.nextSibling }),
                t.classList.remove("hidden"),
                e.appendChild(t),
                t.classList.add("search-container--in-overlay"),
                (o = a),
                (i = n);
        else {
            const t = (function () {
                const e = document.createElement("div");
                (e.id = "search-container"), (e.className = "search-container search-container--overlay");
                const t = document.createElement("input");
                (t.type = "search"),
                    (t.id = "search-input"),
                    (t.className = "search-input"),
                    (t.placeholder = "Buscar estaciÃ³n, viaje, lÃ­nea o ramal..."),
                    t.setAttribute("aria-label", "Buscar estaciÃ³n, viaje, lÃ­nea o ramal"),
                    (t.autocomplete = "off");
                const a = document.createElement("div");
                return (
                    (a.id = "search-dropdown"), (a.className = "search-dropdown"), e.appendChild(t), e.appendChild(a), e
                );
            })();
            e.appendChild(t),
                (o = t.querySelector("#search-input")),
                (i = t.querySelector("#search-dropdown")),
                "function" == typeof window.initSearch && window.initSearch();
        }
    }
    function h(e) {
        if (!c || "Tab" !== e.key || !r) return;
        const t = Array.from(
            r.querySelectorAll(
                '.buscar-overlay-sheet button:not([disabled]), .buscar-overlay-sheet input:not([disabled]), .buscar-overlay-sheet a[href], .buscar-overlay-sheet [tabindex]:not([tabindex="-1"])'
            )
        ).filter((e) => null !== e.offsetParent || e === document.activeElement);
        if (0 === t.length) return;
        const a = t[0],
            n = t[t.length - 1],
            o = document.activeElement,
            i = !r.contains(o);
        e.shiftKey
            ? (o === a || i) && (e.preventDefault(), n.focus())
            : (o === n || i) && (e.preventDefault(), a.focus());
    }
    function v() {
        if (c || !r) return;
        (s = document.activeElement),
            m(),
            r.classList.add("is-open"),
            r.setAttribute("aria-hidden", "false"),
            document.body.classList.add("buscar-overlay-open");
        const e = document.querySelector('nav.bottom-nav[data-quetren-nav="true"]'),
            t = e && e.querySelector('[data-nav-key="buscar"]');
        t && t.setAttribute("aria-expanded", "true"),
            e &&
                (e.querySelectorAll(".bottom-nav-item.is-active").forEach((e) => {
                    e.classList.remove("is-active"), e.removeAttribute("aria-current");
                }),
                t && (t.classList.add("is-active"), t.setAttribute("aria-current", "true")));
        const a = document.querySelector("main");
        a && a.setAttribute("inert", "");
        const n = document.querySelector("header");
        n && n.setAttribute("inert", ""),
            (d = h),
            document.addEventListener("keydown", d, !0),
            (c = !0),
            setTimeout(() => {
                if (c && o) {
                    o.focus();
                    try {
                        o.dispatchEvent(new Event("focus"));
                    } catch (e) {}
                }
            }, 50);
    }
    function b() {
        if (!c || !r) return;
        r.classList.remove("is-open"),
            r.setAttribute("aria-hidden", "true"),
            document.body.classList.remove("buscar-overlay-open");
        const e = document.querySelector('nav.bottom-nav[data-quetren-nav="true"]'),
            a = e && e.querySelector('[data-nav-key="buscar"]');
        if ((a && a.setAttribute("aria-expanded", "false"), e)) {
            a && (a.classList.remove("is-active"), a.removeAttribute("aria-current"));
            const n = t(window.location.pathname);
            if (n) {
                const t = e.querySelector(`[data-nav-key="${n}"]`);
                t && (t.classList.add("is-active"), t.setAttribute("aria-current", "page"));
            }
        }
        const n = document.querySelector("main");
        n && n.removeAttribute("inert");
        const o = document.querySelector("header");
        if (
            (o && o.removeAttribute("inert"),
            d && (document.removeEventListener("keydown", d, !0), (d = null)),
            i && i.classList.remove("visible"),
            (function () {
                if (!l) return;
                const { container: e, parent: t, nextSibling: a } = l;
                e.classList.remove("search-container--in-overlay"),
                    t && (a && a.parentNode === t ? t.insertBefore(e, a) : t.appendChild(e)),
                    "function" == typeof window.refreshHeaderSearchVisibility && window.refreshHeaderSearchVisibility(),
                    (l = null);
            })(),
            (c = !1),
            s && "function" == typeof s.focus)
        )
            try {
                s.focus();
            } catch (e) {}
    }
    function p() {
        (r = (function () {
            const e = document.createElement("div");
            (e.className = "buscar-overlay"),
                e.setAttribute("role", "dialog"),
                e.setAttribute("aria-modal", "true"),
                e.setAttribute("aria-label", "Buscar"),
                e.setAttribute("aria-hidden", "true");
            const t = document.createElement("div");
            (t.className = "buscar-overlay-backdrop"), t.setAttribute("data-buscar-close", "true");
            const a = document.createElement("div");
            a.className = "buscar-overlay-sheet";
            const n = document.createElement("div");
            n.className = "buscar-overlay-header";
            const r = document.createElement("h2");
            (r.className = "buscar-overlay-title"), (r.textContent = "Buscar");
            const o = document.createElement("button");
            (o.type = "button"),
                (o.className = "buscar-overlay-close"),
                o.setAttribute("data-buscar-close", "true"),
                o.setAttribute("aria-label", "Cerrar bÃºsqueda"),
                (o.innerHTML =
                    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>'),
                n.appendChild(r),
                n.appendChild(o);
            const i = document.createElement("button");
            (i.type = "button"),
                (i.className = "buscar-overlay-cercanas"),
                i.setAttribute("data-buscar-cercanas", "true"),
                i.setAttribute("aria-label", "Estaciones cerca de mÃ­");
            const c = document.createElement("span");
            (c.className = "buscar-overlay-cercanas-icon"),
                c.setAttribute("aria-hidden", "true"),
                (c.innerHTML =
                    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>');
            const s = document.createElement("span");
            (s.className = "buscar-overlay-cercanas-label"),
                (s.textContent = "Estaciones cerca de mÃ­"),
                i.appendChild(c),
                i.appendChild(s);
            const l = !!document.getElementById("cerca-de-mi-btn"),
                d = document.createElement("div");
            return (
                (d.className = "buscar-overlay-body"),
                (d.id = "buscar-overlay-body"),
                a.appendChild(n),
                l && a.appendChild(i),
                a.appendChild(d),
                e.appendChild(t),
                e.appendChild(a),
                e
            );
        })()),
            document.body.appendChild(r),
            r.addEventListener("click", (e) => {
                const t = e.target;
                if (t && t.closest)
                    if (t.closest('[data-buscar-close="true"]')) b();
                    else if (t.closest('[data-buscar-cercanas="true"]')) {
                        e.stopPropagation(), b();
                        const t = document.getElementById("cerca-de-mi-btn");
                        t ? t.click() : (window.location.href = "/?cercanas=1");
                    }
            }),
            document.addEventListener("click", (e) => {
                if (!c) return;
                const t = e.target;
                t && t.closest && t.closest(".search-result-item") && setTimeout(b, 0);
            }),
            document.addEventListener("keydown", (e) => {
                c && "Escape" === e.key && (e.preventDefault(), b());
            }),
            window.addEventListener("pageshow", (e) => {
                e.persisted && c && b();
            });
    }
    function f() {
        if (u) return;
        u = !0;
        const e = t(window.location.pathname);
        let o = document.querySelector('nav.bottom-nav[data-quetren-nav="true"]');
        o
            ? o.querySelectorAll("[data-nav-key]").length < a.length && n(o, e)
            : ((o = (function (e) {
                  const t = document.createElement("nav");
                  return (
                      (t.className = "bottom-nav"), t.setAttribute("aria-label", "NavegaciÃ³n principal"), n(t, e), t
                  );
              })(e)),
              o.setAttribute("data-quetren-nav", "true"),
              document.body.appendChild(o));
        const i = o.querySelector('[data-nav-key="buscar"]');
        i &&
            (i.setAttribute("aria-expanded", "false"),
            i.addEventListener("click", (e) => {
                e.preventDefault(), c ? b() : v();
            })),
            o.querySelectorAll("a").forEach((e) => {
                e.addEventListener("click", () => {
                    c && b();
                });
            }),
            r || p();
    }
    "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", f) : f(),
        (window.BottomNav = { open: v, close: b, activeTabForPath: t });
})();
