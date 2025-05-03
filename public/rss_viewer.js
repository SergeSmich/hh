// public/rss_viewer.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing RSS Viewer script...");

    // --- DOM элементы ---
    const rssGrid = document.getElementById('rss-grid');
    const paginationControls = document.getElementById('pagination-controls');
    const gamepadStatusEl = document.getElementById('gamepad-status');
    const sidePanel = document.getElementById('side-panel'); // Для проверки состояния панели
    const sourceButtons = document.querySelectorAll('.source-button'); // Кнопки выбора источника
    const filterForm = document.getElementById('filter-form');
    const applyFiltersButton = document.getElementById('apply-filters');
    const resetFiltersButton = document.getElementById('reset-filters');

    if (!rssGrid || !paginationControls || !gamepadStatusEl || !sidePanel || sourceButtons.length === 0) {
        console.error("CRITICAL: Essential DOM elements not found!"); return;
    } else { console.log("Essential DOM elements found."); }

    // --- Переменные состояния ---
    let rssItemsData = []; // Данные текущей страницы RSS
    let gamepadIndex = null; let animationFrameId = null;
    const prevButtonStates = {}; let axisNavigated = { x: false, y: false };
    let paginationButtons = []; let currentPaginationFocusIndex = -1;
    let currentFocusContext = 'rss'; // 'rss', 'pagination', 'panel'
    let currentRssFocusIndex = -1; // Локальный индекс фокуса на RSS элементе

    // --- Пагинация ---
    const ITEMS_PER_PAGE = 50; // Сколько RSS записей показывать за раз
    let currentPage = 1;
    let totalPages = 1;

    // --- Константы ---
    const AXIS_THRESHOLD = 0.7; const AXIS_DEADZONE = 0.2;
    const API_URL = '/api/rss/rutracker'; // Эндпоинт для RSS

    // --- Загрузка данных RSS с БЭКЕНДА ---
    function loadRssData(page = 1) {
        console.log(`Fetching data from API: ${API_URL}?page=${page}&limit=${ITEMS_PER_PAGE}`);
        rssGrid.innerHTML = '<p>Загрузка RSS ленты...</p>';
        paginationControls.innerHTML = '';

        return fetch(`${API_URL}?page=${page}&limit=${ITEMS_PER_PAGE}`)
            .then(response => {
                console.log("API response status:", response.status);
                if (!response.ok) { throw new Error(`API error ${response.status}`); }
                return response.json();
            })
            .then(apiResponse => {
                console.log(`API RSS Data loaded for page ${page}:`, apiResponse.items?.length ?? 0, "items.");
                if (!apiResponse || !Array.isArray(apiResponse.items)) { throw new Error("Invalid data format from API."); }

                rssItemsData = apiResponse.items; // Сохраняем только текущую страницу
                totalPages = apiResponse.totalPages || 1;
                currentPage = apiResponse.currentPage || 1;
                console.log(`Total pages set to: ${totalPages}`);

                displayRssItems(rssItemsData); // Отображаем
                generatePaginationControls(); // Генерируем пагинацию
                // Устанавливаем фокус, если геймпад подключен
                if (gamepadIndex !== null && currentFocusContext !== 'panel') {
                    if(rssItemsData.length > 0) setRssFocus(0);
                    else if (paginationButtons.length > 0) setPaginationFocus(0);
                }
                return rssItemsData;
            })
            .catch(error => {
                 console.error("Error loading RSS data from API:", error);
                 rssGrid.innerHTML = `<p style="color:red;">Ошибка загрузки RSS: ${error.message}</p>`;
                 generatePaginationControls();
                 currentFocusContext = 'none';
            });
    }

    // --- Отображение RSS записей ---
    function displayRssItems(itemsToDisplay) {
        console.log(`Rendering ${itemsToDisplay.length} RSS items for page ${currentPage}`);
        rssGrid.innerHTML = ''; // Очищаем сетку
        currentRssFocusIndex = -1; // Сбрасываем фокус

        if (itemsToDisplay.length === 0) {
            rssGrid.innerHTML = `<p>Нет данных RSS для страницы ${currentPage}.</p>`;
        } else {
            itemsToDisplay.forEach((item, indexOnPage) => {
                 const div = document.createElement('div'); div.classList.add('rss-item');
                 div.dataset.localIndex = indexOnPage; // Локальный индекс
                 div.dataset.link = item.link || '#'; // Ссылка на тему

                 let displayDate = '-';
                 // Пытаемся отформатировать дату (updated или published)
                 const dateStrToFormat = item.updated || item.published;
                 if (dateStrToFormat) {
                     try { displayDate = new Date(dateStrToFormat).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
                     catch(e) { displayDate = dateStrToFormat; } // Оставляем как есть, если ошибка
                 }

                 let detailsHTML = `<h3>${item.title || 'Без заголовка'}</h3>`;
                 if (item.author) detailsHTML += `<p><b>Автор:</b> ${item.author}</p>`;
                 detailsHTML += `<p><b>Дата:</b> ${displayDate}</p>`; // Отображаем дату

                 div.innerHTML = detailsHTML;

                 // Обработчик клика
                 div.addEventListener('click', (event) => {
                     const link = event.currentTarget.dataset.link;
                     console.log(`RSS Item ${indexOnPage} clicked. Link: ${link}`);
                     if (link && link !== '#') { window.open(link, '_blank'); }
                 });
                 rssGrid.appendChild(div);
            });
        }
        // Фокус устанавливается в конце loadRssData или updateGamepadStatus
    }

    // --- Генерация и обновление кнопок пагинации ---
    function generatePaginationControls() {
        if (!paginationControls) return; paginationControls.innerHTML = ''; paginationButtons = [];
        const prevButton = document.createElement('button'); prevButton.textContent = '« Пред.'; prevButton.classList.add('page-button'); prevButton.addEventListener('click', (e) => { e.preventDefault(); if (currentPage > 1) changePage(currentPage - 1); });
        paginationControls.appendChild(prevButton); paginationButtons.push(prevButton);
        const maxPageButtons = 5; let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2)); let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
        if (endPage - startPage + 1 < maxPageButtons && totalPages >= maxPageButtons) { startPage = Math.max(1, endPage - maxPageButtons + 1); }
        if (startPage > 1) { addPageLink(1); if (startPage > 2) addPageEllipsis(); }
        for (let i = startPage; i <= endPage; i++) { addPageLink(i); }
        if (endPage < totalPages) { if (endPage < totalPages - 1) addPageEllipsis(); addPageLink(totalPages); }
        const nextButton = document.createElement('button'); nextButton.textContent = 'След. »'; nextButton.classList.add('page-button');
        nextButton.addEventListener('click', (e) => { e.preventDefault(); if (currentPage < totalPages) changePage(currentPage + 1); });
        paginationControls.appendChild(nextButton); paginationButtons.push(nextButton);
        updatePaginationButtonsState();
    }
    function addPageLink(pageNumber) { const pageLink = document.createElement('a'); pageLink.textContent = pageNumber; pageLink.href = `#page=${pageNumber}`; pageLink.classList.add('page-button'); pageLink.dataset.page = pageNumber; pageLink.addEventListener('click', (e) => { e.preventDefault(); changePage(pageNumber); }); paginationControls.appendChild(pageLink); paginationButtons.push(pageLink); }
    function addPageEllipsis() { const dots = document.createElement('span'); dots.textContent = '...'; dots.style.margin = '0 5px'; dots.style.padding = '8px 0'; dots.style.display = 'inline-block'; paginationControls.appendChild(dots); }
    function updatePaginationButtonsState() {
         if (!paginationControls || paginationButtons.length === 0) return;
         paginationButtons.forEach(button => {
             const pageNum = button.dataset.page ? parseInt(button.dataset.page, 10) : null;
             if (pageNum !== null) { button.classList.toggle('active', pageNum === currentPage); }
             else if (button.textContent.includes('Пред.')) { button.disabled = (currentPage <= 1); }
             else if (button.textContent.includes('След.')) { button.disabled = (currentPage >= totalPages); }
             button.classList.remove('pagination-focused');
         });
    }

    // --- Смена страницы ---
    function changePage(newPageNumber) {
         if (newPageNumber < 1 || newPageNumber > totalPages || newPageNumber === currentPage) return;
         console.log(`Changing page to ${newPageNumber}`);
         currentPage = newPageNumber;
         loadRssData(currentPage); // Загружаем новую страницу RSS
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Функции фокуса ---
    function setRssFocus(index) {
        if (sidePanel && sidePanel.classList.contains('open')) return;
        if (!rssItemsData || rssItemsData.length === 0) return;
        const rssElements = rssGrid.querySelectorAll('.rss-item');
        if (index < 0 || index >= rssElements.length) index = 0;
        if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
        currentPaginationFocusIndex = -1;
        if (currentRssFocusIndex !== -1 && rssElements[currentRssFocusIndex]) { rssElements[currentRssFocusIndex].classList.remove('focused'); }
        currentRssFocusIndex = index;
        if (rssElements[currentRssFocusIndex]) {
             rssElements[currentRssFocusIndex].classList.add('focused');
             rssElements[currentRssFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
             currentFocusContext = 'rss';
             console.log(`RSS focus set: index ${index}`);
        } else { currentRssFocusIndex = -1; currentFocusContext = 'none'; }
    }

    function setPaginationFocus(index) {
        if (sidePanel && sidePanel.classList.contains('open')) return;
        if (!paginationButtons) return;
        if (currentRssFocusIndex !== -1 && rssGrid.querySelectorAll('.rss-item')[currentRssFocusIndex]) { rssGrid.querySelectorAll('.rss-item')[currentRssFocusIndex].classList.remove('focused'); }
        currentRssFocusIndex = -1;
        if (currentPaginationFocusIndex !== -1 && paginationButtons[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
        if (paginationButtons.length === 0) { currentPaginationFocusIndex = -1; currentFocusContext = 'none'; return; }
        if (index < 0 || index >= paginationButtons.length) { currentPaginationFocusIndex = -1; return; }
        currentPaginationFocusIndex = index;
        if (paginationButtons[currentPaginationFocusIndex]) {
             const targetButton = paginationButtons[currentPaginationFocusIndex];
             targetButton.classList.add('pagination-focused');
             targetButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
             currentFocusContext = 'pagination';
             console.log(`PAGINATION focus set: index ${index}`);
        } else { currentPaginationFocusIndex = -1; currentFocusContext = 'none'; }
    }

    // --- Навигация ---
    function moveRssFocus(direction) {
        if (rssItemsData.length === 0) { setPaginationFocus(0); return; }
        if (currentRssFocusIndex === -1) { setRssFocus(0); return; }
        let targetIndex = currentRssFocusIndex;
        const rssElements = rssGrid.querySelectorAll('.rss-item');
        if (direction === 'down') { targetIndex++; } else if (direction === 'up') { targetIndex--; }
        if (targetIndex < 0) { console.log("Switching focus RSS -> pagination (UP)"); setPaginationFocus(0); }
        else if (targetIndex >= rssElements.length) { console.log("Switching focus RSS -> pagination (DOWN)"); setPaginationFocus(0); }
        else { setRssFocus(targetIndex); }
    }

    function navigatePaginationButtons(direction) {
        if (currentFocusContext !== 'pagination' || paginationButtons.length === 0) return;
        let nextIndex = currentPaginationFocusIndex; const numElements = paginationButtons.length;
        if (nextIndex === -1) { nextIndex = (direction === 'right' ? 0 : numElements - 1); }
        else { if (direction === 'right') { nextIndex = (currentPaginationFocusIndex + 1); if(nextIndex >= numElements) nextIndex = 0; } else if (direction === 'left') { nextIndex = (currentPaginationFocusIndex - 1); if(nextIndex < 0) nextIndex = numElements - 1; } }
        setPaginationFocus(nextIndex);
    }

    // --- Активация ---
    function activateRssItem() {
        if (currentRssFocusIndex === -1) return;
        const rssElements = rssGrid.querySelectorAll('.rss-item');
        if(rssElements[currentRssFocusIndex]) { rssElements[currentRssFocusIndex].click(); }
    }
    function activatePaginationButton() {
        if (currentPaginationFocusIndex === -1 || !paginationButtons[currentPaginationFocusIndex]) return;
        const targetButton = paginationButtons[currentPaginationFocusIndex];
        if (targetButton.disabled) { return; } targetButton.click();
    }

     // --- Функции для интеграции с панелью ---
     let previousFocusContext = 'rss';
     let previousFocusIndex = -1;
     window.saveFocusBeforePanel = () => {
         previousFocusContext = currentFocusContext;
         if (currentFocusContext === 'rss') { previousFocusIndex = currentRssFocusIndex; }
         else if (currentFocusContext === 'pagination') { previousFocusIndex = currentPaginationFocusIndex; }
         else { previousFocusIndex = -1; }
         if (currentRssFocusIndex !== -1 && rssGrid.querySelectorAll('.rss-item')[currentRssFocusIndex]) { rssGrid.querySelectorAll('.rss-item')[currentRssFocusIndex].classList.remove('focused'); }
         if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
         currentFocusContext = 'panel';
         console.log("Focus saved before opening panel.");
     };
     window.restoreFocusFromPanel = () => {
         console.log("Restoring focus from panel to:", previousFocusContext, previousFocusIndex);
         currentFocusContext = previousFocusContext;
         if (currentFocusContext === 'rss') { setRssFocus(previousFocusIndex !== -1 ? previousFocusIndex : 0); }
         else if (currentFocusContext === 'pagination') { setPaginationFocus(previousFocusIndex !== -1 ? previousFocusIndex : 0); }
         else { setRssFocus(0); } // По умолчанию на RSS
     };
     window.focusFirstPanelItem = () => { window.navigatePanel('down'); };
     window.navigatePanelItems = (direction) => { window.navigatePanel(direction); };
     window.activateFocusedPanelItem = () => { window.activatePanelItem(); };

    // --- Логика геймпада ---
    function handleButtonPress(buttonIndex) {
        console.log(`Button ${buttonIndex} pressed. Context: ${currentFocusContext}`);
        if (buttonIndex === 8 || buttonIndex === 9) { window.toggleSidePanel(); return; }
        switch (currentFocusContext) {
            case 'rss':
                switch (buttonIndex) {
                    case 0: activateRssItem(); break; // A/X
                    case 12: moveRssFocus('up'); break; case 13: moveRssFocus('down'); break; // D-Pad U/D
                    case 14: window.toggleSidePanel(); break; // D-Pad Left -> Panel
                    case 4: if (currentPage > 1) changePage(currentPage - 1); break; // LB
                    case 5: if (currentPage < totalPages) changePage(currentPage + 1); break; // RB
                } break;
            case 'pagination':
                 switch (buttonIndex) {
                     case 0: activatePaginationButton(); break; // A/X
                     case 1: setRssFocus(currentRssFocusIndex !== -1 ? currentRssFocusIndex : 0); break; // B/O -> RSS
                     case 14: navigatePaginationButtons('left'); break; case 15: navigatePaginationButtons('right'); break; // D-Pad L/R
                     case 12: if (rssItemsData.length > 0) setRssFocus(rssItemsData.length - 1); break; // D-Pad Up -> RSS Last
                     case 13: setPaginationFocus(0); break; // D-Pad Down -> Pagination First
                     case 4: if (currentPage > 1) changePage(currentPage - 1); break; // LB
                     case 5: if (currentPage < totalPages) changePage(currentPage + 1); break; // RB
                 } break;
            case 'panel':
                switch(buttonIndex) {
                     case 0: window.activatePanelItem(); break; // A/X
                     case 1: window.toggleSidePanel(); break; // B/O
                     case 12: window.navigatePanel('up'); break; // D-Pad Up
                     case 13: window.navigatePanel('down'); break; // D-Pad Down
                     case 14: window.toggleSidePanel(); break; // D-Pad Left
                 } break;
        }
    }
    function handleAxisMove(axisIndex, value) {
        if (currentFocusContext === 'panel') {
            if (axisIndex === 1) { // Left Stick Y
                 if (value > AXIS_THRESHOLD && !axisNavigated.y) { window.navigatePanel('down'); axisNavigated.y = true; }
                 else if (value < -AXIS_THRESHOLD && !axisNavigated.y) { window.navigatePanel('up'); axisNavigated.y = true; }
                 else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
            } else if (axisIndex === 0 && Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; }
            return;
        }
        switch (currentFocusContext) {
            case 'rss':
                if (axisIndex === 1) { // Left Stick Y
                    if (value > AXIS_THRESHOLD && !axisNavigated.y) { moveRssFocus('down'); axisNavigated.y = true; }
                    else if (value < -AXIS_THRESHOLD && !axisNavigated.y) { moveRssFocus('up'); axisNavigated.y = true; }
                    else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
                } else if (axisIndex === 0 && Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; }
                break;
            case 'pagination':
                if (axisIndex === 0) { // Left Stick X
                     if (value > AXIS_THRESHOLD && !axisNavigated.x) { navigatePaginationButtons('right'); axisNavigated.x = true; }
                     else if (value < -AXIS_THRESHOLD && !axisNavigated.x) { navigatePaginationButtons('left'); axisNavigated.x = true; }
                     else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; }
                } else if (axisIndex === 1) { // Left Stick Y
                    if (value < -AXIS_THRESHOLD && !axisNavigated.y) { // Вверх -> RSS Last
                        if (rssItemsData.length > 0) setRssFocus(rssItemsData.length - 1); axisNavigated.y = true;
                    } else if (value > AXIS_THRESHOLD && !axisNavigated.y) { // Вниз -> Pagination First
                        setPaginationFocus(0); axisNavigated.y = true;
                    } else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
                }
                break;
        }
    }

    // --- Главный цикл геймпада ---
    function gamepadLoop() {
        if (gamepadIndex === null) { animationFrameId = null; return; }
        try {
            const gamepads = navigator.getGamepads(); if (!gamepads || !gamepads[gamepadIndex]) { updateGamepadStatus(null); return; }
            const gp = gamepads[gamepadIndex];
            gp.buttons.forEach((button, index) => { const wasPressed = !!prevButtonStates[index]; if (button.pressed && !wasPressed) { prevButtonStates[index] = true; handleButtonPress(index); } else if (!button.pressed && wasPressed) { prevButtonStates[index] = false; } });
            gp.axes.forEach((value, index) => { handleAxisMove(index, value); });
        } catch (error) { console.error("!!! ERROR in gamepadLoop (rss_viewer):", error); }
        if (gamepadIndex !== null) { animationFrameId = requestAnimationFrame(gamepadLoop); } else { animationFrameId = null; }
    }

    // --- События подключения/отключения ---
    window.addEventListener("gamepadconnected", (event) => {
         if (!event.gamepad) return; console.log("GP connected:", event.gamepad.id, "Idx:", event.gamepad.index);
         if (!event.gamepad.buttons?.length && !event.gamepad.axes?.length) { return; }
         if (gamepadIndex === null) {
             gamepadIndex = event.gamepad.index;
             axisNavigated = { x: false, y: false };
             updateGamepadStatus(event.gamepad);
             for (let i = 0; i < (event.gamepad.buttons?.length || 0); i++) { prevButtonStates[i] = false; }
             if (!animationFrameId) { console.log("Starting GP loop."); animationFrameId = requestAnimationFrame(gamepadLoop); }
         } else { console.log(`Another GP connected, active index: ${gamepadIndex}`); }
    });
    window.addEventListener("gamepaddisconnected", (event) => {
         if (!event.gamepad) return; console.log("GP disconnected:", event.gamepad.id, "Idx:", event.gamepad.index);
         if (gamepadIndex === event.gamepad.index) { console.log(`Active GP disconnected.`); updateGamepadStatus(null); }
         else { console.log(`Inactive GP disconnected.`); }
    });

    // --- Проверка при загрузке и Обновление статуса ---
    function checkGamepadAndSetInitialFocus() {
        console.log("Checking initial GPs...");
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : []; let found = false;
        for (const gp of gamepads) { if (gp && (gp.buttons?.length || gp.axes?.length)) { console.log(`Found initial GP: ${gp.id}, Idx: ${gp.index}.`); const connectEvent = new GamepadEvent('gamepadconnected', { gamepad: gp }); window.dispatchEvent(connectEvent); found = true; break; } }
        if (!found && gamepadIndex === null) { console.log("No active GP found initially."); updateGamepadStatus(null); }
        else if (found && gamepadIndex !== null && currentFocusContext === 'none' && rssItemsData.length > 0) {
             console.log("Initial GP found, setting initial focus to RSS."); setRssFocus(0);
         }
    }
    function updateGamepadStatus(gamepad) {
         if (!gamepadStatusEl) return;
         if(gamepad) { // Подключен
             const name = gamepad.id.replace(/\s*\(Vendor:\s*\w+\s*Product:\s*\w+\)/i, '').trim();
             gamepadStatusEl.textContent = `Геймпад: ${name}`; gamepadStatusEl.className = 'connected';
             if(currentFocusContext === 'none' && rssItemsData.length > 0) {
                  console.log("GP active, setting initial RSS focus."); setRssFocus(0);
             } else if (currentFocusContext === 'none' && paginationButtons?.length > 0) {
                 console.log("GP active, RSS empty, setting initial pagination focus."); setPaginationFocus(0);
             }
         } else { // Отключен
             gamepadStatusEl.textContent = 'Геймпад отключен'; gamepadStatusEl.className = 'disconnected';
             gamepadIndex = null;
             if (currentRssFocusIndex !== -1 && rssGrid.querySelectorAll('.rss-item')[currentRssFocusIndex]) { rssGrid.querySelectorAll('.rss-item')[currentRssFocusIndex].classList.remove('focused'); }
             if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
             currentRssFocusIndex = -1; currentPaginationFocusIndex = -1; currentFocusContext = 'none';
             if (animationFrameId) { console.log("GP disconnected, loop will stop."); }
             animationFrameId = null;
         }
    }

     // --- Обработчик клика по кнопкам выбора источника (для перехода) ---
     sourceButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedSource = button.dataset.source;
            if (selectedSource === 'rutracker') { window.location.href = '/index.html'; }
            else if (selectedSource === 'pornolab') { window.location.href = '/pornolab.html'; }
            // Клик по 'rutracker_rss' (активной) ничего не делает
        });
    });

    function populateFilterOptions(data) {
        const uniqueValues = (key) => [...new Set(data.map(item => item[key]).filter(Boolean))].sort();

        const populateSelect = (selectId, values) => {
            const select = document.getElementById(selectId);
            values.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });
        };

        populateSelect('filter-year', uniqueValues('year'));
        populateSelect('filter-genre', uniqueValues('genre'));
        populateSelect('filter-voice-lang', uniqueValues('voice_lang'));
        populateSelect('filter-text-lang', uniqueValues('text_lang'));
        populateSelect('filter-age-rating', uniqueValues('age_rating'));
    }

    function applyFilters() {
        const formData = new FormData(filterForm);
        const filters = Object.fromEntries(formData.entries());
        const filteredData = rssItemsData.filter(item => {
            return Object.entries(filters).every(([key, value]) => {
                if (!value) return true;
                if (key === 'has_multiplayer') return item[key] === (value === 'true');
                return item[key] === value;
            });
        });
        displayRssItems(filteredData);
    }

    function resetFilters() {
        filterForm.reset();
        displayRssItems(rssItemsData);
    }

    applyFiltersButton.addEventListener('click', applyFilters);
    resetFiltersButton.addEventListener('click', resetFilters);

    // Задержка перед первой проверкой
    setTimeout(checkGamepadAndSetInitialFocus, 300);

    // --- НАЧИНАЕМ ЗАГРУЗКУ ДАННЫХ ПРИ СТАРТЕ ---
    loadRssData(1).then(data => populateFilterOptions(data)); // Загружаем первую страницу RSS

    console.log("RSS Viewer script initialization finished.");
}); // Конец DOMContentLoaded