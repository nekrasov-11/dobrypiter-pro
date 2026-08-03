(function () {
    // ===== Schedule: подмена статичного HTML свежими данными из API =====
    const grid = document.getElementById("schedule-grid");
    if (grid) {
        fetch("/api/schedule")
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (data) {
                if (data && Array.isArray(data.groups) && data.groups.length) {
                    renderSchedule(grid, data);
                }
            })
            .catch(function () {
                // API недоступен — оставляем статический HTML
            });
    }

    function renderSchedule(target, data) {
        let groups = (data && Array.isArray(data.groups)) ? data.groups : [];
        // Подстраницы показывают только свои группы: data-schedule-groups="Детская группа,Подростковая группа".
        // Имена должны совпадать с теми, что отдаёт /api/schedule (правятся в админке).
        const filterAttr = target.getAttribute("data-schedule-groups");
        if (filterAttr) {
            const wanted = filterAttr.split(",").map(function (s) { return s.trim().toLowerCase(); });
            groups = groups.filter(function (g) {
                return wanted.indexOf(String(g.name || "").trim().toLowerCase()) !== -1;
            });
        }
        // Фильтр ничего не нашёл (группу переименовали) — оставляем статичный фолбэк из HTML.
        if (!groups.length) return;
        const html = groups.map(function (g) {
            const rows = (g.sessions || []).map(function (s) {
                return '<div class="sch-row"><span class="sch-day">' + escapeHtml(s.day) + '</span><span class="sch-time">' + escapeHtml(s.start) + '–' + escapeHtml(s.end) + '</span></div>';
            }).join("");
            const sessions = (g.sessions || []).length;
            const badge = sessions ? '<span class="sch-badge">' + sessions + '×/неделю</span>' : '';
            return '<article class="sch-card">' +
                '<div class="sch-card-title">' + escapeHtml(g.name) + '</div>' +
                rows +
                badge +
                '</article>';
        }).join("");
        target.innerHTML = html;
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    // ===== Reviews carousel (активна только на mobile — на desktop стрелки/dots скрыты CSS) =====
    document.querySelectorAll("[data-reviews-carousel]").forEach(function (carouselEl) {
        const slides = Array.prototype.slice.call(carouselEl.querySelectorAll(".rev-card"));
        const dots = Array.prototype.slice.call(carouselEl.querySelectorAll(".rev-dot"));
        const prev = carouselEl.querySelector(".rev-prev");
        const next = carouselEl.querySelector(".rev-next");
        if (!slides.length) return;
        const interval = parseInt(carouselEl.getAttribute("data-interval"), 10) || 10000;
        let idx = 0;
        let timer = null;

        function isCarouselActive() {
            // На десктопе стрелки скрыты CSS — карусель отключаем
            return prev && getComputedStyle(prev).display !== "none";
        }

        function show(target) {
            idx = ((target % slides.length) + slides.length) % slides.length;
            slides.forEach(function (s, k) { s.classList.toggle("is-active", k === idx); });
            dots.forEach(function (d, k) { d.classList.toggle("is-active", k === idx); });
        }

        function restartAuto() {
            if (timer) clearInterval(timer);
            if (!isCarouselActive()) return;
            timer = setInterval(function () { show(idx + 1); }, interval);
        }

        function stopAuto() {
            if (timer) { clearInterval(timer); timer = null; }
        }

        if (prev) prev.addEventListener("click", function () { show(idx - 1); restartAuto(); });
        if (next) next.addEventListener("click", function () { show(idx + 1); restartAuto(); });
        dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k); restartAuto(); }); });

        carouselEl.addEventListener("mouseenter", stopAuto);
        carouselEl.addEventListener("mouseleave", restartAuto);

        // Свайп на мобильном
        let touchStartX = null;
        let touchStartY = null;
        carouselEl.addEventListener("touchstart", function (e) {
            if (!isCarouselActive()) return;
            const t = e.changedTouches[0];
            touchStartX = t.screenX;
            touchStartY = t.screenY;
        }, { passive: true });
        carouselEl.addEventListener("touchend", function (e) {
            if (touchStartX === null) return;
            const t = e.changedTouches[0];
            const dx = t.screenX - touchStartX;
            const dy = t.screenY - touchStartY;
            touchStartX = null;
            // Минимум 40px горизонтально, и горизонталь больше вертикали (иначе это скролл)
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) show(idx + 1);
                else show(idx - 1);
                restartAuto();
            }
        }, { passive: true });

        // При ресайзе пересмотреть, активна ли карусель
        let resizeTimer;
        window.addEventListener("resize", function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (isCarouselActive()) {
                    restartAuto();
                } else {
                    stopAuto();
                    // На desktop возвращаем первую видимой (на всякий случай)
                    slides.forEach(function (s, k) { s.classList.toggle("is-active", k === 0); });
                    dots.forEach(function (d, k) { d.classList.toggle("is-active", k === 0); });
                    idx = 0;
                }
            }, 200);
        });

        restartAuto();
    });

    // ===== Inline signup form =====
    (function initSignup() {
        const form = document.querySelector("[data-signup-form]");
        const block = document.querySelector("[data-signup-block]");
        const formView = document.querySelector("[data-signup-form-view]");
        const successView = document.querySelector("[data-signup-success-view]");
        const status = form && form.querySelector("[data-form-status]");
        const submit = form && form.querySelector(".signup-submit");
        const submitLabel = submit && submit.querySelector(".signup-submit-label");
        const tgFallback = (block && block.getAttribute("data-tg-fallback")) || "https://t.me/nekrasov_valeriy";
        if (!form || !submit || !formView || !successView) return;

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
                page: location.pathname,
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
                if (typeof ym === "function") ym(108780081, "reachGoal", "form_submit");
            } catch (err) {
                genericError();
            } finally {
                submit.disabled = false;
                if (submitLabel) submitLabel.textContent = submit.getAttribute("data-default-label") || "Записаться на пробное занятие";
            }
        });

    })();

    // ===== CTA-кнопки (scroll к форме + ym goal form_open) =====
    document.querySelectorAll("[data-scroll-form]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            const target = document.getElementById("contacts");
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            if (typeof ym === "function") ym(108780081, "reachGoal", "form_open");
            // Слегка задерживаем фокус, чтобы скролл успел доехать
            setTimeout(function () {
                const nameField = document.querySelector('[data-signup-form] [name="name"]');
                if (nameField) nameField.focus({ preventScroll: true });
            }, 600);
        });
    });

    // ===== Reveal-on-scroll (только мобайл): scroll-driven подсветка =====
    // В каждой группе чипов (.sch-grid, .about-nums, .coach-badges) подсвечен ровно один
    // элемент — тот, на чей sub-range приходится текущая позиция скролла внутри группы.
    // Track группы: от момента, когда её верх достигает 2/3 viewport (group ещё внизу),
    // до момента, когда её низ достигает 1/3 viewport (group уже сверху).
    // Внутри track элементы делят прогресс [0..1] на равные сегменты.
    (function initRevealOnScroll() {
        const mq = window.matchMedia && window.matchMedia('(max-width: 900px)');
        if (!mq) return;

        const groups = Array.prototype.slice.call(
            document.querySelectorAll('.sch-grid, .about-nums, .coach-badges')
        );
        if (!groups.length) return;

        function clearAll() {
            groups.forEach(function (g) {
                Array.prototype.forEach.call(g.children, function (el) {
                    el.classList.remove('is-revealed');
                });
            });
        }

        function update() {
            if (!mq.matches) { clearAll(); return; }
            const vh = window.innerHeight;
            groups.forEach(function (group) {
                const items = group.children;
                const n = items.length;
                if (!n) return;
                const rect = group.getBoundingClientRect();
                // progress = 0 когда top группы на 2/3 viewport (только-только въезжает)
                // progress = 1 когда bottom на 1/3 viewport (уже почти прошла мимо)
                const range = vh / 3 + rect.height;
                const progress = (vh * 2 / 3 - rect.top) / range;
                const p = Math.max(0, Math.min(1, progress));

                // Активен элемент, на чей сегмент попал прогресс. Вне track — никто.
                let activeIdx = -1;
                if (p > 0 && p < 1) {
                    activeIdx = Math.min(n - 1, Math.floor(p * n));
                }
                for (let i = 0; i < n; i++) {
                    items[i].classList.toggle('is-revealed', i === activeIdx);
                }
            });
        }

        let ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                update();
                ticking = false;
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        if (mq.addEventListener) mq.addEventListener('change', onScroll);
        else if (mq.addListener) mq.addListener(onScroll);
        update();
    })();

    // ===== Hero video sound toggle =====
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
