/* Site behaviour: theme, navigation, the slide deck, dynamic dates and the
   contact form. Vanilla JS — replaces the old jQuery/Bootstrap/affix stack. */
(function () {
    'use strict';

    /* ---------- Theme toggle ---------- */
    // The initial value is set by the inline script in <head> to avoid a flash.
    var root = document.documentElement;
    var themeBtn = document.querySelector('.theme-toggle');

    function labelTheme() {
        if (!themeBtn) return;
        var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        themeBtn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    }
    labelTheme();

    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* private mode */ }
            labelTheme();
        });
    }

    // Follow the OS unless the visitor has made an explicit choice.
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSchemeChange = function (e) {
        var stored = null;
        try { stored = localStorage.getItem('theme'); } catch (err) { /* private mode */ }
        if (stored) return;
        root.dataset.theme = e.matches ? 'dark' : 'light';
        labelTheme();
    };
    if (mq.addEventListener) mq.addEventListener('change', onSchemeChange);
    else if (mq.addListener) mq.addListener(onSchemeChange);

    /* ---------- Mobile navigation ---------- */
    var navToggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');

    if (navToggle && nav) {
        navToggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', String(open));
            navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });

        nav.addEventListener('click', function (e) {
            if (e.target.tagName !== 'A') return;
            nav.classList.remove('is-open');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.setAttribute('aria-label', 'Open menu');
        });
    }

    /* ---------- Slide deck ---------- */
    var deck = document.querySelector('.deck');
    var slides = deck ? Array.prototype.slice.call(deck.querySelectorAll('.slide')) : [];

    if (deck && slides.length) (function () {
        var current = 0;
        var busy = false;
        var pending = 0;             // a move requested while the deck was busy
        var DURATION = 300;          // must match --slide-dur
        var EDGE = 2;                // px tolerance when testing inner scroll ends

        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

        function atTop(el)    { return el.scrollTop <= EDGE; }
        function atBottom(el) { return el.scrollTop + el.clientHeight >= el.scrollHeight - EDGE; }

        function setNav() {
            var id = slides[current].id;
            Array.prototype.forEach.call(
                document.querySelectorAll('.site-nav a[href^="#"]'), function (a) {
                    a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
                });
            Array.prototype.forEach.call(
                document.querySelectorAll('.deck-nav button'), function (b, i) {
                    b.setAttribute('aria-current', i === current ? 'true' : 'false');
                });
            if (id && history.replaceState) history.replaceState(null, '', '#' + id);
        }

        function go(next, dir) {
            if (busy || next === current || next < 0 || next >= slides.length) return;
            busy = true;

            var from = slides[current];
            var to = slides[next];
            var inCls  = dir > 0 ? 'in-down'  : 'in-up';
            var outCls = dir > 0 ? 'out-down' : 'out-up';

            to.scrollTop = 0;
            to.classList.add('is-current');
            from.classList.add('is-leaving');

            if (reduced.matches) {
                from.classList.remove('is-current', 'is-leaving');
                current = next;
                setNav();
                busy = false;
                flushPending();
                return;
            }

            to.classList.add(inCls);
            from.classList.add(outCls);

            window.setTimeout(function () {
                from.classList.remove('is-current', 'is-leaving', outCls);
                to.classList.remove(inCls);
                to.scrollTop = 0;        // belt and braces: always land on the heading
                current = next;
                setNav();
                busy = false;
                flushPending();
            }, DURATION);
        }

        // A swipe made during a transition used to be dropped, which is why
        // navigating again right after changing section often did nothing.
        // One move is remembered and replayed instead.
        function flushPending() {
            if (!pending) return;
            var dir = pending;
            pending = 0;
            var slide = slides[current];
            // re-check the edge: the new slide may have room to scroll
            if (dir > 0 ? !atBottom(slide) : !atTop(slide)) return;
            step(dir);
        }

        function step(dir) { go(current + dir, dir); }

        // --- wheel / trackpad ---
        // A flick is ONE gesture that emits dozens of events, so intent has to
        // be tracked per gesture rather than per event. Two rules follow:
        //
        //  1. A gesture that begins while the slide still has room to scroll
        //     never changes section — not even once it reaches the edge. That
        //     is what stopped Resume and Projects from jumping to the next
        //     section the moment you scrolled to their bottom.
        //  2. A gesture fires at most one move, and ends once the wheel goes
        //     quiet or the user pushes again harder (momentum only decays, so
        //     re-acceleration means a genuine second swipe).
        var gesture = { active: false, fired: false, canAdvance: false, dir: 0 };
        var quietTimer = null;
        var lastEventAt = 0;
        var cooldownUntil = 0;
        var lastAbs = 0;

        function beginGesture(down, canScrollInside) {
            gesture.active = true;
            gesture.fired = false;
            gesture.canAdvance = !canScrollInside;
            gesture.dir = down ? 1 : -1;
        }

        deck.addEventListener('wheel', function (e) {
            var slide = slides[current];
            var down = e.deltaY > 0;
            var absY = Math.abs(e.deltaY);
            var canScrollInside = down ? !atBottom(slide) : !atTop(slide);

            var now = Date.now();
            var gap = now - lastEventAt;
            lastEventAt = now;

            var reversed = gesture.active && (down ? 1 : -1) !== gesture.dir;

            // A fresh push is only recognised once the cooldown has passed.
            // Detecting it purely from delta size (momentum "re-accelerating")
            // misfires on a fast flick, whose deltas are large and noisy — that
            // is what made a quick swipe jump two sections at once.
            // Momentum decays, so a genuine second push is not just "big" — it
            // is much bigger than the tail currently coasting. Comparing
            // against the previous delta is what separates the two; an
            // absolute threshold alone cannot, because early momentum from a
            // hard flick is still large when the short cooldown expires.
            var freshPush = gesture.fired && now >= cooldownUntil &&
                            absY >= 40 && absY > lastAbs * 1.8;
            lastAbs = absY;

            if (!gesture.active || gap > 100 || reversed || freshPush) {
                beginGesture(down, canScrollInside);
            }

            window.clearTimeout(quietTimer);
            quietTimer = window.setTimeout(function () {
                gesture.active = false;
                lastAbs = 0;
            }, 110);

            // Once this gesture has already moved the deck, swallow the rest of
            // its momentum. Without this the tail of the flick lands on the
            // slide that just arrived and scrolls it down past its heading.
            if (gesture.fired) { e.preventDefault(); return; }

            // A swipe during a transition is remembered rather than dropped;
            // flushPending re-checks the edge before replaying it.
            if (busy) {
                e.preventDefault();
                gesture.fired = true;
                pending = down ? 1 : -1;
                return;
            }

            // Inside its own overflow the slide scrolls normally.
            if (canScrollInside) return;

            e.preventDefault();
            if (!gesture.canAdvance || absY < 3) return;

            gesture.fired = true;
            // cooldownUntil only gates the "fresh push" heuristic above; it no
            // longer blocks input, because blocking silently threw the swipe
            // away instead of acting on it.
            cooldownUntil = now + 200;
            step(down ? 1 : -1);
        }, { passive: false });

        // --- touch ---
        // Same rule as the wheel: whether the section may change is decided at
        // touchstart, so a swipe that begins mid-section only scrolls.
        var touchY = null;
        var touchCanAdvance = false;

        deck.addEventListener('touchstart', function (e) {
            var slide = slides[current];
            touchY = e.touches[0].clientY;
            // record both edges now; direction is only known on touchend
            touchCanAdvance = { top: atTop(slide), bottom: atBottom(slide) };
        }, { passive: true });

        deck.addEventListener('touchend', function (e) {
            if (touchY === null) return;
            var dy = touchY - e.changedTouches[0].clientY;
            var edges = touchCanAdvance;
            touchY = null;
            if (Math.abs(dy) < 60 || busy || !edges) return;

            var down = dy > 0;
            if (down ? !edges.bottom : !edges.top) return;
            step(down ? 1 : -1);
        }, { passive: true });

        // --- keyboard ---
        document.addEventListener('keydown', function (e) {
            if (e.target.matches('input, textarea, select')) return;
            var slide = slides[current];
            switch (e.key) {
                case 'ArrowDown': case 'PageDown':
                    if (!atBottom(slide)) return;
                    e.preventDefault(); step(1); break;
                case 'ArrowUp': case 'PageUp':
                    if (!atTop(slide)) return;
                    e.preventDefault(); step(-1); break;
                case 'Home': e.preventDefault(); go(0, -1); break;
                case 'End':  e.preventDefault(); go(slides.length - 1, 1); break;
            }
        });

        // --- in-page links ---
        document.addEventListener('click', function (e) {
            var link = e.target.closest('a[href^="#"]');
            if (!link) return;
            var id = link.getAttribute('href').slice(1);
            if (!id) return;
            var idx = slides.indexOf(document.getElementById(id));
            if (idx === -1) return;
            e.preventDefault();
            go(idx, idx > current ? 1 : -1);
        });

        // --- progress dots ---
        var dots = document.createElement('ul');
        dots.className = 'deck-nav screen-only';
        dots.setAttribute('aria-label', 'Sections');
        slides.forEach(function (s, i) {
            var li = document.createElement('li');
            var b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('aria-label', (s.id || 'Section ' + (i + 1)).replace(/^\w/, function (c) {
                return c.toUpperCase();
            }));
            b.addEventListener('click', function () { go(i, i > current ? 1 : -1); });
            li.appendChild(b);
            dots.appendChild(li);
        });
        document.body.appendChild(dots);

        // open on the slide named in the URL, if any
        var startIdx = slides.indexOf(document.getElementById(location.hash.slice(1)));
        current = startIdx > -1 ? startIdx : 0;
        slides[current].classList.add('is-current');
        setNav();
    })();

    /* ---------- Print / download CV ---------- */
    Array.prototype.forEach.call(document.querySelectorAll('[data-print]'), function (btn) {
        btn.addEventListener('click', function () { window.print(); });
    });

    /* ---------- Dynamic dates ---------- */
    // Footer year.
    Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
        el.textContent = String(new Date().getFullYear());
    });

    // Years of experience, counted from the first substantive role so the
    // number never goes stale. Format: data-years-since="YYYY-MM".
    Array.prototype.forEach.call(document.querySelectorAll('[data-years-since]'), function (el) {
        var parts = el.getAttribute('data-years-since').split('-');
        var start = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        var now = new Date();
        var months = (now.getFullYear() - start.getFullYear()) * 12
                   + (now.getMonth() - start.getMonth());
        var years = Math.floor(months / 12);
        if (years > 0) el.textContent = String(years);
    });

    /* ---------- Contact form (loaded on demand) ---------- */
    var formHost = document.getElementById('hubspot-form');

    function loadHubspot() {
        var script = document.createElement('script');
        script.src = 'https://js-eu1.hsforms.net/forms/embed/v2.js';
        script.charset = 'utf-8';
        script.async = true;
        script.onload = function () {
            if (!window.hbspt) return;
            window.hbspt.forms.create({
                region: 'eu1',
                portalId: '26284719',
                formId: '551d968c-eaaa-45b3-a1b7-f51943572586',
                target: '#hubspot-form'
            });
        };
        script.onerror = function () {
            formHost.innerHTML = '<p>The contact form failed to load. '
                + 'Please email me at <a href="mailto:alessandrodiscalzi98@gmail.com">'
                + 'alessandrodiscalzi98@gmail.com</a>.</p>';
        };
        document.head.appendChild(script);
    }

    // Deferred to idle rather than to an IntersectionObserver: the form host is
    // an empty (zero-height) div, which is exactly the case where observers are
    // least predictable, and a contact form that silently never appears is a
    // worse failure than loading one script a moment early.
    if (formHost) {
        var startForm = function () {
            if (window.requestIdleCallback) {
                window.requestIdleCallback(loadHubspot, { timeout: 3000 });
            } else {
                setTimeout(loadHubspot, 1200);
            }
        };
        if (document.readyState === 'complete') startForm();
        else window.addEventListener('load', startForm);
    }
})();
