const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');
const proxy = require('https-proxy-agent').HttpsProxyAgent; // ���������� ��� �� HttpsProxyAgent
const yargs = require('yargs'); // ��� ������ ���������� ������ �� ��������� ������
const { hideBin } = require('yargs/helpers');

// === ��������� ===
const pornolabSearchUrl = 'https://pornolab.net/forum/search.php'; // �������� � ������ ������ (��� ������ ���� <select>)
const categoryFilePath = path.join(__dirname, 'category.json'); // ���� � ������ ����� ���������
const pornolabCategoryKey = 'Pornolab'; // ���� ��� ��������� Pornolab � JSON

// ������ ��������� ������ � ��������� ��� ��, ��� � �������� ����� API
const argv = yargs(hideBin(process.argv))
    .option('proxyAddress', { type: 'string', description: 'Address proxy server (e.g., 127.0.0.1)' })
    .option('proxyPort', { type: 'number', description: 'Port proxy server (e.g., 9050)' })
    .option('username', { type: 'string', description: 'Username for proxy server' })
    .option('password', { type: 'string', description: 'Password for proxy server' })
    .argv;

// �������� ���������� Axios � ������ (�������� ������ �� ��������� �����)
const createAxiosProxy = () => {
    const config = {};
    if (argv.proxyAddress && argv.proxyPort) {
        let proxyUrl = `http://${argv.proxyAddress}:${argv.proxyPort}`;
        if (argv.username && argv.password) {
            proxyUrl = `http://${argv.username}:${argv.password}@${argv.proxyAddress}:${argv.proxyPort}`;
        }
        console.log(`Using proxy: ${proxyUrl.replace(/:[^:]*@/, ':[hidden]@')}`);
        try {
            const proxyOptions = new URL(proxyUrl);
            config.httpsAgent = new proxy(proxyOptions);
            config.proxy = false;
        } catch (e) {
            console.error(`Error creating proxy agent: ${e.message}`);
        }
    }
    return axios.create(config);
};
const axiosProxy = createAxiosProxy();

// Cookies ��� Pornolab (�� ��������� �����, ���� ����� ��� �������)
const headers_Pornolab = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': process.env.PORNOLAB_COOKIE || 'bb_session=1-21895375-wWOFAC17X1BFkqY6LiPT-2502177517-1746028069-1746032217-2611168079-1; bb_keep_loged_in=a:1:{i:3173008;i:1746001097;}'
};

// --- ������� �������� ��������� ---
async function fetchAndParseCategories() {
    console.log(`Fetching categories from ${pornolabSearchUrl}...`);
    let html;
    try {
        const response = await axiosProxy.get(pornolabSearchUrl, {
            responseType: 'arraybuffer',
            headers: headers_Pornolab, // ���������� cookies, ��� ��� ��� ����� ���� �����
            timeout: 10000
        });
        html = iconv.decode(response.data, 'win1251');
        console.log('Successfully fetched page content (with cookies).');
    } catch (error) {
        console.error(`Error fetching Pornolab page: ${error.message}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            try {
                const errorBody = iconv.decode(Buffer.from(error.response.data), 'win1251');
                console.error(`Response Body (start): ${errorBody.slice(0, 300)}...`);
            } catch (decodeError) {
                console.error('Could not decode error response body.');
            }
        }
        return null;
    }

    try {
        const $ = cheerio.load(html);
        const categories = {};
        // === ���������: ���� select � name="f[]" ===
        const selectElement = $('select[name="f[]"]').first();

        if (selectElement.length === 0) {
            console.error('Could not find the category select dropdown (<select name="f[]">). Page structure might have changed or cookies might be invalid/insufficient.');
            return null;
        }

        console.log(`Found category select element: name="${selectElement.attr('name')}"`);

        // ���������� �� ���� <option> ������ ���������� <select>
        selectElement.find('option').each((index, element) => {
            const $option = $(element);
            const value = $option.attr('value');
            let name = $option.text();

            const categoryId = parseInt(value, 10);
            // ����� ������ ����� � �������� ID > 0 (��������� "��� ���������" � ��������� optgroup)
            if (!isNaN(categoryId) && categoryId > 0) {
                // ������� ���: ������� �������� "|-", "�", ������ �������
                name = name.replace(/^\|-\s*/, '')    // ������� "|- " � ������
                           .replace(/�/g, ' ')   // �������� � �� ������
                           .replace(/\s+/g, ' ')      // �������� ������������� ������� �� ����
                           .trim();                   // ������� ������� �� �����
                if (name) {
                    categories[categoryId.toString()] = name;
                    // console.log(`Found category: ID=${categoryId}, Name="${name}"`); // ����������������� ��� �������
                }
            }
        });

        const count = Object.keys(categories).length;
        if (count > 0) {
            console.log(`Successfully parsed ${count} categories.`);
            return categories;
        } else {
            console.error('No valid categories found within the select dropdown. Check option values or page content.');
            return null;
        }
    } catch (parseError) {
        console.error(`Error parsing HTML content: ${parseError.message}`);
        return null;
    }
}

// --- ������� ���������� ����� category.json ---
async function updateCategoryFile() {
    const pornolabCategories = await fetchAndParseCategories();

    if (!pornolabCategories || Object.keys(pornolabCategories).length === 0) {
        console.error('Failed to get Pornolab categories. category.json will not be updated.');
        return;
    }

    let existingData = {};
    try {
        if (fs.existsSync(categoryFilePath)) {
            const fileContent = fs.readFileSync(categoryFilePath, 'utf-8');
            // ��������� ��������� BOM (Byte Order Mark), ������� ����� ���� � ������ �����
            const cleanedContent = fileContent.charCodeAt(0) === 0xFEFF ? fileContent.slice(1) : fileContent;
            existingData = JSON.parse(cleanedContent);
            console.log(`Read existing data from ${categoryFilePath}`);
        } else {
            console.log(`${categoryFilePath} not found. Creating a new file.`);
        }
    } catch (readError) {
        console.error(`Error reading or parsing existing ${categoryFilePath}: ${readError.message}`);
        console.log('Proceeding with potentially empty existing data.');
        existingData = {};
    }

    // �������� ��� ��������� ��������� Pornolab
    existingData[pornolabCategoryKey] = pornolabCategories;
    console.log(`Updated categories for key "${pornolabCategoryKey}".`);

    try {
        fs.writeFileSync(categoryFilePath, JSON.stringify(existingData, null, 4), 'utf-8'); // ���������� 4 ������� ��� �������
        console.log(`Successfully updated ${categoryFilePath} with Pornolab categories.`);
    } catch (writeError) {
        console.error(`Error writing updated data to ${categoryFilePath}: ${writeError.message}`);
    }
}

// --- ������ ������� ---
updateCategoryFile();