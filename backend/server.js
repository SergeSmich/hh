// --- O:\hh\server.js ---
require('dotenv').config(); // Загружаем переменные окружения из .env (для YOUTUBE_API_KEY)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises; // Асинхронный файловый модуль
const path = require('path');

const app = express();
// Используем порт из окружения или 3000 по умолчанию
const PORT = process.env.BACKEND_PORT || 3000; // Основной порт приложения
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY; // Ключ YouTube
const DATA_JSON_PATH = path.join(__dirname, 'data.json'); // Путь к data.json
const PUBLIC_FOLDER_PATH = path.join(__dirname, 'public'); // Путь к папке public

// Проверка наличия ключа YouTube
if (!YOUTUBE_API_KEY) {
    console.warn("!!! ВНИМАНИЕ: Ключ YouTube API (YOUTUBE_API_KEY) не найден в .env файле. Поиск видео работать не будет.");
    // process.exit(1); // Не выходим, приложение может работать и без YouTube
}

// --- Middleware ---
// Разрешаем CORS-запросы (настройте более строго для продакшена)
app.use(cors());
// Логирование запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// --- Раздача статических файлов из папки 'public' ---
app.use(express.static(PUBLIC_FOLDER_PATH));
console.log(`Раздача статических файлов из: ${PUBLIC_FOLDER_PATH}`);

// --- API Эндпоинт для получения данных тем с пагинацией ---
app.get('/api/topics', async (req, res) => {
    // Получаем параметры страницы и лимита из запроса, устанавливаем значения по умолчанию
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Лимит по умолчанию совпадает с фронтендом
    const skip = (page - 1) * limit; // Вычисляем смещение

    console.log(`Запрос API: /api/topics?page=${page}&limit=${limit}`);

    try {
        // Асинхронно читаем data.json
        const jsonData = await fs.readFile(DATA_JSON_PATH, 'utf-8');
        const allTopics = JSON.parse(jsonData); // Парсим JSON

        if (!Array.isArray(allTopics)) {
             throw new Error('data.json не содержит валидный JSON массив.');
        }

        const totalItems = allTopics.length;
        const totalPages = Math.ceil(totalItems / limit);

        // Отбираем данные для текущей страницы
        const paginatedTopics = allTopics.slice(skip, skip + limit);

        console.log(`Отправка ${paginatedTopics.length} тем для страницы ${page}. Всего тем: ${totalItems}`);

        // Отправляем результат вместе с информацией о пагинации
        res.json({
            totalPages: totalPages,
            currentPage: page,
            itemsPerPage: limit,
            totalItems: totalItems,
            items: paginatedTopics // Массив тем для текущей страницы
        });

    } catch (error) {
        console.error(`Ошибка чтения или обработки ${DATA_JSON_PATH}:`, error);
        if (error.code === 'ENOENT') { // Файл не найден
             console.error(`!!! Файл ${DATA_JSON_PATH} не найден. Запустите parser.py!`);
             res.status(404).json({ error: `Файл данных не найден. Сначала запустите parser.py.` });
        } else { // Другие ошибки (например, некорректный JSON)
             res.status(500).json({ error: 'Ошибка обработки данных тем.' });
        }
    }
});


// --- Эндпоинт для поиска видео на YouTube (из вашего кода) ---
app.get('/youtube-search', async (req, res) => {
    const searchQuery = req.query.query;
    if (!YOUTUBE_API_KEY) { return res.status(503).json({ error: 'YouTube API key не настроен на сервере.' }); }
    if (!searchQuery) { return res.status(400).json({ error: 'Параметр "query" обязателен' }); }

    console.log(`Получен запрос на поиск видео: "${searchQuery}"`);
    const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
    const params = {
        key: YOUTUBE_API_KEY, part: 'snippet', q: searchQuery, type: 'video',
        maxResults: 5, videoEmbeddable: 'true', fields: 'items(id(videoId))'
    };
    try {
        console.log(`Запрос к YouTube API: ${searchUrl}`);
        const response = await axios.get(searchUrl, { params: params });
        const items = response.data.items;
        if (items && items.length > 0) {
            const firstVideo = items.find(item => item.id && item.id.videoId);
            if (firstVideo) {
                const videoId = firstVideo.id.videoId;
                console.log(`Найдено встраиваемое видео. ID: ${videoId}`);
                return res.json({ videoId: videoId });
            }
        }
        console.log("Не найдено подходящих видео с videoId.");
        return res.json({ videoId: null });
    } catch (error) {
        console.error("Ошибка при запросе к YouTube API:", error.response ? error.response.data : error.message);
        return res.status(500).json({ error: 'Ошибка при поиске видео на YouTube' });
    }
});

// --- Корневой маршрут - отдает index.html из папки public ---
// Это важно, чтобы при заходе на http://localhost:PORT/ открывался ваш интерфейс
app.get('/', (req, res) => {
    const indexPath = path.join(PUBLIC_FOLDER_PATH, 'index.html');
    console.log(`Отправка файла: ${indexPath}`);
    res.sendFile(indexPath, (err) => {
         if (err) {
             console.error(`Ошибка отправки index.html: ${err.message}`);
             res.status(err.status || 500).end();
         }
    });
});


// --- Обработка несуществующих маршрутов (404) ---
app.use((req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.url}`);
    res.status(404).send('Ресурс не найден (404)');
});

// --- Запуск сервера ---
app.listen(PORT, () => {
    console.log(`-------------------------------------------------------`);
    console.log(` Основной Бэкенд-сервер запущен на порту ${PORT}`);
    console.log(` > Статика раздается из: ${PUBLIC_FOLDER_PATH}`);
    console.log(` > API тем: http://localhost:${PORT}/api/topics?page=1&limit=${ITEMS_PER_PAGE}`);
    console.log(` > API YouTube: http://localhost:${PORT}/youtube-search?query=...`);
    console.log(` > Ключ YouTube API: ${YOUTUBE_API_KEY ? 'ЗАГРУЖЕН' : '!!! ОШИБКА: НЕ НАЙДЕН в .env !!!'}`);
    console.log(`-------------------------------------------------------`);
});