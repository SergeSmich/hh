// --- O:\hh\server.js ---
require('dotenv').config(); // ��������� ���������� ��������� �� .env (��� YOUTUBE_API_KEY)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises; // ����������� �������� ������
const path = require('path');

const app = express();
// ���������� ���� �� ��������� ��� 3000 �� ���������
const PORT = process.env.BACKEND_PORT || 3000; // �������� ���� ����������
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY; // ���� YouTube
const DATA_JSON_PATH = path.join(__dirname, 'data.json'); // ���� � data.json
const PUBLIC_FOLDER_PATH = path.join(__dirname, 'public'); // ���� � ����� public

// �������� ������� ����� YouTube
if (!YOUTUBE_API_KEY) {
    console.warn("!!! ��������: ���� YouTube API (YOUTUBE_API_KEY) �� ������ � .env �����. ����� ����� �������� �� �����.");
    // process.exit(1); // �� �������, ���������� ����� �������� � ��� YouTube
}

// --- Middleware ---
// ��������� CORS-������� (��������� ����� ������ ��� ����������)
app.use(cors());
// ����������� ��������
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// --- ������� ����������� ������ �� ����� 'public' ---
app.use(express.static(PUBLIC_FOLDER_PATH));
console.log(`������� ����������� ������ ��: ${PUBLIC_FOLDER_PATH}`);

// --- API �������� ��� ��������� ������ ��� � ���������� ---
app.get('/api/topics', async (req, res) => {
    // �������� ��������� �������� � ������ �� �������, ������������� �������� �� ���������
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // ����� �� ��������� ��������� � ����������
    const skip = (page - 1) * limit; // ��������� ��������

    console.log(`������ API: /api/topics?page=${page}&limit=${limit}`);

    try {
        // ���������� ������ data.json
        const jsonData = await fs.readFile(DATA_JSON_PATH, 'utf-8');
        const allTopics = JSON.parse(jsonData); // ������ JSON

        if (!Array.isArray(allTopics)) {
             throw new Error('data.json �� �������� �������� JSON ������.');
        }

        const totalItems = allTopics.length;
        const totalPages = Math.ceil(totalItems / limit);

        // �������� ������ ��� ������� ��������
        const paginatedTopics = allTopics.slice(skip, skip + limit);

        console.log(`�������� ${paginatedTopics.length} ��� ��� �������� ${page}. ����� ���: ${totalItems}`);

        // ���������� ��������� ������ � ����������� � ���������
        res.json({
            totalPages: totalPages,
            currentPage: page,
            itemsPerPage: limit,
            totalItems: totalItems,
            items: paginatedTopics // ������ ��� ��� ������� ��������
        });

    } catch (error) {
        console.error(`������ ������ ��� ��������� ${DATA_JSON_PATH}:`, error);
        if (error.code === 'ENOENT') { // ���� �� ������
             console.error(`!!! ���� ${DATA_JSON_PATH} �� ������. ��������� parser.py!`);
             res.status(404).json({ error: `���� ������ �� ������. ������� ��������� parser.py.` });
        } else { // ������ ������ (��������, ������������ JSON)
             res.status(500).json({ error: '������ ��������� ������ ���.' });
        }
    }
});


// --- �������� ��� ������ ����� �� YouTube (�� ������ ����) ---
app.get('/youtube-search', async (req, res) => {
    const searchQuery = req.query.query;
    if (!YOUTUBE_API_KEY) { return res.status(503).json({ error: 'YouTube API key �� �������� �� �������.' }); }
    if (!searchQuery) { return res.status(400).json({ error: '�������� "query" ����������' }); }

    console.log(`������� ������ �� ����� �����: "${searchQuery}"`);
    const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
    const params = {
        key: YOUTUBE_API_KEY, part: 'snippet', q: searchQuery, type: 'video',
        maxResults: 5, videoEmbeddable: 'true', fields: 'items(id(videoId))'
    };
    try {
        console.log(`������ � YouTube API: ${searchUrl}`);
        const response = await axios.get(searchUrl, { params: params });
        const items = response.data.items;
        if (items && items.length > 0) {
            const firstVideo = items.find(item => item.id && item.id.videoId);
            if (firstVideo) {
                const videoId = firstVideo.id.videoId;
                console.log(`������� ������������ �����. ID: ${videoId}`);
                return res.json({ videoId: videoId });
            }
        }
        console.log("�� ������� ���������� ����� � videoId.");
        return res.json({ videoId: null });
    } catch (error) {
        console.error("������ ��� ������� � YouTube API:", error.response ? error.response.data : error.message);
        return res.status(500).json({ error: '������ ��� ������ ����� �� YouTube' });
    }
});

// --- �������� ������� - ������ index.html �� ����� public ---
// ��� �����, ����� ��� ������ �� http://localhost:PORT/ ���������� ��� ���������
app.get('/', (req, res) => {
    const indexPath = path.join(PUBLIC_FOLDER_PATH, 'index.html');
    console.log(`�������� �����: ${indexPath}`);
    res.sendFile(indexPath, (err) => {
         if (err) {
             console.error(`������ �������� index.html: ${err.message}`);
             res.status(err.status || 500).end();
         }
    });
});


// --- ��������� �������������� ��������� (404) ---
app.use((req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.url}`);
    res.status(404).send('������ �� ������ (404)');
});

// --- ������ ������� ---
app.listen(PORT, () => {
    console.log(`-------------------------------------------------------`);
    console.log(` �������� ������-������ ������� �� ����� ${PORT}`);
    console.log(` > ������� ��������� ��: ${PUBLIC_FOLDER_PATH}`);
    console.log(` > API ���: http://localhost:${PORT}/api/topics?page=1&limit=${ITEMS_PER_PAGE}`);
    console.log(` > API YouTube: http://localhost:${PORT}/youtube-search?query=...`);
    console.log(` > ���� YouTube API: ${YOUTUBE_API_KEY ? '��������' : '!!! ������: �� ������ � .env !!!'}`);
    console.log(`-------------------------------------------------------`);
});