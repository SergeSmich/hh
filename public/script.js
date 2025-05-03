// public/script.js (ПОЛНАЯ ВЕРСИЯ БЕЗ СОКРАЩЕНИЙ)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing script (Full Code + Focus Restore Fix v3)...");

    // --- DOM элементы ---
    const posterGrid = document.getElementById('poster-grid');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalFullDescription = document.getElementById('modal-full-description');
    const modalPoster = document.getElementById('modal-poster');
    const modalLink = document.getElementById('modal-link');
    const closeModalButton = document.getElementById('close-modal');
    const gamepadStatusEl = document.getElementById('gamepad-status');
    const modalTextContent = document.querySelector('.modal-text-content');
    const modalDownloadLink = document.getElementById('modal-download-link');
    const paginationControls = document.getElementById('pagination-controls');
    const modalYear = document.getElementById('modal-year');
    const modalGenre = document.getElementById('modal-genre');
    const modalVoice = document.getElementById('modal-voice');
    const modalText = document.getElementById('modal-text');
    const modalAge = document.getElementById('modal-age');
    const modalMultiplayer = document.getElementById('modal-multiplayer');
    const youtubeContainer = document.getElementById('modal-youtube-container');
    const youtubePlayer = document.getElementById('youtube-player');
    const sidePanel = document.getElementById('side-panel');
    const sourceSelector = document.getElementById('source-selector');
    const sourceButtons = document.querySelectorAll('#source-selector .source-button');

    // Проверки DOM
    if (!posterGrid || !modalOverlay || !modalContent || !modalTitle || !modalFullDescription || !modalPoster || !modalLink || !closeModalButton || !gamepadStatusEl || !modalTextContent || !modalDownloadLink || !paginationControls || !sidePanel || !sourceSelector || sourceButtons.length === 0) {
        console.error("CRITICAL: One or more essential DOM elements not found!");
    } else { console.log("Essential DOM elements found."); }
    if (!modalYear || !modalGenre || !modalVoice || !modalText || !modalAge || !modalMultiplayer ) { console.warn("Warning: Modal detail elements missing."); }
    if (!youtubeContainer || !youtubePlayer) { console.warn("Warning: YouTube elements missing."); }


    // --- Переменные состояния ---
    let allPostersData = []; let posterElements = [];
    let gamepadIndex = null; let animationFrameId = null; let isModalOpen = false;
    const prevButtonStates = {};
    let axisNavigated = { x: false, y: false }; // Используем let!
    let modalFocusableElements = []; let currentModalFocusIndex = -1;
    let paginationButtons = []; let currentPaginationFocusIndex = -1;
    let currentFocusContext = 'grid';
    let currentGridFocusIndex = -1;
    let currentSource = 'rutracker';
    
    // --- Переменные для фильтрации и сортировки ---
    let allData = []; // Полный набор данных (без пагинации)
    let filteredData = []; // Отфильтрованные данные
    let currentSortOption = 'title_asc'; // Текущая опция сортировки
    let currentFilters = { // Текущие фильтры
        year: '',
        genre: '',
        voice: '',
        text: '',
        multiplayer: ''
    };
    let isFilterMode = false; // Флаг режима фильтрации

    // --- Пагинация ---
    const ITEMS_PER_PAGE = 50; let currentPage = 1; let totalPages = 1;

    // --- Константы ---
    const AXIS_THRESHOLD = 0.7; const AXIS_DEADZONE = 0.2;
    const SCROLL_AMOUNT = 60; const STICK_SCROLL_AMOUNT = 10;
    const RIGHT_STICK_Y_AXIS_INDEX = 3;
    const RUTRACKER_DOWNLOAD_BASE_URL = "https://rutracker.org/forum/";
    const TOPICS_API_URL = "/api/topics";
    const YOUTUBE_API_URL = "/youtube-search";

    // --- Загрузка данных с БЭКЕНДА ---
    function loadPageData(page = 1, source = currentSource) {
        console.log(`Fetching data from API: ${TOPICS_API_URL}?source=${source}&page=${page}&limit=${ITEMS_PER_PAGE}`);
        if(posterGrid) posterGrid.innerHTML = '<p>Загрузка данных...</p>';
        if(paginationControls) paginationControls.innerHTML = '';

        fetch(`${TOPICS_API_URL}?source=${source}&page=${page}&limit=${ITEMS_PER_PAGE}`)
            .then(response => {
                if (!response.ok) { throw new Error(`API error ${response.status}`); }
                return response.json();
            })
            .then(apiResponse => {
                if (!apiResponse || !Array.isArray(apiResponse.items)) { throw new Error("Invalid data format from API."); }
                const startIndex = (apiResponse.currentPage || 1) * ITEMS_PER_PAGE - ITEMS_PER_PAGE;
                while (allPostersData.length < startIndex) { allPostersData.push(undefined); }
                for (let i = 0; i < apiResponse.items.length; i++) { allPostersData[startIndex + i] = apiResponse.items[i]; }
                allPostersData = allPostersData.filter(item => item !== undefined);

                totalPages = apiResponse.totalPages || 1;
                currentPage = apiResponse.currentPage || 1;
                displayCurrentPageItems(apiResponse.items);
                generatePaginationControls();
                checkGamepadAndSetInitialFocus(); // Проверяем геймпад
            })
            .catch(error => {
                 console.error("Error loading data from API:", error);
                 if(posterGrid) posterGrid.innerHTML = `<p style="color:red;">Ошибка: ${error.message}</p>`;
                 if(gamepadStatusEl) { gamepadStatusEl.textContent = 'Ошибка данных!'; gamepadStatusEl.className = 'disconnected'; }
                 generatePaginationControls(); currentFocusContext = 'none';
            });
    }

    // --- Отображение ЭЛЕМЕНТОВ ТЕКУЩЕЙ СТРАНИЦЫ ---
    function displayCurrentPageItems(itemsToDisplay) {
        console.log(`Rendering ${itemsToDisplay.length} items for page ${currentPage}`); if (!posterGrid) return;
        posterGrid.innerHTML = ''; posterElements = []; currentGridFocusIndex = -1;

        if (itemsToDisplay.length === 0) { posterGrid.innerHTML = `<p>Нет данных для страницы ${currentPage}.</p>`; }
        else {
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            itemsToDisplay.forEach((item, indexOnPage) => {
                 const globalIndex = startIndex + indexOnPage;
                 const div = document.createElement('div'); div.classList.add('poster-item');
                 div.dataset.globalIndex = globalIndex;
                 if (item.has_multiplayer === true) { const indicator = document.createElement('span'); indicator.classList.add('multiplayer-indicator'); indicator.title = "Есть мультиплеер"; div.appendChild(indicator); }
                 const img = document.createElement('img'); img.src = item.poster_url || "https://via.placeholder.com/160x240.png?text=NA"; img.alt = item.title || ""; img.loading = 'lazy';
                 img.onerror = function() { if (this.src.includes('Error')) return; this.onerror=null; this.src='https://via.placeholder.com/160x240.png?text=Error'; };
                 const titleDiv = document.createElement('div'); titleDiv.classList.add('title'); titleDiv.textContent = item.title || "No title"; titleDiv.title = item.title || "";
                 div.appendChild(img); div.appendChild(titleDiv);
                 if (typeof openModal === 'function') { div.addEventListener('click', (event) => { console.log(`Item global index ${globalIndex} clicked.`); currentGridFocusIndex = indexOnPage; openModal(globalIndex); }); }
                 posterGrid.appendChild(div); posterElements.push(div);
            });
        }
        if (posterElements.length > 0 && gamepadIndex !== null) { setGridFocus(0); }
        else if (paginationButtons?.length > 0 && gamepadIndex !== null) { setPaginationFocus(0); }
        else { currentGridFocusIndex = -1; currentFocusContext = 'grid'; }
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
         console.log(`Changing page to ${newPageNumber} for source ${currentSource}`);
         currentPage = newPageNumber;
         loadPageData(currentPage, currentSource);
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Установка фокуса на СЕТКЕ ---
    function setGridFocus(index) {
        if (isModalOpen || (sidePanel && sidePanel.classList.contains('open'))) return;
        if (!posterElements) return;
        if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
        currentPaginationFocusIndex = -1;
        if (posterElements.length === 0) { setPaginationFocus(0); return; }
        if (index < 0 || index >= posterElements.length) index = 0;
        if (currentGridFocusIndex !== -1 && posterElements[currentGridFocusIndex]) { posterElements[currentGridFocusIndex].classList.remove('focused'); }
        currentGridFocusIndex = index;
        if (posterElements[currentGridFocusIndex]) {
             posterElements[currentGridFocusIndex].classList.add('focused');
             posterElements[currentGridFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
             currentFocusContext = 'grid';
             console.log(`GRID focus set: local index ${index}`);
        } else { currentGridFocusIndex = -1; currentFocusContext = 'none'; }
    }

    // --- Установка фокуса на ПАГИНАЦИИ ---
    function setPaginationFocus(index) {
        if (isModalOpen || (sidePanel && sidePanel.classList.contains('open'))) return;
        if (!paginationButtons) return;
        if (currentGridFocusIndex !== -1 && posterElements?.[currentGridFocusIndex]) { posterElements[currentGridFocusIndex].classList.remove('focused'); }
        // Не сбрасываем currentGridFocusIndex
        if (currentPaginationFocusIndex !== -1 && paginationButtons[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
        if (paginationButtons.length === 0) { currentPaginationFocusIndex = -1; currentFocusContext = 'none'; return; }
        if (index < 0 || index >= paginationButtons.length) { currentPaginationFocusIndex = -1; return; }
        currentPaginationFocusIndex = index;
        if (paginationButtons[currentPaginationFocusIndex]) {
             const targetButton = paginationButtons[currentPaginationFocusIndex];
             targetButton.classList.add('pagination-focused');
             targetButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
             currentFocusContext = 'pagination';
             console.log(`PAGINATION focus set: index ${index}`);
        } else { currentPaginationFocusIndex = -1; currentFocusContext = 'none'; }
    }

    // --- Установка фокуса ВНУТРИ МОДАЛКИ ---
    function setModalFocus(index) {
         if (!isModalOpen && index !== -1) return;
         if (index !== -1) {
             if (currentGridFocusIndex !== -1 && posterElements?.[currentGridFocusIndex]) { posterElements[currentGridFocusIndex].classList.remove('focused'); }
             if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
             currentPaginationFocusIndex = -1;
             currentFocusContext = 'modal';
         }
         if (currentModalFocusIndex !== -1 && modalFocusableElements?.[currentModalFocusIndex]) { modalFocusableElements[currentModalFocusIndex].classList.remove('modal-link-focused'); }
         currentModalFocusIndex = (index >= 0 && index < modalFocusableElements.length) ? index : -1;
         if (currentModalFocusIndex !== -1 && modalFocusableElements?.[currentModalFocusIndex]) {
             modalFocusableElements[currentModalFocusIndex].classList.add('modal-link-focused');
         } else { currentModalFocusIndex = -1; }
    }

    // --- Перемещение фокуса на СЕТКЕ ---
    function moveFocus(direction) {
        if (isModalOpen || currentFocusContext !== 'grid') return;
        if (posterElements.length === 0) { setPaginationFocus(0); return; }
        if (currentGridFocusIndex === -1) { setGridFocus(0); return; }
        const currentElement = posterElements[currentGridFocusIndex]; if (!currentElement) { setGridFocus(0); return; }
        let targetLocalIndex = -1; let cols = 1;
        try { const gridStyles = window.getComputedStyle(posterGrid); const gap = parseFloat(gridStyles.gap) || 25; if (currentElement.offsetWidth > 0) { const itemWidth = currentElement.offsetWidth + gap; const gridWidth = posterGrid.offsetWidth; cols = Math.max(1, Math.floor(gridWidth / itemWidth)); } } catch(e) {}
        let switchToPagination = false; let paginationTargetIndex = 0;
        switch (direction) {
            case 'up': targetLocalIndex = currentGridFocusIndex - cols; if (targetLocalIndex < 0) { switchToPagination = true; paginationTargetIndex = currentPaginationFocusIndex !== -1 ? currentPaginationFocusIndex : Math.floor(paginationButtons.length / 2); } break;
            case 'down': targetLocalIndex = currentGridFocusIndex + cols; if (targetLocalIndex >= posterElements.length) { switchToPagination = true; paginationTargetIndex = currentPaginationFocusIndex !== -1 ? currentPaginationFocusIndex : Math.floor(paginationButtons.length / 2); } break;
            case 'left': if (currentGridFocusIndex % cols === 0) { switchToPagination = true; paginationTargetIndex = 0; } else { targetLocalIndex = currentGridFocusIndex - 1; } break;
            case 'right': if ((currentGridFocusIndex + 1) % cols === 0 || currentGridFocusIndex === posterElements.length - 1) { switchToPagination = true; paginationTargetIndex = paginationButtons.length - 1; } else { targetLocalIndex = currentGridFocusIndex + 1; } break;
        }
        if (switchToPagination) { console.log(`Switching focus grid -> pagination (target: ${paginationTargetIndex})`); setPaginationFocus(paginationTargetIndex); }
        else if (targetLocalIndex >= 0 && targetLocalIndex < posterElements.length && posterElements[targetLocalIndex]) { setGridFocus(targetLocalIndex); }
    }

    // --- Навигация между кнопками ПАГИНАЦИИ ---
    function navigatePaginationButtons(direction) {
        if (currentFocusContext !== 'pagination' || paginationButtons.length === 0) return;
        let nextIndex = currentPaginationFocusIndex; const numElements = paginationButtons.length;
        if (nextIndex === -1) { nextIndex = (direction === 'right' ? 0 : numElements - 1); }
        else { if (direction === 'right') { nextIndex = (currentPaginationFocusIndex + 1); if(nextIndex >= numElements) nextIndex = 0; } else if (direction === 'left') { nextIndex = (currentPaginationFocusIndex - 1); if(nextIndex < 0) nextIndex = numElements - 1; } }
        setPaginationFocus(nextIndex);
    }

    // --- Активация кнопки ПАГИНАЦИИ ---
    function activatePaginationButton() {
        if (currentFocusContext !== 'pagination' || currentPaginationFocusIndex === -1 || !paginationButtons[currentPaginationFocusIndex]) return;
        const targetButton = paginationButtons[currentPaginationFocusIndex];
        if (targetButton.disabled) { console.log("Pagination button disabled."); return; }
        console.log(`Activating pagination button: ${targetButton.textContent}`);
        targetButton.click();
    }

    // --- Навигация между ссылками в модалке ---
    function navigateModalLinks(direction) {
         if (!isModalOpen || modalFocusableElements.length < 2) return;
         let nextIndex = currentModalFocusIndex; const numElements = modalFocusableElements.length;
         if (currentModalFocusIndex === -1) { nextIndex = 0; }
         else { if (direction === 'down') { nextIndex = (currentModalFocusIndex + 1) % numElements; } else if (direction === 'up') { nextIndex = (currentModalFocusIndex - 1 + numElements) % numElements; } }
         setModalFocus(nextIndex);
         if (currentModalFocusIndex !== -1 && modalFocusableElements[currentModalFocusIndex]) { modalFocusableElements[currentModalFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); }
    }

    // --- Активация ссылки в модалке ---
    function activateModalLink() {
        if (!isModalOpen || currentModalFocusIndex === -1 || !modalFocusableElements[currentModalFocusIndex]) { console.log("Cannot activate: No link focused."); return; }
        const targetLink = modalFocusableElements[currentModalFocusIndex];
        console.log(`Activating modal link: ${targetLink.id || targetLink.textContent}`);
        targetLink.click();
    }

    // --- Открытие модального окна ---
    async function openModal(globalIndex) {
        console.log(`Open modal for global index: ${globalIndex}`);
        const item = allPostersData[globalIndex]; // Получаем данные из общего массива
        if (!item || isModalOpen || !modalOverlay /*...*/) { console.error("Cannot open modal."); return; }
        const gridIndexBeforeOpen = currentGridFocusIndex; // Запоминаем
        // Снимаем подсветку, но не сбрасываем индекс сетки
        if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
        currentPaginationFocusIndex = -1;

        modalTitle.textContent = item.title || "No Title"; modalPoster.src = item.poster_url || "..."; modalLink.href = item.link || "#";
        try { modalFullDescription.innerHTML = item.full_description_html || '<p><em>...</em></p>'; } catch (e) { /*...*/ }
        if (modalYear) modalYear.textContent = item.year || '-'; else console.warn("#modal-year not found");
        if (modalGenre) modalGenre.textContent = item.genre || '-'; else console.warn("#modal-genre not found");
        if (modalVoice) modalVoice.textContent = item.voice_lang || '-'; else console.warn("#modal-voice not found");
        if (modalText) modalText.textContent = item.text_lang || '-'; else console.warn("#modal-text not found");
        if (modalAge) modalAge.textContent = item.age_rating || '-'; else console.warn("#modal-age not found");
        if (modalMultiplayer) modalMultiplayer.textContent = item.multiplayer_status || 'неизвестно'; else console.warn("#modal-multiplayer not found");
        // Запрос к YouTube бэкенду
        if (youtubeContainer && youtubePlayer && item.title) {
            youtubeContainer.style.display = 'none'; youtubePlayer.src = '';
            const cleanTitle = item.title.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
            const searchQuery = `${cleanTitle} trailer gameplay`;
            console.log(`Requesting video ID for query: "${searchQuery}"`);
            try {
                const response = await fetch(`${YOUTUBE_API_URL}?query=${encodeURIComponent(searchQuery)}`);
                if (!response.ok) { throw new Error(`Backend request failed: ${response.status}`); }
                const result = await response.json();
                if (result && result.videoId) { youtubePlayer.src = `https://www.youtube.com/embed/${result.videoId}?autoplay=1&mute=1`; youtubeContainer.style.display = 'block'; }
            } catch (error) { console.error("Error fetching video ID:", error); }
        }
        modalFocusableElements = []; if(modalLink) modalFocusableElements.push(modalLink);
        if (item.topic_id && item.topic_id !== '0') { modalDownloadLink.href = `${RUTRACKER_DOWNLOAD_BASE_URL}dl.php?t=${item.topic_id}`; modalDownloadLink.style.display = 'inline-block'; if(modalDownloadLink) modalFocusableElements.push(modalDownloadLink); }
        else { modalDownloadLink.style.display = 'none'; modalDownloadLink.href = '#'; }

        modalOverlay.classList.remove('hidden');
        requestAnimationFrame(() => { requestAnimationFrame(() => { modalOverlay.style.opacity = '1'; modalContent.style.transform = 'scale(1)'; }); });
        isModalOpen = true; modalTextContent.scrollTop = 0;
        currentGridFocusIndex = gridIndexBeforeOpen; // Восстанавливаем для closeModal
        setModalFocus(0); // Устанавливаем фокус и контекст 'modal'
        console.log("Modal opened.");
    }

    // --- Закрытие модального окна ---
    function closeModal() {
        console.log("Close modal."); if (!isModalOpen || !modalOverlay || !modalContent) return;
        const gridIndexToRestore = currentGridFocusIndex; // Запоминаем локальный индекс сетки
        setModalFocus(-1); modalFocusableElements = []; currentModalFocusIndex = -1; // Сброс фокуса модалки
        if(youtubePlayer) youtubePlayer.src = ''; if(youtubeContainer) youtubeContainer.style.display = 'none'; // Остановка YouTube
        modalOverlay.style.opacity = '0'; modalContent.style.transform = 'scale(0.95)';
        setTimeout(() => {
            modalOverlay.classList.add('hidden'); isModalOpen = false;
            if (modalFullDescription) modalFullDescription.innerHTML = ''; if (modalDownloadLink) { /*...*/ }
            // Очистка деталей
            if (modalYear) modalYear.textContent = '-'; if (modalGenre) modalGenre.textContent = '-'; if (modalVoice) modalVoice.textContent = '-';
            if (modalText) modalText.textContent = '-'; if (modalAge) modalAge.textContent = '-'; if (modalMultiplayer) modalMultiplayer.textContent = '-';
            console.log("Modal closed. Attempting to restore focus.");
            // Восстанавливаем фокус на сетке или пагинации
            if (posterElements?.length > 0) {
                const targetIndex = (gridIndexToRestore !== -1 && gridIndexToRestore < posterElements.length) ? gridIndexToRestore : 0;
                console.log(`Restoring grid focus to index: ${targetIndex}`);
                setGridFocus(targetIndex); // Установит фокус и контекст 'grid'
            } else if (paginationButtons?.length > 0) { console.log("Restoring focus to pagination index 0."); setPaginationFocus(0); }
            else { currentFocusContext = 'none'; console.log("No elements to restore focus to."); }
        }, 300);
    }

    // --- Прокрутка модального окна ---
    function scrollModal(direction, amount = SCROLL_AMOUNT) {
         if (!isModalOpen || !modalTextContent) return;
         const scrollStep = direction === 'up' ? -amount : amount;
         const behavior = amount === STICK_SCROLL_AMOUNT ? 'auto' : 'smooth';
         modalTextContent.scrollBy({ top: scrollStep, behavior: behavior });
    }

    // --- Обработчики событий мыши/клавиатуры ---
    if (closeModalButton) closeModalButton.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isModalOpen) closeModal(); });

    // --- Функции для интеграции с панелью ---
    let previousFocusContext = 'grid';
    let previousFocusIndex = -1;
    window.saveFocusBeforePanel = () => {
        previousFocusContext = currentFocusContext;
        if (currentFocusContext === 'grid') { previousFocusIndex = currentGridFocusIndex; }
        else if (currentFocusContext === 'pagination') { previousFocusIndex = currentPaginationFocusIndex; }
        else if (currentFocusContext === 'modal') { previousFocusIndex = currentModalFocusIndex; } // Добавлено для модалки
        else { previousFocusIndex = -1; }
        // Снимаем текущий фокус
        if (currentGridFocusIndex !== -1 && posterElements?.[currentGridFocusIndex]) { posterElements[currentGridFocusIndex].classList.remove('focused'); }
        if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
        if (currentModalFocusIndex !== -1 && modalFocusableElements?.[currentModalFocusIndex]) { modalFocusableElements[currentModalFocusIndex].classList.remove('modal-link-focused'); }
        currentFocusContext = 'panel';
        console.log("Focus saved before opening panel.");
    };
    window.restoreFocusFromPanel = () => {
         console.log("Restoring focus from panel to:", previousFocusContext, previousFocusIndex);
         currentFocusContext = previousFocusContext;
         if (currentFocusContext === 'grid') { setGridFocus(previousFocusIndex !== -1 ? previousFocusIndex : 0); }
         else if (currentFocusContext === 'pagination') { setPaginationFocus(previousFocusIndex !== -1 ? previousFocusIndex : 0); }
         else if (currentFocusContext === 'modal') { setModalFocus(previousFocusIndex !== -1 ? previousFocusIndex : 0); }
         else { setGridFocus(0); } // По умолчанию на сетку
    };
    window.focusFirstPanelItem = () => { window.navigatePanel('down'); };
    window.navigatePanelItems = (direction) => { window.navigatePanel(direction); };
    window.activateFocusedPanelItem = () => { window.activatePanelItem(); };

    // --- Логика геймпада: обработчики ---
    function handleButtonPress(buttonIndex) {
         console.log(`Button ${buttonIndex} pressed. Context: ${currentFocusContext}`);
         if (buttonIndex === 8 || buttonIndex === 9) { window.toggleSidePanel(); return; } // Кнопка меню
         switch (currentFocusContext) {
             case 'grid': handleGridButtonPress(buttonIndex); break;
             case 'pagination': handlePaginationButtonPress(buttonIndex); break;
             case 'modal': handleModalButtonPress(buttonIndex); break;
             case 'panel': handlePanelButtonPress(buttonIndex); break;
             default: break;
         }
    }
    function handleGridButtonPress(buttonIndex) {
        switch (buttonIndex) {
            case 0: if(currentGridFocusIndex !== -1 && posterElements[currentGridFocusIndex]) { openModal(parseInt(posterElements[currentGridFocusIndex].dataset.globalIndex, 10)); } break; // A/X
            case 12: moveFocus('up'); break; case 13: moveFocus('down'); break; // D-Pad U/D
            case 14: moveFocus('left'); break; case 15: moveFocus('right'); break; // D-Pad L/R
            case 4: if (currentPage > 1) changePage(currentPage - 1); break; // LB
            case 5: if (currentPage < totalPages) changePage(currentPage + 1); break; // RB
        }
    }
    function handlePaginationButtonPress(buttonIndex) {
         switch (buttonIndex) {
             case 0: activatePaginationButton(); break; // A/X
             case 1: setGridFocus(currentGridFocusIndex !== -1 ? currentGridFocusIndex : 0); break; // B/O -> Grid
             case 14: navigatePaginationButtons('left'); break; case 15: navigatePaginationButtons('right'); break; // D-Pad L/R
             case 12: if (posterElements.length > 0) { let targetIndex = posterElements.length - 1; try { const cols = Math.max(1, Math.floor(posterGrid.offsetWidth / (posterElements[0].offsetWidth + 25))); targetIndex = Math.max(0, posterElements.length - cols); } catch(e){} setGridFocus(targetIndex); } break; // D-Pad Up -> Grid Last Row
             case 13: console.log("D-Pad Down from pagination - reserved."); setPaginationFocus(0); break; // D-Pad Down -> Pagination First
             case 4: if (currentPage > 1) changePage(currentPage - 1); break; // LB
             case 5: if (currentPage < totalPages) changePage(currentPage + 1); break; // RB
         }
    }
    function handleModalButtonPress(buttonIndex) {
        switch (buttonIndex) {
            case 0: activateModalLink(); break;  // A/X
            case 1: closeModal(); break;        // B/O
            case 12: scrollModal('up', SCROLL_AMOUNT); break;   // D-Pad Up
            case 13: scrollModal('down', SCROLL_AMOUNT); break; // D-Pad Down
            case 14: navigateModalLinks('up'); break;    // D-Pad Left
            case 15: navigateModalLinks('down'); break;  // D-Pad Right
            case 4: if (currentPage > 1) changePage(currentPage - 1); break; // LB -> Prev Page
            case 5: if (currentPage < totalPages) changePage(currentPage + 1); break; // RB -> Next Page
        }
    }
    function handlePanelButtonPress(buttonIndex) { // Обработчик для панели
        console.log(`Handle Panel Button: ${buttonIndex}`);
        switch(buttonIndex) {
             case 0: window.activatePanelItem(); break; // A/X
             case 1: window.toggleSidePanel(); break; // B/O
             case 12: window.navigatePanel('up'); break; // D-Pad Up
             case 13: window.navigatePanel('down'); break; // D-Pad Down
             case 14: window.toggleSidePanel(); break; // D-Pad Left (закрыть)
         }
    }

    function handleAxisMove(axisIndex, value) {
        if (currentFocusContext === 'panel') { // Обработка для панели
            if (axisIndex === 1) { // Left Stick Y
                 if (value > AXIS_THRESHOLD && !axisNavigated.y) { window.navigatePanel('down'); axisNavigated.y = true; }
                 else if (value < -AXIS_THRESHOLD && !axisNavigated.y) { window.navigatePanel('up'); axisNavigated.y = true; }
                 else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
            } else if (axisIndex === 0 && Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; }
            return;
        }
        // Обработка остальных контекстов
        switch (currentFocusContext) {
            case 'grid': handleGridAxisMove(axisIndex, value); break;
            case 'pagination': handlePaginationAxisMove(axisIndex, value); break;
            case 'modal': handleModalAxisMove(axisIndex, value); break;
        }
    }
    function handleGridAxisMove(axisIndex, value) {
        if (axisIndex === 0) { // Left Stick X
            if (value > AXIS_THRESHOLD && !axisNavigated.x) { moveFocus('right'); axisNavigated.x = true; }
            else if (value < -AXIS_THRESHOLD && !axisNavigated.x) { moveFocus('left'); axisNavigated.x = true; }
            else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; }
        } else if (axisIndex === 1) { // Left Stick Y
            if (value > AXIS_THRESHOLD && !axisNavigated.y) { moveFocus('down'); axisNavigated.y = true; }
            else if (value < -AXIS_THRESHOLD && !axisNavigated.y) { moveFocus('up'); axisNavigated.y = true; }
            else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
        }
    }
    function handlePaginationAxisMove(axisIndex, value) {
        if (axisIndex === 0) { // Left Stick X
             if (value > AXIS_THRESHOLD && !axisNavigated.x) { navigatePaginationButtons('right'); axisNavigated.x = true; }
             else if (value < -AXIS_THRESHOLD && !axisNavigated.x) { navigatePaginationButtons('left'); axisNavigated.x = true; }
             else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; }
        } else if (axisIndex === 1) { // Left Stick Y
            if (value < -AXIS_THRESHOLD && !axisNavigated.y) { // Вверх -> Grid (last row)
                 if (posterElements.length > 0) { let targetIndex = posterElements.length - 1; try { const cols = Math.max(1, Math.floor(posterGrid.offsetWidth / (posterElements[0].offsetWidth + 25))); targetIndex = Math.max(0, posterElements.length - cols); } catch(e){} setGridFocus(targetIndex); axisNavigated.y = true; }
            } else if (value > AXIS_THRESHOLD && !axisNavigated.y) { // Вниз -> Резерв
                console.log("Axis Y Down from pagination - reserved."); setPaginationFocus(0); axisNavigated.y = true;
            } else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
        }
    }
    function handleModalAxisMove(axisIndex, value) {
        if (axisIndex === 1) { // Left Stick Y -> Nav Links
             if (value > AXIS_THRESHOLD && !axisNavigated.y) { navigateModalLinks('down'); axisNavigated.y = true; }
             else if (value < -AXIS_THRESHOLD && !axisNavigated.y) { navigateModalLinks('up'); axisNavigated.y = true; }
             else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
        } else if (axisIndex === RIGHT_STICK_Y_AXIS_INDEX) { // Right Stick Y -> Scroll Content
             if (value > AXIS_THRESHOLD) scrollModal('down', STICK_SCROLL_AMOUNT);
             else if (value < -AXIS_THRESHOLD) scrollModal('up', STICK_SCROLL_AMOUNT);
        } else if (axisIndex === 0 && Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; } // Сброс для оси X
    }


    // --- Главный цикл геймпада ---
    function gamepadLoop() {
        if (gamepadIndex === null) { animationFrameId = null; return; }
        try {
            const gamepads = navigator.getGamepads(); if (!gamepads || !gamepads[gamepadIndex]) { updateGamepadStatus(null); return; }
            const gp = gamepads[gamepadIndex];
            gp.buttons.forEach((button, index) => { const wasPressed = !!prevButtonStates[index]; if (button.pressed && !wasPressed) { prevButtonStates[index] = true; handleButtonPress(index); } else if (!button.pressed && wasPressed) { prevButtonStates[index] = false; } });
            gp.axes.forEach((value, index) => { handleAxisMove(index, value); });
        } catch (error) { console.error("!!! ERROR in gamepadLoop:", error); }
        if (gamepadIndex !== null) { animationFrameId = requestAnimationFrame(gamepadLoop); } else { animationFrameId = null; }
    }

    // --- События подключения/отключения ---
    window.addEventListener("gamepadconnected", (event) => {
         if (!event.gamepad) return; console.log("GP connected:", event.gamepad.id, "Idx:", event.gamepad.index);
         if (!event.gamepad.buttons?.length && !event.gamepad.axes?.length) { return; }
         if (gamepadIndex === null) {
             gamepadIndex = event.gamepad.index;
             axisNavigated = { x: false, y: false }; // Сброс флагов осей
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
         else if (found && gamepadIndex !== null && currentFocusContext === 'none' && allPostersData.length > 0) {
             console.log("Initial GP found, setting initial focus now.");
             if (posterElements?.length > 0) { setGridFocus(0); }
             else if (paginationButtons?.length > 0) { setPaginationFocus(0); }
        }
    }
    function updateGamepadStatus(gamepad) {
         if (!gamepadStatusEl) return;
         if(gamepad) { // Подключен
             const name = gamepad.id.replace(/\s*\(Vendor:\s*\w+\s*Product:\s*\w+\)/i, '').trim();
             gamepadStatusEl.textContent = `Геймпад: ${name}`; gamepadStatusEl.className = 'connected';
             // Ставим фокус, только если его нет нигде И данные уже загружены
             if(currentFocusContext === 'none' && allPostersData.length > 0) {
                  if (posterElements?.length > 0) { console.log("GP active, setting initial grid focus."); setGridFocus(0); }
                  else if (paginationButtons?.length > 0) { console.log("GP active, grid empty, setting initial pagination focus."); setPaginationFocus(0); }
             }
         } else { // Отключен
             gamepadStatusEl.textContent = 'Геймпад отключен'; gamepadStatusEl.className = 'disconnected';
             gamepadIndex = null;
             if (currentGridFocusIndex !== -1 && posterElements?.[currentGridFocusIndex]) { posterElements[currentGridFocusIndex].classList.remove('focused'); }
             if (currentPaginationFocusIndex !== -1 && paginationButtons?.[currentPaginationFocusIndex]) { paginationButtons[currentPaginationFocusIndex].classList.remove('pagination-focused'); }
             setModalFocus(-1); // Снимет фокус модалки
             currentGridFocusIndex = -1; currentPaginationFocusIndex = -1; currentFocusContext = 'none';
             if (animationFrameId) { console.log("GP disconnected, loop will stop."); }
             animationFrameId = null; // Останавливаем цикл
         }
    }

    // --- Обработчик клика по кнопкам выбора источника (на основной странице) ---
    sourceButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedSource = button.dataset.source;
            if (selectedSource === 'pornolab') { window.location.href = '/pornolab.html'; }
            else if (selectedSource === 'rutracker_rss') { window.location.href = '/rss_viewer.html'; }
            // Клик по 'rutracker' (активной) ничего не делает
        });
    });

    // Задержка перед первой проверкой
    setTimeout(checkGamepadAndSetInitialFocus, 300);

    // --- Функции для фильтрации и сортировки ---
    
    // Загрузка всех данных (без пагинации)
    function loadAllData() {
        console.log("Loading all data for filtering and sorting...");
        if(posterGrid) posterGrid.innerHTML = '<p>Загрузка данных...</p>';
        
        fetch(`${TOPICS_API_URL}?source=${currentSource}&page=1&limit=1000`)
            .then(response => {
                if (!response.ok) { throw new Error(`API error ${response.status}`); }
                return response.json();
            })
            .then(apiResponse => {
                if (!apiResponse || !Array.isArray(apiResponse.items)) { 
                    throw new Error("Invalid data format from API."); 
                }
                
                allData = apiResponse.items;
                console.log(`Loaded ${allData.length} items for filtering and sorting.`);
                
                // Заполняем опции фильтров
                populateFilterOptions();
                
                // Применяем фильтры и сортировку
                applyFiltersAndSort();
                
                // Переключаем режим фильтрации
                isFilterMode = true;
            })
            .catch(error => {
                console.error("Error loading all data:", error);
                if(posterGrid) posterGrid.innerHTML = `<p style="color:red;">Ошибка загрузки данных: ${error.message}</p>`;
                // Возвращаемся к обычному режиму
                loadPageData(1, currentSource);
            });
    }
    
    // Заполнение опций фильтров
    function populateFilterOptions() {
        console.log("Populating filter options...");
        
        // Получаем уникальные значения для каждого фильтра
        const years = new Set();
        const genres = new Set();
        const voices = new Set();
        const texts = new Set();
        
        allData.forEach(item => {
            if (item.year) years.add(item.year);
            if (item.genre) {
                // Разбиваем жанры по запятой, если они в одной строке
                const genreList = item.genre.split(',').map(g => g.trim());
                genreList.forEach(g => genres.add(g));
            }
            if (item.voice_lang) voices.add(item.voice_lang);
            if (item.text_lang) texts.add(item.text_lang);
        });
        
        // Заполняем выпадающие списки
        fillSelectOptions('year-filter', Array.from(years).sort((a, b) => b - a)); // По убыванию
        fillSelectOptions('genre-filter', Array.from(genres).sort());
        fillSelectOptions('voice-filter', Array.from(voices).sort());
        fillSelectOptions('text-filter', Array.from(texts).sort());
        
        console.log(`Filter options populated: ${years.size} years, ${genres.size} genres, ${voices.size} voices, ${texts.size} text languages.`);
    }
    
    // Вспомогательная функция для заполнения select
    function fillSelectOptions(selectId, options) {
        const select = document.getElementById(selectId);
        if (!select) {
            console.warn(`Select element with id "${selectId}" not found.`);
            return;
        }
        
        // Сохраняем первую опцию (обычно "Все")
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        // Добавляем новые опции
        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option;
            optElement.textContent = option;
            select.appendChild(optElement);
        });
    }
    
    // Применение фильтров и сортировки
    function applyFiltersAndSort() {
        console.log("Applying filters and sorting...");
        console.log("Current filters:", currentFilters);
        console.log("Current sort option:", currentSortOption);
        
        // Применяем фильтры
        filteredData = allData.filter(item => {
            // Проверяем каждый фильтр
            if (currentFilters.year && item.year !== currentFilters.year) return false;
            
            if (currentFilters.genre && item.genre) {
                // Проверяем, содержит ли строка жанров выбранный жанр
                if (!item.genre.includes(currentFilters.genre)) return false;
            } else if (currentFilters.genre) {
                return false;
            }
            
            if (currentFilters.voice && item.voice_lang !== currentFilters.voice) return false;
            if (currentFilters.text && item.text_lang !== currentFilters.text) return false;
            
            if (currentFilters.multiplayer === 'true' && !item.has_multiplayer) return false;
            if (currentFilters.multiplayer === 'false' && item.has_multiplayer) return false;
            
            return true;
        });
        
        console.log(`Filtered data: ${filteredData.length} items.`);
        
        // Применяем сортировку
        sortData(filteredData, currentSortOption);
        
        // Обновляем пагинацию
        totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        currentPage = 1;
        
        // Отображаем первую страницу отфильтрованных данных
        const startIndex = 0;
        const endIndex = Math.min(ITEMS_PER_PAGE, filteredData.length);
        displayCurrentPageItems(filteredData.slice(startIndex, endIndex));
        generatePaginationControls();
    }
    
    // Функция сортировки данных
    function sortData(data, sortOption) {
        console.log(`Sorting data by option: ${sortOption}`);
        
        switch (sortOption) {
            case 'title_asc':
                data.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'title_desc':
                data.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                break;
            case 'year_asc':
                data.sort((a, b) => {
                    const yearA = a.year ? parseInt(a.year) : 0;
                    const yearB = b.year ? parseInt(b.year) : 0;
                    return yearA - yearB;
                });
                break;
            case 'year_desc':
                data.sort((a, b) => {
                    const yearA = a.year ? parseInt(a.year) : 0;
                    const yearB = b.year ? parseInt(b.year) : 0;
                    return yearB - yearA;
                });
                break;
        }
    }
    
    // Модифицированная функция смены страницы для режима фильтрации
    function changeFilteredPage(newPageNumber) {
        if (newPageNumber < 1 || newPageNumber > totalPages || newPageNumber === currentPage) return;
        console.log(`Changing filtered page to ${newPageNumber}`);
        
        currentPage = newPageNumber;
        
        // Используем отфильтрованные данные вместо загрузки с сервера
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length);
        displayCurrentPageItems(filteredData.slice(startIndex, endIndex));
        generatePaginationControls();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Обработчики событий для фильтров и сортировки
    const sortSelect = document.getElementById('sort-select');
    const yearFilter = document.getElementById('year-filter');
    const genreFilter = document.getElementById('genre-filter');
    const voiceFilter = document.getElementById('voice-filter');
    const textFilter = document.getElementById('text-filter');
    const multiplayerFilter = document.getElementById('multiplayer-filter');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentSortOption = sortSelect.value;
            console.log(`Sort option changed to: ${currentSortOption}`);
        });
    }
    
    if (yearFilter) {
        yearFilter.addEventListener('change', () => {
            currentFilters.year = yearFilter.value;
            console.log(`Year filter changed to: ${currentFilters.year}`);
        });
    }
    
    if (genreFilter) {
        genreFilter.addEventListener('change', () => {
            currentFilters.genre = genreFilter.value;
            console.log(`Genre filter changed to: ${currentFilters.genre}`);
        });
    }
    
    if (voiceFilter) {
        voiceFilter.addEventListener('change', () => {
            currentFilters.voice = voiceFilter.value;
            console.log(`Voice filter changed to: ${currentFilters.voice}`);
        });
    }
    
    if (textFilter) {
        textFilter.addEventListener('change', () => {
            currentFilters.text = textFilter.value;
            console.log(`Text filter changed to: ${currentFilters.text}`);
        });
    }
    
    if (multiplayerFilter) {
        multiplayerFilter.addEventListener('change', () => {
            currentFilters.multiplayer = multiplayerFilter.value;
            console.log(`Multiplayer filter changed to: ${currentFilters.multiplayer}`);
        });
    }
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            console.log("Apply filters button clicked.");
            
            // Если мы еще не в режиме фильтрации, загружаем все данные
            if (!isFilterMode) {
                loadAllData();
            } else {
                // Иначе просто применяем фильтры к уже загруженным данным
                applyFiltersAndSort();
            }
            
            // Закрываем боковую панель после применения фильтров
            if (typeof window.toggleSidePanel === 'function') {
                window.toggleSidePanel();
            }
        });
    }
    
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            console.log("Reset filters button clicked.");
            
            // Сбрасываем все фильтры
            if (sortSelect) sortSelect.value = 'title_asc';
            if (yearFilter) yearFilter.value = '';
            if (genreFilter) genreFilter.value = '';
            if (voiceFilter) voiceFilter.value = '';
            if (textFilter) textFilter.value = '';
            if (multiplayerFilter) multiplayerFilter.value = '';
            
            currentSortOption = 'title_asc';
            currentFilters = {
                year: '',
                genre: '',
                voice: '',
                text: '',
                multiplayer: ''
            };
            
            // Если мы в режиме фильтрации, применяем сброшенные фильтры
            if (isFilterMode) {
                applyFiltersAndSort();
            } else {
                // Иначе возвращаемся к обычному режиму
                loadPageData(1, currentSource);
            }
            
            // Закрываем боковую панель после сброса фильтров
            if (typeof window.toggleSidePanel === 'function') {
                window.toggleSidePanel();
            }
        });
    }
    
    // Переопределяем функцию changePage для поддержки режима фильтрации
    const originalChangePage = changePage;
    changePage = function(newPageNumber) {
        if (isFilterMode) {
            changeFilteredPage(newPageNumber);
        } else {
            originalChangePage(newPageNumber);
        }
    };

    // --- НАЧИНАЕМ ЗАГРУЗКУ ДАННЫХ ПРИ СТАРТЕ ---
    loadPageData(1, currentSource); // Загружаем первую страницу для источника по умолчанию

    console.log("Main script initialization finished.");

}); // Конец DOMContentLoaded
