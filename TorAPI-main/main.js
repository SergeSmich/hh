// --- START OF FULL server.js FILE (Corrected v24 - Restore RuTrackerRSS function) ---

const express       = require('express');
const swaggerJsdoc  = require('swagger-jsdoc');
const swaggerUi     = require('swagger-ui-express');
const yargs         = require('yargs');
const axios         = require('axios');
const cheerio       = require('cheerio');
const proxy         = require('https-proxy-agent').HttpsProxyAgent;
const iconv         = require('iconv-lite');
const xml2js        = require('xml2js');
const path          = require('path');
const fs            = require('fs');
const { URL }       = require('url');

// --- Category List Loading ---
const categoryFilePath = path.join(__dirname, 'category.json');
let categoryList = {};
try {
    if (fs.existsSync(categoryFilePath)) {
        categoryList = JSON.parse(fs.readFileSync(categoryFilePath, 'utf-8'));
        console.log("Loaded categories from category.json");
    } else {
        console.error(`Error: category.json not found at ${categoryFilePath}. Using empty categories.`);
        categoryList = { RuTracker: {}, Kinozal: {}, RuTor: {}, NoNameClub: {}, Pornolab: {} };
    }
} catch (e) {
    console.error(`Error reading or parsing category.json: ${e}. Using empty categories.`);
    categoryList = { RuTracker: {}, Kinozal: {}, RuTor: {}, NoNameClub: {}, Pornolab: {} };
}

// Add Pornolab placeholder if missing
if (!categoryList.Pornolab) {
    if (categoryList.RuTracker && Object.keys(categoryList.RuTracker).length > 0) {
        categoryList.Pornolab = { ...categoryList.RuTracker };
        console.warn("Pornolab categories not found in category.json, using RuTracker categories as placeholder. Please update category.json!");
    } else {
        categoryList.Pornolab = { "0": "Все категории (Placeholder)" };
        console.warn("Pornolab categories not found in category.json, and RuTracker categories unavailable. Using minimal placeholder. Please update category.json!");
    }
}

// --- Argument Parsing ---
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv))
    .option('port', { alias: 'p', type: 'number', default: 8443, description: 'Express server port' })
    .option('test', { alias: 't', type: 'boolean', default: false, description: 'Test endpoints and stop server' })
    .option('query', { alias: 'q', type: 'string', description: 'Title for test (e.g., The+Rookie or Blonde)' })
    .option('proxyAddress', { type: 'string', description: 'Address proxy server (e.g., 127.0.0.1)' })
    .option('proxyPort', { type: 'number', description: 'Port proxy server (e.g., 9050)' })
    .option('username', { type: 'string', description: 'Username for proxy server' })
    .option('password', { type: 'string', description: 'Password for proxy server' })
    .argv;

// --- Puppeteer Flags (Keep Disabled) ---
const RuTrackerPuppeteer = false;
const RuTorPuppeteer     = false;

// --- Axios Instance with Proxy (Increased Timeout) ---
const createAxiosProxy = () => {
    const config = {
        timeout: 20000 // 20 seconds default timeout
    };
    if (argv.proxyAddress && argv.proxyPort) {
        if (typeof argv.proxyAddress !== 'string' || typeof argv.proxyPort !== 'number') {
             console.error("Invalid proxy address or port provided.");
             return axios.create(config);
        }
        let proxyAuth = '';
        if (argv.username && argv.password) {
            proxyAuth = `${encodeURIComponent(argv.username)}:${encodeURIComponent(argv.password)}@`;
        }
        const proxyUrl = `http://${proxyAuth}${argv.proxyAddress}:${argv.proxyPort}`;
        console.log(`Using proxy: http://${argv.proxyAddress}:${argv.proxyPort} (auth hidden)`);
        try {
            config.httpsAgent = new proxy(proxyUrl);
            config.proxy = false;
        } catch (e) {
            console.error(`Error creating proxy agent for ${proxyUrl}: ${e.message}`);
        }
    }
    return axios.create(config);
};
const axiosProxy = createAxiosProxy();

// --- Default Headers & Tracker Specific Headers ---
const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
};

// RuTracker Cookies
const headers_RuTracker = {
    ...defaultHeaders,
    'Cookie': process.env.RUTRACKER_COOKIE || 'bb_session=YOUR_RUTRACKER_BB_SESSION_COOKIE' // REPLACE OR USE ENV
};

// Kinozal Cookies
const headers_Kinozal = {
    ...defaultHeaders,
    'Cookie': process.env.KINOZAL_COOKIE || 'uid=YOUR_KINOZAL_UID; pass=YOUR_KINOZAL_PASS' // REPLACE OR USE ENV
};

// Pornolab Cookies (Using bb_data and bb_t based on user input)
const headers_Pornolab = {
    ...defaultHeaders,
    'Cookie': process.env.PORNOLAB_COOKIE || 'bb_data=1-21895375-wWOFAC17X1BFkqY6LiPT-2502177517-1746028069-1746032217-2611168079-1; bb_t=a%3A4%3A%7Bi%3A3173008%3Bi%3A1746001097%3Bi%3A3178684%3Bi%3A1746032752%3Bi%3A3178704%3Bi%3A1746041867%3Bi%3A3178652%3Bi%3A1746023500%3B%7D' // REPLACE OR USE ENV
};

// --- Helper Functions ---

function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function getPage(page) {
     const pageNum = parseInt(page, 10);
     if (isNaN(pageNum) || pageNum < 0) return '0';
     return (pageNum * 50).toString();
}

function formatDate(dateString, type) {
    const months = {
        'Янв': '01', 'Фев': '02', 'Мар': '03', 'Апр': '04', 'Май': '05', 'Июн': '06',
        'Июл': '07', 'Авг': '08', 'Сен': '09', 'Окт': '10', 'Ноя': '11', 'Дек': '12'
    };
     if (!dateString || typeof dateString !== 'string') return dateString || '';

    const cleanedDateString = dateString.replace(/\s+/g, ' ').trim();
    const parts = cleanedDateString.split(type);

    if (parts.length === 3) {
        let day = parts[0].trim();
        const monthStr = parts[1].trim();
        let yearSuffix = parts[2].trim();

        yearSuffix = yearSuffix.length > 2 ? yearSuffix.slice(-2) : yearSuffix;
        if (!yearSuffix.match(/^\d{2}$/)) return dateString;

        const month = months[monthStr];
        if (!month) return dateString;

        const currentYearSuffix = parseInt(new Date().getFullYear().toString().slice(-2), 10);
        const year = (parseInt(yearSuffix, 10) <= currentYearSuffix + 1)
            ? '20' + yearSuffix : '19' + yearSuffix;

        if (day.length === 1) day = '0' + day;

        if (day.match(/^\d{2}$/)) {
            return `${day}.${month}.${year}`;
        }
    }
    return dateString;
}

function unixTimestamp(timestamp) {
    const tsNum = parseInt(timestamp, 10);
    if (isNaN(tsNum)) return timestamp;
    const date = new Date(tsNum * 1000);
    if (isNaN(date.getTime())) return timestamp;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function addTrackerList(infoHash, tracker) {
    if (!infoHash || typeof infoHash !== 'string' || infoHash.length < 40) return '';
    let magnetLink = `magnet:?xt=urn:btih:${infoHash}`;
    const trackerLists = {
        "RuTracker": ["http://retracker.local/announce", "http://bt.t-ru.org/ann", "http://bt2.t-ru.org/ann", "http://bt3.t-ru.org/ann", "http://bt4.t-ru.org/ann"],
        "Kinozal": ["http://retracker.local/announce", /* ... other kinozal trackers ... */ ],
        "RuTor": ["http://retracker.local/announce", "udp://opentor.net:6969", /* ... other rutor trackers ... */ ],
        "NoNameClub": ["http://retracker.local/announce", "http://bt01.nnm-club.info:2710/announce", /* ... other nnm trackers ... */ ],
        "Pornolab": ["http://retracker.local/announce", "http://bt01.nnm-club.info:2710/announce", "http://bt02.nnm-club.info:2710/announce", "http://bt01.nnm-club.cc:2710/announce", "http://bt02.nnm-club.cc:2710/announce"]
    };
    const trackers = trackerLists[tracker] || [];
    for (const tr of trackers) {
        magnetLink += "&tr=" + encodeURIComponent(tr);
    }
    return magnetLink;
}

// Safe replace function
const safeReplace = (str, pattern, replacement) => (str && typeof str === 'string') ? str.replace(pattern, replacement) : (str || '');


// --- Tracker Functions ---

// --- RuTracker Functions ---
async function RuTracker(query, categoryId, page) {
    // ... (RuTracker search code remains the same) ...
    if (query === 'undefined' || !query) query = '';
    const p = getPage(page);
    const urls = ['https://rutracker.org', 'https://rutracker.net', 'https://rutracker.nl'];
    let checkUrl = false, torrents = [], html, currentUrl;

    for (const url of urls) {
        const urlQuery = `${url}/forum/tracker.php?nm=${encodeURIComponent(query)}&f=${categoryId}&start=${p}`;
        currentUrl = url;
        try {
            const response = await axiosProxy.get(urlQuery, { responseType: 'arraybuffer', headers: headers_RuTracker });
            html = iconv.decode(response.data, 'win1251');
            checkUrl = true;
            console.log(`${getCurrentTime()} [Request] ${urlQuery}`);
            break;
        } catch (error) {
            const hostname = error.request?.host || error.hostname || url.split('/')[2] || 'RuTracker';
            console.error(`${getCurrentTime()} [ERROR] ${hostname} is unavailable (Code: ${error.code}). URL: ${urlQuery}`);
        }
    }
    if (!checkUrl) return { 'Result': `RuTracker server is not available` };

    const data = cheerio.load(html);
    data('table.forumline tbody tr').each((_, element) => {
        const $element = data(element);
        const topicLinkElement = $element.find('.row4 .wbr .med');
        const torrentLinkElement = $element.find('a.small.tr-dl.dl-stub');
        if (topicLinkElement.length > 0 && torrentLinkElement.length > 0) {
            const torrent = {
                'Name': topicLinkElement.text().trim(),
                'Id': topicLinkElement.attr('href')?.replace(/.+t=/g, ''),
                'Url': `${currentUrl}/forum/` + topicLinkElement.attr('href'),
                'Torrent': `${currentUrl}/forum/` + torrentLinkElement.attr('href'),
                'Size': torrentLinkElement.text().trim().split(' ').slice(0, 1).join(' '),
                'Download_Count': $element.find('td.row4.small.number-format').first().text().trim(),
                'Checked': $element.find('td.row1.t-ico').text().trim() === '√' ? 'True' : 'False',
                'Category': $element.find('.row1 .f-name .gen').text().trim(),
                'Seeds': $element.find('b.seedmed').text().trim(),
                'Peers': $element.find('.row4.leechmed.bold').text().trim(),
                'Date': formatDate($element.find('td.row4.small.tor-date p.small').text().trim().replace(/(\d{1,2}-[А-Яа-я]{3}-\d{2}).*/, '$1'), "-")
            };
            if (torrent.Id) torrents.push(torrent);
        }
    });
    if (torrents.length === 0) {
        const errorMessage = data('.maintitle.torTopic.NotResult').text().trim();
        if (errorMessage.includes('Не найдено ни одного ответа')) return { 'Result': 'No matches were found for your title on RuTracker' };
        console.warn(`${getCurrentTime()} [WARN] No torrents found on RuTracker page, but no explicit error message. Check page structure or cookies.`);
        return { 'Result': 'No matches were found (or error parsing RuTracker page)' };
    }
    return torrents;
}

async function RuTrackerAllPage(query, categoryId) {
    // ... (RuTrackerAllPage code remains the same) ...
    let result = [], page = 0, maxPages = 10, currentResult;
    while (page < maxPages) {
        currentResult = await RuTracker(query, categoryId, page);
        if (Array.isArray(currentResult)) {
            result.push(...currentResult);
            if (currentResult.length < 50) break;
            page++;
        } else {
            if (page === 0) return currentResult;
            break;
        }
    }
    if (result.length === 0 && page === 0 && !(currentResult && currentResult.Result)) return { 'Result': 'No matches were found for your title or error occurred on RuTracker' };
    return result;
}

async function RuTrackerID(query) {
    const baseUrl = 'https://rutracker.org';
    const url = `${baseUrl}/forum/viewtopic.php?t=${query}`;
    let html;
    try {
        const response = await axiosProxy.get(url, { responseType: 'arraybuffer', headers: headers_RuTracker });
        html = iconv.decode(response.data, 'win1251');
        console.log(`${getCurrentTime()} [Request] ${url}`);
    } catch (error) {
        const hostname = error.request?.host || error.hostname || baseUrl.split('/')[2] || 'RuTracker';
        console.error(`${getCurrentTime()} [ERROR] ${hostname} is unavailable (Code: ${error.code}) for ID: ${url}`);
        return { 'Result': `The ${hostname} server is not available or request failed for RuTracker ID ${query}` };
    }

    const data = cheerio.load(html);
    let Name = data('a#topic-title').text().trim();
    let Hash = data('a[href*="magnet:?xt=urn:btih:"]').attr('href')?.replace(/.+btih:|&.+/g, '');
    let Torrent = `${baseUrl}/forum/dl.php?t=${query}`;
    let imdb = "";
    let kp = "";

    data('a[href*="imdb.com"]').each((_, element) => { const href = data(element).attr('href'); if (href) { imdb = href; return false; } });
    data('a[href*="kinopoisk.ru"]').each((_, element) => { const href = data(element).attr('href'); if (href) { kp = href; return false; } });

    // --- Restore ORIGINAL IIFE logic for Rutracker Fields ---
     const getTextOrLinkTextSimple = (element) => {
        if (!element) return '';
        let nextNode = element.nextSibling;
        while (nextNode && nextNode.nodeType === 3 && !nextNode.nodeValue.trim()) { nextNode = nextNode.nextSibling; } // Skip whitespace
        if (!nextNode) return '';
        if (nextNode.nodeType === 3) return nextNode.nodeValue.trim().replace(/^:/, '').trim();
        if (nextNode.nodeType === 1 && nextNode.nodeName?.toLowerCase() === 'a') return data(nextNode).text().trim();
        // Try finding text in common formatting tags right after if plain text/link failed
        if (nextNode.nodeType === 1 && ['b', 'i', 'strong', 'em', 'span'].includes(nextNode.nodeName?.toLowerCase())) return data(nextNode).text().trim();
        return '';
    };
    const getMultiNodeText = (element) => { // For Description
       if (!element) return '';
       let content = ''; let nextNode = element.nextSibling;
       while (nextNode && nextNode.nodeType === 3 && !nextNode.nodeValue.trim().replace(/^:/, '').trim()) { nextNode = nextNode.nextSibling; }
       while (nextNode) {
           if (!nextNode) break; let stop = false;
           if (nextNode.nodeType === 1) {
               if (typeof nextNode.nodeName === 'string') {
                   const nl = nextNode.nodeName.toLowerCase();
                   if ((nl === 'span' && data(nextNode).hasClass('post-b')) || nl === 'div') { stop = true; }
                   else if (nl === 'br' || data(nextNode).hasClass('post-br')) { content += '\n'; }
                   else { content += data(nextNode).text(); } // Collect text from other inline elements
               }
           } else if (nextNode.nodeType === 3) { content += nextNode.nodeValue; }
           if (stop) break; nextNode = nextNode.nextSibling;
       } return content.replace(/^:/, '').replace(/\s+/g, ' ').trim();
    };

    const Year = (() => { const el = data('span.post-b:contains("Год выпуска:")')[0]; return getTextOrLinkTextSimple(el); })(); // Changed back to Год выпуска:
    const Release = (() => { const el = data('span.post-b:contains("Страна:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Type = (() => { const el = data('span.post-b:contains("Жанр:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Lang = (() => { const el = data('span.post-b:contains("Язык интерфейса:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Multiplayer = (() => { const el = data('span.post-b:contains("Мультиплеер:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Age = (() => { const el = data('span.post-b:contains("Возрастной рейтинг:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Voice = (() => { const el = data('span.post-b:contains("Озвучка:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Duration = (() => { const el = data('span.post-b:contains("Продолжительность:")')[0]; return getTextOrLinkTextSimple(el); })();
    const AudioLang = (() => { const el = data('span.post-b:contains("Перевод:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Directer = (() => { const el = data('span.post-b:contains("Режиссёр:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Actors = (() => { const el = data('span.post-b:contains("В ролях:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Description = (() => { const el = data('span.post-b:contains("Описание:")')[0]; return getMultiNodeText(el); })();
    const videoQuality = (() => { const el = data('span.post-b:contains("Качество:")')[0]; return getTextOrLinkTextSimple(el); })();
    const Video = (() => { const el = data('span.post-b:contains("Видео:")')[0]; return getTextOrLinkTextSimple(el); })();
    const AudioSpec = (() => { const el = data('span.post-b:contains("Аудио:")')[0]; return getTextOrLinkTextSimple(el); })();
    // --- End of Restored Logic ---

    let Poster = data('div.post_body').first().find('.postImg.postImgAligned.img-right').attr('title') || data('div.post_body').first().find('var.postImg').first().attr('title') || "";

    // File List
    let torrentFiles = [];
    const urlFiles = `${baseUrl}/forum/viewtorrent.php`;
    const postData = `t=${query}`;
    let fileListError = false;
    try {
        const responseFiles = await axiosProxy.post(urlFiles, postData, { responseType: 'arraybuffer', headers: { ...headers_RuTracker, 'Content-Type': 'application/x-www-form-urlencoded' } });
        const htmlFiles = iconv.decode(responseFiles.data, 'win1251');
        console.log(`${getCurrentTime()} [Request] ${urlFiles} (RuTracker Files) with ID ${query}`);
        const dataFiles = cheerio.load(htmlFiles);
        dataFiles('li.file').each((_, element) => {
             const $li = dataFiles(element);
             const fileName = $li.find('b').first().text().trim();
             const fileSize = $li.find('i').first().text().trim().replace(/[\(\)]/g, '');
             if (fileName) {
                 torrentFiles.push({ Name: fileName, Size: fileSize });
             }
        });
        if (torrentFiles.length === 0) {
             console.warn(`[WARN] RuTracker file list parsing resulted in empty list for ID ${query} (using li.file selector).`);
             const errorMsg = dataFiles('td.row1[align="center"]').text();
             if (errorMsg && !errorMsg.includes('Список файлов')) {
                 console.error(`[ERROR] Error message found on viewtorrent.php: ${errorMsg}`);
                 fileListError = true;
             }
        }
    } catch (error) {
        fileListError = true;
        const hostname = error.request?.host || error.hostname || urlFiles.split('/')[2] || 'RuTracker';
        console.error(`${getCurrentTime()} [ERROR] Failed to get RuTracker file list from ${hostname} (Code: ${error.code})`);
    }
    if (fileListError && torrentFiles.length === 0) {
        torrentFiles.push({ Name: 'Failed to retrieve file list (check cookies/permissions)', Size: '' });
    }

    // Restore original .replace() calls with safety checks
    return [{
        Name: Name,
        Url: url,
        Hash: Hash || '',
        Magnet: Hash ? addTrackerList(Hash,"RuTracker") : '',
        Torrent: Torrent,
        IMDb_link: imdb,
        Kinopoisk_link: kp,
        IMDb_id: imdb.replace(/[^0-9]/g, ''),
        Kinopoisk_id: kp.replace(/[^0-9]/g, ''),
        Year: safeReplace(Year, /^:\s*/, ''),
        Release: safeReplace(Release, /^:\s*/, ''),
        Type: safeReplace(Type, /^:\s*/, ''),
        Voice: safeReplace(Voice, /^:\s*/, ''),
        Lang: safeReplace(Lang, /^:\s*/, ''),
        Age: safeReplace(Age, /^:\s*/, ''),
        Multiplayer: safeReplace(Multiplayer, /^:\s*/, ''),
        Duration: safeReplace(Duration, /^:\s*/, '').replace(/~ |~/g, ''),
        Audio: safeReplace(AudioLang, /^:\s*/, ''),
        Directer: safeReplace(Directer, /^:\s*/, ''),
        Actors: safeReplace(Actors, /^:\s*/, ''),
        Description: Description, // Keep raw Description
        Quality: safeReplace(videoQuality, /^:\s*/, ''),
        Video: safeReplace(Video, /^:\s*/, ''),
        AudioSpec: safeReplace(AudioSpec, /^:\s*/, ''),
        Poster: Poster,
        Files: torrentFiles
    }];
}


async function RuTrackerRSS(typeData, categoryId) {
    // !!! USER MUST PASTE THE RuTrackerRSS FUNCTION CODE HERE !!!
    // RuTracker RSS Native - Implementation from original code
    const url = `https://feed.rutracker.cc/atom/f/${categoryId}.atom`;
    console.log(`${getCurrentTime()} [Request] ${url}`);
    try {
        const response = await axiosProxy.get(url, {
            headers: defaultHeaders // Use default headers, RSS usually doesn't need auth
        });
        if (typeData === "json") {
            const parser = new xml2js.Parser({
                mergeAttrs: true,
                explicitArray: false,
                ignoreAttrs: false, // Keep attributes like href in links
                tagNameProcessors: [xml2js.processors.stripPrefix] // Remove prefixes like feed: entry:
            });
            let jsonResult = await parser.parseStringPromise(response.data);

            // Atom feed structure is slightly different, entries are in feed.entry
            if (jsonResult.feed && jsonResult.feed.entry) {
                jsonResult = jsonResult.feed.entry.map(item => ({
                    id: item.id,
                    link: item.link?.href || item.link, // Link might be object or string
                    updated: item.updated,
                    title: (typeof item.title === 'object' ? item.title._ : item.title) || '', // Handle potential object title
                    author: item.author?.name || '', // Safely access author name
                    category: item.category?.term || '', // Safely access category term
                    categoryLabel: item.category?.label || '' // Safely access category label
                }));
                 return jsonResult;
            } else {
                 console.error("Invalid Atom feed structure received from RuTracker RSS");
                 return { Result: "Error parsing RuTracker RSS feed structure" };
            }
        } else {
            // For XML, return the raw response data
            return response.data;
        }
    } catch (error) {
        const hostname = error.request?.host || error.hostname || url.split('/')[2] || 'feed.rutracker.cc';
        console.error(`${getCurrentTime()} [ERROR] ${hostname} server is not available (Code: ${error.code}) for RSS feed: ${url}`);
        // Return appropriate error format
        if (typeData === "json") {
             return { 'Result': `RuTracker RSS Server is not available or error occurred` };
        } else {
             return `<error>Result: RuTracker RSS Server is not available or error occurred</error>`;
        }
    }
}


// --- Kinozal Functions ---
async function Kinozal(query, categoryId, page, year, format) {
    // !!! USER MUST PASTE THE Kinozal FUNCTION CODE HERE !!!
    console.warn("Kinozal function is not implemented in this provided code.");
    return { Result: "Kinozal function not implemented" };
}
async function KinozalAllPage(query, categoryId, year, format) {
     // !!! USER MUST PASTE THE KinozalAllPage FUNCTION CODE HERE !!!
     console.warn("KinozalAllPage function is not implemented in this provided code.");
     return { Result: "KinozalAllPage function not implemented" };
}
async function KinozalID(query) {
     // !!! USER MUST PASTE THE KinozalID FUNCTION CODE HERE !!!
     console.warn("KinozalID function is not implemented in this provided code.");
     return { Result: "KinozalID function not implemented" };
}
async function KinozalRssCustom(typeData, categoryId, year, format) {
     // !!! USER MUST PASTE THE KinozalRssCustom FUNCTION CODE HERE !!!
     console.warn("KinozalRssCustom function is not implemented in this provided code.");
     return { Result: "KinozalRssCustom function not implemented" };
}
async function KinozalRSS(typeData) {
     // !!! USER MUST PASTE THE KinozalRSS FUNCTION CODE HERE !!!
     console.warn("KinozalRSS function is not implemented in this provided code.");
     return { Result: "KinozalRSS function not implemented" };
}

// --- RuTor Functions ---
async function RuTor(query, categoryId, page) {
    // !!! USER MUST PASTE THE RuTor FUNCTION CODE HERE !!!
    console.warn("RuTor function is not implemented in this provided code.");
    return { Result: "RuTor function not implemented" };
}
async function RuTorAllPage(query, categoryId) {
     // !!! USER MUST PASTE THE RuTorAllPage FUNCTION CODE HERE !!!
     console.warn("RuTorAllPage function is not implemented in this provided code.");
     return { Result: "RuTorAllPage function not implemented" };
}
async function RuTorID(query) {
     // !!! USER MUST PASTE THE RuTorID FUNCTION CODE HERE !!!
     console.warn("RuTorID function is not implemented in this provided code.");
     return { Result: "RuTorID function not implemented" };
}
async function RuTorRssCustom(typeData, categoryId) {
     // !!! USER MUST PASTE THE RuTorRssCustom FUNCTION CODE HERE !!!
     console.warn("RuTorRssCustom function is not implemented in this provided code.");
     return { Result: "RuTorRssCustom function not implemented" };
}
async function RuTorRSS(typeData, categoryId) {
     // !!! USER MUST PASTE THE RuTorRSS FUNCTION CODE HERE !!!
     console.warn("RuTorRSS function is not implemented in this provided code.");
     return { Result: "RuTorRSS function not implemented" };
}

// --- NoNameClub Functions ---
async function NoNameClub(query, categoryId, page) {
    // !!! USER MUST PASTE THE NoNameClub FUNCTION CODE HERE !!!
    console.warn("NoNameClub function is not implemented in this provided code.");
    return { Result: "NoNameClub function not implemented" };
}
async function NoNameClubAllPage(query, categoryId) {
     // !!! USER MUST PASTE THE NoNameClubAllPage FUNCTION CODE HERE !!!
     console.warn("NoNameClubAllPage function is not implemented in this provided code.");
     return { Result: "NoNameClubAllPage function not implemented" };
}
async function NoNameClubID(query) {
     // !!! USER MUST PASTE THE NoNameClubID FUNCTION CODE HERE !!!
     console.warn("NoNameClubID function is not implemented in this provided code.");
     return { Result: "NoNameClubID function not implemented" };
}
async function NoNameClubRSS(typeData, categoryId) {
     // !!! USER MUST PASTE THE NoNameClubRSS FUNCTION CODE HERE !!!
     console.warn("NoNameClubRSS function is not implemented in this provided code.");
     return { Result: "NoNameClubRSS function not implemented" };
}

// --- FastsTorrent Function ---
async function FastsTorrent(query) {
     // !!! USER MUST PASTE THE FastsTorrent FUNCTION CODE HERE !!!
     console.warn("FastsTorrent function is not implemented in this provided code.");
     return { Result: "FastsTorrent function not implemented" };
}


// --- Pornolab Functions (Using strict getData_Pornolab v10 + Stats) ---

const pornolabBaseUrl = 'https://pornolab.net';

async function Pornolab(query, categoryId, page) {
    if (query === 'undefined' || !query) query = '';
    const p = getPage(page);
    const urlQuery = `${pornolabBaseUrl}/forum/tracker.php?nm=${encodeURIComponent(query)}&f=${categoryId}&start=${p}`;
    const torrents = [];
    let html;
    try {
        const response = await axiosProxy.get(urlQuery, { responseType: 'arraybuffer', headers: headers_Pornolab });
        html = iconv.decode(response.data, 'win1251');
        console.log(`${getCurrentTime()} [Request] ${urlQuery}`);
    } catch (error) {
        const hostname = error.request?.host || error.hostname || pornolabBaseUrl.split('/')[2] || 'Pornolab';
        console.error(`${getCurrentTime()} [ERROR] ${hostname} is unavailable (Code: ${error.code}). URL: ${urlQuery}`);
        if (error.response) console.error(`Pornolab Response Status: ${error.response.status}, Data: ${iconv.decode(Buffer.from(error.response.data || ''),'win1251').slice(0, 500)}...`);
        return { 'Result': `Pornolab server is not available or request failed` };
    }

    const data = cheerio.load(html);
    data('table.forumline tbody tr').each((_, element) => {
        const $element = data(element);
        const topicLinkElement = $element.find('.med.tLink.bold');
        const torrentLinkElement = $element.find('a.small.tr-dl.dl-stub');
        if (topicLinkElement.length > 0 && torrentLinkElement.length > 0) {
            const torrent = {
                'Name': topicLinkElement.text().trim(),
                'Id': topicLinkElement.attr('href')?.replace(/.+t=/g, ''),
                'Url': `${pornolabBaseUrl}/forum/` + topicLinkElement.attr('href'),
                'Torrent': `${pornolabBaseUrl}/forum/` + torrentLinkElement.attr('href'),
                'Size': torrentLinkElement.text().trim().split(' ').slice(0, 1).join(' '),
                'Download_Count': $element.find('td.row4.small.number-format.tdDown').text().trim(),
                'Checked': $element.find('td.row1.t-ico').text().trim() === '√' ? 'True' : 'False',
                'Category': $element.find('.row1 .f-name .gen').text().trim(),
                'Seeds': $element.find('b.seedmed').text().trim(),
                'Peers': $element.find('.leechmed').text().trim(),
                'Date': formatDate($element.find('td.row4.small.tor-date p.small').text().trim().replace(/(\d{1,2}-[А-Яа-я]{3}-\d{2}).*/, '$1'), "-")
            };
            if (torrent.Id) torrents.push(torrent);
        }
    });

    if (torrents.length === 0) {
        const errorMessage = data('p.med.bold:contains("Не найдено ни одного ответа")').text().trim() || data('.maintitle.torTopic.NotResult').text().trim();
        if (errorMessage) return { 'Result': 'No matches were found for your title on Pornolab' };
        console.warn(`${getCurrentTime()} [WARN] No torrents found on Pornolab page, but no explicit error message. Check page structure or cookies. URL: ${urlQuery}`);
        return { 'Result': 'No matches were found (or error parsing Pornolab page)' };
    }
    return torrents;
}

async function PornolabAllPage(query, categoryId) {
    let result = [], page = 0, maxPages = 10, currentResult;
    while (page < maxPages) {
        currentResult = await Pornolab(query, categoryId, page);
        if (Array.isArray(currentResult)) {
            result.push(...currentResult);
            if (currentResult.length < 50) break;
            page++;
        } else {
            if (page === 0) return currentResult;
            break;
        }
    }
    if (result.length === 0 && page === 0 && !(currentResult && currentResult.Result)) {
        return { 'Result': 'No matches were found for your title on Pornolab' };
    }
    return result;
}

async function PornolabID(query) {
    const url = `${pornolabBaseUrl}/forum/viewtopic.php?t=${query}`;
    let html;
    try {
        const response = await axiosProxy.get(url, { responseType: 'arraybuffer', headers: headers_Pornolab });
        html = iconv.decode(response.data, 'win1251');
        console.log(`${getCurrentTime()} [Request] ${url}`);
    } catch (error) {
        const hostname = error.request?.host || error.hostname || pornolabBaseUrl.split('/')[2] || 'Pornolab';
        console.error(`${getCurrentTime()} [ERROR] ${hostname} is unavailable (Code: ${error.code}) for ID: ${url}`);
        if (error.response) console.error(`Pornolab Response Status: ${error.response.status}`);
        return { 'Result': `Pornolab server is not available or request failed for ID ${query}` };
    }

    const data = cheerio.load(html);
    let Name = data('h1#topic-title').text().trim() ||
               data('body > div.wrap > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > table:nth-child(2) > tbody > tr > td:nth-child(1) > h1 > a').text().trim() ||
               data('title').text().split(' :: ')[0] ||
               `Topic ${query}`;

    let Torrent = '', attachId = '';
    const torrentLinkElement = data('a.dl-stub.dl-link[href*="dl.php?t="]');
    if (torrentLinkElement.length > 0) {
        const torrentHref = torrentLinkElement.attr('href');
        if (torrentHref) {
             Torrent = `${pornolabBaseUrl}/forum/${torrentHref}`;
             attachId = torrentHref.match(/t=(\d+)/)?.[1];
             console.log(`${getCurrentTime()} [Debug] Found attachId ${attachId} from dl.php link for ${query}`);
        }
    } else {
         console.warn(`${getCurrentTime()} [WARN] Could not find dl.php torrent link for Pornolab ID ${query}. File list might be unavailable.`);
    }

    let Hash = data('a[href*="magnet:?xt=urn:btih:"]').attr('href')?.replace(/.+btih:|&.+/g, '');
    if (!Hash) console.log(`${getCurrentTime()} [Debug] Magnet link not found directly in HTML for Pornolab ID ${query}. Hash will be empty.`);

    let imdb = data('a[href*="imdb.com"]').first().attr('href') || "";
    let kp = data('a[href*="kinopoisk.ru"]').first().attr('href') || "";

    // Use SPECIFIC getData function for Pornolab (v10 - strict stop)
    const getDataFromPostBody_Pornolab = (fieldName) => {
        const postBody = data('div.post_body').first();
        const element = postBody.find(`span.post-b:contains("${fieldName}")`)[0];
        if (element) {
            let content = '';
            let nextNode = element.nextSibling;
            // Skip initial whitespace/colon text nodes
            while (nextNode && nextNode.nodeType === 3 && !nextNode.nodeValue.trim().replace(/^:/, '').trim()) {
                nextNode = nextNode.nextSibling;
            }
            // Check the very next *significant* node ONLY
            if (nextNode) {
                if (nextNode.nodeType === 3) { // Text node
                    content = nextNode.nodeValue;
                } else if (nextNode.nodeType === 1) { // Element node
                    if (typeof nextNode.nodeName === 'string') {
                        const nodeNameLower = nextNode.nodeName.toLowerCase();
                        // Stop if it's a block or the next field header
                        if (nodeNameLower === 'br' || (nodeNameLower === 'span' && data(nextNode).hasClass('post-b')) || nodeNameLower === 'div') {
                            // Stop, content remains empty
                        } else if (['a', 'b', 'i', 'strong', 'em', 'span'].includes(nodeNameLower)) {
                           content = data(nextNode).text();
                        }
                    }
                }
            }
            return content.replace(/^:/, '').replace(/\s+/g, ' ').trim();
        } return '';
    };

    const Actors = getDataFromPostBody_Pornolab('В ролях');
    const ClipTitle = getDataFromPostBody_Pornolab('Название ролика');
    const SiteInfo = getDataFromPostBody_Pornolab('Подсайт и сайт');
    const ReleaseDateRaw = getDataFromPostBody_Pornolab('Дата производства');
    const Type = getDataFromPostBody_Pornolab('Жанр');
    const Duration = getDataFromPostBody_Pornolab('Продолжительность');
    const VideoType = getDataFromPostBody_Pornolab('Тип видео');
    const Quality = getDataFromPostBody_Pornolab('Качество видео');
    const Video3DType = getDataFromPostBody_Pornolab('Тип 3D');
    const VRDeviceType = getDataFromPostBody_Pornolab('Тип устройства');
    const VideoFormat = getDataFromPostBody_Pornolab('Формат видео');
    const Video = getDataFromPostBody_Pornolab('Видео');
    const Audio = getDataFromPostBody_Pornolab('Аудио');
    const Description = getDataFromPostBody_Pornolab('Описание');
    const AdditionalInfoLink = data('div.post_body').first().find('span.post-b:contains("Доп. информация")').next('a.postLink').attr('href');
    const Directer = getDataFromPostBody_Pornolab('Режиссер:') || getDataFromPostBody_Pornolab('Режиссёр:');

    let Poster = data('div.post_body').first().find('.postImg.postImgAligned.img-right').attr('title') || data('div.post_body').first().find('var.postImg').first().attr('title') || "";

    // --- ADD Pornolab Stats Parsing (Refined Table Selector) ---
    let Size = "";
    let Seeds = "";
    let Peers = "";
    // Find the stats table by looking for the 'td' containing 'Размер:'
    const statsTd = data('td.borderless.bCenter:contains("Размер:")'); // Find the cell containing "Размер:" text
    if (statsTd.length > 0) {
        // Extract Size from the bold tag within the same cell
        Size = statsTd.find('b').first().text().trim();

        // Find the next sibling row (tr) which contains seeds/peers info
        const peerRow = statsTd.parent('tr').nextAll('tr:has(span.seed)').first(); // Find the next row containing span.seed
        if (peerRow.length > 0) {
            Seeds = peerRow.find('span.seed b').first().text().trim();
            Peers = peerRow.find('b.leech b').first().text().trim(); // Inner <b> for peers
        } else {
            console.warn(`[WARN] Peer row (containing span.seed) not found after size row for Pornolab ID ${query}`);
        }
    } else {
        console.warn(`[WARN] Statistics cell ('Размер:') not found for Pornolab ID ${query}`);
    }
    // --- End of Pornolab Stats Parsing ---


    // File List - Disabled for Pornolab
    let torrentFiles = [];
    console.log(`${getCurrentTime()} [Info] File list retrieval is disabled for Pornolab as it uses a different mechanism.`);
    torrentFiles.push({ Name: 'File list not automatically retrieved for this provider', Size: '' });

    // Add stats to the return object
    return [{
        Name, Url: url, Hash: Hash || '', Magnet: Hash ? addTrackerList(Hash, "Pornolab") : '', Torrent,
        IMDb_link: imdb, Kinopoisk_link: kp, IMDb_id: imdb.replace(/[^0-9]/g, ''), Kinopoisk_id: kp.replace(/[^0-9]/g, ''),
        ClipTitle, SiteInfo, ReleaseDate: ReleaseDateRaw, Type, Actors, Description, Duration, Quality, VideoType, VideoFormat,
        Video3DType, VRDeviceType, Video, Audio, AdditionalInfoLink: AdditionalInfoLink || '', Directer, Poster,
        Size: Size || '', // Add parsed Size
        Seeds: Seeds || '', // Add parsed Seeds
        Peers: Peers || '', // Add parsed Peers
        Files: torrentFiles
    }];
}


// --- Provider List & Test Function ---
const providerList = [
    { "Provider": "RuTracker", "Urls": [ "https://rutracker.org", "https://rutracker.net", "https://rutracker.nl" ] },
    { "Provider": "Kinozal", "Urls": [ "https://kinozal.tv", "https://kinozal.me", "https://kinozal.guru" ] },
    { "Provider": "RuTor", "Urls": [ "https://rutor.info", "https://rutor.is" ] },
    { "Provider": "NoNameClub", "Urls": [ "https://nnmclub.to" ] },
    { "Provider": "Pornolab", "Urls": [ "https://pornolab.net" ] }
];

// Test API Endpoints
async function testEndpoints(query) {
    // !!! USER MUST PASTE THE FULL testEndpoints FUNCTION IMPLEMENTATION HERE !!!
    console.warn("testEndpoints function needs to be fully implemented or pasted from previous response.");
    let testQueryGeneral = query || "Test Query General";
    let testQueryPornolab = query || "Test Query Adult";
    console.log(`[Test] Using queries: "${testQueryGeneral}" and "${testQueryPornolab}"`);
    const results = { Title: { Status: {}, Id: {}, RunTime: {} }, Id: { Status: {}, Files: {}, RunTime: {} }, RSS: {} };
     try {
         const rtTitleRes = await RuTracker(testQueryGeneral, 0, 0);
         results.Title.Status.RuTracker = Array.isArray(rtTitleRes) && rtTitleRes.length > 0 && rtTitleRes[0].Id;
         if (results.Title.Status.RuTracker) { const rtId = rtTitleRes[0].Id; results.Title.Id.RuTracker = parseInt(rtId, 10); const rtIdRes = await RuTrackerID(rtId); results.Id.Status.RuTracker = Array.isArray(rtIdRes) && rtIdRes.length > 0 && rtIdRes[0].Torrent; results.Id.Files.RuTracker = results.Id.Status.RuTracker && rtIdRes[0].Files.length > 0 && !rtIdRes[0].Files[0].Name.includes('Failed'); }
     } catch (e) { console.error(`[Test Error RuTracker]: ${e.message}`); results.Title.Status.RuTracker=false; results.Id.Status.RuTracker=false; }
      try {
         const plTitleRes = await Pornolab(testQueryPornolab, 0, 0);
         results.Title.Status.Pornolab = Array.isArray(plTitleRes) && plTitleRes.length > 0 && plTitleRes[0].Id;
         if (results.Title.Status.Pornolab) { const plId = plTitleRes[0].Id; results.Title.Id.Pornolab = parseInt(plId, 10); const plIdRes = await PornolabID(plId); results.Id.Status.Pornolab = Array.isArray(plIdRes) && plIdRes.length > 0 && plIdRes[0].Torrent; results.Id.Files.Pornolab = results.Id.Status.Pornolab && plIdRes[0].Files.length > 0 && !plIdRes[0].Files[0].Name.includes('not automatically retrieved'); }
      } catch (e) { console.error(`[Test Error Pornolab]: ${e.message}`); results.Title.Status.Pornolab=false; results.Id.Status.Pornolab=false; }
    // Add tests for other providers and RSS here
    return [results];
}


// --- Express App Setup ---
const web = express();

// CORS Middleware
web.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// --- Swagger Setup ---
const swaggerDefinitionFile = path.join(__dirname, 'swagger', 'swagger.js');
let swaggerSpec;
if (fs.existsSync(swaggerDefinitionFile)) {
    const options = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'TorAPI (Multi-Tracker API)', version: '0.7.6', // Increment version
                description: 'Unofficial API for RuTracker, Kinozal, RuTor, NoNameClub, and Pornolab',
                contact: { name: "© Lifailon (Alex Kup)", url: "https://github.com/Lifailon/TorAPI" },
                license: { name: "License MIT", url: "https://github.com/Lifailon/TorAPI/blob/main/LICENSE" }
            },
            servers: [ { url: `http://localhost:${argv.port}`, description: 'Local server' }, /* ... other servers ... */ ]
        },
        apis: [swaggerDefinitionFile]
    };
    try {
        swaggerSpec = swaggerJsdoc(options);
        web.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
        console.log(`Swagger Docs available at http://localhost:${argv.port}/docs`);
    } catch (e) {
        console.error(`Error generating Swagger spec: ${e}`);
        web.use('/docs', (req, res) => res.status(500).send('Error loading Swagger documentation.'));
    }
} else {
    console.warn(`Swagger definition file not found at ${swaggerDefinitionFile}. Docs endpoint /docs will be disabled.`);
    web.use('/docs', (req, res) => res.status(404).send('Swagger documentation file not found.'));
}


// --- Main Route Handler ---
web.all('/:api?/:category?/:type?/:provider?', async (req, res) => {
    // 1. Validate Method
    if (req.method.toUpperCase() !== 'GET') {
        console.log(`${getCurrentTime()} [${req.method}] ${req.ip.replace('::ffff:', '')} (...) [405] Method not allowed. Endpoint: ${req.path}`);
        return res.status(405).send(`Method ${req.method} not allowed`);
    }

    // 2. Extract and Validate Path Parameters
    const { api, category: categoryParam, type: typeParam, provider: providerParam } = req.params;

    if (api !== 'api') {
        console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [404] Invalid base path. Endpoint: ${req.path}`);
        return res.status(404).send('Endpoint not found. Base path must be /api/');
    }

    const category = categoryParam?.toLowerCase();
    const type = typeParam?.toLowerCase();
    const provider = providerParam?.toLowerCase();

    // 3. Handle /api/provider routes
    if (category === 'provider') {
        if (type === 'list') {
            console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [200] Endpoint: ${req.path}`);
            return res.json(providerList);
        }
        if (type === 'test') {
            console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [200] Endpoint: ${req.path}`);
            try {
                if (typeof testEndpoints !== 'function') throw new Error("testEndpoints function is not defined");
                const result = await testEndpoints(req.query.query);
                return res.json(result);
            } catch (error) {
                console.error("Error during provider test:", error);
                return res.status(500).json({ Result: 'Error running provider tests' });
            }
        }
         console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [404] Invalid provider type. Endpoint: ${req.path}`);
         return res.status(404).send('Invalid provider endpoint type (must be list or test)');
    }

    // 4. Validate Category/Type/Provider for main routes
    const validCategories = ['get', 'search'];
    const validTypesForGet = ['category', 'rss'];
    const validTypesForSearch = ['title', 'id'];

    if (!category || !validCategories.includes(category)) {
        console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [404] Invalid category. Endpoint: ${req.path}`);
        return res.status(404).send('Invalid category (must be get or search)');
    }
    if (!type || (category === 'get' && !validTypesForGet.includes(type)) || (category === 'search' && !validTypesForSearch.includes(type))) {
        console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [404] Invalid type for category. Endpoint: ${req.path}`);
        return res.status(404).send(`Invalid type "${typeParam || 'undefined'}" for category "${category}"`);
    }
    if (!provider) {
        console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [404] Missing provider. Endpoint: ${req.path}`);
        return res.status(404).send('Provider not specified');
    }
     const knownProviders = providerList.map(p => p.Provider.toLowerCase());
     if (provider !== 'all' && !knownProviders.includes(provider)) {
         console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (...) [404] Unknown provider. Endpoint: ${req.path}`);
         return res.status(404).send(`Unknown provider: ${providerParam}`);
     }

    // 5. Extract and Sanitize Query Parameters
    let query = req.query.query || '';
    let categoryId = req.query.category || '0';
    let page = req.query.page || '0';
    let year = req.query.year || '0';
    let format = req.query.format || '0';

    if (page !== 'all' && (isNaN(parseInt(page, 10)) || parseInt(page, 10) < 0)) page = '0';
    if (!/^\d+$/.test(categoryId)) categoryId = '0';
    if (!/^(0|\d{4})$/.test(year)) year = '0';
    const formatMap = { '720': 3002, '1080': 3001, '2160': 7 };
    format = formatMap[format] || (Number.isInteger(parseInt(format, 10)) ? format : '0');

    // 6. Validate categoryId against the list
    if (categoryId !== '0' && provider !== 'all') {
        let catKey = providerList.find(p => p.Provider.toLowerCase() === provider)?.Provider;
        if (!catKey || !categoryList[catKey] || !categoryList[catKey][categoryId]) {
            console.log(`${getCurrentTime()} [WARN] Invalid category ID ${categoryId} for provider ${provider}. Resetting to 0.`);
            categoryId = '0';
        }
    }

    // 7. Log the processed request
    const decodedQuery = decodeURIComponent(query || '').replace(/\+/g, ' ');
    const userAgentShort = req.headers['user-agent'] ? req.headers['user-agent'].slice(0, 50) + '...' : 'N/A';
    console.log(`${getCurrentTime()} [GET] ${req.ip.replace('::ffff:', '')} (${userAgentShort}) [200] Path: ${req.path}, Provider: ${provider}, Type: ${type}, Query: "${decodedQuery}", Cat: ${categoryId}, Page: ${page}`);

    // 8. Route to appropriate handler function
    try {
        let result = { Result: `Handler not found for ${category}/${type}/${provider}` };
        let contentType = 'application/json';
        let functionToCall = null;
        let args = [];
        let providerImplMissing = false;

        // --- Determine Function and Arguments ---
        if (category === 'get') {
            if (type === 'category') {
                let catKey = providerList.find(p => p.Provider.toLowerCase() === provider)?.Provider;
                if (catKey && categoryList[catKey]) {
                    result = [categoryList[catKey]];
                     res.set('Content-Type', contentType).send(result);
                     return;
                } else {
                    result = { Result: `Provider ${provider} not found or categories unavailable` };
                    res.status(404);
                }
            } else if (type === 'rss') {
                const requestedType = (req.get('Accept') || '').includes('json') ? 'json' : 'xml';
                contentType = requestedType === 'json' ? 'application/json' : 'application/xml';
                args = [requestedType, categoryId];
                if (provider === 'rutracker') functionToCall = RuTrackerRSS;
                else if (provider === 'kinozal') { functionToCall = KinozalRssCustom; args.push(year, format); }
                else if (provider === 'rutor') functionToCall = RuTorRssCustom;
                else if (provider === 'nonameclub') functionToCall = NoNameClubRSS;
                else { result = { Result: `RSS feed not available for provider ${provider}` }; res.status(404); }

                if (functionToCall && typeof functionToCall !== 'function') functionToCall = null;
                if (!functionToCall && !res.headersSent && res.statusCode !== 404) {
                     providerImplMissing = true;
                     result = { Result: `RSS function for ${provider} is not implemented` };
                     res.status(501);
                     functionToCall = null;
                }
            }
        } else if (category === 'search') {
            const isAllPages = page === 'all';
            if (type === 'title') {
                args = [query, categoryId, page];
                if (provider === 'rutracker') functionToCall = isAllPages ? RuTrackerAllPage : RuTracker;
                else if (provider === 'kinozal') { functionToCall = isAllPages ? KinozalAllPage : Kinozal; args.push(year, format); }
                else if (provider === 'rutor') functionToCall = isAllPages ? RuTorAllPage : RuTor;
                else if (provider === 'nonameclub') functionToCall = isAllPages ? NoNameClubAllPage : NoNameClub;
                else if (provider === 'pornolab') functionToCall = isAllPages ? PornolabAllPage : Pornolab;
                else if (provider === 'faststorrent') { functionToCall = FastsTorrent; args = [query]; }
                else if (provider === 'all') {
                    // --- Handle 'all' provider search ---
                    const allProviderFunctions = { RuTracker, Kinozal, RuTor, NoNameClub, Pornolab };
                    const allProviderFunctionsAllPage = { RuTrackerAllPage, KinozalAllPage, RuTorAllPage, NoNameClubAllPage, PornolabAllPage };
                    const providerKeys = ["RuTracker", "Kinozal", "RuTor", "NoNameClub", "Pornolab"];
                    const promises = providerKeys.map(key => {
                        const func = isAllPages ? allProviderFunctionsAllPage[key] : allProviderFunctions[key];
                        const providerArgs = (key === 'Kinozal') ? [query, categoryId, page, year, format] : [query, categoryId, page];
                        if (isAllPages) providerArgs.pop();
                        if (typeof func !== 'function') {
                             console.warn(`[WARN] Function ${key} (Page: ${isAllPages?'all':page}) is not defined for 'all' search.`);
                             return Promise.resolve({ Result: `Function ${key} not implemented` });
                        }
                         return Promise.resolve().then(() => func(...providerArgs)).catch(err => ({ Result: `Error executing ${key}: ${err.message}` }));
                    });

                    const resultsArray = await Promise.allSettled(promises);
                    result = {};
                    resultsArray.forEach((res, index) => {
                         const key = providerKeys[index];
                         result[key] = res.status === 'fulfilled' ? res.value : { Result: `Error: ${res.reason?.Result || res.reason?.message || 'Failed'}` };
                    });
                      res.set('Content-Type', contentType).send(result);
                      return;
                 }
                 else { result = { Result: `Provider ${provider} not found or does not support title search` }; res.status(404); }

                 if (isAllPages || provider === 'faststorrent') args.pop();
                 if (provider !== 'kinozal' && provider !== 'all') args = args.slice(0, provider === 'faststorrent' ? 1 : 3);

                 if (functionToCall && typeof functionToCall !== 'function') functionToCall = null;
                 if (!functionToCall && !res.headersSent && res.statusCode !== 404) {
                      providerImplMissing = true;
                      result = { Result: `Title search function for ${provider} is not implemented` };
                      res.status(501);
                      functionToCall = null;
                 }

            } else if (type === 'id') {
                if (!query) { result = { Result: 'Missing torrent ID in query parameter' }; res.status(400); }
                else {
                    args = [query];
                    if (provider === 'rutracker') functionToCall = RuTrackerID;
                    else if (provider === 'kinozal') functionToCall = KinozalID;
                    else if (provider === 'rutor') functionToCall = RuTorID;
                    else if (provider === 'nonameclub') functionToCall = NoNameClubID;
                    else if (provider === 'pornolab') functionToCall = PornolabID;
                    else { result = { Result: `Provider ${provider} not found or does not support ID search` }; res.status(404); }

                    if (functionToCall && typeof functionToCall !== 'function') functionToCall = null;
                    if (!functionToCall && !res.headersSent && res.statusCode !== 404) {
                        providerImplMissing = true;
                        result = { Result: `ID search function for ${provider} is not implemented` };
                        res.status(501);
                        functionToCall = null;
                    }
                }
            }
        }

        // --- Execute Function and Send Response ---
        if (functionToCall && typeof functionToCall === 'function' && !providerImplMissing) {
            result = await functionToCall(...args);
        }

        // Set status based on result content only if status hasn't been set yet
        if (res.statusCode === 200) {
            if (typeof result === 'object' && result !== null && result.Result) {
                 if (result.Result.toLowerCase().includes('error') || result.Result.toLowerCase().includes('unavailable') || result.Result.toLowerCase().includes('failed')) res.status(503);
                 else if (result.Result.toLowerCase().includes('not found') || result.Result.toLowerCase().includes('no matches')) res.status(404);
                 else if (result.Result.toLowerCase().includes('not implemented')) res.status(501);
            } else if (Array.isArray(result) && result.length === 0) {
                 result = { Result: "No matches found" };
                 res.status(404);
            } else if (!result) {
                 console.warn(`[WARN] Handler for ${req.path} returned null or undefined.`);
                 result = { Result: "Internal processing error: Empty result" };
                 res.status(500);
            }
        }

        if (!res.headersSent) {
            res.set('Content-Type', contentType);
            res.send(result);
        } else {
             console.warn(`[WARN] Headers already sent for ${req.path}, cannot send final result.`);
        }

    } catch (error) {
        console.error(`${getCurrentTime()} [FATAL ERROR] ${req.path} : ${error.stack || error}`);
        if (!res.headersSent) {
            res.status(500).json({ Result: 'Internal Server Error processing request' });
        }
    }
});


// --- Server Export & Startup ---
module.exports = web;

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const port = argv.port;
    const server = web.listen(port, () => {
        console.log(`Server is running locally on port: ${port}`);
        if (argv.test) {
            console.log(`Running test request (query: "${argv.query || 'default'}")...`);
            setTimeout(() => {
                 const testUrl = `http://localhost:${port}/api/provider/test?query=${encodeURIComponent(argv.query || 'Blonde')}`;
                 // const testPornolabId = '3134910'; // Example Pornolab ID with stats
                 // const testUrl = `http://localhost:${port}/api/search/id/pornolab?query=${testPornolabId}`;
                 // const testRutrackerId = '3753926'; // Snezhnaya Koroleva
                 // const testUrl = `http://localhost:${port}/api/search/id/rutracker?query=${testRutrackerId}`;
                 // const testRutrackerGameId = '6657532'; // Suikoden
                 // const testUrl = `http://localhost:${port}/api/search/id/rutracker?query=${testRutrackerGameId}`;
                 // const testRutrackerGameId2 = '5749028'; // Darkest Dungeon
                 // const testUrl = `http://localhost:${port}/api/search/id/rutracker?query=${testRutrackerGameId2}`;


                console.log(`[Test] Requesting: ${testUrl}`);
                axios.get(testUrl)
                    .then(response => {
                        const prettyJson = JSON.stringify(response.data, null, 4);
                        console.log("\n--- Test Result ---");
                        console.log(prettyJson.length > 5000 ? prettyJson.slice(0, 5000) + "\n... (output truncated)" : prettyJson);
                        console.log("--- Test End ---");
                        server.close(() => { console.log('Server closed after test.'); process.exit(0); });
                    })
                    .catch(error => {
                        console.error(`\n--- Test Error ---`);
                        console.error(`Error during test request to ${testUrl}: ${error.message}`);
                        if (error.response) {
                            console.error(`Test Response Status: ${error.response.status}`);
                            try { console.error(`Test Response Data:`, JSON.stringify(error.response.data, null, 2)); } catch { console.error(`Test Response Data:`, error.response.data); }
                        }
                        console.error("--- Test End ---");
                        server.close(() => { console.log('Server closed after error during test.'); process.exit(1); });
                    });
            }, 1500);
        }
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') console.error(`Error: Port ${port} is already in use. Try another port using -p PORT.`);
        else console.error(`Server startup error: ${err}`);
        process.exit(1);
    });
} else {
    console.log("Server starting in serverless environment...");
}

// --- END OF FULL server.js FILE ---