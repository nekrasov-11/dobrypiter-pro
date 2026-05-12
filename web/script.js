(function () {
    const root = document.documentElement;
    let ticking = false;

    function update() {
        root.style.setProperty("--scroll", window.scrollY);
        ticking = false;
    }

    window.addEventListener("scroll", function () {
        if (!ticking) {
            window.requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });

    update();

    const grid = document.getElementById("schedule-grid");
    if (grid) {
        fetch("/api/schedule")
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (data) { renderSchedule(grid, data); })
            .catch(function () {
                grid.innerHTML = '<p class="schedule-loading">Не удалось загрузить расписание.</p>';
            });
    }

    function renderSchedule(target, data) {
        const groups = (data && Array.isArray(data.groups)) ? data.groups : [];
        if (!groups.length) {
            target.innerHTML = '<p class="schedule-loading">Расписание пока не заполнено.</p>';
            return;
        }
        const html = groups.map(function (g) {
            const rows = (g.sessions || []).map(function (s) {
                return '<tr><td>' + escapeHtml(s.day) + '</td><td>' + escapeHtml(s.start) + ' – ' + escapeHtml(s.end) + '</td></tr>';
            }).join("");
            return '<article class="schedule-card">' +
                '<h3>' + escapeHtml(g.name) + '</h3>' +
                '<table class="schedule-table"><tbody>' + rows + '</tbody></table>' +
                '</article>';
        }).join("");
        target.innerHTML = html;
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    document.querySelectorAll("[data-reviews-carousel]").forEach(function (carouselEl) {
        const slides = Array.prototype.slice.call(carouselEl.querySelectorAll(".rc-slide"));
        const dots = Array.prototype.slice.call(carouselEl.querySelectorAll(".rc-dot"));
        const prev = carouselEl.querySelector(".rc-prev");
        const next = carouselEl.querySelector(".rc-next");
        if (!slides.length) return;
        const interval = parseInt(carouselEl.getAttribute("data-interval"), 10) || 10000;
        let idx = 0;
        let timer = null;

        function show(target) {
            idx = ((target % slides.length) + slides.length) % slides.length;
            slides.forEach(function (s, k) { s.classList.toggle("is-active", k === idx); });
            dots.forEach(function (d, k) { d.classList.toggle("is-active", k === idx); });
        }

        function restartAuto() {
            if (timer) clearInterval(timer);
            timer = setInterval(function () { show(idx + 1); }, interval);
        }

        if (prev) prev.addEventListener("click", function () { show(idx - 1); restartAuto(); });
        if (next) next.addEventListener("click", function () { show(idx + 1); restartAuto(); });
        dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k); restartAuto(); }); });

        carouselEl.addEventListener("mouseenter", function () { if (timer) { clearInterval(timer); timer = null; } });
        carouselEl.addEventListener("mouseleave", restartAuto);

        restartAuto();
    });

    const video = document.querySelector(".hero-video");
    const toggle = document.querySelector(".hero-sound-toggle");
    const label = toggle && toggle.querySelector(".hero-sound-label");

    if (video && toggle) {
        toggle.addEventListener("click", function () {
            const willUnmute = video.muted;
            video.muted = !willUnmute;
            toggle.classList.toggle("is-muted", !willUnmute);
            toggle.setAttribute("aria-label", willUnmute ? "Выключить звук" : "Включить звук");
            if (label) label.textContent = willUnmute ? "Выключить звук" : "Включить звук";
            if (willUnmute) {
                const p = video.play();
                if (p && typeof p.catch === "function") p.catch(function () {});
            }
        });
    }
})();
