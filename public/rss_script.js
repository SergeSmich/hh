document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:8443/api'; // Укажите адрес вашего API
    const providerSelect = document.getElementById('providerSelect');
    const categorySelect = document.getElementById('categorySelect');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const rssItemsList = document.getElementById('rssItemsList');

    // --- Вспомогательные функции ---
    const showLoading = () => {
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        rssItemsList.innerHTML = ''; // Очищаем старые результаты
    };

    const hideLoading = () => {
        loadingDiv.style.display = 'none';
    };

    const showError = (message) => {
        errorDiv.textContent = `Ошибка: ${message}`;
        errorDiv.style.display = 'block';
        rssItemsList.innerHTML = '';
    };

    const clearError = () => {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    };

    // --- Загрузка провайдеров ---
    const fetchProviders = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/provider/list`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const providers = await response.json();

            // Убираем существующие опции, кроме первой (-- Выберите --)
            providerSelect.length = 1;

            providers.forEach(p => {
                // Добавляем только тех, для кого есть RSS в API
                if (['rutracker', 'kinozal', 'rutor', 'nonameclub'].includes(p.Provider.toLowerCase())) {
                    const option = document.createElement('option');
                    option.value = p.Provider.toLowerCase();
                    option.textContent = p.Provider;
                    providerSelect.appendChild(option);
                }
            });
        } catch (err) {
            console.error('Ошибка загрузки провайдеров:', err);
            showError(`Не удалось загрузить список провайдеров. ${err.message}`);
        }
    };

    // --- Загрузка категорий для провайдера ---
    const fetchAndPopulateCategories = async (provider) => {
        categorySelect.disabled = true;
        categorySelect.innerHTML = '<option value="0">Загрузка категорий...</option>';
        if (!provider) {
            categorySelect.innerHTML = '<option value="0">-- Все категории --</option>';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/get/category/${provider}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const categoryData = await response.json(); // Ожидаем массив с одним объектом [{ "id": "name", ... }]

            categorySelect.innerHTML = '<option value="0">-- Все категории --</option>'; // Опция по умолчанию

            if (categoryData && Array.isArray(categoryData) && categoryData.length > 0) {
                 const categories = categoryData[0]; // Берем первый элемент массива
                 // Сортируем категории по названию для удобства
                 const sortedCategories = Object.entries(categories).sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));

                 sortedCategories.forEach(([id, name]) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = `${name} (ID: ${id})`;
                    categorySelect.appendChild(option);
                });
            } else {
                console.warn(`Нет категорий для провайдера ${provider} или неверный формат ответа`);
                 categorySelect.innerHTML = '<option value="0">Категории недоступны</option>';
                 return; // Не включаем селект, если нет категорий
            }
            categorySelect.disabled = false; // Включаем селект после загрузки
        } catch (err) {
            console.error(`Ошибка загрузки категорий для ${provider}:`, err);
            categorySelect.innerHTML = '<option value="0">Ошибка загрузки</option>';
            // Оставляем селект выключенным
        }
    };

    // --- Загрузка и отображение RSS ленты ---
    const fetchRssFeed = async (provider, categoryId = 0) => {
        if (!provider) {
            rssItemsList.innerHTML = ''; // Очищаем если провайдер не выбран
            return;
        }
        showLoading();

        const url = `${API_BASE_URL}/get/rss/${provider}?category=${categoryId}`;
        console.log(`Fetching RSS from: ${url}`);

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json' // Запрашиваем JSON
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                try { // Пытаемся парсить ошибку как JSON
                    const errorJson = JSON.parse(errorText);
                     throw new Error(errorJson.Result || `HTTP error! status: ${response.status}`);
                } catch { // Если не JSON, показываем как текст
                     throw new Error(errorText || `HTTP error! status: ${response.status}`);
                }
            }

            const data = await response.json();
            hideLoading();
            clearError();
            displayRssItems(data, provider); // Передаем провайдера для специфичной обработки

        } catch (err) {
            console.error('Ошибка загрузки RSS ленты:', err);
            hideLoading();
            showError(err.message || 'Неизвестная ошибка');
        }
    };

    // --- Отображение элементов RSS ---
    const displayRssItems = (items, provider) => {
        rssItemsList.innerHTML = ''; // Очистка перед отображением

        if (!Array.isArray(items) || items.length === 0) {
            // Проверяем, не объект ли это с ошибкой
            if (typeof items === 'object' && items !== null && items.Result) {
                 showError(items.Result);
            } else {
                 rssItemsList.innerHTML = '<li>Нет данных для отображения.</li>';
            }
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');

            // Стандартизируем поля (могут отличаться для разных RSS)
            const title = item.title || 'Без названия';
            const link = item.link || '#';
            const date = item.updated || item.pubDate || item.date || '';
            const category = item.categoryLabel || item.category || item.categoryLable || ''; // Учитываем опечатку в старом коде

            // Специфичные поля для кастомных RSS
            const size = item.size || '';
            const seeds = item.seeds !== undefined ? `Seeds: ${item.seeds}` : '';
            const peers = item.peers !== undefined ? `Peers: ${item.peers}` : '';
            const comments = item.comments !== undefined ? `Comments: ${item.comments}` : '';
            const downloadLink = item.downloadLink || item.enclosure?.url || '';
            const magnetLink = item.guid && item.guid.startsWith('magnet:') ? item.guid : (item.magnet || ''); // Rutor использует guid для magnet

            // Формируем HTML для элемента
            let content = `<strong><a href="${link}" target="_blank">${title}</a></strong>`;
            if (category) content += `<span>Категория: ${category}</span>`;
            if (date) {
                 try { content += `<span>Дата: ${new Date(date).toLocaleString('ru-RU')}</span>`; }
                 catch { content += `<span>Дата: ${date}</span>`; } // Показать как есть, если дата невалидна
            }
            if (size) content += `<span>Размер: ${size}</span>`;
            if (seeds) content += `<span>${seeds}</span>`;
            if (peers) content += `<span>${peers}</span>`;
            if (comments) content += `<span>${comments}</span>`;
            if (downloadLink) content += `<span><a href="${downloadLink}">Скачать .torrent</a></span>`;
            if (magnetLink) content += `<span><a href="${magnetLink}">Magnet-ссылка</a></span>`;

            li.innerHTML = content;
            rssItemsList.appendChild(li);
        });
    };

    // --- Обработчики событий ---
    providerSelect.addEventListener('change', () => {
        const selectedProvider = providerSelect.value;
        fetchAndPopulateCategories(selectedProvider); // Загружаем категории
        // Загружаем RSS для "Все категории" при смене провайдера
        fetchRssFeed(selectedProvider, 0);
    });

    categorySelect.addEventListener('change', () => {
        const selectedProvider = providerSelect.value;
        const selectedCategory = categorySelect.value;
        fetchRssFeed(selectedProvider, selectedCategory);
    });

    // --- Инициализация ---
    fetchProviders(); // Загружаем список провайдеров при старте

});