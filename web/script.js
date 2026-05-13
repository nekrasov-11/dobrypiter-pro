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

    (function initSignup() {
        const modal = document.querySelector("[data-signup-modal]");
        const block = modal && modal.querySelector("[data-signup-block]");
        const form = block && block.querySelector("[data-signup-form]");
        const formView = modal && modal.querySelector("[data-signup-form-view]");
        const successView = modal && modal.querySelector("[data-signup-success-view]");
        const status = form && form.querySelector("[data-form-status]");
        const submit = form && form.querySelector(".signup-submit");
        const submitLabel = submit && submit.querySelector(".signup-submit-label");
        const tgFallback = block && block.getAttribute("data-tg-fallback") || "https://t.me/nekrasov_valeriy";
        if (!modal || !form || !submit || !formView || !successView) return;

        const phoneInput = form.querySelector('[name="phone"]');
        const PHONE_PREFIX = "+7 ";

        if (phoneInput) {
            if (!phoneInput.value || !phoneInput.value.trim()) phoneInput.value = PHONE_PREFIX;
            phoneInput.addEventListener("focus", function () {
                if (!phoneInput.value || phoneInput.value === "+7") phoneInput.value = PHONE_PREFIX;
                requestAnimationFrame(function () {
                    const end = phoneInput.value.length;
                    phoneInput.setSelectionRange(end, end);
                });
            });
            phoneInput.addEventListener("input", function () {
                if (!phoneInput.value.startsWith("+7")) {
                    const rest = phoneInput.value.replace(/^[\s+]*7?\s*/, "");
                    phoneInput.value = PHONE_PREFIX + rest;
                }
            });
            phoneInput.addEventListener("keydown", function (e) {
                if ((e.key === "Backspace" || e.key === "Delete") && phoneInput.selectionStart <= PHONE_PREFIX.length && phoneInput.selectionEnd <= PHONE_PREFIX.length) {
                    e.preventDefault();
                }
            });
        }

        function showStatus(message, isError) {
            if (!status) return;
            status.innerHTML = message;
            status.classList.toggle("is-error", !!isError);
            status.hidden = false;
        }
        function hideStatus() {
            if (!status) return;
            status.hidden = true;
            status.textContent = "";
            status.classList.remove("is-error");
        }
        function genericError() {
            const link = '<a href="' + tgFallback + '" target="_blank" rel="noopener">' + tgFallback.replace(/^https?:\/\//, "") + '</a>';
            showStatus("Что-то пошло не&nbsp;так. Напишите нам в&nbsp;Telegram: " + link, true);
        }
        function validatePhone(value) {
            const digits = String(value || "").replace(/\D+/g, "");
            return digits.length >= 10 && digits.length <= 11;
        }

        function showFormView() {
            formView.hidden = false;
            successView.hidden = true;
            hideStatus();
        }
        function showSuccessView() {
            formView.hidden = true;
            successView.hidden = false;
        }
        function openModal() {
            showFormView();
            modal.hidden = false;
            document.body.style.overflow = "hidden";
            const firstField = form.querySelector('[name="name"]');
            if (firstField) setTimeout(function () { firstField.focus(); }, 50);
        }
        function closeModal() {
            modal.hidden = true;
            document.body.style.overflow = "";
            // Сбрасываем форму, чтобы при следующем открытии было чисто
            form.reset();
            if (phoneInput) phoneInput.value = PHONE_PREFIX;
            showFormView();
        }

        // Открытие модалки
        document.querySelectorAll("[data-open-signup]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                openModal();
            });
        });

        // Закрытие
        modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
            el.addEventListener("click", closeModal);
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !modal.hidden) closeModal();
        });

        // Submit
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            hideStatus();
            if (!form.checkValidity()) { form.reportValidity(); return; }
            if (phoneInput && !validatePhone(phoneInput.value)) {
                phoneInput.focus();
                showStatus("Проверьте номер телефона — кажется, неполный.", true);
                return;
            }
            const endpoint = (form.getAttribute("data-endpoint") || "").trim();
            if (!endpoint) {
                const link = '<a href="' + tgFallback + '" target="_blank" rel="noopener">' + tgFallback.replace(/^https?:\/\//, "") + '</a>';
                showStatus("Форма ещё не&nbsp;настроена. Напишите нам в&nbsp;Telegram: " + link, true);
                return;
            }
            const formData = new FormData(form);
            const payload = {
                name: (formData.get("name") || "").toString().trim(),
                phone: (formData.get("phone") || "").toString().trim(),
                group: (formData.get("group") || "").toString(),
                comment: (formData.get("comment") || "").toString().trim(),
                website: (formData.get("website") || "").toString(),
            };
            submit.disabled = true;
            if (submitLabel) submitLabel.textContent = "Отправляем…";
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error("HTTP " + res.status);
                const data = await res.json().catch(function () { return {}; });
                if (data && data.error) throw new Error(data.error);
                showSuccessView();
                if (typeof ym === "function") ym(108780081, "reachGoal", "signup_form_submit");
            } catch (err) {
                genericError();
            } finally {
                submit.disabled = false;
                if (submitLabel) submitLabel.textContent = submit.getAttribute("data-default-label") || "Записаться на пробное";
            }
        });
    })();

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
