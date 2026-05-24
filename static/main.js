let currentProjectId = null;
const criteriaContainer = document.getElementById("criteriaContainer");
// САЙДБАР
const menuBtn = document.getElementById("menuButton");
const sidebar = document.querySelector(".sidebar");
const container = document.querySelector(".container");

function setSidebarState(isOpen) {

    sidebar.classList.toggle("active", isOpen);
    container.classList.toggle("shift", isOpen);

    localStorage.setItem("sidebarOpen", isOpen);
}

menuBtn.onclick = () => {
    const isOpen = !sidebar.classList.contains("active");
    setSidebarState(isOpen);
};

// СОЗДАТЬ И ДОБАВИТЬ НОВЫЙ ПРОЕКТ
const addBtn = document.getElementById("addProjectBtn");
const modal = document.getElementById("modalOverlay");
const closeModal = document.getElementById("modalClose");

const createProjectBtn = document.getElementById("createProjectBtn");
const input = document.getElementById("projectInput");
const projectList = document.getElementById("projectList");

// для createProjectBtn при процессе удаления проекта
let holdStart = 0;
let holdProgressInterval = null;

// для текущих весов критериев
const criteriaInitial = {};
let isAnimatingReset = false;

const projectModalTitle = document.getElementById("projectModalTitle");
const projectModalDescription = document.getElementById("projectModalDescription");

let projectModalMode = "create"; // create | rename | delete
let editingProjectId = null;

function openCreateProjectModal() {
    projectModalMode = "create";
    editingProjectId = null;

    projectModalTitle.textContent = "Создать новый проект";

    projectModalDescription.classList.add("hidden");
    projectModalDescription.innerHTML = "";

    input.classList.remove("hidden");
    input.value = "";
    input.placeholder = "Название проекта";

    createProjectBtn.textContent = "Создать проект";
    createProjectBtn.classList.remove("danger");
    createProjectBtn.classList.remove("holding");

    modal.classList.add("active");

    input.addEventListener("input", validateProjectInput);
    setTimeout(validateProjectInput, 0);
    input.focus();
}

// ПРОВЕРКА НАЗВАНИЯ ДОБАВЛЯЕМОГО ПРОЕКТА НА ДУБЛИКАТ
function isDuplicateProjectName(name, excludeId = null) {
    return Array.from(projectList.querySelectorAll(".project-item"))
        .some(item => {
            const itemId = item.dataset.id;
            const itemName = item.querySelector(".project-name")?.textContent?.trim();

            if (!itemName) return false;
            if (excludeId && itemId == excludeId) return false;

            return itemName.toLowerCase() === name.trim().toLowerCase();
        });
}

// ВАЛИДАЦИЯ НОВОГО ПРОЕКТА
function validateProjectInput() {
    const name = input.value.trim();
    const wrapper = document.getElementById("projectInput").closest(".project-input-wrapper");

    const isEmpty = !name;

    const isDuplicate =
        !isEmpty && isDuplicateProjectName(
            name,
            projectModalMode === "rename" ? editingProjectId : null
        );

    const invalid = !isEmpty && isDuplicate;

    createProjectBtn.disabled = invalid;
    createProjectBtn.classList.toggle("disabled", invalid);
    wrapper.classList.toggle("input-error", invalid);

    input.classList.toggle("input-error", invalid);
}

function openRenameProjectModal(projectId, currentName) {
    projectModalMode = "rename";
    editingProjectId = projectId;

    projectModalTitle.textContent = "Переименовать проект";

    projectModalDescription.classList.add("hidden");
    projectModalDescription.innerHTML = "";

    input.classList.remove("hidden");
    input.value = currentName;

    createProjectBtn.textContent = "Сохранить";
    createProjectBtn.classList.remove("danger");
    createProjectBtn.classList.remove("holding");

    modal.classList.add("active");

    input.addEventListener("input", validateProjectInput);
    setTimeout(validateProjectInput, 0);
    input.focus();
}

function openDeleteProjectModal(projectId, currentName) {
    projectModalMode = "delete";
    editingProjectId = projectId;

    projectModalTitle.textContent = "Удаление проекта";

    projectModalDescription.innerHTML = `
        <img 
            src="/static/warning.png"
            class="modal-warning-image"
            alt="warning"
        >

        <div class="modal-warning-text">
            <div class="modal-warning-main">
                Вы уверены, что хотите удалить проект «${currentName}»?
            </div>

            <div class="modal-warning-danger">
                Это действие необратимо!
            </div>
        </div>
    `;

    projectModalDescription.classList.remove("hidden");

    input.classList.add("hidden");

    createProjectBtn.textContent = "Удалить";
    createProjectBtn.classList.add("danger");
    createProjectBtn.classList.remove("holding");

    modal.classList.add("active");
}

function startHoldDelete() {
    if (projectModalMode !== "delete") return;
    if (holdProgressInterval) return;

    const btn = createProjectBtn;

    let progress = 0;
    const duration = 750;

    btn.classList.add("holding");

    holdStart = Date.now();

    holdProgressInterval = setInterval(() => {
        const elapsed = Date.now() - holdStart;
        progress = Math.min(elapsed / duration, 1);

        btn.style.setProperty("--hold-progress", `${progress * 100}%`);

        if (progress >= 1) {
            clearInterval(holdProgressInterval);
            executeDelete();
        }
    }, 16);
}

function resetHoldState() {
    const btn = createProjectBtn;

    btn.classList.remove("holding");
    btn.style.pointerEvents = "auto";
    btn.style.setProperty("--hold-progress", "0%");

    clearInterval(holdProgressInterval);
    holdProgressInterval = null;
}

function cancelHoldDelete() {
    clearInterval(holdProgressInterval);

    if (holdProgressInterval && createProjectBtn.classList.contains("holding")) {
        resetHoldState();
    }

    const btn = createProjectBtn;

    btn.classList.remove("holding");
    btn.style.pointerEvents = "auto";
    btn.style.setProperty("--hold-progress", "0%");
}

// Debounce для частых событий (слайдеры)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function executeDelete() {
    await fetch(`/api/projects/${editingProjectId}`, {
        method: 'DELETE'
    });

    if (currentProjectId == editingProjectId) {
        currentProjectId = null;
        localStorage.removeItem('lastProjectId');
        setProjectState(false);
        switchToProjectTab();
    }

    await loadProjects();
    modal.classList.remove('active');

    createProjectBtn.style.pointerEvents = "auto";
    resetHoldState();
}

function switchToProjectTab() {
    tabs.forEach(t => t.classList.remove("active"));

    const projectTab = [...tabs].find(t => 
        t.textContent.trim() === "Проект"
    );

    if (projectTab) projectTab.classList.add("active");

    Object.values(pages).forEach(p => p.classList.remove("active"));

    const projectPage = pages["Проект"];
    if (projectPage) projectPage.classList.add("active");
}

addBtn.onclick = () => {
    openCreateProjectModal();
};

closeModal.onclick = () => {
    modal.classList.remove("active");
    input.classList.remove("input-error");
    createProjectBtn.disabled = false;
};

modal.onclick = (e) => {
    if (e.target === modal) {
        modal.classList.remove("active");
    }
};

createProjectBtn.addEventListener("mousedown", () => {
    if (projectModalMode === "delete") startHoldDelete();
});

createProjectBtn.addEventListener("mouseup", () => {
    if (projectModalMode === "delete") cancelHoldDelete();
});

createProjectBtn.addEventListener("mouseleave", () => {
    if (projectModalMode === "delete") cancelHoldDelete();
});

createProjectBtn.addEventListener("touchstart", () => {
    if (projectModalMode !== "delete") return;
    startHoldDelete();
});

createProjectBtn.addEventListener("touchend", cancelHoldDelete);


createProjectBtn.addEventListener("click", async () => {
    if (projectModalMode === "delete") return; // важно

    if (projectModalMode === "create") {
        const name = input.value.trim();
        if (isDuplicateProjectName(name)) return;
        if (!name) return;

        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const project = await res.json();
        modal.classList.remove('active');
        await loadProjects();

        const el = [...projectList.children]
            .find(d => d.dataset.id == project.id);

        openProject(project.id, el);
    }

    if (projectModalMode === "rename") {
        const newName = input.value.trim();
        if (!newName) return;

        await fetch(`/api/projects/${editingProjectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });

        await loadProjects();
        modal.classList.remove('active');
    }
});

// ===== КОНТЕКСТНОЕ МЕНЮ ПРОЕКТОВ =====
const ctxMenu = document.createElement('div');
ctxMenu.id = 'projectContextMenu';
ctxMenu.innerHTML = `
    <div class="context-menu-item" id="ctxRename">Переименовать</div>
    <div class="context-menu-item delete" id="ctxDelete">Удалить</div>
`;
document.body.appendChild(ctxMenu);

let ctxTargetId = null;

function showCtxMenu(id, btn) {
    ctxTargetId = id;
    const rect = btn.getBoundingClientRect();
    // Позиционируем меню, чтобы не вылезало за правый край viewport
    ctxMenu.style.top = `${rect.bottom + 5}px`;
    ctxMenu.style.left = `${Math.min(rect.left - 140, window.innerWidth - 170)}px`;
    ctxMenu.classList.add('visible');
}

// Закрытие при клике вне меню
document.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target)) {
        ctxMenu.classList.remove('visible');
    }
});

document.getElementById('ctxRename').onclick = () => {

    const projectEl = document.querySelector(
        `.project-item[data-id="${ctxTargetId}"]`
    );

    const currentName =
        projectEl?.querySelector('.project-name')?.textContent
        || projectEl?.childNodes[0]?.textContent
        || "Проект";

    openRenameProjectModal(ctxTargetId, currentName);

    ctxMenu.classList.remove('visible');
};

document.getElementById('ctxDelete').onclick = () => {

    const projectEl = document.querySelector(
        `.project-item[data-id="${ctxTargetId}"]`
    );

    const currentName =
        projectEl?.querySelector('.project-name')?.textContent
        || projectEl?.childNodes[0]?.textContent
        || "Проект";

    openDeleteProjectModal(ctxTargetId, currentName);

    ctxMenu.classList.remove('visible');
};

async function loadProjects() {
    const res = await fetch('/api/projects');
    const projects = await res.json();

    projectList.innerHTML = '';
    projects.forEach(p => {
        const div = document.createElement('div');
        div.className = 'project-item';
        div.dataset.id = p.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'project-name';
        nameSpan.textContent = p.name;
        div.appendChild(nameSpan);

        const ellipsis = document.createElement('span');
        ellipsis.className = 'project-ellipsis';
        ellipsis.innerHTML = '&#8942;';
        ellipsis.onclick = (e) => {
            e.stopPropagation(); // не открываем проект
            showCtxMenu(p.id, ellipsis);
        };
        div.appendChild(ellipsis);

        div.onclick = (e) => {
            if (e.target.closest('.project-ellipsis')) return;
            openProject(p.id, div);
        }

        projectList.appendChild(div);
    });
}

// ===== КОНТЕКСТНОЕ МЕНЮ МОДЕЛЕЙ =====
const modelCtxMenu = document.createElement('div');

modelCtxMenu.id = 'modelContextMenu';

modelCtxMenu.innerHTML = `
    <div class="context-menu-item" id="ctxModelRename">
        Переименовать
    </div>

    <div class="context-menu-item delete" id="ctxModelDelete">
        Удалить
    </div>
`;

document.body.appendChild(modelCtxMenu);

let ctxModelTargetId = null;

function showModelCtxMenu(id, btn) {
    ctxModelTargetId = id;

    const rect = btn.getBoundingClientRect();

    modelCtxMenu.style.top = `${rect.bottom + 5}px`;

    modelCtxMenu.style.left =
        `${Math.min(rect.left - 140, window.innerWidth - 170)}px`;

    modelCtxMenu.classList.add('visible');
}

// закрытие при клике вне меню
document.addEventListener('click', (e) => {
    if (!modelCtxMenu.contains(e.target)) {
        modelCtxMenu.classList.remove('visible');
    }
});

// ПЕРЕИМЕНОВАНИЕ МОДЕЛИ
document.getElementById('ctxModelRename').onclick = () => {

    const model = models.find(m => m.id == ctxModelTargetId);

    const currentName = model?.name || "Модель";

    openRenameModelModal(ctxModelTargetId, currentName);

    modelCtxMenu.classList.remove('visible');
};

// УДАЛЕНИЕ МОДЕЛИ
document.getElementById('ctxModelDelete').onclick = () => {

    const model = models.find(m => m.id == ctxModelTargetId);

    const currentName = model?.name || "Модель";

    openDeleteModelModal(ctxModelTargetId, currentName);

    modelCtxMenu.classList.remove('visible');
};


// ЛОГИКА СТАРТОВОГО ЭКРАНА
function setProjectState(hasProject) {
    const emptyState = document.getElementById("emptyProjectState");
    const projectContent = document.getElementById("projectContent");

    // если ранее был выбран проект
    if (!emptyState || !projectContent) return;

    // логика: клиент впервые заходит на сайт и ещё не открывал проекты
    if (hasProject) {
        emptyState.classList.add("hidden");
        projectContent.classList.remove("hidden");
    } else {
        emptyState.classList.remove("hidden");
        projectContent.classList.add("hidden");
    }

    tabs.forEach(tab => {
        const name = tab.textContent.trim();
        if (name === "Проект") return;

        tab.classList.toggle("disabled", !hasProject);
    });
}

// АНАЛИЗ ЧУВСТВИТЕЛЬНОСТИ
let originalRanking = [];
let sensitivityOriginalWeights = {};   // исходные веса (из базы)
let currentSensitivityWeights = {};    // текущие временные веса (для анализа)

async function loadSensitivity() {
    if (!currentProjectId) return;

    try {
        const res = await fetch(`/api/projects/${currentProjectId}/criteria`);
        const criteriaData = await res.json();
        const active = criteriaData.filter(c => c.enabled);

        const container = document.getElementById('sensitivitySliders');
        if (!container) return;

        container.innerHTML = '';

        // Сохраняем исходные веса (один раз)
        sensitivityOriginalWeights = {};
        active.forEach(c => {
            sensitivityOriginalWeights[c.id] = Math.round(c.weight * 100);
        });

        // Если ещё нет временных весов — инициализируем
        if (Object.keys(currentSensitivityWeights).length === 0) {
            currentSensitivityWeights = {...sensitivityOriginalWeights};
        }

        active.forEach(c => {
            const currentPercent = currentSensitivityWeights[c.id] || Math.round(c.weight * 100);

            const item = document.createElement('div');
            item.className = 'criteria-item';
            item.innerHTML = `
                <div class="criteria-name">${c.name}</div>
                <div class="criteria-control">
                    <input type="range" min="0" max="100"
                        value="${currentPercent}"
                        class="criteria-slider sensitivity-slider"
                        data-id="${c.id}">
                    <div class="criteria-value" id="sv_${c.id}">
                        ${currentPercent}%
                    </div>
                </div>
            `;
            container.appendChild(item);
        });

        updateSensitivityTotal();

        // Сохраняем исходный рейтинг для показа изменений позиций
        await saveOriginalRanking();

        // Навешиваем обработчики
        document.querySelectorAll('.sensitivity-slider').forEach(slider => {
            slider.addEventListener('input', debounce(handleSensitivitySlider, 120));
        });

        // Первый расчёт
        await fetchSensitivity();

        // Добавляем кнопку сброса (один раз)
        addSensitivityResetButton();

    } catch (e) {
        console.error("Ошибка в loadSensitivity:", e);
    }
}

function handleSensitivitySlider() {
    const sliders = document.querySelectorAll('.sensitivity-slider');

    sliders.forEach(slider => {
        const id = parseInt(slider.dataset.id);
        currentSensitivityWeights[id] = parseInt(slider.value);

        const valueEl = document.getElementById(`sv_${id}`);
        if (valueEl) valueEl.textContent = slider.value + '%';
    });

    updateSensitivityTotal();
    fetchSensitivity();
}

async function saveOriginalRanking() {
    const res = await fetch(`/api/projects/${currentProjectId}/results`);
    const data = await res.json();

    originalRanking = data.map((item, index) => ({
        model_id: item.model?.id || item.model_id,
        model_name: item.model_name || item.model?.name,
        rank: index + 1,
        score: item.K_k
    }));
}

function updateSensitivityTotal() {
    let total = 0;
    document.querySelectorAll('.sensitivity-slider').forEach(s => {
        total += Number(s.value);
    });
    const el = document.getElementById('sensitivityTotal');
    if (el) el.textContent = total + '%';
}

async function fetchSensitivity() {
    try {
        const params = new URLSearchParams();

        Object.entries(currentSensitivityWeights).forEach(([id, value]) => {
            params.set(`w_${id}`, value / 100);
        });

        const res = await fetch(`/api/projects/${currentProjectId}/sensitivity?${params}`);
        if (!res.ok) throw new Error('Ошибка сервера');

        const newResults = await res.json();

        // Обновляем список рейтинга
        const container = document.getElementById('sensitivityResults');
        container.innerHTML = '';

        newResults.forEach((r, newIndex) => {
            const modelId = r.model?.id || r.model_id;
            const original = originalRanking.find(o => o.model_id == modelId);
            const oldRank = original ? original.rank : 999;
            const change = (newIndex + 1) - oldRank;

            let arrow = change < 0 ?
                `<span class="rank-change up">↑ ${Math.abs(change)}</span>` :
                change > 0 ?
                    `<span class="rank-change down">↓ ${change}</span>` :
                    `<span class="rank-change same">→</span>`;

            const percent = Math.round(r.K_k * 100);
            const tagClass = percent >= 75 ? 'good' : percent >= 60 ? 'ok' : 'bad';

            const item = document.createElement('div');
            item.className = 'rank-item';
            item.innerHTML = `
                <div class="rank-number">${newIndex + 1}</div>
                <div class="rank-content">
                    <div class="rank-name">${r.model_name || r.model?.name}</div>
                    <div class="rank-bar">
                        <div class="rank-bar-fill" style="width:${percent}%"></div>
                    </div>
                </div>
                <div class="tag ${tagClass}">${percent}%</div>
                ${arrow}
            `;
            container.appendChild(item);
        });

        generateDetailedRecommendations(newResults);

    } catch (e) {
        console.error("Ошибка при пересчёте чувствительности:", e);
    }
}

function addSensitivityResetButton() {
    // Удаляем старую кнопку, если есть
    const existing = document.getElementById('sensitivityResetBtn');
    if (existing) existing.remove();

    const container = document.querySelector('#sensitivitySliders').parentElement;

    const resetBtn = document.createElement('button');
    resetBtn.id = 'sensitivityResetBtn';
    resetBtn.className = 'reset-sensitivity-btn';
    resetBtn.textContent = '↺ Сбросить к исходным весам';
    resetBtn.style.marginTop = '12px';

    resetBtn.onclick = () => {
        currentSensitivityWeights = {...sensitivityOriginalWeights};

        // Перезагружаем слайдеры
        loadSensitivity();
    };

    container.appendChild(resetBtn);
}





function generateDetailedRecommendations(newResults) {
    const container = document.getElementById('recContent');
    if (!container) return;

    const topModel = newResults[0];
    const topModelName = topModel.model_name || topModel.model?.name;

    // Находим изменения позиций
    let biggestGainers = [];
    let biggestLosers = [];

    newResults.forEach((r, newIndex) => {
        const modelId = r.model?.id || r.model_id;
        const original = originalRanking.find(o => o.model_id == modelId);
        if (!original) return;

        const change = (newIndex + 1) - original.rank;

        if (change < -1) biggestGainers.push({ name: r.model_name || r.model?.name, change: Math.abs(change) });
        if (change > 1) biggestLosers.push({ name: r.model_name || r.model?.name, change });
    });

    let html = `<p><strong>Текущий лидер:</strong> ${topModelName} — ${Math.round(topModel.K_k * 100)}%</p>`;

    if (biggestGainers.length > 0) {
        html += `<p><strong>Сильно выросли:</strong> ${biggestGainers.map(m => m.name).join(', ')}</p>`;
    }
    if (biggestLosers.length > 0) {
        html += `<p><strong>Сильно упали:</strong> ${biggestLosers.map(m => m.name).join(', ')}</p>`;
    }

    // Рекомендации по сценариям
    html += `
        <div class="rec-tips">
            <strong>Рекомендации:</strong><br>
            • Если вам важна <strong>максимальная точность</strong> — оставьте текущие веса.<br>
            • Модель <strong>${topModelName}</strong> сейчас выглядит наиболее сбалансированной.<br>
    `;

    if (biggestGainers.length > 0) {
        html += `• При текущих весах выгодно выделяются: <strong>${biggestGainers[0].name}</strong><br>`;
    }

    html += `</div>`;

    container.innerHTML = html;
}

// WEBSITE ENTRY POINT
async function initApp() {
    await loadProjects();

    const lastId = localStorage.getItem("lastProjectId");
    const lastTab = localStorage.getItem("lastTab");

    if (!lastId) {
        setProjectState(false);
        return;
    }

    if (lastTab && pages[lastTab]) {
        await switchTab(lastTab);
    }

    const el = [...document.querySelectorAll(".project-item")]
        .find(d => d.dataset.id == lastId);

    if (!el) {
        setProjectState(false);
        return;
    }

    await openProject(lastId, el);
}

// ОБРАБОТКА ОТКРЫТИЯ ВКЛАДОК
async function switchTab(name) {

    tabs.forEach(t => t.classList.remove("active"));

    const targetTab = [...tabs].find(
        t => t.textContent.trim() === name
    );

    if (targetTab) {
        targetTab.classList.add("active");
    }

    Object.values(pages).forEach(p => p.classList.remove("active"));

    if (pages[name]) {
        pages[name].classList.add("active");
    }

    localStorage.setItem("lastTab", name);

    if (name === "Результаты" && currentProjectId) {
        await renderAllCharts();
    }

    if (name === "Анализ" && currentProjectId) {
        await loadSensitivity();
    }
}

async function openProject(id, el) {
    currentProjectId = id;
    localStorage.setItem("lastProjectId", id);
    setProjectState(true); // проверка необходимости приветственного экрана

    document.querySelectorAll('.project-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    const [modelsRes, criteriaRes, resultsRes] = await Promise.all([
        fetch(`/api/projects/${id}/models`),
        fetch(`/api/projects/${id}/criteria`),
        fetch(`/api/projects/${id}/results`)
    ]);

    const apiModels = await modelsRes.json();
    const apiCriteria = await criteriaRes.json();
    const apiResults = await resultsRes.json();

    // для тегов интегральных оценок
    const resultsMap = {};

    apiResults.forEach(r => {
        resultsMap[r.model.id] = r;
    });

    // для интегральных оценок
    const scoreMap = {};
    apiResults.forEach(r => {
        scoreMap[r.model.id] = r.K_k; 
    });

    updateProjectStats(apiModels, apiCriteria, apiResults);
    renderCriteria(apiCriteria);


    models = apiModels.map(m => {
        const r = resultsMap[m.id];

        return {
            id: m.id,
            name: m.name,
            score: r ? r.K_k * 100 : 0,
            label: r ? extractTagName(r.label) : "Нет оценки"
        };
    });

    criteria = apiCriteria
        .filter(c => c.enabled)
        .map(c => ({ id: c.id, title: c.name, weight: c.weight * 100 }));

    const scoresRes = await fetch(`/api/projects/${id}/scores`);
    const scoresData = await scoresRes.json();

    Object.entries(scoresData.scores).forEach(([modelId, critMap]) => {
        Object.entries(critMap).forEach(([criterionId, value]) => {

            if (!ratings[modelId]) ratings[modelId] = {};
            ratings[modelId][criterionId] = value;
        });
    });

    createScoresTable(); // создание таблицы в Оценках

    document.querySelectorAll(".rating-cell").forEach(cell => {
        const criterionId = cell.dataset.criterionId;
        const modelId = cell.dataset.modelId;

        const savedValue = ratings[modelId]?.[criterionId];

        if (savedValue) {
            updateDots(cell, savedValue);
        }
    });

    renderAllCharts();     // создание диаграмм в Результатах
    sortResults();         // сортировка моделей в Результатах
    updateShowMoreState(); // обновление состояния кнопки showmore в Результатах
    updateRankList();      // обновление рейтинга моделей
    await renderRadarChart();
}

// ОБНОВЛЕНИЕ БАЗОВЫХ СТАТИСТИК В РАЗДЕЛЕ ПРОЕКТА
function updateProjectStats(models, criteria, results = []) {
    const modelsEl = document.getElementById("statModels");
    const criteriaEl = document.getElementById("statCriteria");
    const leaderEl = document.getElementById("statLeader");

    if (modelsEl) modelsEl.textContent = models.length;
    if (criteriaEl) criteriaEl.textContent = criteria.length;

    if (leaderEl) {

        if (!results || results.length === 0 || models.length === 0) {
            leaderEl.textContent = "-";
            return;
        }

        const sorted = [...results].sort((a, b) => b.K_k - a.K_k);
        const leader = sorted[0];

        leaderEl.textContent = leader?.model?.name ?? "-";
    }
}

// ЛОГИКА ГЕНЕРАЦИИ НОВОЙ МОДЕЛИ
const addModelBtn = document.getElementById("addModelBtn");

const modelModal = document.getElementById("modelModalOverlay");
const modelClose = document.getElementById("modelModalClose");
const createModelBtn = document.getElementById("createModelBtn");
const modelInput = document.getElementById("modelInput");

const rankList = document.querySelector(".rank-list");

// ПРОВЕРКА НАЗВАНИЯ ДОБАВЛЯЕМОЙ МОДЕЛИ НА ДУБЛИКАТ
function isDuplicateModelName(name) {
    return models.some(m =>
        m.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
}

// ВАЛИДАЦИЯ НОВОЙ МОДЕЛИ
function validateModelInput() {
    const name = modelInput.value.trim();
    const wrapper = document.querySelector(".input-wrapper");

    const isEmpty = !name;

    // при переименовании разрешаем текущее имя
    const isDuplicate = !isEmpty && models.some(m => {
        if (
            modelModalMode === "rename" &&
            m.id == editingModelId
        ) {
            return false;
        }

        return m.name.trim().toLowerCase() === name.toLowerCase();
    });

    const invalid = !isEmpty && isDuplicate;

    createModelBtn.disabled = invalid;

    modelInput.classList.toggle("input-error", invalid);
    wrapper.classList.toggle("input-error", invalid);

    createModelBtn.classList.toggle("disabled", invalid);
}

addModelBtn.onclick = () => {
    modelModalMode = "create";
    editingModelId = null;
    modelModalTitle.textContent = "Добавить модель";

    modelModalDescription.classList.add("hidden");
    modelModalDescription.innerHTML = " ";

    modelInput.classList.remove("hidden");
    modelInput.addEventListener("input", validateModelInput);

    createModelBtn.textContent = "Добавить";
    createModelBtn.classList.remove("danger");
    createModelBtn.classList.remove("holding");
    createModelBtn.style.setProperty("--hold-progress", "0%");

    modelModal.classList.add("active");
    modelInput.value = "";
    modelInput.focus();
    validateModelInput();
};

modelClose.onclick = () => {
    modelModal.classList.remove("active");
    cancelModelHoldDelete();
};

modelModal.onclick = (e) => {
    if (e.target === modelModal) {
        modelModal.classList.remove("active");
        cancelModelHoldDelete();
    }
};


// ЛОГИКА ДОБАВЛЕНИЯ НОВОЙ МОДЕЛИ
createModelBtn.onclick = async () => {
    if (modelModalMode === "delete") return;

    if (modelModalMode === "create") {
        const name = modelInput.value.trim();

    if (!name || isDuplicateModelName(name)) return;
        if (!name || !currentProjectId) return;

        await fetch(`/api/projects/${currentProjectId}/models`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        modelModal.classList.remove('active');

        const activeEl = document.querySelector(
            `.project-item[data-id="${currentProjectId}"]`
        );

        await openProject(currentProjectId, activeEl);
    }

    if (modelModalMode === "rename") {
        const newName = modelInput.value.trim();
        if (!newName) return;

        await fetch(`/api/projects/${currentProjectId}/models/${editingModelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        modelModal.classList.remove('active');

        const activeEl = document.querySelector(
            `.project-item[data-id="${currentProjectId}"]`
        );

        await openProject(currentProjectId, activeEl);
    }
};

// Обработчики удержания для удаления
createModelBtn.addEventListener("mousedown", () => { if (modelModalMode === "delete") startModelHoldDelete(); });
createModelBtn.addEventListener("mouseup", () => { if (modelModalMode === "delete") cancelModelHoldDelete(); });
createModelBtn.addEventListener("mouseleave", () => { if (modelModalMode === "delete") cancelModelHoldDelete(); });
createModelBtn.addEventListener("touchstart", () => { if (modelModalMode === "delete") startModelHoldDelete(); });
createModelBtn.addEventListener("touchend", cancelModelHoldDelete);

// ===== ЛОГИКА МОДЕЛЕЙ (ПЕРЕИМЕНОВАНИЕ / УДАЛЕНИЕ) =====
let modelModalMode = "create"; // create | rename | delete
let editingModelId = null;
let modelHoldStart = 0;
let modelHoldProgressInterval = null;

const modelModalTitle = document.getElementById("modelModalTitle");
const modelModalDescription = document.getElementById("modelModalDescription");

function openRenameModelModal(modelId, currentName) {
    modelModalMode = "rename";
    editingModelId = modelId;

    modelModalTitle.textContent = "Переименовать модель";

    modelModalDescription.classList.add("hidden");
    modelInput.classList.remove("hidden");

    modelInput.value = currentName;

    createModelBtn.textContent = "Сохранить";
    createModelBtn.className = "modal-create-btn";

    modelModal.classList.add("active");
    validateModelInput();
}

function openDeleteModelModal(modelId, currentName) {
    modelModalMode = "delete";
    editingModelId = modelId;

    modelModalTitle.textContent = "Удаление модели";

    modelInput.classList.add("hidden");

    modelModalDescription.classList.remove("hidden");
    modelModalDescription.innerHTML = `
        <div class="modal-warning-text">
            Удалить модель «${currentName}»?
        </div>
    `;

    createModelBtn.textContent = "Удалить";
    createModelBtn.className = "modal-create-btn danger";

    modelModal.classList.add("active");
}

function startModelHoldDelete() {
    if (modelModalMode !== "delete") return;
    if (modelHoldProgressInterval) return;
    const btn = createModelBtn;
    let progress = 0;
    const duration = 200;

    btn.classList.add("holding");
    modelHoldStart = Date.now();

    modelHoldProgressInterval = setInterval(() => {
        const elapsed = Date.now() - modelHoldStart;
        progress = Math.min(elapsed / duration, 1);
        btn.style.setProperty("--hold-progress", `${progress * 100}%`);

        if (progress >= 1) {
            clearInterval(modelHoldProgressInterval);
            executeModelDelete();
        }
    }, 16);
}

function resetModelHoldState() {
    const btn = createModelBtn;
    btn.classList.remove("holding");
    btn.style.pointerEvents = "auto";
    btn.style.setProperty("--hold-progress", "0%");
    clearInterval(modelHoldProgressInterval);
    modelHoldProgressInterval = null;
}

function cancelModelHoldDelete() {
    clearInterval(modelHoldProgressInterval);
    if (modelHoldProgressInterval && createModelBtn.classList.contains("holding")) {
        resetModelHoldState();
    }
    const btn = createModelBtn;
    btn.classList.remove("holding");
    btn.style.pointerEvents = "auto";
    btn.style.setProperty("--hold-progress", "0%");
}

async function executeModelDelete() {
    await fetch(`/api/projects/${currentProjectId}/models/${editingModelId}`, {
        method: 'DELETE'
    });
    modelModal.classList.remove('active');
    resetModelHoldState();
    
    const activeEl = document.querySelector(
        `.project-item[data-id="${currentProjectId}"]`
    );

    await openProject(currentProjectId, activeEl);
}


// ПЕРЕКЛЮЧЕНИЕ ПОДРАЗДЕЛОВ
const tabs = document.querySelectorAll(".tab");

const pages = {
    "Проект": document.getElementById("page-project"),
    "Критерии": document.getElementById("page-criteria"),
    "Оценки": document.getElementById("page-scores"),
    "Результаты": document.getElementById("page-results"),
    "Анализ": document.getElementById("page-analysis"),
};

tabs.forEach(tab => {
    tab.addEventListener("click", async () => {
        await switchTab(tab.textContent.trim());

        // убрать active у всех tabs
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // скрыть все страницы
        Object.values(pages).forEach(p => p.classList.remove("active"));

        // показать нужную и сохранить как последнюю посещённую
        const name = tab.textContent.trim();
        localStorage.setItem("lastTab", name);

        if (pages[name]) {
            pages[name].classList.add("active");

            if (name === "Результаты" && currentProjectId) {
                await renderAllCharts();
            }

            if (name === "Анализ" && currentProjectId) {
                await loadSensitivity();
                await renderAnalysis(currentProjectId);
            }

            // Сбрасываем кнопку генерации отчёта при уходе с вкладки Анализ
            if (name !== "Анализ") {
                const btn = document.getElementById('btn-generate');
                if (btn && !btn.disabled) {
                    btn.textContent = 'Скачать отчёт (PDF)';
                }
            }
        }
    });
});

// ЗАПОЛНЕНИЕ СПИСКА ВКЛАДКИ КРИТЕРИЕВ
function renderCriteria(criteriaFromApi) {
    criteriaContainer.innerHTML = "";

    const groups = {};

    criteriaFromApi.forEach(c => {
        if (!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
    });

    Object.entries(groups).forEach(([groupName, items]) => {
        const group = document.createElement("div");
        group.className = "criteria-group";

        let html = `
            <div class="criteria-title">Группа - ${groupName}</div>
            <div class="criteria-box">
        `;

        items.forEach(c => {
            html += `
                <div class="criteria-item" data-id="${c.id}">
                    <div class="criteria-name">${c.name}</div>
                    <div class="criteria-control">
                        <button class="resetWeightBtn inactive">⭯</button>
                        <input type="range" min="0" max="100"
                            value="${Math.round(c.weight * 100)}"
                            class="criteria-slider">
                        <div class="criteria-value">${Math.round(c.weight * 100)}%</div>
                    </div>
                </div>
            `;
            criteriaInitial[c.id] = Math.round(c.weight * 100);
        });

        html += `</div>`;
        group.innerHTML = html;

        criteriaContainer.appendChild(group);
    });

    attachCriteriaListeners();
    updateCriteriaSum();
}

function attachCriteriaListeners() {
    criteriaContainer.querySelectorAll(".criteria-item").forEach(item => {
        const slider = item.querySelector(".criteria-slider");
        const value = item.querySelector(".criteria-value");
        const resetBtn = item.querySelector(".resetWeightBtn");
        const criterionId = item.dataset.id;

        updateResetButtonState(item, slider, resetBtn, criterionId);

        slider.addEventListener("input", () => {
            let newValue = Math.max(0, Math.min(Number(slider.value)));

            slider.value = newValue;
            value.textContent = newValue + "%";

            updateCriteriaSum();
            updateResetButtonState(item, slider, resetBtn, criterionId);
        });

        resetBtn.addEventListener("click", () => {

            if (resetBtn.classList.contains("inactive")) return;

            resetBtn.classList.add("hiding");

            resetBtn.addEventListener("animationend", () => {

                const target = criteriaInitial[criterionId];
                const current = Number(slider.value);

                animateSlider(slider, current, target, 150);

                resetBtn.classList.remove("hiding");

            }, { once: true });
        });
    });
}

// ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПКИ РЕСЕТА
function updateResetButtonState(item, slider, resetBtn, criterionId) {
    const initial = criteriaInitial[criterionId];
    const current = Number(slider.value);

    const isDirty = current !== initial;

    if (isAnimatingReset) {
        resetBtn.classList.add("inactive");
        return;
    }

    resetBtn.classList.toggle("inactive", !isDirty);
}

function animateSlider(slider, from, to, duration = 300) {
    const start = performance.now();
    isAnimatingReset = true;

    function frame(time) {
        const progress = Math.min((time - start) / duration, 1);
        const value = from + (to - from) * progress;

        slider.value = value;
        slider.dispatchEvent(new Event("input"));

        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            isAnimatingReset = false;
        }
    }

    requestAnimationFrame(frame);
}

// ОТМЕНА ВСЕХ ИЗМЕНЕНИЙ ВЕСОВ
document.getElementById("resetWeightsBtn").addEventListener("click", () => {

    criteriaContainer.querySelectorAll(".criteria-item").forEach(item => {

        const slider = item.querySelector(".criteria-slider");
        const value = item.querySelector(".criteria-value");
        const resetBtn = item.querySelector(".resetWeightBtn");
        const criterionId = item.dataset.id;

        const initial = criteriaInitial[criterionId];

        animateSlider(slider, Number(slider.value), initial, 300);
        slider.value = initial;
        value.textContent = initial + "%";

        updateResetButtonState(item, slider, resetBtn, criterionId);
    });

    updateCriteriaSum();
    saveCriteriaDebounced();
});

// СОХРАНЕНИЕ ВСЕХ НОВЫЙ ВЕСОВ
document.getElementById("saveWeightsBtn").addEventListener("click", async () => {
    const sliders = Array.from(criteriaContainer.querySelectorAll(".criteria-slider"));
    const rawValues = sliders.map(s => Number(s.value));
    const normalizedValues = normalizeWeightsValues(rawValues);

    const payload = Array.from(criteriaContainer.querySelectorAll(".criteria-item")).map((item, i) => {

        const slider = item.querySelector(".criteria-slider");
        const valueEl = item.querySelector(".criteria-value");
        const criterionId = item.dataset.id;

        const value = normalizedValues[i];

        animateSlider(slider, Number(slider.value), value, 250);
        valueEl.textContent = value + "%";

        return {
            id: criterionId,
            weight: value / 100,
            enabled: true
        };
    });

    await fetch(`/api/projects/${currentProjectId}/criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    payload.forEach(p => {
        criteriaInitial[p.id] = Math.round(p.weight * 100);
    });

    updateCriteriaSum();

    criteriaContainer.querySelectorAll(".criteria-item").forEach(item => {
        const slider = item.querySelector(".criteria-slider");
        const resetBtn = item.querySelector(".resetWeightBtn");
        const criterionId = item.dataset.id;

        updateResetButtonState(item, slider, resetBtn, criterionId);
    });

    await refreshResults();
});

// ИЗМЕНЕНИЕ ВЕСОВ КРИТЕРИЕВ
criteriaContainer.querySelectorAll(".criteria-item").forEach(item => {
    const slider = item.querySelector(".criteria-slider");
    const value = item.querySelector(".criteria-value");

    slider.addEventListener("input", () => {
        const sliders = Array.from(criteriaContainer.querySelectorAll(".criteria-slider"));

        const currentTotal = sliders.reduce((sum, s) => sum + Number(s.value), 0);

        const maxAllowed = 100 - (currentTotal - Number(slider.value));

        let newValue = Number(slider.value);
        newValue = Math.max(0, Math.min(newValue, maxAllowed));

        if (newValue > maxAllowed) {
            newValue = maxAllowed;
        }

        if (newValue < 0) {
            newValue = 0;
        }

        slider.value = newValue;
        value.textContent = newValue + "%";

        updateCriteriaSum();
        saveCriteriaDebounced();
    });
});

// НОРМАЛИЗАЦИЯ ВЕСОВ ПРИ СОХРАНЕНИИ НОВЫХ ЗНАЧЕНИЙ
let isNormalizing = false;

function normalizeWeightsValues(values) {
    const sum = values.reduce((a, b) => a + b, 0);

    if (sum === 0) {
        const equal = 100 / values.length;
        return values.map(() => Math.round(equal));
    }

    const normalized = values.map(v => (v / sum) * 100);

    const floored = normalized.map(v => Math.floor(v));

    let diff = 100 - floored.reduce((a, b) => a + b, 0);

    // распределяем остаток по наибольшим дробным частям
    // предохранитель от суммы, не равно 100%
    const fractions = normalized
        .map((v, i) => ({ i, frac: v - floored[i] }))
        .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < diff; i++) {
        floored[fractions[i % fractions.length].i]++;
    }

    return floored;
}

// ДИНАМИЧЕСКОЕ ИЗМЕНЕНИИ ИНТЕГРАЛЬНОЙ ОЦЕНКИ С ИЗМЕНЕНИЕМ ВЕСОВ КРИТЕРИВ
let criteriaTimeout = null;

function saveCriteriaDebounced() {
    // if (isNormalizing) return;
    clearTimeout(criteriaTimeout);

    criteriaTimeout = setTimeout(async () => {
        if (!currentProjectId) return;

        const payload = Array.from(criteriaContainer.querySelectorAll(".criteria-item")).map(item => {
            const slider = item.querySelector(".criteria-slider");
            return {
                id: item.dataset.id,
                weight: slider.value / 100,
                enabled: true
            };
        });

        await fetch(`/api/projects/${currentProjectId}/criteria`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        await refreshResults();
    }, 300);
}

// СУММА ВЕСОВ ПО ВСЕМ КРИТЕРИЯМ
function updateCriteriaSum() {
    const sliders = criteriaContainer.querySelectorAll(".criteria-slider");

    let total = 0;

    sliders.forEach(slider => {
        total += Number(slider.value);
    });

    const totalBox = document.getElementById("criteriaTotal");
    if (totalBox) {
        totalBox.textContent = total + "%";
    }
}

updateCriteriaSum();


// ХРАНЕНИЕ ОЦЕНОК
// формат: ratings["Точность ответа"]["ResNet18"] = 4

const ratings = {};

// РУЧНАЯ ОЦЕНКА МОДЕЛЕЙ КРУЖОЧКАМИ
function initRatingDots() {

    const allDots = document.querySelectorAll(".rating-cell .dot");

    allDots.forEach(dot => {

        dot.addEventListener("click", async () => {

            const value = Number(dot.textContent);

            // текущая ячейка модели
            const container = dot.closest(".rating-cell");

            const criterionId = container.dataset.criterionId;
            const modelId = container.dataset.modelId;

            // создаём объект критерия
            if (!ratings[modelId]) {
                ratings[modelId] = {};
            }

            // сохраняем оценку
            ratings[modelId][criterionId] = value;

            // обновляем визуал
            updateDots(container, value);

            // синхронизация оценок с сервером
            await fetch(`/api/projects/${currentProjectId}/scores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{
                    model_id: Number(modelId),
                    criterion_id: Number(criterionId),
                    value: value
                }])
            });
            await refreshResults();
        });

    });

}

function updateDots(container, value) {

    const dots = container.querySelectorAll(".dot");

    dots.forEach(d => {

        const current = Number(d.textContent);

        if (current <= value) {
            d.classList.add("active");
        } else {
            d.classList.remove("active");
        }

    });

}




// ЗАПОЛНЕНИЕ ПОДРАЗДЕЛА ОЦЕНОК ТАБЛИЦЕЙ
const scoresTable = document.getElementById("scoresTable");

function createScoresTable() {

    scoresTable.innerHTML = "";

    // ===== HEADER =====

    const header = document.createElement("div");
    header.className = "scores-row scores-header";
    header.style.gridTemplateColumns = `300px repeat(${models.length}, 220px)`;

    let headerHTML = `
        <div class="scores-cell criteria-header">
            Критерии
        </div>
    `;

    models.forEach(model => {
        headerHTML += `
            <div class="scores-cell model-header">
                ${model.name}
            </div>
        `;
    });

    header.innerHTML = headerHTML;

    scoresTable.appendChild(header);

    // ===== ROWS =====

    criteria.forEach(criterion => {

        const row = document.createElement("div");
        row.className = "scores-row";

        row.style.gridTemplateColumns =
            `300px repeat(${models.length}, 220px)`;

        let rowHTML = `
            <div class="scores-cell criteria-cell">
                <div class="crit-title">
                    ${criterion.title}
                </div>

                <div class="crit-weight">
                    Значимость - ${criterion.weight}%
                </div>
            </div>
        `;

        // ячейки моделей
        models.forEach(model => {

            let dotsHTML = "";

            for (let i = 1; i <= 5; i++) {
                dotsHTML += `
                    <div class="dot">${i}</div>
                `;
            }

            rowHTML += `
                <div 
                    class="scores-cell rating-cell"
                    data-criterion-id="${criterion.id}"
                    data-model-id="${model.id}"
                >
                    <div class="rating-dots">
                        ${dotsHTML}
                    </div>
                </div>
            `;
        });

        row.innerHTML = rowHTML;

        scoresTable.appendChild(row);
    });

    // восстановление оценок
    document.querySelectorAll(".rating-cell").forEach(cell => {

        const criterion = cell.dataset.criterion;
        const model = cell.dataset.model;

        const savedValue =
            ratings[criterion]?.[model];

        if (savedValue) {
            updateDots(cell, savedValue);
        }

    });

    // заново навесить события
    initRatingDots();
}

function updateRankList() {
    rankList.innerHTML = '';
    models.forEach((m, i) => {
        const item = document.createElement('div');
        const tagStyle = getTagStyle(m.label);
        item.className = 'rank-item';
        item.innerHTML = `
            <div class="rank-number">${i + 1}</div>
            <div class="rank-content">
                <div class="rank-name">${m.name}</div>
                <div class="rank-bar-container">
                    <div class="rank-bar">
                        <div class="rank-bar-fill" style="width:${m.score}%"></div>
                    </div>
                    <div class="rank-bar-text">${m.score.toFixed(1)}%</div>
                </div>
            </div>
            <div class="tag" style="background:${tagStyle.bg}; color:${tagStyle.text};"> ${extractTagName(m.label)} </div>
            <span class="model-ellipsis" data-id="${m.id}">&#8942;</span>
        `;

        const ellipsis = item.querySelector('.model-ellipsis');
        ellipsis.onclick = (e) => {
            e.stopPropagation();
            showModelCtxMenu(m.id, ellipsis);
        };

        rankList.appendChild(item);
    });
}

// разеделение имени тега и комментария к нему
function extractTagName(label) {
    if (!label) return "";
    return label.split("—")[0].trim();
}

const SCORE_THEME = {
    "Отличная": {
        bg: "#DCFCE7",
        text: "#166534"
    },
    "Хорошая": {
        bg: "#DBEAFE",
        text: "#1E40AF"
    },
    "Приемлемая": {
        bg: "#FEF3C7",
        text: "#92400E"
    },
    "Слабая": {
        bg: "#FFEDD5",
        text: "#9A3412"
    },
    "Не рекомендуется": {
        bg: "#FEE2E2",
        text: "#991B1B"
    }
};

function getTagStyle(label) {
    const key = extractTagName(label); 
    return SCORE_THEME[key] || {
        bg: "#F3F4F6",
        text: "#374151"
    };
}

// СОРТИРОВКА МОДЕЛЕЙ В РЕЗУЛЬТАТАХ
function renderResults() {
    const list = document.querySelector(".results-models-list");
    list.innerHTML = "";

    const isCollapsed = resultsBlock.classList.contains("collapsed");
    const limit = window.innerWidth >= 1400 ? 8 : 4;

    const visibleModels = isCollapsed ? models.slice(0, limit) : models;

    visibleModels.forEach((m, index) => {
        const tagText = extractTagName(m.label);
        const tagStyle = getTagStyle(m.label);

        const item = document.createElement("div");
        item.className = "rank-item";

        item.innerHTML = `
            <div class="rank-number">${index + 1}</div>

            <div class="rank-content">
                <div class="rank-name">${m.name}</div>
                <div class="rank-bar-container">
                    <div class="rank-bar">
                        <div class="rank-bar-fill" style="width:${m.score}%"></div>
                    </div>
                    <div class="rank-bar-text">${m.score.toFixed(1)}%</div>
                </div>
            </div>

            <div class="tag"
                style="background:${tagStyle.bg}; color:${tagStyle.text};">
                ${tagText}
            </div>
        `;

        list.appendChild(item);
    });
}

// обновление всех результатов
async function refreshResults() {
    if (!currentProjectId) return;

    try {
        const resultsRes = await fetch(`/api/projects/${currentProjectId}/results`);
        const apiResults = await resultsRes.json();

        const resultsMap = {};
        apiResults.forEach(r => {
            resultsMap[r.model.id] = r;
        });

        models = models.map(m => {
            const r = resultsMap[m.id];
            return {
                ...m,
                score: r ? r.K_k * 100 : 0,
                label: r ? extractTagName(r.label) : "Нет оценки"
            };
        });

        updateRankList();
        renderResults();
        updateProjectStats(models, criteria, apiResults);
        await renderAllCharts();
        await renderRadarChart();

    } catch (e) {
        console.error("Ошибка обновления результатов:", e);
    }
}

let sortMode = "rating"; // rating | name
let sortOrder = "desc";   // asc | desc

function sortResults() {
    models.sort((a, b) => {

        let valA, valB;

        if (sortMode === "name") {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        }

        // rating
        valA = a.score;
        valB = b.score;

        return sortOrder === "asc"
            ? valA - valB
            : valB - valA;
    });

    renderResults();
    updateShowMoreState();
}

const sortBtns = document.querySelectorAll(".sort-btn");
const orderBtn = document.querySelector(".order-btn");

sortBtns.forEach(btn => {
    btn.addEventListener("click", () => {

        sortBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const text = btn.textContent.trim();

        sortMode = text === "Название" ? "name" : "rating";

        sortResults();
        updateShowMoreState();
    });
});

orderBtn.addEventListener("click", () => {
    sortOrder = sortOrder === "asc" ? "desc" : "asc";

    orderBtn.textContent = sortOrder === "asc" ? "↑" : "↓";

    sortResults();
    updateShowMoreState();
});

// SHOW MORE КНОПКА В СПИСКЕ МОДЕЛЕЙ РАЗДЕЛА РЕЗУЛЬТАТОВ
const resultsBlock = document.querySelector(".results-rating-block");
const showMoreBtn = document.querySelector(".show-more-btn");
const resultsList = document.querySelector(".results-models-list");

if (resultsBlock && showMoreBtn && resultsList) {

    resultsBlock.classList.add("collapsed");

    showMoreBtn.onclick = () => {
        const isCollapsed = resultsBlock.classList.contains("collapsed");

        if (isCollapsed) {
            // РАСШИРЯЕМ
            resultsBlock.classList.remove("collapsed");
            resultsBlock.classList.add("expanded");
            showMoreBtn.textContent = "Свернуть";
        } else {
            // СВЁРТЫВАЕМ
            resultsBlock.classList.remove("expanded");
            resultsBlock.classList.add("collapsed");

            // СКРОЛЛ В НАЧАЛО ПРИ СВЁРТКЕ
            resultsList.scrollTop = 0;

            showMoreBtn.textContent = "Показать больше";
        }

        renderResults();
    };
}

function updateShowMoreState() {
    const LIMIT = window.innerWidth >= 1400 ? 8 : 4;

    if (models.length <= LIMIT) {
        showMoreBtn.disabled = true;
        showMoreBtn.classList.add("disabled");
    } else {
        showMoreBtn.disabled = false;
        showMoreBtn.classList.remove("disabled");
    }
}


// СТОЛБЧАТЫЕ ДИАГРАММЫ В РЕЗУЛЬТАТАХ
const criteriaGroups = [
    { name: "Точность", criteria: ["Точность ответа", "Логичность и структура", "Глубина ответа"] },
    { name: "Устойчивость", criteria: ["Устойчивость к шуму", "Обработка сложных запросов"] },
    { name: "Контекст", criteria: ["Контекстная согласованность"] }
];

// общий рассчёт оценок для диаграмм
function calculateGroupScore(model, group) {
    let total = 0;
    let weightSum = 0;

    group.criteria.forEach(name => {
        const crit = criteria.find(c => c.title === name);
        if (!crit) return;

        const value = ratings[model.id]?.[crit.id] || 0;

        total += value * crit.weight;
        weightSum += crit.weight;
    });

    return weightSum ? total / weightSum : 0;
}

// рендер холста под диаграммы
async function renderChart(container, group) {
    if (!currentProjectId) return;

    try {
        const res = await fetch(
            `/api/projects/${currentProjectId}/top-models?group=${encodeURIComponent(group.name)}`
        );

        if (!res.ok) throw new Error('Failed to fetch top models');

        const topModels = await res.json();

        container.innerHTML = `
            <div class="results-block-header">${group.name}</div>
            <div class="chart-bars"></div>
        `;

        const barsContainer = container.querySelector(".chart-bars");

        if (topModels.length === 0) {
            barsContainer.innerHTML = `<div style="padding: 20px; color: #888; text-align: center;">Нет данных</div>`;
            return;
        }

        topModels.forEach(item => {
            const percentage = (item.score * 20).toFixed(1); // переводим из 1-5 в проценты (примерно)

            const bar = document.createElement("div");
            bar.style.display = "flex";
            bar.style.alignItems = "center";
            bar.style.gap = "10px";
            bar.style.marginTop = "12px";

            bar.innerHTML = `
                <div style="width: 85px; font-size: 13px; font-weight: 600;">
                    ${item.model_name}
                </div>

                <div style="flex: 1; height: 11px; background:#e5e7eb; border-radius: 999px; overflow:hidden;">
                    <div style="width:${percentage}%; height:100%; background:linear-gradient(90deg, #8b5cf6, #c084fc);"></div>
                </div>

                <div style="width: 48px; font-size: 13px; font-family: 'Space Mono', monospace; text-align:right;">
                    ${percentage}%
                </div>
            `;

            barsContainer.appendChild(bar);
        });

    } catch (e) {
        console.error("Error loading top models for", group.name, e);
        container.innerHTML = `
            <div class="results-block-header">${group.name}</div>
            <div style="padding: 30px; color: #999; text-align: center; font-size: 14px;">
                Не удалось загрузить данные
            </div>
        `;
    }
}

// рендер 3 диаграмм
async function renderAllCharts() {
    const blocks = document.querySelectorAll(".chart-block");

    await Promise.all(
        Array.from(blocks).map((block, i) => {
            const group = criteriaGroups[i];
            if (group) return renderChart(block, group);
            return Promise.resolve();
        })
    );

    await renderRadarChart();
}

// RADAR CHART РЕЗУЛЬТАТОВ

let radarChartInstance = null;

async function renderRadarChart() {
    if (!currentProjectId) return;

    const canvas = document.getElementById('radarChart');
    if (!canvas) return;

    const res = await fetch(`/api/projects/${currentProjectId}/results`);
    const results = await res.json();

    if (results.length === 0) {
        if (radarChartInstance) radarChartInstance.destroy();
        return;
    }

    const labels = ['Точность', 'Устойчивость', 'Контекст'];

    const datasets = results.slice(0, 5).map((result, index) => {  // максимум 5 моделей
        const model = result.model;
        const scores = {
            'Точность': calculateGroupScoreByName(model.id, 'Точность'),
            'Устойчивость': calculateGroupScoreByName(model.id, 'Устойчивость'),
            'Контекст': calculateGroupScoreByName(model.id, 'Контекст')
        };

        const colors = [
            '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6'
        ];

        return {
            label: model.name,
            data: labels.map(label => scores[label] || 0),
            fill: true,
            backgroundColor: colors[index % colors.length] + '33',
            borderColor: colors[index % colors.length],
            borderWidth: 3,
            pointBackgroundColor: colors[index % colors.length],
            pointBorderColor: '#fff',
            pointHoverBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7
        };
    });


    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    radarChartInstance = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    min: 0,
                    max: 5,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 }
                    },
                    grid: {
                        color: '#e2e8f0'
                    },
                    angleLines: {
                        color: '#e2e8f0'
                    },
                    pointLabels: {
                        font: {
                            size: 13,
                            weight: '600'
                        },
                        color: '#4b5563'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 15,
                        boxWidth: 12,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw.toFixed(2)}`
                    }
                }
            }
        }
    });
}


function calculateGroupScoreByName(modelId, groupName) {
    const groupCriteria = {
        'Точность': ['Точность ответа', 'Логичность и структура', 'Глубина и полнота ответа', 'Гибкость в интерпретации', 'Адекватность формата'],
        'Устойчивость': ['Устойчивость к нагрузке', 'Обработка сложных запросов', 'Восприятие неоднозначности', 'Анализ и синтез информации'],
        'Контекст': ['Контекстная согласованность', 'Адаптивность к стилю', 'Чувствительность к контексту']
    };

    const criteriaInGroup = criteria.filter(c =>
        groupCriteria[groupName]?.includes(c.title)
    );

    if (criteriaInGroup.length === 0) return 0;

    let total = 0;
    let weightSum = 0;

    criteriaInGroup.forEach(crit => {
        const value = ratings[modelId]?.[crit.id] || 0;
        total += value * crit.weight;
        weightSum += crit.weight;
    });

    return weightSum ? total / weightSum : 0;
}

// ОТОБРАЖЕНИЕ АНАЛИЗА НА СТРАНИЦЕ
async function renderAnalysis(projectId) {
    const box = document.getElementById('analysis-content');
    if (!box || !projectId) return;

    box.classList.remove('hidden');
    box.innerHTML = '<div class="analysis-loading">Загрузка данных...</div>';

    try {
        const res = await fetch(`/api/projects/${projectId}/analysis`);

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Нет данных' }));
            box.innerHTML = `<div class="analysis-error">${err.error || 'Ошибка загрузки'}</div>`;
            return;
        }

        const d = await res.json();

        // Таблица рейтинга
        const medalClass = ['gold', 'silver', 'bronze'];
        const rankRows = d.ranking.map((m, i) => `
            <tr class="${medalClass[i] || ''}">
                <td>${i + 1}</td>
                <td>${m.name}</td>
                <td>${m.s_k.toFixed(2)}</td>
                <td>${m.k_k.toFixed(2)}</td>
            </tr>
        `).join('');

        // Список критериев
        const critBlock = (label, items, cls) => items.length ? `
            <div class="crit-group ${cls}">
                <div class="crit-group-label">${label}</div>
                <ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>
            </div>` : '';

        // Таблица групп
        const groupRows = d.groups.map(g => `
            <tr>
                <td>${g.name}</td>
                <td>${g.avg_score.toFixed(1)}</td>
                <td>${g.level_text}</td>
            </tr>
        `).join('');

        box.innerHTML = `
            <div class="analysis-date">Данные актуальны на: ${d.generation_date}</div>

            <div class="analysis-section">
                <div class="analysis-section-title">Лидер рейтинга</div>
                <p>Модель <strong>${d.best_model_name}</strong> заняла первое место.<br>
                Результат: <strong>${d.best_model_performance}</strong>
                (взвешенная оценка ${d.best_model_score.toFixed(2)}).</p>
            </div>

            <div class="analysis-section">
                <div class="analysis-section-title">Рейтинг всех моделей</div>
                <table class="analysis-table">
                    <thead>
                        <tr><th>Место</th><th>Модель</th><th>Оценка (s_k)</th><th>Коэф. (k_k)</th></tr>
                    </thead>
                    <tbody>${rankRows}</tbody>
                </table>
            </div>

            <div class="analysis-section">
                <div class="analysis-section-title">Анализ критериев — ${d.best_model_name}</div>
                <p>Из <strong>${d.total_criteria_count}</strong> критериев:</p>
                ${critBlock('Высокие показатели (4–5)', d.high_criteria, 'high')}
                ${critBlock('Средние показатели (3)',   d.mid_criteria,  'mid')}
                ${critBlock('Низкие показатели (1–2)',  d.low_criteria,  'low')}
            </div>

            <div class="analysis-section">
                <div class="analysis-section-title">Оценка групп критериев — ${d.best_model_name}</div>
                <table class="analysis-table">
                    <thead>
                        <tr><th>Группа</th><th>Средний балл</th><th>Уровень</th></tr>
                    </thead>
                    <tbody>${groupRows}</tbody>
                </table>
            </div>
        `;

    } catch (err) {
        box.innerHTML = `<div class="analysis-error">Ошибка: ${err.message}</div>`;
    }
}

// ЛОГИКА ГЕНЕРАЦИИ PDF (ВКЛАДКА АНАЛИЗ)
async function generateReport(projectId) {
    const btn = document.getElementById('btn-generate');

    btn.disabled    = true;
    btn.textContent = 'Генерация...';

    try {
        const response = await fetch(`/api/projects/${projectId}/report`);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Сервер вернул ${response.status}: ${text}`);
        }

        const blob     = await response.blob();
        const blobUrl  = URL.createObjectURL(blob);
        const filename = `project_${projectId}_report.pdf`;

        const a    = document.createElement('a');
        a.href     = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

        btn.disabled    = false;
        btn.textContent = 'Готово! Скачать ещё раз';

    } catch (err) {
        alert(`Ошибка генерации отчёта: ${err.message}`);
        btn.disabled    = false;
        btn.textContent = 'Скачать отчёт (PDF)';
    }
};

// ОТВЕЧАЕТ ЗА СТАРТ СТРАНИЦЫ
document.addEventListener("DOMContentLoaded", async () => {    
    await initApp();
    const sidebarOpen = localStorage.getItem("sidebarOpen") === "true";
    setSidebarState(sidebarOpen);
    document.body.classList.remove("booting");
});