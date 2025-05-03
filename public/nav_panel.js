// public/nav_panel.js
document.addEventListener('DOMContentLoaded', () => {
    const sidePanel = document.getElementById('side-panel');
    const openBtn = document.getElementById('open-panel-btn');
    const closeBtn = document.getElementById('close-panel-btn');
    // const mainContent = document.getElementById('main-content'); // Для сдвига (если нужно)

    // Переменные для управления фокусом ВНУТРИ панели
    let panelFocusableItems = []; // Массив фокусируемых элементов в панели (ссылки, кнопки и т.д.)
    let currentPanelFocusIndex = -1; // Текущий индекс фокуса в панели

    function openNav() {
        if (sidePanel) {
             sidePanel.classList.add('open');
             // Собираем фокусируемые элементы при открытии
             panelFocusableItems = Array.from(
                 sidePanel.querySelectorAll('ul a, #sort-filter-options button, #sort-filter-options select') // Добавляем кнопки и селекты
             );
             console.log(`Panel opened. Found ${panelFocusableItems.length} focusable items.`);
             currentPanelFocusIndex = -1; // Сбрасываем индекс при открытии
        }
        // if (mainContent) mainContent.classList.add('shifted');
    }

    function closeNav() {
        if (sidePanel) {
            sidePanel.classList.remove('open');
            // Убираем подсветку с элемента панели при закрытии
            if (currentPanelFocusIndex !== -1 && panelFocusableItems[currentPanelFocusIndex]) {
                panelFocusableItems[currentPanelFocusIndex].classList.remove('panel-focused');
            }
            panelFocusableItems = []; // Очищаем массив
            currentPanelFocusIndex = -1; // Сбрасываем индекс
            console.log("Panel closed.");
        }
        // if (mainContent) mainContent.classList.remove('shifted');
    }

    // --- Обработчики кнопок открытия/закрытия ---
    if (openBtn) {
        openBtn.addEventListener('click', () => {
             // Сохраняем фокус основного контента ПЕРЕД открытием панели
             if (typeof window.saveFocusBeforePanel === 'function') {
                 window.saveFocusBeforePanel(); // Эта функция должна установить currentFocusContext = 'panel' в основном скрипте
             }
             openNav();
             // Устанавливаем фокус на первый элемент панели
             if (typeof window.focusFirstPanelItem === 'function') {
                 window.focusFirstPanelItem(); // Эта функция должна вызвать navigatePanel('down') или установить фокус
             }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeNav();
            // Восстанавливаем фокус основного контента ПОСЛЕ закрытия панели
            if (typeof window.restoreFocusFromPanel === 'function') {
                 window.restoreFocusFromPanel(); // Эта функция должна восстановить предыдущий контекст в основном скрипте
            }
        });
    }

    // --- Глобальные функции для управления панелью (вызываются из других скриптов) ---
    window.toggleSidePanel = () => {
        if (sidePanel && sidePanel.classList.contains('open')) {
            closeNav();
            if (typeof window.restoreFocusFromPanel === 'function') { window.restoreFocusFromPanel(); }
        } else {
            if (typeof window.saveFocusBeforePanel === 'function') { window.saveFocusBeforePanel(); }
            openNav();
            if (typeof window.focusFirstPanelItem === 'function') { window.focusFirstPanelItem(); }
        }
    };

    // --- Навигация внутри панели ---
    window.navigatePanel = (direction) => {
         if (!sidePanel || !sidePanel.classList.contains('open') || panelFocusableItems.length === 0) return;

         let nextIndex = currentPanelFocusIndex;
         const numElements = panelFocusableItems.length;

         if (nextIndex === -1) { // Если фокуса нет, ставим на первый/последний
             nextIndex = (direction === 'down' ? 0 : numElements - 1);
         } else {
             if (direction === 'down') { nextIndex = (currentPanelFocusIndex + 1) % numElements; }
             else if (direction === 'up') { nextIndex = (currentPanelFocusIndex - 1 + numElements) % numElements; }
         }

         // Снимаем старый фокус
         if (currentPanelFocusIndex !== -1 && panelFocusableItems[currentPanelFocusIndex]) {
             panelFocusableItems[currentPanelFocusIndex].classList.remove('panel-focused');
         }
         // Устанавливаем новый фокус
         if (panelFocusableItems[nextIndex]) {
             panelFocusableItems[nextIndex].classList.add('panel-focused');
             panelFocusableItems[nextIndex].scrollIntoView({ block: 'nearest'});
             currentPanelFocusIndex = nextIndex;
             console.log(`Panel focus moved to index ${currentPanelFocusIndex}`);
         } else {
             currentPanelFocusIndex = -1; // Сбрасываем, если элемент не найден
         }
    };

    // --- Активация элемента панели ---
    window.activatePanelItem = () => {
        if (!sidePanel || !sidePanel.classList.contains('open') || currentPanelFocusIndex === -1 || !panelFocusableItems[currentPanelFocusIndex]) return;
        const focusedItem = panelFocusableItems[currentPanelFocusIndex];
        console.log("Activating panel item:", focusedItem);
        focusedItem.click(); // Имитируем клик по ссылке или кнопке
        // Закрываем панель после активации пункта меню (опционально)
        // window.toggleSidePanel();
    };

    console.log("Navigation panel script loaded and ready.");
});