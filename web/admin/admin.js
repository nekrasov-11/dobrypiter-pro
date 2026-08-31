(function () {
    const TOKEN_KEY = "boxing_admin_token";
    const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

    const loginView = document.getElementById("login-view");
    const editorView = document.getElementById("editor-view");
    const loginForm = document.getElementById("login-form");
    const loginInput = document.getElementById("login-input");
    const passwordInput = document.getElementById("password-input");
    const loginError = document.getElementById("login-error");
    const groupsRoot = document.getElementById("groups");
    const addGroupBtn = document.getElementById("add-group-btn");
    const saveBtn = document.getElementById("save-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const status = document.getElementById("status");
    const editorTitle = document.getElementById("editor-title");
    const tabButtons = document.querySelectorAll(".tab");
    const tabSections = {
        schedule: document.getElementById("tab-schedule"),
        prices: document.getElementById("tab-prices"),
    };
    const TAB_TITLES = { schedule: "Расписание тренировок", prices: "Цены" };
    const pricesRoot = document.getElementById("price-categories");
    const addCategoryBtn = document.getElementById("add-category-btn");
    const noteInput = document.getElementById("price-note");

    const PRICE_KINDS = [
        { value: "sub", label: "Абонемент" },
        { value: "single", label: "Разовая" },
        { value: "trial", label: "Пробная" },
        { value: "other", label: "Другое" },
    ];

    let schedule = { groups: [] };
    let prices = { categories: [], note: "" };
    let activeTab = "schedule";

    function getToken() { return localStorage.getItem(TOKEN_KEY); }
    function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
    function clearToken() { localStorage.removeItem(TOKEN_KEY); }

    function showLogin() {
        loginView.hidden = false;
        editorView.hidden = true;
        loginError.hidden = true;
        passwordInput.value = "";
    }
    function showEditor() {
        loginView.hidden = true;
        editorView.hidden = false;
        showTab(activeTab);
        loadSchedule();
        loadPrices();
    }

    function showTab(name) {
        activeTab = name;
        Object.keys(tabSections).forEach(function (key) {
            tabSections[key].hidden = key !== name;
        });
        tabButtons.forEach(function (btn) {
            btn.classList.toggle("is-active", btn.dataset.tab === name);
        });
        editorTitle.textContent = TAB_TITLES[name];
    }

    tabButtons.forEach(function (btn) {
        btn.addEventListener("click", function () { showTab(btn.dataset.tab); });
    });

    function showStatus(message, kind) {
        status.textContent = message;
        status.className = "status " + (kind || "success");
        status.hidden = false;
        setTimeout(function () { status.hidden = true; }, 3000);
    }

    async function loadSchedule() {
        try {
            const res = await fetch("/api/schedule");
            const data = await res.json();
            schedule = data && Array.isArray(data.groups) ? data : { groups: [] };
            render();
        } catch (e) {
            showStatus("Не удалось загрузить расписание", "error");
        }
    }

    function render() {
        groupsRoot.innerHTML = "";
        schedule.groups.forEach(function (group, gIdx) {
            groupsRoot.appendChild(buildGroup(group, gIdx));
        });
    }

    function buildGroup(group, gIdx) {
        const el = document.createElement("article");
        el.className = "group";

        const header = document.createElement("div");
        header.className = "group-header";

        const nameInput = document.createElement("input");
        nameInput.className = "group-name";
        nameInput.type = "text";
        nameInput.value = group.name;
        nameInput.placeholder = "Название группы";
        nameInput.addEventListener("input", function () {
            schedule.groups[gIdx].name = nameInput.value;
        });

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "btn btn-icon";
        downloadBtn.type = "button";
        downloadBtn.title = "Скачать сторис";
        downloadBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
        downloadBtn.addEventListener("click", function () {
            generateStoryImage(schedule.groups[gIdx]).catch(function (err) {
                console.error(err);
                showStatus("Не удалось сформировать картинку", "error");
            });
        });

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn btn-icon";
        removeBtn.type = "button";
        removeBtn.textContent = "✕";
        removeBtn.title = "Удалить группу";
        removeBtn.addEventListener("click", function () {
            if (!confirm("Удалить группу «" + (group.name || "Без названия") + "»?")) return;
            schedule.groups.splice(gIdx, 1);
            render();
        });

        header.appendChild(nameInput);
        header.appendChild(downloadBtn);
        header.appendChild(removeBtn);
        el.appendChild(header);

        const sessionsEl = document.createElement("div");
        sessionsEl.className = "sessions";
        group.sessions.forEach(function (session, sIdx) {
            sessionsEl.appendChild(buildSession(session, gIdx, sIdx));
        });

        const addSessionBtn = document.createElement("button");
        addSessionBtn.type = "button";
        addSessionBtn.className = "add-session";
        addSessionBtn.textContent = "+ Добавить тренировку";
        addSessionBtn.addEventListener("click", function () {
            schedule.groups[gIdx].sessions.push({ day: "Понедельник", start: "18:00", end: "19:00" });
            render();
        });
        sessionsEl.appendChild(addSessionBtn);

        el.appendChild(sessionsEl);
        return el;
    }

    function buildSession(session, gIdx, sIdx) {
        const row = document.createElement("div");
        row.className = "session-row";

        const daySelect = document.createElement("select");
        DAYS.forEach(function (day) {
            const opt = document.createElement("option");
            opt.value = day;
            opt.textContent = day;
            if (day === session.day) opt.selected = true;
            daySelect.appendChild(opt);
        });
        daySelect.addEventListener("change", function () {
            schedule.groups[gIdx].sessions[sIdx].day = daySelect.value;
        });

        const startInput = document.createElement("input");
        startInput.type = "time";
        startInput.value = session.start || "";
        startInput.addEventListener("change", function () {
            schedule.groups[gIdx].sessions[sIdx].start = startInput.value;
        });

        const dash = document.createElement("span");
        dash.className = "dash";
        dash.textContent = "–";

        const endInput = document.createElement("input");
        endInput.type = "time";
        endInput.value = session.end || "";
        endInput.addEventListener("change", function () {
            schedule.groups[gIdx].sessions[sIdx].end = endInput.value;
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-icon";
        removeBtn.textContent = "✕";
        removeBtn.title = "Удалить тренировку";
        removeBtn.addEventListener("click", function () {
            schedule.groups[gIdx].sessions.splice(sIdx, 1);
            render();
        });

        row.appendChild(daySelect);
        row.appendChild(startInput);
        row.appendChild(dash);
        row.appendChild(endInput);
        row.appendChild(removeBtn);
        return row;
    }

    async function loadPrices() {
        try {
            const res = await fetch("/api/prices");
            const data = await res.json();
            prices = data && Array.isArray(data.categories) ? data : { categories: [], note: "" };
            if (typeof prices.note !== "string") prices.note = "";
            renderPrices();
        } catch (e) {
            showStatus("Не удалось загрузить цены", "error");
        }
    }

    function renderPrices() {
        pricesRoot.innerHTML = "";
        prices.categories.forEach(function (cat, cIdx) {
            pricesRoot.appendChild(buildCategory(cat, cIdx));
        });
        noteInput.value = prices.note || "";
    }

    // id связывают позицию с текстом страницы (абзацы, FAQ, микроразметка),
    // поэтому владельцу их не показываем — новым позициям выдаём сами.
    function uniqueId(prefix, taken) {
        let n = 1;
        while (taken.indexOf(prefix + n) !== -1) n += 1;
        return prefix + n;
    }

    function buildCategory(cat, cIdx) {
        const el = document.createElement("article");
        el.className = "group";

        const header = document.createElement("div");
        header.className = "group-header";

        const titleInput = document.createElement("input");
        titleInput.className = "group-name";
        titleInput.type = "text";
        titleInput.maxLength = 80;
        titleInput.value = cat.title || "";
        titleInput.placeholder = "Название раздела";
        titleInput.addEventListener("input", function () {
            prices.categories[cIdx].title = titleInput.value;
        });

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn btn-icon";
        removeBtn.type = "button";
        removeBtn.textContent = "✕";
        removeBtn.title = "Удалить раздел";
        removeBtn.addEventListener("click", function () {
            if (!confirm("Удалить раздел «" + (cat.title || "Без названия") + "»?")) return;
            prices.categories.splice(cIdx, 1);
            renderPrices();
        });

        header.appendChild(titleInput);
        header.appendChild(removeBtn);
        el.appendChild(header);

        const body = document.createElement("div");
        body.className = "sessions";

        const meta = document.createElement("div");
        meta.className = "price-meta";
        meta.appendChild(metaField("Подпись под ценами", cat.badge || "", 80, "например: от 18 лет", function (v) {
            prices.categories[cIdx].badge = v;
        }));
        meta.appendChild(metaField("Уточнение для поисковиков", cat.schemaGroup || "", 80, "например: взрослая группа", function (v) {
            prices.categories[cIdx].schemaGroup = v;
        }));
        body.appendChild(meta);

        (cat.items || []).forEach(function (item, iIdx) {
            body.appendChild(buildPriceItem(item, cIdx, iIdx));
        });

        const addItemBtn = document.createElement("button");
        addItemBtn.type = "button";
        addItemBtn.className = "add-session";
        addItemBtn.textContent = "+ Добавить позицию";
        addItemBtn.addEventListener("click", function () {
            const taken = prices.categories[cIdx].items.map(function (i) { return i.id; });
            prices.categories[cIdx].items.push({
                id: uniqueId("item", taken), name: "Новая позиция", kind: "other", price: 0,
            });
            renderPrices();
        });
        body.appendChild(addItemBtn);

        el.appendChild(body);
        return el;
    }

    function metaField(labelText, value, maxLength, placeholder, onChange) {
        const label = document.createElement("label");
        label.className = "price-meta-field";
        const span = document.createElement("span");
        span.textContent = labelText;
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = maxLength;
        input.value = value;
        input.placeholder = placeholder;
        input.addEventListener("input", function () { onChange(input.value); });
        label.appendChild(span);
        label.appendChild(input);
        return label;
    }

    function buildPriceItem(item, cIdx, iIdx) {
        const row = document.createElement("div");
        row.className = "price-row";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.maxLength = 80;
        nameInput.value = item.name || "";
        nameInput.placeholder = "Название позиции";
        nameInput.addEventListener("input", function () {
            prices.categories[cIdx].items[iIdx].name = nameInput.value;
        });

        const kindSelect = document.createElement("select");
        kindSelect.title = "По позициям с типом «Абонемент» считается «абонементы от …» в заголовке страницы";
        PRICE_KINDS.forEach(function (kind) {
            const opt = document.createElement("option");
            opt.value = kind.value;
            opt.textContent = kind.label;
            if (kind.value === (item.kind || "other")) opt.selected = true;
            kindSelect.appendChild(opt);
        });
        kindSelect.addEventListener("change", function () {
            prices.categories[cIdx].items[iIdx].kind = kindSelect.value;
        });

        const priceWrap = document.createElement("div");
        priceWrap.className = "price-input";
        const priceInput = document.createElement("input");
        priceInput.type = "number";
        priceInput.min = "0";
        priceInput.max = "1000000";
        priceInput.step = "50";
        priceInput.value = String(item.price);
        priceInput.addEventListener("input", function () {
            const parsed = parseInt(priceInput.value, 10);
            prices.categories[cIdx].items[iIdx].price = isNaN(parsed) ? 0 : parsed;
            hint.hidden = prices.categories[cIdx].items[iIdx].price !== 0;
        });
        const currency = document.createElement("span");
        currency.className = "price-currency";
        currency.textContent = "₽";
        priceWrap.appendChild(priceInput);
        priceWrap.appendChild(currency);

        // Ноль на странице печатается словом — подсказываем, чтобы это не выглядело ошибкой
        const hint = document.createElement("span");
        hint.className = "price-free-hint";
        hint.textContent = "на сайте: бесплатно";
        hint.hidden = item.price !== 0;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-icon";
        removeBtn.textContent = "✕";
        removeBtn.title = "Удалить позицию";
        removeBtn.addEventListener("click", function () {
            prices.categories[cIdx].items.splice(iIdx, 1);
            renderPrices();
        });

        row.appendChild(nameInput);
        row.appendChild(kindSelect);
        row.appendChild(priceWrap);
        row.appendChild(hint);
        row.appendChild(removeBtn);
        return row;
    }

    noteInput.addEventListener("input", function () { prices.note = noteInput.value; });

    addCategoryBtn.addEventListener("click", function () {
        const taken = prices.categories.map(function (c) { return c.id; });
        prices.categories.push({
            id: uniqueId("cat", taken), title: "Новый раздел", badge: "", schemaGroup: "",
            items: [{ id: "item1", name: "Новая позиция", kind: "other", price: 0 }],
        });
        renderPrices();
    });

    addGroupBtn.addEventListener("click", function () {
        schedule.groups.push({ name: "Новая группа", sessions: [] });
        render();
    });

    async function save(endpoint, payload, successMessage) {
        saveBtn.disabled = true;
        try {
            const res = await fetch(endpoint, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + getToken(),
                },
                body: JSON.stringify(payload),
            });
            if (res.status === 401 || res.status === 403) {
                clearToken();
                showLogin();
                return;
            }
            if (!res.ok) {
                const data = await res.json().catch(function () { return {}; });
                showStatus(data.error || "Ошибка сохранения", "error");
                return;
            }
            showStatus(successMessage, "success");
        } catch (e) {
            showStatus("Сетевая ошибка", "error");
        } finally {
            saveBtn.disabled = false;
        }
    }

    saveBtn.addEventListener("click", function () {
        if (activeTab === "prices") {
            save("/api/prices", prices, "Сохранено, страница цен обновлена");
        } else {
            save("/api/schedule", schedule, "Сохранено");
        }
    });

    logoutBtn.addEventListener("click", function () {
        clearToken();
        showLogin();
    });

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        loginError.hidden = true;
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: loginInput.value.trim(), password: passwordInput.value }),
            });
            if (!res.ok) {
                loginError.textContent = "Неверный логин или пароль";
                loginError.hidden = false;
                return;
            }
            const data = await res.json();
            setToken(data.token);
            showEditor();
        } catch (err) {
            loginError.textContent = "Сетевая ошибка";
            loginError.hidden = false;
        }
    });

    let logoImagePromise = null;
    function loadLogo() {
        if (logoImagePromise) return logoImagePromise;
        logoImagePromise = new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = reject;
            img.src = "../favicon.png";
        });
        return logoImagePromise;
    }

    function fitText(ctx, text, maxWidth, baseSize, fontWeight) {
        let size = baseSize;
        ctx.font = fontWeight + " " + size + "px Arial";
        while (ctx.measureText(text).width > maxWidth && size > 24) {
            size -= 2;
            ctx.font = fontWeight + " " + size + "px Arial";
        }
        return size;
    }

    function slugify(s) {
        return String(s || "group")
            .toLowerCase()
            .replace(/«|»|"|'/g, "")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9а-яё-]/gi, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "") || "group";
    }

    async function generateStoryImage(group) {
        const W = 1080, H = 1920;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");

        const bg = ctx.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H * 0.35, H);
        bg.addColorStop(0, "#3a0606");
        bg.addColorStop(0.45, "#0d0202");
        bg.addColorStop(1, "#000");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, W - 80, H - 80);

        try {
            const logo = await loadLogo();
            const logoSize = 280;
            ctx.drawImage(logo, (W - logoSize) / 2, 130, logoSize, logoSize);
        } catch (e) {}

        ctx.fillStyle = "#bdbdbd";
        ctx.textAlign = "center";
        ctx.font = "700 30px Arial";
        ctx.fillText("БОКСЕРСКИЙ КЛУБ", W / 2, 470);
        ctx.fillStyle = "#e11d1d";
        ctx.font = "700 38px Arial";
        ctx.fillText("«ДОБРЫЙ ПИТЕР»", W / 2, 520);

        const titleText = (group.name || "").toUpperCase();
        const titleBoxX = 90, titleBoxY = 620, titleBoxW = W - 180, titleBoxH = 130;
        ctx.fillStyle = "#e11d1d";
        ctx.fillRect(titleBoxX, titleBoxY, titleBoxW, titleBoxH);
        ctx.fillStyle = "#fff";
        const titleSize = fitText(ctx, titleText, titleBoxW - 80, 64, "900");
        ctx.font = "900 " + titleSize + "px Arial";
        ctx.textBaseline = "middle";
        ctx.fillText(titleText, W / 2, titleBoxY + titleBoxH / 2 + 4);
        ctx.textBaseline = "alphabetic";

        const sessions = group.sessions || [];
        const rowsTop = 830;
        const rowsBottom = 1740;
        const rowGap = 20;
        const maxRowH = 130;
        const minRowH = 70;
        const available = rowsBottom - rowsTop;
        const rowsCount = Math.max(sessions.length, 1);
        const rowH = Math.max(minRowH, Math.min(maxRowH, (available - rowGap * (rowsCount - 1)) / rowsCount));
        const totalH = rowH * rowsCount + rowGap * (rowsCount - 1);
        const startY = rowsTop + (available - totalH) / 2;

        sessions.forEach(function (s, i) {
            const y = startY + i * (rowH + rowGap);
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            ctx.fillRect(90, y, W - 180, rowH);
            ctx.fillStyle = "#e11d1d";
            ctx.fillRect(90, y, 8, rowH);

            const dayText = s.day || "";
            const timeText = (s.start || "") + " – " + (s.end || "");
            const dayMaxW = (W - 180) * 0.55 - 60;
            const timeMaxW = (W - 180) * 0.45 - 60;

            ctx.fillStyle = "#dcdcdc";
            ctx.textAlign = "left";
            const daySize = fitText(ctx, dayText, dayMaxW, Math.min(56, rowH * 0.44), "600");
            ctx.font = "600 " + daySize + "px Arial";
            ctx.textBaseline = "middle";
            ctx.fillText(dayText, 130, y + rowH / 2);

            ctx.fillStyle = "#fff";
            ctx.textAlign = "right";
            const timeSize = fitText(ctx, timeText, timeMaxW, Math.min(58, rowH * 0.46), "800");
            ctx.font = "800 " + timeSize + "px Arial";
            ctx.fillText(timeText, W - 130, y + rowH / 2);
            ctx.textBaseline = "alphabetic";
        });

        if (!sessions.length) {
            ctx.fillStyle = "#bdbdbd";
            ctx.textAlign = "center";
            ctx.font = "italic 36px Arial";
            ctx.fillText("Расписание не задано", W / 2, rowsTop + available / 2);
        }

        ctx.fillStyle = "#e11d1d";
        ctx.textAlign = "center";
        ctx.font = "800 38px Arial";
        ctx.fillText("DOBRYPITER.PRO", W / 2, 1840);

        const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = slugify(group.name) + "-story.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    }

    if (getToken()) showEditor();
    else showLogin();
})();
