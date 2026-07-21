/**
 * Актуальные селекторы для работы с Wildberries
 * Обновлено на основе реальных селекторов сайта
 */

export const WB_SELECTORS = {
  // Авторизация
  AUTH: {
    // Поле ввода номера телефона
    PHONE_INPUT: '#root > div > div.Page__login-form-wrapper-4AMotcBsmv > div > div.LoginFormView__input > form > div > div.FormPhoneInputBorderless__input-wrapper-PGFy5abTfm',
    // Поле ввода SMS кода
    SMS_CODE_INPUT: '#Portal-modal > div > div > div > div > div > div > div.CodeInputContentView > div.CodeInputContentView__code-wrapper > form > div > ul',
    // Кнопка отправки SMS
    SMS_SEND_BUTTON: '#Portal-modal > div > div > div > div > div > div > div.CodeInputContentView > div.CodeInputContentView__code-wrapper > form > div > button',
    // Кнопка входа
    LOGIN_BUTTON: '#root > div > div.Page__login-form-wrapper-4AMotcBsmv > div > div.LoginFormView__input > form > div > button'
  },

  // Основной контент
  MAIN_CONTENT: {
    // Главный контейнер приложения
    APP_CONTENT: '#app-content-id',
    // Дочерний контент
    CHILDREN: '.app_Content__children__2mrvJ',
    // Основной лейаут
    MAIN_LAYOUT: '.Main-layout__QrWWjB8D-d',
    // Блок контента
    CONTENT_BLOCK: '.Main-layout__content-block__FKdy15MrbO'
  },

  // Поставки
  SUPPLIES: {
    // Страница поставок
    PAGE: '.Page__T92U2hfQ0I',
    // Внутренний контейнер поставок
    INNER: '.All-supplies-inner',
    // Таблица поставок
    TABLE: '.All-supplies-inner__table__nJF8PMIHkQ',
    // Строка поставки (пример для второй строки)
    ROW: (index: number) => `#app-content-id > div.app_Content__children__2mrvJ > div > div > div.Main-layout__QrWWjB8D-d > div > div.Main-layout__content-block__FKdy15MrbO > div.Page__T92U2hfQ0I > div > div > div.All-supplies-inner > div.All-supplies-inner__table__nJF8PMIHkQ > div > div > div > table > tbody > tr:nth-child(${index}) > td:nth-child(1)`,
    // Кнопка "Запланировать поставку"
    PLAN_BUTTON: '#app-content-id > div.app_Content__children__2mrvJ > div > div > div.Breadcrumbs-layout > div > div.Page__DaM7iUg46W > div > div > div.Supply-detail-view__stack__Z-qMMZhsZq > div.Supply-detail-options > div > div.Supply-detail-options__wrapper__CyOfW5jY0y > div > div.Supply-detail-options__plan-desktop-button__-N407e2FDC > button'
  },

  // Календарь лотов
  CALENDAR: {
    // Модальное окно календаря
    MODAL: '#Portal-CalendarPlanModal',
    // Контент модального окна
    MODAL_CONTENT: '#Portal-CalendarPlanModal > div > div > div > div.Modal__content__tdLj90YfdL',
    // Календарная сетка
    GRID: '#Portal-CalendarPlanModal .calendar-grid',
    // Свободные слоты
    FREE_SLOTS: '#Portal-CalendarPlanModal .calendar-slot.free',
    // Выбранный слот
    SELECTED_SLOT: '#Portal-CalendarPlanModal .calendar-slot.selected'
  },

  // Общие селекторы для проверки авторизации
  AUTH_INDICATORS: [
    '#app-content-id',
    '.app_Content__children__2mrvJ',
    '.Main-layout__QrWWjB8D-d',
    '.Main-layout__content-block__FKdy15MrbO',
    '.Page__T92U2hfQ0I',
    '.All-supplies-inner',
    '.All-supplies-inner__table__nJF8PMIHkQ'
  ],

  // Селекторы для страниц логина
  LOGIN_INDICATORS: [
    '#root > div > div.Page__login-form-wrapper-4AMotcBsmv',
    '.LoginFormView__input',
    '.FormPhoneInputBorderless__input-wrapper-PGFy5abTfm',
    '#Portal-modal > div > div > div > div > div > div > div.CodeInputContentView'
  ]
};

/**
 * Проверяет, находимся ли мы на странице авторизации
 */
export function isLoginPage(url: string, pageTitle: string): boolean {
  const loginUrls = ['/login', 'seller-auth.wildberries.ru', '/auth', '/signin'];
  const loginTitles = ['вход', 'login', 'авторизация', 'signin'];
  
  const isLoginUrl = loginUrls.some(loginUrl => url.includes(loginUrl));
  const isLoginTitle = loginTitles.some(title => pageTitle.toLowerCase().includes(title));
  
  return isLoginUrl || isLoginTitle;
}

/**
 * Проверяет, находимся ли мы на странице поставок
 */
export function isSuppliesPage(url: string): boolean {
  return url.includes('/supplies-management/') || 
         url.includes('/supplies-management/all-supplies') ||
         url.includes('seller.wildberries.ru') && !isLoginPage(url, '');
}

/**
 * Получает селектор для строки поставки по индексу
 */
export function getSupplyRowSelector(index: number): string {
  return WB_SELECTORS.SUPPLIES.ROW(index);
}

/**
 * Получает селектор для свободного слота в календаре
 */
export function getFreeSlotSelector(): string {
  return WB_SELECTORS.CALENDAR.FREE_SLOTS;
}
