// --- O:\hh\server.js (������ ������ � RSS API) ---
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const DATA_JSON_PATH = path.join(__dirname, 'data.json'); // ��� Rutracker ���
const PORNOLAB_DATA_JSON_PATH = path.join(__dirname, 'pornolab_data.json'); // ��� Pornolab ���
const RSS_DATA_JSON_PATH = path.join(__dirname, 'rss_data.json'); // !!! ���� � RSS ������ !!!
const PUBLIC_FOLDER_PATH = path.join(__dirname, 'public');

if (!YOUTUBE_API_KEY) { console.warn("!!! YOUTUBE_API_KEY �� ������ � .env !!!"); }

// --- Middleware ---
app.use(cors());
app.use((req, res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); next(); });
app.use(express.static(PUBLIC_FOLDER_PATH));
console.log(`Static files served from: ${PUBLIC_FOLDER_PATH}`);

// --- ������� ��� ������ � ��������� ������ ---
async function getPaginatedData(filePath, page, limit, sourceFilter = null) {
    console.log(`Reading data from: ${filePath}`);
    let allItems = [];
    try {
        const jsonData = await fs.readFile(filePath, 'utf-8');
        allItems = JSON.parse(jsonData);
        if (!Array.isArray(allItems)) { throw new Error(`${path.basename(filePath)} invalid array.`); }
    } catch (error) {
        if (error.code === 'ENOENT') {
             console.warn(`Data file not found: ${filePath}. Returning empty results.`);
             return { totalPages: 0, currentPage: page, itemsPerPage: limit, totalItems: 0, items: [] };
        } else { throw new Error(`Error processing ${filePath}.`); }
    }
    if (sourceFilter) {
        allItems = allItems.filter(item => item && item.source === sourceFilter);
        console.log(`Filtered items for source "${sourceFilter}": ${allItems.length}`);
    } else {
         console.log(`Total items in ${path.basename(filePath)}: ${allItems.length}`);
    }
    const totalItems = allItems.length;
    const totalPages = Math.ceil(totalItems / limit);
    const skip = (page - 1) * limit;
    const paginatedItems = allItems.slice(skip, skip + limit);
    console.log(`Sending ${paginatedItems.length} of ${totalItems} items for page ${page} (File: ${path.basename(filePath)})`);
    return { totalPages, currentPage: page, itemsPerPage: limit, totalItems, items: paginatedItems };
}

// --- API �������� ��� ��� Rutracker ---
app.get('/api/topics', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    console.log(`API request: /api/topics?page=${page}&limit=${limit}`);
    try {
        // ���������� data.json � ��������� �� 'rutracker'
        const result = await getPaginatedData(DATA_JSON_PATH, page, limit, 'rutracker');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- API �������� ��� Pornolab ---
app.get('/api/pornolab', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    console.log(`API request: /api/pornolab?page=${page}&limit=${limit}`);
    try {
        const result = await getPaginatedData(PORNOLAB_DATA_JSON_PATH, page, limit, 'pornolab');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- !!! ����� API �������� ��� RSS Rutracker !!! ---
app.get('/api/rss/rutracker', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    // ��� RSS ����� ������ ������ �� ��� ��� ��� �����, ���� �� �������
    const limit = parseInt(req.query.limit) || 100;
     console.log(`API request: /api/rss/rutracker?page=${page}&limit=${limit}`);
     try {
         // ���������� rss_data.json, ������ �� source 'rutracker_rss'
         const result = await getPaginatedData(RSS_DATA_JSON_PATH, page, limit, 'rutracker_rss');
         res.setHeader('Content-Type', 'application/json; charset=utf-8');
         res.json(result);
     } catch (error) {
         if (error.message.includes("Data file not found")) {
              res.status(404).json({ error: `���� ${RSS_DATA_JSON_PATH} �� ������. ��������� ������ � ������� RSS.` });
         } else {
              res.status(500).json({ error: `������ ��������� RSS ������: ${error.message}` });
         }
     }
});
// --- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ---

// --- �������� ��� ������ ����� �� YouTube ---
app.get('/youtube-search', async (req, res) => {
    const searchQuery = req.query.query;
    if (!YOUTUBE_API_KEY) { return res.status(503).json({ error: 'YouTube API key �� ��������.' }); }
    if (!searchQuery) { return res.status(400).json({ error: '�������� "query" ����������' }); }
    console.log(`������� ������ �� ����� �����: "${searchQuery}"`);
    const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
    const params = { key: YOUTUBE_API_KEY, part: 'snippet', q: searchQuery, type: 'video', maxResults: 5, videoEmbeddable: 'true', fields: 'items(id(videoId))' };
    try {
        const response = await axios.get(searchUrl, { params: params });
        const items = response.data.items;
        if (items && items.length > 0) {
            const firstVideo = items.find(item => item.id && item.id.videoId);
            if (firstVideo) { return res.json({ videoId: firstVideo.id.videoId }); }
        }
        return res.json({ videoId: null });
    } catch (error) { console.error("������ YouTube API:", error.response ? error.response.data : error.message); return res.status(500).json({ error: '������ ������ YouTube' }); }
});

// --- �������� ������� - ������ home.html ---
app.get('/', (req, res) => {
    const indexPath = path.join(PUBLIC_FOLDER_PATH, 'home.html');
    console.log(`�������� �����: ${indexPath}`);
    res.sendFile(indexPath, (err) => { if (err) { console.error(`������ home.html: ${err.message}`); res.status(err.status || 500).end(); } });
});

// --- ������� ��� index.html (Rutracker) ---
app.get('/index.html', (req, res) => {
    const indexPath = path.join(PUBLIC_FOLDER_PATH, 'index.html');
     console.log(`�������� �����: ${indexPath}`);
    res.sendFile(indexPath, (err) => { if (err) { console.error(`������ index.html: ${err.message}`); res.status(err.status || 500).end(); } });
});

// --- ������� ��� pornolab.html ---
app.get('/pornolab.html', (req, res) => {
     const pornolabPath = path.join(PUBLIC_FOLDER_PATH, 'pornolab.html');
     console.log(`�������� �����: ${pornolabPath}`);
     res.sendFile(pornolabPath, (err) => { if (err) { console.error(`������ pornolab.html: ${err.message}`); res.status(err.status || 500).end(); } });
});

// --- ������� ��� rss_viewer.html ---
app.get('/rss_viewer.html', (req, res) => {
     const rssPath = path.join(PUBLIC_FOLDER_PATH, 'rss_viewer.html');
     console.log(`�������� �����: ${rssPath}`);
     res.sendFile(rssPath, (err) => { if (err) { console.error(`������ rss_viewer.html: ${err.message}`); res.status(err.status || 500).end(); } });
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
    console.log(` > ������� ��������:   http://localhost:${PORT}/`);
    console.log(` > Rutracker Viewer: http://localhost:${PORT}/index.html`);
    console.log(` > Pornolab Viewer:  http://localhost:${PORT}/pornolab.html`);
    console.log(` > RSS Viewer:       http://localhost:${PORT}/rss_viewer.html`);
    console.log(` > API Rutracker:    http://localhost:${PORT}/api/topics`);
    console.log(` > API Pornolab:     http://localhost:${PORT}/api/pornolab`);
    console.log(` > API RSS:          http://localhost:${PORT}/api/rss/rutracker`);
    console.log(` > API YouTube:      http://localhost:${PORT}/youtube-search`);
    console.log(`-------------------------------------------------------`);
});