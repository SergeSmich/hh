document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Pornolab Viewer script...");

    // --- DOM элементы ---
    const posterGrid = document.getElementById('poster-grid');
    const paginationControls = document.getElementById('pagination-controls');
    const sourceButtons = document.querySelectorAll('.source-button'); // Кнопки выбора источника

    if (!posterGrid || !paginationControls || sourceButtons.length === 0) {
        console.error("CRITICAL: Essential DOM elements (poster-grid, pagination-controls, or source-buttons) not found!");
        return;
    } else {
        console.log("DOM elements found.");
    }

    // --- Переменные состояния ---
    let currentSourceData = []; // Данные только для текущей страницы
    let currentPage = 1;
    let totalPages = 1;
    const ITEMS_PER_PAGE = 50; // Синхронизировать с бэкендом
    const SOURCE_NAME = 'pornolab'; // Источник для API
    const API_URL = '/api/pornolab'; // !!! Убедитесь, что этот эндпоинт есть на бэкенде !!!
    // Базовый URL для скачивания с Pornolab (может потребоваться уточнение)
    const PORNOLAB_DOWNLOAD_BASE_URL = "https://pornolab.net/forum/";

    // --- Загрузка данных с БЭКЕНДА ---
    function loadPageData(page = 1) {
        console.log(`Fetching data from API: ${API_URL}?page=${page}&limit=${ITEMS_PER_PAGE}`);
        posterGrid.innerHTML = '<p>Загрузка данных...</p>';
        paginationControls.innerHTML = '';

        fetch(`${API_URL}?page=${page}&limit=${ITEMS_PER_PAGE}`)
            .then(response => {
                console.log("API response status:", response.status);
                if (!response.ok) { throw new Error(`API error ${response.status}`); }
                return response.json();
            })
            .then(apiResponse => {
                console.log(`API Data loaded for page ${page}:`, apiResponse.items?.length ?? 0, "items.");
                if (!apiResponse || !Array.isArray(apiResponse.items)) { throw new Error("Invalid data format from API."); }

                currentSourceData = apiResponse.items; // Сохраняем только текущую страницу
                totalPages = apiResponse.totalPages || 1;
                currentPage = apiResponse.currentPage || 1;
                console.log(`Total pages set to: ${totalPages}`);

                displayCurrentPageItems(currentSourceData); // Отображаем
                generatePaginationControls(); // Генерируем пагинацию
            })
            .catch(error => {
                 console.error("Error loading data from API:", error);
                 posterGrid.innerHTML = `<p style="color:red;">Ошибка загрузки данных: ${error.message}</p>`;
                 generatePaginationControls(); // Показать неактивные кнопки
            });
    }

    // --- Отображение ЭЛЕМЕНТОВ ТЕКУЩЕЙ СТРАНИЦЫ ---
    function displayCurrentPageItems(itemsToDisplay) {
        console.log(`Rendering ${itemsToDisplay.length} items for page ${currentPage}`);
        posterGrid.innerHTML = ''; // Очищаем сетку

        if (itemsToDisplay.length === 0) {
            posterGrid.innerHTML = `<p>Нет данных для страницы ${currentPage}.</p>`;
        } else {
            itemsToDisplay.forEach((item, indexOnPage) => {
                 const div = document.createElement('div'); div.classList.add('poster-item');
                 // Сохраняем ссылку для скачивания
                 let downloadUrl = item.magnet_link || '#'; // Приоритет magnet
                 if ((!downloadUrl || downloadUrl === '#') && item.topic_id) {
                      downloadUrl = `${PORNOLAB_DOWNLOAD_BASE_URL}dl.php?t=${item.topic_id}`;
                 }
                 div.dataset.downloadUrl = downloadUrl;

                 if (item.has_multiplayer === true) { const indicator = document.createElement('span'); indicator.classList.add('multiplayer-indicator'); indicator.title = "Есть мультиплеер"; div.appendChild(indicator); }
                 const img = document.createElement('img'); img.src = item.poster_url || "https://via.placeholder.com/210x140.png?text=NA"; img.alt = item.title || "Постер"; img.loading = 'lazy';
                 img.onerror = function() { if (this.src.includes('Error')) return; this.onerror=null; this.src='https://via.placeholder.com/210x140.png?text=Error'; };
                 div.appendChild(img);

                 // --- !!! СОЗДАЕМ БЛОК ДЕТАЛЕЙ С ПРАВИЛЬНЫМИ КЛЮЧАМИ !!! ---
                 const detailsDiv = document.createElement('div');
                 detailsDiv.classList.add('details');

                 // Используем ключи, которые СОХРАНЯЕТ parser.py для pornolab
                 detailsDiv.innerHTML = `
                     <p><b>Сиды:</b> ${item.Seeds ?? '-'}</p>
                     <p><b>Пиры:</b> ${item.Peers ?? '-'}</p>
                     <p title="${item.Size ?? '-'}"><b>Размер:</b> ${item.Size ?? '-'}</p>
                     <p title="${item.Video ?? '-'}"><b>Видео:</b> ${item.Video ?? '-'}</p>
                     <p title="${item.Type ?? '-'}"><b>Тип:</b> ${item.Type ?? '-'}</p>
                 `;
                 div.appendChild(detailsDiv);
                 // --------------------------------------------------

                 // Обработчик клика для скачивания
                 div.addEventListener('click', (event) => {
                     const finalDownloadUrl = event.currentTarget.dataset.downloadUrl;
                     console.log(`Item ${indexOnPage} clicked. Download URL: ${finalDownloadUrl}`);
                     if (finalDownloadUrl && finalDownloadUrl !== '#') {
                         window.open(finalDownloadUrl, '_blank');
                     } else { console.warn("Download URL not found."); }
                 });
                 posterGrid.appendChild(div);
            });
        }
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
         });
    }

    // --- Смена страницы ---
    function changePage(newPageNumber) {
         if (newPageNumber < 1 || newPageNumber > totalPages || newPageNumber === currentPage) return;
         console.log(`Changing page to ${newPageNumber}`);
         currentPage = newPageNumber;
         loadPageData(currentPage); // Загружаем данные для НОВОЙ страницы
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }

     // --- Обработчик клика по кнопкам выбора источника (для перехода) ---
     sourceButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedSource = button.dataset.source;
            if (selectedSource === 'rutracker') {
                window.location.href = '/'; // Переход на главную страницу
            }
            // Клик по кнопке Pornolab на этой странице ничего не делает
        });
    });

    // --- НАЧИНАЕМ ЗАГРУЗКУ ДАННЫХ ПРИ СТАРТЕ ---
    loadPageData(1); // Загружаем первую страницу

    console.log("Pornolab script initialization finished.");

}); // Конец DOMContentLoaded