# -*- coding: utf-8 -*-
import requests
from bs4 import BeautifulSoup
import json
import logging
import os
import time
from urllib.parse import urljoin, urlparse, parse_qs
import subprocess
import webbrowser
import sys
import threading
from queue import Queue
import re
import concurrent.futures
import math
import random
from dotenv import load_dotenv
import xml.etree.ElementTree as ET # Для парсинга RSS/Atom
from datetime import datetime, timezone # Для работы с датами RSS

load_dotenv()

# --- Настройки ---
SOURCES = {
    "rutracker": { "forum_id": 1605, "base_url": "https://rutracker.org/forum/", "provider_name": "rutracker", "output_json": "data.json", "open_browser": True },
    "rutracker_886": { "forum_id": 886, "base_url": "https://rutracker.org/forum/", "provider_name": "rutracker", "output_json": "data_886.json", "open_browser": True },
    "pornolab": { "forum_id": 1823, "base_url": "https://pornolab.net/forum/", "provider_name": "pornolab", "output_json": "pornolab_data.json", "open_browser": False },
    "rutracker_rss": { "forum_id": 1605, "base_url": "https://rutracker.org/forum/", "rss_url": "https://feed.rutracker.cc/atom/f/{forum_id}.atom", "provider_name": "rutracker", "output_json": "rss_data.json", "open_browser": False }
}
ITEMS_PER_PAGE_TRACKER = 50
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
}
COOKIES = {}
PLACEHOLDER_POSTER = "https://via.placeholder.com/160x240.png?text=RSS" # Заглушка для RSS
RUTRACKER_DOWNLOAD_BASE_URL = "https://rutracker.org/forum/"
PORNOLAB_DOWNLOAD_BASE_URL = "https://pornolab.net/forum/"
TORAPI_BASE_URL = "http://localhost:8443"
TORAPI_REQUEST_TIMEOUT = 30
TRACKER_PAGE_REQUEST_TIMEOUT = 45
RSS_REQUEST_TIMEOUT = 25
MAX_WORKERS_ID_FETCH = 8
MAX_WORKERS_TORAPI = 5
WORKER_SLEEP_MIN = 0.3
WORKER_SLEEP_MAX = 1.0
BACKEND_SERVER_PORT = int(os.environ.get('BACKEND_PORT', 3000))

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(threadName)s] %(levelname)s - %(message)s')

session = requests.Session()
session.headers.update(HEADERS)
if COOKIES: session.cookies.update(COOKIES)

def fetch_html(url, session_obj, timeout, specific_cookies=None):
    """Загружает HTML контент страницы с использованием сессии и специфичных кук."""
    current_cookies = session_obj.cookies.copy()
    if specific_cookies: current_cookies.update(specific_cookies)
    try:
        response = session_obj.get(url, timeout=timeout, cookies=current_cookies)
        response.raise_for_status()
        response.encoding = response.apparent_encoding or 'windows-1251'
        return response.text
    except requests.exceptions.Timeout: logging.error(f"Таймаут при запросе {url}"); return None
    except requests.exceptions.RequestException as e: logging.error(f"Ошибка сети при загрузке {url}: {e}"); return None
    except Exception as e: logging.error(f"Непредвиденная ошибка при загрузке {url}: {e}"); return None

def get_total_pages(forum_id, base_url, session_obj, source_key):
    """Определяет общее количество страниц в разделе форума."""
    start_page_url = urljoin(base_url, f"viewforum.php?f={forum_id}")
    logging.info(f"[{source_key.upper()}] Определение кол-ва страниц: Загрузка {start_page_url}")
    source_cookies = globals().get(f"COOKIES_{source_key.upper()}")
    html = fetch_html(start_page_url, session_obj, TRACKER_PAGE_REQUEST_TIMEOUT, specific_cookies=source_cookies)
    if not html: return 0
    try:
        soup = BeautifulSoup(html, 'lxml')
        pagination_container = soup.find('div', id='pagination') or soup.find('div', class_='nav-top') or soup.find('td', class_='nav', align='right') or soup.find('td', class_='nav') or soup.find('p', class_='pagination')
        if not pagination_container:
            if soup.select_one('a.topictitle, a.torTopic'): logging.warning(f"[{source_key.upper()}] Пагинация не найдена, но темы есть. Считаем 1 страницу."); return 1
            else: logging.error(f"[{source_key.upper()}] Пагинация и темы не найдены."); return 0
        all_links = pagination_container.find_all('a')
        if not all_links:
             if soup.select_one('a.topictitle, a.torTopic'): logging.info(f"[{source_key.upper()}] Контейнер пагинации найден, но ссылок нет. Считаем 1 страницу."); return 1
             else: logging.warning(f"[{source_key.upper()}] Контейнер пагинации найден, но тем и ссылок нет."); return 0
        max_page_num = 1; found_page_number = False
        for link in all_links:
            link_text = link.get_text(strip=True)
            if link_text.isdigit():
                try: max_page_num = max(max_page_num, int(link_text)); found_page_number = True
                except ValueError: continue
        if not found_page_number and max_page_num == 1:
             if soup.select_one('a.topictitle, a.torTopic'): logging.warning(f"[{source_key.upper()}] Номера страниц в пагинации не найдены. Предполагаем 1 страницу."); return 1
             else: logging.warning(f"[{source_key.upper()}] Номера страниц и темы не найдены."); return 0
        logging.info(f"[{source_key.upper()}] Определено страниц по макс. номеру: {max_page_num}")
        last_start = 0
        last_page_link = None
        if len(pagination_links := pagination_container.find_all('a', class_='pg')) > 0:
            maybe_last = pagination_links[-1]
            if maybe_last.get_text(strip=True).isdigit(): last_page_link = maybe_last
            elif len(pagination_links) > 1 and pagination_links[-2].get_text(strip=True).isdigit(): last_page_link = pagination_links[-2]
        if last_page_link and last_page_link.has_attr('href'):
             match = re.search(r'[?&]start=(\d+)', last_page_link['href'])
             if match: last_start = int(match.group(1))
        total_pages_by_start = (last_start // ITEMS_PER_PAGE_TRACKER) + 1
        final_total_pages = max(max_page_num, total_pages_by_start)
        logging.info(f"[{source_key.upper()}] Итоговое кол-во страниц: {final_total_pages} (проверено по start={last_start})")
        return final_total_pages
    except Exception as e: logging.error(f"[{source_key.upper()}] Ошибка парсинга пагинации: {e}"); logging.exception("Traceback:"); return 0

def fetch_and_extract_ids_from_page(page_url, page_num_display, source_key):
    """Загружает страницу форума и извлекает все ID тем, адаптируясь к источнику."""
    thread_name = threading.current_thread().name
    ids_on_page = set(); html = None
    logging.info(f"[{thread_name}-{source_key.upper()}] Загрузка ID со стр. {page_num_display} ({page_url})...")
    try:
        time.sleep(random.uniform(WORKER_SLEEP_MIN, WORKER_SLEEP_MAX))
        source_cookies = globals().get(f"COOKIES_{source_key.upper()}")
        html = fetch_html(page_url, session, TRACKER_PAGE_REQUEST_TIMEOUT, specific_cookies=source_cookies)
        if html:
            soup = BeautifulSoup(html, 'lxml');
            topic_table = None
            topic_links = []
            if source_key in ['rutracker', 'rutracker_886']:
                 # Добавляем новые селекторы для поиска таблицы
                 topic_table = (
                     soup.find('table', class_='vf-table vf-tor forumline forum') or 
                     soup.find('table', class_='forumline', id='tor-tbl') or 
                     soup.find('table', id='tor-tbl') or 
                     soup.find('table', class_='forumline') or
                     soup.find('table', class_='forum')  # Добавлен новый селектор
                 )
                 if topic_table:
                     # Расширяем поиск ссылок на темы
                     topic_links = (
                         topic_table.select('a.torTopic.bold.tt-text[href*="t="]') or 
                         topic_table.select('a.torTopic[href*="t="]') or
                         topic_table.select('a.tt-text[href*="t="]') or  # Добавлен новый селектор
                         topic_table.select('a.topictitle[href*="t="]')  # Добавлен новый селектор
                     )
            elif source_key == 'pornolab':
                 topic_table = soup.find('table', class_='topic_list') or soup.find('table', class_='forumline')
                 if topic_table: topic_links = topic_table.select('a.topictitle[href*="t="]')
            else: logging.error(f"[{thread_name}-{source_key.upper()}] Неизвестный источник '{source_key}'!")
            if topic_table and topic_links:
                processed_links = 0
                for link_tag in topic_links:
                    href = link_tag.get('href', ''); match = re.search(r'[?&]t=(\d+)', href)
                    if match: ids_on_page.add(match.group(1)); processed_links += 1
                logging.info(f"[{thread_name}-{source_key.upper()}] Стр. {page_num_display}: Найдено ссылок с ID: {processed_links} -> Уник. ID: {len(ids_on_page)}")
            elif not topic_table: logging.warning(f"[{thread_name}-{source_key.upper()}] Не найдена таблица тем на стр. {page_num_display} ({page_url})")
            else: logging.warning(f"[{thread_name}-{source_key.upper()}] Не найдены ссылки на темы внутри таблицы на стр. {page_num_display}")
        return ids_on_page
    except Exception as e: logging.error(f"[{thread_name}-{source_key.upper()}] Критическая ошибка на стр. {page_num_display}: {e}"); logging.exception("Traceback:"); return set()

def fetch_details_from_torapi(endpoint_path):
    """Запрашивает детали у локального TorAPI."""
    api_url = f"{TORAPI_BASE_URL}{endpoint_path}"
    try:
        response = requests.get(api_url, timeout=TORAPI_REQUEST_TIMEOUT); response.raise_for_status(); return response.json()
    except requests.exceptions.Timeout: logging.error(f"Таймаут TorAPI: {api_url}"); return None
    except requests.exceptions.RequestException as e: logging.error(f"Ошибка сети TorAPI ({api_url}): {e}"); return None
    except json.JSONDecodeError as e: logging.error(f"Ошибка JSON от TorAPI ({api_url}): {e} - Ответ: {response.text[:200]}..."); return None
    except Exception as e: logging.error(f"Непредв. ошибка TorAPI ({api_url}): {e}"); return None

def worker_torapi_details(task_queue, results_list, results_lock, source_key):
    """Поток-воркер: берет ID, запрашивает ДЕТАЛИ у TorAPI, добавляет source, обрабатывает поля и кладет результат."""
    provider_name = SOURCES.get(source_key, {}).get("provider_name", source_key)
    while True:
        topic_id = task_queue.get();
        if topic_id is None: task_queue.task_done(); break
        try:
            thread_name = threading.current_thread().name; logging.info(f"[{thread_name}-{source_key.upper()}] Запрос деталей ID: {topic_id}")
            endpoint = f"/api/search/id/{provider_name}?query={topic_id}"; api_data_list = fetch_details_from_torapi(endpoint)
            if api_data_list and isinstance(api_data_list, list) and len(api_data_list) > 0:
                api_data = api_data_list[0]
                if isinstance(api_data, dict):
                    original_title = api_data.get("Name", f"ID:{topic_id}")
                    title = original_title.replace("[Nintendo Switch]", "[NS]").strip() if source_key == 'rutracker' else original_title.strip()
                    link = api_data.get("Url", f"{SOURCES[source_key]['base_url']}viewtopic.php?t={topic_id}")
                    poster_url = api_data.get("Poster", PLACEHOLDER_POSTER) or PLACEHOLDER_POSTER
                    magnet_link = api_data.get("Magnet", "")
                    full_desc_html = "<p><em>(Описание для этого источника не отображается)</em></p>"
                    desc_text = ""
                    if source_key != 'pornolab':
                        desc_text = api_data.get("Description", "")
                        full_desc_html = f"<p>{desc_text.replace(chr(10), '<br>')}</p>" if desc_text else "<p><em>Описание отсутствует.</em></p>"
                    year = api_data.get("Year", "-"); genre = api_data.get("Type", "-"); voice_lang = api_data.get("Voice", "-")
                    text_lang = api_data.get("Lang", "-"); age_rating = api_data.get("Age", "-"); multiplayer_status = api_data.get("Multiplayer", "неизвестно")
                    has_mp = False; type_str = genre.lower(); desc_lower = desc_text.lower()
                    mp_kw = ["мультиплеер", "multiplayer", "сетевая", "online", "кооператив", "co-op", "онлайн"]; no_mp = ["мультиплеер: нет", "multiplayer: no"]
                    if multiplayer_status.lower() != 'нет' and multiplayer_status != "неизвестно": has_mp = True
                    elif multiplayer_status == "неизвестно" and any(kw in desc_lower or kw in type_str for kw in mp_kw) and not any(ph in desc_lower for ph in no_mp): has_mp = True
                    result = {'source': source_key, 'title': title,'link': link,'topic_id': topic_id,'poster_url': poster_url,'full_description_html': full_desc_html,'has_multiplayer': has_mp, 'magnet_link': magnet_link, 'year': year, 'genre': genre, 'voice_lang': voice_lang, 'text_lang': text_lang, 'age_rating': age_rating, 'multiplayer_status': multiplayer_status}
                    if source_key == 'pornolab':
                         seeds_str = api_data.get("Seeds", "0") or "0"; peers_str = api_data.get("Peers", "0") or "0"
                         size_str = api_data.get("Size", "-") or "-"; video_str = api_data.get("Video", "-") or "-"
                         genre_pl = api_data.get("Type", "-") or "-"
                         result['Seeds'] = seeds_str.strip(); result['Peers'] = peers_str.strip()
                         result['Size'] = size_str.replace("\xa0", " ").strip(); result['Video'] = video_str.strip()
                         result['Type'] = genre_pl.strip();
                         if 'genre' in result: del result['genre']
                    with results_lock: results_list.append(result)
                    logging.debug(f"[{thread_name}-{source_key.upper()}] Успешно ID {topic_id}")
                else: logging.warning(f"[{thread_name}-{source_key.upper()}] Неверный формат элемента ID {topic_id}: {api_data}")
            elif isinstance(api_data_list, dict) and api_data_list.get(provider_name, {}).get("Result", "").startswith("No matches"): logging.warning(f"[{thread_name}-{source_key.upper()}] TorAPI не нашел ID {topic_id}.")
            else: logging.warning(f"[{thread_name}-{source_key.upper()}] Пропуск ID {topic_id} (TorAPI data: {str(api_data_list)[:200]}...)")
        except Exception as e: logging.error(f"[{thread_name}-{source_key.upper()}] Ошибка воркера деталей ID {topic_id}: {e}")
        finally: task_queue.task_done()

# --- !!! НОВАЯ ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ И ПАРСИНГА RSS !!! ---
def fetch_and_parse_rss(rss_url):
    """Загружает и парсит Atom/RSS ленту, возвращает список словарей."""
    logging.info(f"Загрузка RSS: {rss_url}")
    rss_items = []
    try:
        response = requests.get(rss_url, headers=HEADERS, timeout=RSS_REQUEST_TIMEOUT)
        response.raise_for_status()
        response.encoding = 'utf-8'
        xml_content = response.text
        try: root = ET.fromstring(xml_content)
        except ET.ParseError as e_xml: logging.error(f"Ошибка парсинга XML из {rss_url}: {e_xml}"); logging.error(f"Начало XML: {xml_content[:500]}..."); return []
        ns = {}
        if root.tag.startswith('{'): ns['atom'] = root.tag.split('}')[0].strip('{')
        else: ns['atom'] = 'http://www.w3.org/2005/Atom'
        logging.debug(f"Используется namespace: {ns}")

        for entry in root.findall('atom:entry', ns):
            title_tag = entry.find('atom:title', ns); title = title_tag.text if title_tag is not None else "Без названия"
            link_tag = entry.find('atom:link[@rel="alternate"]', ns) or entry.find('atom:link', ns)
            link = link_tag.attrib.get('href') if link_tag is not None else "#"
            published_tag = entry.find('atom:published', ns); updated_tag = entry.find('atom:updated', ns); author_tag = entry.find('atom:author/atom:name', ns)
            topic_id = None; match = re.search(r'[?&]t=(\d+)', link);
            if match: topic_id = match.group(1)
            published_date_str = published_tag.text if published_tag is not None else ""
            updated_date_str = updated_tag.text if updated_tag is not None else published_date_str
            item_data = {'source': 'rutracker_rss', 'title': title.strip(), 'link': link, 'topic_id': topic_id, 'author': author_tag.text.strip() if author_tag is not None else "Неизвестен", 'published': published_date_str, 'updated': updated_date_str, 'poster_url': PLACEHOLDER_POSTER, 'has_multiplayer': False, 'magnet_link': '', 'full_description_html': f'<p>Опубликовано: {published_date_str}<br>Обновлено: {updated_date_str}</p>' }
            rss_items.append(item_data)
        logging.info(f"Успешно обработано {len(rss_items)} записей из RSS.")
        return rss_items
    except requests.exceptions.RequestException as e: logging.error(f"Ошибка сети при загрузке RSS {rss_url}: {e}"); return []
    except Exception as e: logging.error(f"Неожиданная ошибка при обработке RSS {rss_url}: {e}"); logging.exception("Traceback:"); return []
# --- КОНЕЦ НОВОЙ ФУНКЦИИ ---


def update_and_save_data(new_data_list, filename):
    """Читает существующие данные, добавляет/обновляет новыми, сортирует и сохраняет."""
    existing_data = []; existing_ids = set()
    if os.path.exists(filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f: existing_data = json.load(f)
            if isinstance(existing_data, list):
                for item in existing_data:
                    if isinstance(item, dict) and 'topic_id' in item and 'source' in item: existing_ids.add(f"{item['source']}-{item['topic_id']}")
                logging.info(f"Прочитано {len(existing_data)} записей из {filename}.")
            else: logging.warning(f"{filename} не список."); existing_data = []
        except Exception as e: logging.error(f"Ошибка чтения {filename}: {e}."); existing_data = []
    else: logging.info(f"Файл {filename} не найден."); existing_data = []
    added_count = 0; updated_count = 0
    current_data_map = {f"{item['source']}-{item['topic_id']}": item for item in existing_data if isinstance(item, dict) and 'topic_id' in item and 'source' in item}
    for new_item in new_data_list:
        if not isinstance(new_item, dict) or 'topic_id' not in new_item or 'source' not in new_item: continue
        unique_key = f"{new_item['source']}-{new_item['topic_id']}"
        if unique_key not in current_data_map: current_data_map[unique_key] = new_item; added_count += 1
        else: current_data_map[unique_key].update(new_item); updated_count += 1
    logging.info(f"Добавлено: {added_count}, Обновлено: {updated_count} записей для {filename}.")
    final_data = sorted(current_data_map.values(), key=lambda x: int(x.get('topic_id', 0)), reverse=True)
    try:
        logging.info(f"Сохранение {len(final_data)} записей в {filename}")
        with open(filename, 'w', encoding='utf-8') as f: json.dump(final_data, f, ensure_ascii=False, indent=4)
        logging.info(f"Обновленные данные сохранены в {filename}."); return True
    except Exception as e: logging.error(f"Ошибка сохранения {filename}: {e}"); return False

def start_server_and_open_browser(backend_port):
    """Просто открывает URL бэкенда в браузере."""
    host = 'localhost'; url_to_open = f"http://{host}:{backend_port}/"; logging.info(f"URL для открытия в браузере: {url_to_open}")
    try: time.sleep(1); logging.info(f"Открытие {url_to_open}..."); webbrowser.open(url_to_open)
    except Exception as e: logging.error(f"Ошибка открытия браузера: {e}")

# --- Основной блок выполнения скрипта ---
if __name__ == "__main__":
    main_start_time = time.time()
    logging.info(f"--- Старт Парсера v2.8 (Мульти-источник + RSS, API: {TORAPI_BASE_URL}) ---")
    script_dir = os.path.dirname(os.path.abspath(__file__)); os.chdir(script_dir);
    logging.info(f"Рабочая директория: {script_dir}")

    # --- Выбор источника ---
    source_keys = list(SOURCES.keys())
    print("\nДоступные источники:")
    for i, key in enumerate(source_keys): print(f"{i+1}. {key.capitalize().replace('_', ' ')}")
    chosen_source_key = None
    while True:
        try:
            user_input = input(f"Выберите номер источника для обновления (1-{len(source_keys)}): ")
            choice_idx = int(user_input) - 1
            if 0 <= choice_idx < len(source_keys): chosen_source_key = source_keys[choice_idx]; break
            else: print("Неверный номер.")
        except ValueError: print("Введите число.")
        except (EOFError, KeyboardInterrupt): logging.warning("Ввод прерван."); sys.exit(0)
    chosen_source_config = SOURCES[chosen_source_key]
    output_file_path = os.path.join(script_dir, chosen_source_config['output_json'])
    logging.info(f"Выбран источник: {chosen_source_key.capitalize().replace('_', ' ')} -> {output_file_path}")

    # --- Логика в зависимости от выбранного источника ---
    data_saved_successfully = False

    if chosen_source_key == "rutracker_rss":
        # --- Обработка RSS ---
        rss_start_time = time.time()
        rss_url = chosen_source_config['rss_url'].format(forum_id=chosen_source_config['forum_id'])
        rss_results = fetch_and_parse_rss(rss_url)
        if rss_results:
            try: # Для RSS просто перезаписываем файл
                logging.info(f"Сохранение {len(rss_results)} записей RSS в {output_file_path}")
                with open(output_file_path, 'w', encoding='utf-8') as f: json.dump(rss_results, f, ensure_ascii=False, indent=4)
                logging.info("Данные RSS сохранены."); data_saved_successfully = True
            except Exception as e: logging.error(f"Ошибка сохранения RSS {output_file_path}: {e}")
        else: logging.error("Не удалось получить или обработать данные RSS.")
        rss_end_time = time.time(); logging.info(f"--- Время обработки RSS: {rss_end_time - rss_start_time:.2f} сек ---")

    else: # Логика для обычных трекеров (Rutracker, Pornolab)
        # --- Определение кол-ва страниц ---
        total_pages_available = get_total_pages(chosen_source_config['forum_id'], chosen_source_config['base_url'], session, chosen_source_key)
        if total_pages_available <= 0: logging.error("Не удалось определить количество страниц. Завершение."); sys.exit(1)

        # --- Запрос у пользователя кол-ва страниц для сканирования ---
        num_pages_to_scan_user = 0
        while True:
            try:
                prompt = f"Найдено страниц: {total_pages_available}. Сколько сканировать для НОВЫХ ID (1-{total_pages_available}): "
                user_input = input(prompt)
                num_pages_to_scan_user = int(user_input)
                if 1 <= num_pages_to_scan_user <= total_pages_available: logging.info(f"Будет просканировано страниц: {num_pages_to_scan_user}"); break
                else: print(f"Ошибка: Введите число от 1 до {total_pages_available}.")
            except ValueError: print("Введите целое число.")
            except EOFError: logging.warning("Ввод прерван."); sys.exit(0)
            except KeyboardInterrupt: logging.warning("Операция прервана."); sys.exit(0)

        # --- Фаза 1: Параллельный сбор ID с трекера ---
        id_fetch_start_time = time.time()
        all_topic_ids = set()
        page_urls_to_scan = [f"{chosen_source_config['base_url']}viewforum.php?f={chosen_source_config['forum_id']}&start={s}" for s in range(0, num_pages_to_scan_user * ITEMS_PER_PAGE_TRACKER, ITEMS_PER_PAGE_TRACKER)]
        logging.info(f"[{chosen_source_key.upper()}] Начинаем сбор ID с {len(page_urls_to_scan)} страниц (Потоков: {MAX_WORKERS_ID_FETCH})...")
        processed_pages_count = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS_ID_FETCH, thread_name_prefix="ID_Fetcher") as executor:
            future_to_url = {executor.submit(fetch_and_extract_ids_from_page, url, i+1, chosen_source_key): url for i, url in enumerate(page_urls_to_scan)}
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]; processed_pages_count += 1
                try: ids_from_page = future.result(); all_topic_ids.update(ids_from_page)
                except Exception as exc: logging.error(f"Ошибка при получении результата для URL {url}: {exc}")
                finally:
                     if processed_pages_count % 10 == 0 or processed_pages_count == len(page_urls_to_scan): logging.info(f"--- Сбор ID ({chosen_source_key}): обработано {processed_pages_count}/{len(page_urls_to_scan)} стр. Найдено уник. ID: {len(all_topic_ids)} ---")
        id_fetch_end_time = time.time(); logging.info(f"--- [{chosen_source_key.upper()}] Сбор ID завершен за {id_fetch_end_time - id_fetch_start_time:.2f} сек. Собрано уникальных ID: {len(all_topic_ids)} ---")
        total_unique_ids = len(all_topic_ids)
        if total_unique_ids == 0: logging.warning(f"[{chosen_source_key.upper()}] Не найдено ни одного ID темы. Завершение."); sys.exit(0)

        # --- Получаем существующие ID из соответствующего data.json ---
        existing_ids_in_file = set() # Теперь это set ключей "source-id"
        if os.path.exists(output_file_path):
            try:
                with open(output_file_path, 'r', encoding='utf-8') as f: existing_data_list = json.load(f)
                if isinstance(existing_data_list, list):
                    for item in existing_data_list:
                         if isinstance(item, dict) and 'topic_id' in item and item.get('source') == chosen_source_key:
                             existing_ids_in_file.add(f"{item['source']}-{item['topic_id']}")
                logging.info(f"Найдено {len(existing_ids_in_file)} существующих записей для {chosen_source_key} в {output_file_path}.")
            except Exception as e: logging.warning(f"Не удалось прочитать {output_file_path}: {e}")

        # --- Определяем ID для запроса к TorAPI (новые для этого источника) ---
        ids_to_request_torapi = []
        for topic_id in all_topic_ids:
            unique_key = f"{chosen_source_key}-{topic_id}" # Используем ключ источника
            if unique_key not in existing_ids_in_file:
                ids_to_request_torapi.append(topic_id)
        ids_to_request_torapi = sorted(ids_to_request_torapi, key=int, reverse=True) # Новые сначала

        total_tasks_final = len(ids_to_request_torapi)
        logging.info(f"--- [{chosen_source_key.upper()}] Всего НОВЫХ ID для запроса к TorAPI: {total_tasks_final} ---")

        if total_tasks_final == 0:
            logging.info(f"[{chosen_source_key.upper()}] Нет новых ID для обработки.");
            data_saved_successfully = True # Считаем успешным, если обновлять нечего
        else:
            # --- Фаза 2: ЗАПРОС ДЕТАЛЕЙ К TORAPI только для НОВЫХ ID ---
            torapi_start_time = time.time()
            task_queue = Queue(maxsize=total_tasks_final + MAX_WORKERS_TORAPI); results_list = []; results_lock = threading.Lock()
            for topic_id in ids_to_request_torapi: task_queue.put(topic_id)
            for _ in range(MAX_WORKERS_TORAPI): task_queue.put(None)
            logging.info(f"[{chosen_source_key.upper()}] Запуск {MAX_WORKERS_TORAPI} потоков для запроса деталей {total_tasks_final} новых тем к TorAPI...")
            threads_torapi = []
            for i in range(MAX_WORKERS_TORAPI):
                thread = threading.Thread(target=worker_torapi_details, args=(task_queue, results_list, results_lock, chosen_source_key), name=f"TorAPI-{i+1}")
                thread.start(); threads_torapi.append(thread)
            task_queue.join(); logging.info(f"--- [{chosen_source_key.upper()}] Очередь запросов к TorAPI обработана ---")
            logging.info(f"Собрано НОВЫХ результатов от TorAPI для {chosen_source_key}: {len(results_list)}")

            # --- Фаза 3: ОБНОВЛЕНИЕ И СОХРАНЕНИЕ ---
            if results_list: data_saved_successfully = update_and_save_data(results_list, output_file_path) # Используем нужный файл
            else: logging.warning("Не получено новых результатов от TorAPI."); data_saved_successfully = True
            torapi_end_time = time.time(); logging.info(f"--- [{chosen_source_key.upper()}] Время запросов к TorAPI: {torapi_end_time - torapi_start_time:.2f} сек ---")

    main_end_time = time.time(); logging.info(f"--- ОБЩЕЕ ВРЕМЯ РАБОТЫ: {main_end_time - main_start_time:.2f} сек ---")

    # --- Открываем браузер только если выбран соответствующий источник и все успешно ---
    if data_saved_successfully and chosen_source_config.get('open_browser', False):
        start_server_and_open_browser(BACKEND_SERVER_PORT)
    elif not data_saved_successfully:
        logging.warning("Браузер не будет открыт из-за ошибок.")
    else:
        logging.info(f"Источник '{chosen_source_key}' не требует открытия браузера.")
    logging.info("Скрипт парсера завершил работу.")