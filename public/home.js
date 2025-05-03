// public/home.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("Home page script loaded.");

    const navButtons = document.querySelectorAll('.nav-button');
    const gamepadStatusEl = document.getElementById('gamepad-status'); // Статус геймпада
    const sidePanel = document.getElementById('side-panel'); // Для проверки состояния панели

    let currentFocusIndex = -1;
    let gamepadIndex = null;
    let animationFrameId = null;
    const prevButtonStates = {};
    let axisNavigated = { x: false, y: false };
    let currentFocusContext = 'home'; // Контекст по умолчанию 'home'

    // --- Функции фокуса ---
    function setHomeFocus(index) {
        if (sidePanel && sidePanel.classList.contains('open')) return; // Не ставим фокус если панель открыта
        if (!navButtons || navButtons.length === 0) return; // Нет кнопок
        if (index < 0 || index >= navButtons.length) index = 0;

        if (currentFocusIndex !== -1 && navButtons[currentFocusIndex]) {
            navButtons[currentFocusIndex].classList.remove('focused');
        }
        currentFocusIndex = index;
        if (navButtons[currentFocusIndex]) {
            navButtons[currentFocusIndex].classList.add('focused');
            navButtons[currentFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            currentFocusContext = 'home'; // Устанавливаем контекст
            console.log(`Home focus set to index: ${index}`);
        } else {
            currentFocusIndex = -1;
            currentFocusContext = 'none';
        }
    }

    function moveHomeFocus(direction) {
        if (!navButtons || navButtons.length === 0) return;
        let targetIndex = currentFocusIndex;
        if (targetIndex === -1) targetIndex = 0;

        if (direction === 'down') { targetIndex = (targetIndex + 1) % navButtons.length; }
        else if (direction === 'up') { targetIndex = (targetIndex - 1 + navButtons.length) % navButtons.length; }
        setHomeFocus(targetIndex);
    }

    function activateHomeButton() {
        if (currentFocusIndex !== -1 && navButtons[currentFocusIndex]) {
            console.log(`Activating home button: ${navButtons[currentFocusIndex].textContent.trim()}`);
            // Вместо click() используем window.location для надежности
            window.location.href = navButtons[currentFocusIndex].href;
        }
    }

    // --- Функции для интеграции с панелью (вызываются из nav_panel.js) ---
    let previousFocusContext = 'home';
    let previousFocusIndex = -1;

    window.saveFocusBeforePanel = () => {
        previousFocusContext = currentFocusContext;
        previousFocusIndex = currentFocusIndex;
        if (currentFocusIndex !== -1 && navButtons[currentFocusIndex]) { navButtons[currentFocusIndex].classList.remove('focused'); }
        currentFocusContext = 'panel'; // Устанавливаем контекст панели
        console.log("Focus saved before opening panel.");
    };

    window.restoreFocusFromPanel = () => {
         console.log("Restoring focus from panel to:", previousFocusContext, previousFocusIndex);
         currentFocusContext = previousFocusContext; // Восстанавливаем 'home'
         setHomeFocus(previousFocusIndex !== -1 ? previousFocusIndex : 0); // Восстанавливаем фокус на кнопке
    };

    window.focusFirstPanelItem = () => { window.navigatePanel('down'); }; // Вызываем глобальную функцию
    window.navigatePanelItems = (direction) => { window.navigatePanel(direction); }; // Вызываем глобальную функцию
    window.activateFocusedPanelItem = () => { window.activatePanelItem(); }; // Вызываем глобальную функцию


    // --- Логика геймпада ---
    function handleButtonPress(buttonIndex) {
        console.log(`Home Button ${buttonIndex} pressed. Context: ${currentFocusContext}`);
        if (buttonIndex === 8 || buttonIndex === 9) { window.toggleSidePanel(); return; }

        if (currentFocusContext === 'home') {
             switch (buttonIndex) {
                 case 0: activateHomeButton(); break; // A/X
                 case 12: moveHomeFocus('up'); break;   // D-Pad Up
                 case 13: moveHomeFocus('down'); break; // D-Pad Down
                 case 14: window.toggleSidePanel(); break; // D-Pad Left -> Open Panel
             }
        } else if (currentFocusContext === 'panel') {
             switch(buttonIndex) {
                 case 0: window.activatePanelItem(); break; // A/X
                 case 1: window.toggleSidePanel(); break; // B/O
                 case 12: window.navigatePanel('up'); break; // D-Pad Up
                 case 13: window.navigatePanel('down'); break; // D-Pad Down
                 case 14: window.toggleSidePanel(); break; // D-Pad Left
             }
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
        // Обработка для 'home'
        if (currentFocusContext === 'home') {
             if (axisIndex === 1) { // Left Stick Y
                 if (value > AXIS_THRESHOLD && !axisNavigated.y) { moveHomeFocus('down'); axisNavigated.y = true; }
                 else if (value < -AXIS_THRESHOLD && !axisNavigated.y) { moveHomeFocus('up'); axisNavigated.y = true; }
                 else if (Math.abs(value) < AXIS_DEADZONE) { axisNavigated.y = false; }
             } else if (axisIndex === 0 && Math.abs(value) < AXIS_DEADZONE) { axisNavigated.x = false; }
        }
    }

    function gamepadLoop() {
        if (gamepadIndex === null) { animationFrameId = null; return; }
        try {
            const gamepads = navigator.getGamepads(); if (!gamepads || !gamepads[gamepadIndex]) { updateGamepadStatus(null); return; }
            const gp = gamepads[gamepadIndex];
            gp.buttons.forEach((button, index) => { const wasPressed = !!prevButtonStates[index]; if (button.pressed && !wasPressed) { prevButtonStates[index] = true; handleButtonPress(index); } else if (!button.pressed && wasPressed) { prevButtonStates[index] = false; } });
            gp.axes.forEach((value, index) => { handleAxisMove(index, value); });
        } catch (error) { console.error("!!! ERROR in home.js gamepadLoop:", error); }
        if (gamepadIndex !== null) { animationFrameId = requestAnimationFrame(gamepadLoop); } else { animationFrameId = null; }
    }

    // --- События подключения/отключения ---
    window.addEventListener("gamepadconnected", (event) => {
         if (!event.gamepad) return; console.log("GP connected:", event.gamepad.id, "Idx:", event.gamepad.index);
         if (!event.gamepad.buttons?.length && !event.gamepad.axes?.length) { return; }
         if (gamepadIndex === null) {
             gamepadIndex = event.gamepad.index;
             axisNavigated = { x: false, y: false };
             updateGamepadStatus(event.gamepad); // Установит фокус
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
    }
    function updateGamepadStatus(gamepad) {
         if (!gamepadStatusEl) return;
         if(gamepad) { // Подключен
             const name = gamepad.id.replace(/\s*\(Vendor:\s*\w+\s*Product:\s*\w+\)/i, '').trim();
             gamepadStatusEl.textContent = `Геймпад: ${name}`; gamepadStatusEl.className = 'connected';
             // Ставим фокус на первую кнопку, если геймпад подключился
             if(currentFocusContext === 'none' || currentFocusContext === 'home') {
                  if (navButtons.length > 0) setHomeFocus(0);
             }
         } else { // Отключен
             gamepadStatusEl.textContent = 'Геймпад отключен'; gamepadStatusEl.className = 'disconnected';
             gamepadIndex = null;
             if (currentFocusIndex !== -1 && navButtons[currentFocusIndex]) { navButtons[currentFocusIndex].classList.remove('focused'); }
             currentFocusIndex = -1; currentFocusContext = 'none';
             if (animationFrameId) { console.log("GP disconnected, loop will stop."); }
             animationFrameId = null;
         }
    }

    // Задержка перед первой проверкой
    setTimeout(checkGamepadAndSetInitialFocus, 200);

    console.log("Home page script initialization finished.");
}); // Конец DOMContentLoaded