/* Site behaviour: theme, navigation, scrollspy, dynamic dates, contact form.
   Vanilla JS — replaces the old jQuery/Bootstrap/affix stack. */
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

    /* ---------- Sticky header shadow ---------- */
    var topbar = document.querySelector('.topbar');
    if (topbar && 'IntersectionObserver' in window) {
        var sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        topbar.parentNode.insertBefore(sentinel, topbar);
        new IntersectionObserver(function (entries) {
            topbar.classList.toggle('is-stuck', !entries[0].isIntersecting);
        }, { threshold: 1 }).observe(sentinel);
    }

    /* ---------- Scrollspy ---------- */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a[href^="#"]'));
    var sections = navLinks
        .map(function (link) { return document.querySelector(link.getAttribute('href')); })
        .filter(Boolean);

    if (sections.length && 'IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                navLinks.forEach(function (link) {
                    link.classList.toggle(
                        'is-active',
                        link.getAttribute('href') === '#' + entry.target.id
                    );
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(function (section) { spy.observe(section); });
    }

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
