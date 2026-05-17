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

addBtn.onclick = () => {
    modal.classList.add("active");
    input.value = "";
    input.focus();
};

closeModal.onclick = () => {
    modal.classList.remove("active");
};

modal.onclick = (e) => {
    if (e.target === modal) {
        modal.classList.remove("active");
    }
};

createProjectBtn.onclick = () => {
    const name = input.value.trim();

    if (!name) return;

    const item = document.createElement("div");
    item.className = "project-item";
    item.textContent = name;

    projectList.appendChild(item);

    modal.classList.remove("active");
};


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
createModelBtn.onclick = () => {
    const name = modelInput.value.trim();
    if (!name) return;

    const score = Math.floor(Math.random() * 51) + 50; // 50–100

    let tagText = "Приемлемая";
    let tagClass = "ok";

    if (score > 75) {
        tagText = "Отличная";
        tagClass = "good";
    }

    const item = document.createElement("div");
    item.className = "rank-item";

    const number = models.length + 1;

    item.innerHTML = `
        <div class="rank-number">${number}</div>
        <div class="rank-content">
            <div class="rank-name">${name}</div>
            <div class="rank-bar">
                <div class="rank-bar-fill" style="width:${score}%"></div>
            </div>
        </div>
        <div class="tag ${score > 75 ? "good" : "ok"}">
            ${score > 75 ? "Отличная" : "Приемлемая"}
        </div>
    `;

    rankList.appendChild(item);
    models.push({ name, score }); // обновление внутреннго списка моделей
    createScoresTable();          // обновление списка моделей в Оценках
    renderAllCharts();            // создание диаграмм в Результатах
    sortResults();                // сортировка моделей в Результатах
    updateShowMoreState();        // обновление состояния кнопки showmore в Результатах

    modelModal.classList.remove("active");
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
    tab.addEventListener("click", () => {

        // убрать active у всех tabs
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // скрыть все страницы
        Object.values(pages).forEach(p => p.classList.remove("active"));

        // показать нужную
        const name = tab.textContent.trim();
        if (pages[name]) {
            pages[name].classList.add("active");
        }
    });
});


// ИЗМЕНЕНИЕ ВЕСОВ КРИТЕРИЕВ
document.querySelectorAll(".criteria-item").forEach(item => {
    const slider = item.querySelector(".criteria-slider");
    const value = item.querySelector(".criteria-value");

    slider.addEventListener("input", () => {
        value.textContent = slider.value + "%";
    });
});

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

// обновление каждого слайдера
document.querySelectorAll(".criteria-item").forEach(item => {
    const slider = item.querySelector(".criteria-slider");
    const value = item.querySelector(".criteria-value");

    slider.addEventListener("input", () => {
        value.textContent = slider.value + "%";
        updateCriteriaSum();
    });
});

updateCriteriaSum();


// ХРАНЕНИЕ ОЦЕНОК
// формат: ratings["Точность ответа"]["ResNet18"] = 4

const ratings = {};

// РУЧНАЯ ОЦЕНКА МОДЕЛЕЙ КРУЖОЧКАМИ
function initRatingDots() {

    const allDots = document.querySelectorAll(".rating-cell .dot");

    allDots.forEach(dot => {

        dot.addEventListener("click", () => {

            const value = Number(dot.textContent);

            // текущая ячейка модели
            const container = dot.closest(".rating-cell");

            const criterion =
                container.dataset.criterion;

            const model =
                container.dataset.model;

            // создаём объект критерия
            if (!ratings[criterion]) {
                ratings[criterion] = {};
            }

            // сохраняем оценку
            ratings[criterion][model] = value;

            // обновляем визуал
            updateDots(container, value);

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


// ДАННЫЕ ДЛЯ ПОДРАЗДЕЛА ОЦЕНОК (ЗАГЛУШКА!!!)
let models = [
    { name: "ResNet18", score: 92 },
    { name: "EfficientNet", score: 67 },
    { name: "ArpaNet", score: 84 }
];

const criteria = [
    {
        title: "Точность ответа",
        weight: 70
    },
    {
        title: "Логичность и структура",
        weight: 60
    },
    {
        title: "Глубина ответа",
        weight: 80
    },
    {
        title: "Устойчивость к шуму",
        weight: 75
    },
    {
        title: "Обработка сложных запросов",
        weight: 65
    },
    {
        title: "Контекстная согласованность",
        weight: 85
    }
];


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
                    data-criterion="${criterion.title}"
                    data-model="${model.name}"
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

// СОРТИРОВКА МОДЕЛЕЙ В РЕЗУЛЬТАТАХ
function renderResults() {
    const list = document.querySelector(".results-models-list");
    list.innerHTML = "";

    models.forEach((m, index) => {
        const tagText = m.score > 75 ? "Отличная" : "Приемлемая";
        const tagClass = m.score > 75 ? "good" : "ok";

        const item = document.createElement("div");
        item.className = "rank-item";

        item.innerHTML = `
            <div class="rank-number">${index + 1}</div>

            <div class="rank-content">
                <div class="rank-name">${m.name}</div>
                <div class="rank-bar">
                    <div class="rank-bar-fill" style="width:${m.score}%"></div>
                </div>
            </div>

            <div class="tag ${tagClass}">${tagText}</div>
        `;

        list.appendChild(item);
    });
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
    };
}

function updateShowMoreState() {
    const LIMIT = 10;

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
function renderChart(container, group) {

    const top = getTopModels(group);

    container.innerHTML = `
        <div class="results-block-header">${group.name}</div>
        <div class="chart-bars"></div>
    `;

    const bars = container.querySelector(".chart-bars");

    top.forEach(item => {

        const bar = document.createElement("div");
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.gap = "8px";
        bar.style.marginTop = "10px";

        bar.innerHTML = `
            <div style="width: 80px; font-size: 12px;">
                ${item.model.name}
            </div>

            <div style="flex: 1; height: 10px; background:#e5e7eb; border-radius: 999px; overflow:hidden;">
                <div style="width:${item.score}%; height:100%; background:#3b82f6;"></div>
            </div>

            <div style="width: 40px; font-size: 12px;">
                ${item.score.toFixed(1)}
            </div>
        `;

        bars.appendChild(bar);
    });
}

// рендер 3 диаграмм
function renderAllCharts() {
    const blocks = document.querySelectorAll(".chart-block");

    blocks.forEach((block, i) => {
        renderChart(block, criteriaGroups[i]);
    });
}


// ПРИ СТАРТЕ СТРАНИЦЫ

createScoresTable();   // создание таблицы в Оценках
renderAllCharts();     // создание диаграмм в Результатах
sortResults();         // сортировка моделей в Результатах
updateShowMoreState(); // обновление состояния кнопки showmore в Результатах