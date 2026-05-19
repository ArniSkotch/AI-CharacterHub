let currentProjectId = null;
const criteriaContainer = document.getElementById("criteriaContainer");
// САЙДБАР
const menuBtn = document.getElementById("menuButton");
const sidebar = document.querySelector(".sidebar");
const container = document.querySelector(".container");

menuBtn.onclick = () => {
    sidebar.classList.toggle("active");
    container.classList.toggle("shift");
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

    input.focus();
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

// WEBSITE ENTRY POINT
async function initApp() {
    await loadProjects();

    const lastId = localStorage.getItem("lastProjectId");

    if (!lastId) {
        setProjectState(false);
        return;
    }

    const el = [...document.querySelectorAll(".project-item")]
        .find(d => d.dataset.id == lastId);

    if (!el) {
        setProjectState(false);
        return;
    }

    await openProject(lastId, el);
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

    updateProjectStats(apiModels, apiCriteria);
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
function updateProjectStats(models, criteria, results = null) {
    const modelsEl = document.getElementById("statModels");
    const criteriaEl = document.getElementById("statCriteria");
    const leaderEl = document.getElementById("statLeader");

    if (modelsEl) modelsEl.textContent = models.length;
    if (criteriaEl) criteriaEl.textContent = criteria.length;

    if (leaderEl && models.length) {
        let leader = models[0];

        if (results && results.length) {
            leader = results.sort((a, b) => b.score - a.score)[0];
        }

        leaderEl.textContent = leader.name;
    }
}

// ЛОГИКА ГЕНЕРАЦИИ НОВОЙ МОДЕЛИ
const addModelBtn = document.getElementById("addModelBtn");

const modelModal = document.getElementById("modelModalOverlay");
const modelClose = document.getElementById("modelModalClose");
const createModelBtn = document.getElementById("createModelBtn");
const modelInput = document.getElementById("modelInput");

const rankList = document.querySelector(".rank-list");

addModelBtn.onclick = () => {
    modelModal.classList.add("active");
    modelInput.value = "";
    modelInput.focus();
};

modelClose.onclick = () => {
    modelModal.classList.remove("active");
};

modelModal.onclick = (e) => {
    if (e.target === modelModal) {
        modelModal.classList.remove("active");
    }
};


// ЛОГИКА ДОБАВЛЕНИЯ НОВОЙ МОДЕЛИ
createModelBtn.onclick = async () => {
    const name = modelInput.value.trim();
    if (!name || !currentProjectId) return;

    await fetch(`/api/projects/${currentProjectId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });

    modelModal.classList.remove('active');
    openProject(currentProjectId); // перезагрузить проект
};


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

        // убрать active у всех tabs
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // скрыть все страницы
        Object.values(pages).forEach(p => p.classList.remove("active"));

        // показать нужную
        const name = tab.textContent.trim();
        if (pages[name]) {
            pages[name].classList.add("active");

            if (name === "Результаты" && currentProjectId) {
                await renderAllCharts();
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
                        <input type="range" min="0" max="100"
                            value="${Math.round(c.weight * 100)}"
                            class="criteria-slider">
                        <div class="criteria-value">${Math.round(c.weight * 100)}%</div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        group.innerHTML = html;

        criteriaContainer.appendChild(group);
    });

    attachCriteriaListeners();
    updateCriteriaSum();
}

function attachCriteriaListeners() {
    document.querySelectorAll(".criteria-item").forEach(item => {
        const slider = item.querySelector(".criteria-slider");
        const value = item.querySelector(".criteria-value");

        slider.addEventListener("input", () => {
            const sliders = Array.from(document.querySelectorAll(".criteria-slider"));

            const currentTotal = sliders.reduce((sum, s) => sum + Number(s.value), 0);

            const maxAllowed = 100 - (currentTotal - Number(slider.value));

            let newValue = Math.max(0, Math.min(Number(slider.value), maxAllowed));

            slider.value = newValue;
            value.textContent = newValue + "%";

            updateCriteriaSum();
        });
    });
}

// ИЗМЕНЕНИЕ ВЕСОВ КРИТЕРИЕВ
document.querySelectorAll(".criteria-item").forEach(item => {
    const slider = item.querySelector(".criteria-slider");
    const value = item.querySelector(".criteria-value");

    slider.addEventListener("input", () => {
        const sliders = Array.from(document.querySelectorAll(".criteria-slider"));

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

// ДИНАМИЧЕСКОЕ ИЗМЕНЕНИИ ИНТЕГРАЛЬНОЙ ОЦЕНКИ С ИЗМЕНЕНИЕМ ВЕСОВ КРИТЕРИВ
let criteriaTimeout = null;

function saveCriteriaDebounced() {
    clearTimeout(criteriaTimeout);

    criteriaTimeout = setTimeout(async () => {
        if (!currentProjectId) return;

        const payload = Array.from(document.querySelectorAll(".criteria-item")).map(item => {
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

        await refreshResults(); // 👈 ВОТ ОНО
    }, 300);
}

// СУММА ВЕСОВ ПО ВСЕМ КРИТЕРИЯМ
function updateCriteriaSum() {
    const sliders = document.querySelectorAll(".criteria-slider");

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
            <div class="tag"
                style="background:${tagStyle.bg}; color:${tagStyle.text};">
                ${extractTagName(m.label)}
            </div>
        `;
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

    updateShowMoreState();
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

        const value = ratings[name]?.[model.name] || 0;

        total += value * crit.weight;
        weightSum += crit.weight;
    });

    return weightSum ? total / weightSum : 0;
}

// выбор 5 лучших моделей для диаграмм
function getTopModels(group) {

    return models
        .map(model => ({
            model,
            score: calculateGroupScore(model.name, group)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
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

// TESTTESTTEST

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

// ОТВЕЧАЕТ ЗА СТАРТ СТРАНИЦЫ
document.addEventListener("DOMContentLoaded", async () => {
    await initApp();
    document.body.classList.remove("booting");
});
