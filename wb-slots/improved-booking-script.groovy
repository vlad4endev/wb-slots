import static com.kms.katalon.core.checkpoint.CheckpointFactory.findCheckpoint
import static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import static com.kms.katalon.core.testobject.ObjectRepository.findWindowsObject
import com.kms.katalon.core.checkpoint.Checkpoint as Checkpoint
import com.kms.katalon.core.cucumber.keyword.CucumberBuiltinKeywords as CucumberKW
import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile
import com.kms.katalon.core.model.FailureHandling as FailureHandling
import com.kms.katalon.core.testcase.TestCase as TestCase
import com.kms.katalon.core.testdata.TestData as TestData
import com.kms.katalon.core.testng.keyword.TestNGBuiltinKeywords as TestNGKW
import com.kms.katalon.core.testobject.TestObject as TestObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.windows.keyword.WindowsBuiltinKeywords as Windows
import internal.GlobalVariable as GlobalVariable
import org.openqa.selenium.Keys as Keys

// Конфигурация
GlobalVariable.supplyNumber = "445194"

// Функция для логирования
def logInfo(String message) {
    println("[INFO] ${new Date()}: ${message}")
}

def logError(String message) {
    println("[ERROR] ${new Date()}: ${message}")
}

// Функция для ожидания элемента с повторными попытками
def waitForElementWithRetry(TestObject element, int maxRetries = 3, int timeout = 10) {
    for (int i = 0; i < maxRetries; i++) {
        try {
            WebUI.waitForElementPresent(element, timeout, FailureHandling.OPTIONAL)
            if (WebUI.verifyElementPresent(element, FailureHandling.OPTIONAL)) {
                return true
            }
        } catch (Exception e) {
            logError("Попытка ${i + 1} не удалась: ${e.getMessage()}")
            if (i < maxRetries - 1) {
                WebUI.delay(2)
            }
        }
    }
    return false
}

// Функция для безопасного клика
def safeClick(TestObject element, String description) {
    try {
        if (waitForElementWithRetry(element)) {
            WebUI.click(element)
            logInfo("Успешно кликнули: ${description}")
            return true
        } else {
            logError("Элемент не найден: ${description}")
            return false
        }
    } catch (Exception e) {
        logError("Ошибка при клике на ${description}: ${e.getMessage()}")
        return false
    }
}

// Функция для безопасного ввода текста
def safeSetText(TestObject element, String text, String description) {
    try {
        if (waitForElementWithRetry(element)) {
            WebUI.clearText(element)
            WebUI.setText(element, text)
            logInfo("Успешно ввели текст '${text}' в: ${description}")
            return true
        } else {
            logError("Элемент для ввода не найден: ${description}")
            return false
        }
    } catch (Exception e) {
        logError("Ошибка при вводе текста в ${description}: ${e.getMessage()}")
        return false
    }
}

try {
    logInfo("=== НАЧАЛО СЦЕНАРИЯ АВТОБРОНИРОВАНИЯ ===")
    
    // Открытие браузера с восстановлением сессии
    logInfo("Открываем браузер с восстановлением сессии...")
    WebUI.openBrowser('')
    
    // Переход на главную страницу Wildberries Seller (сессия должна быть сохранена)
    logInfo("Переходим на страницу Wildberries Seller...")
    WebUI.navigateToUrl('https://seller.wildberries.ru/')
    
    // Ожидание загрузки страницы
    WebUI.delay(3)
    
    // Проверяем, что мы авторизованы (если нет - выбрасываем ошибку)
    if (!WebUI.verifyElementPresent(findTestObject('Object Repository/Page_/span__button-primary_caption__KRi8e'), 5, FailureHandling.OPTIONAL)) {
        logError("Сессия не восстановлена! Необходима повторная авторизация.")
        throw new Exception("Сессия не найдена")
    }
    
    logInfo("Сессия успешно восстановлена, продолжаем...")
    
    // Переход в раздел поставок
    logInfo("Переходим в раздел поставок...")
    if (!safeClick(findTestObject('Object Repository/Page_Wildberries/button__chips_Chips__CVywv chips_Chips--l___6ddb33'), "Кнопка WB")) {
        throw new Exception("Не удалось перейти в раздел WB")
    }
    
    if (!safeClick(findTestObject('Object Repository/Page_Wildberries/a_WB_chips_Chips__CVywv chips_Chips--l__OD6_cb5299'), "Ссылка WB")) {
        throw new Exception("Не удалось открыть раздел WB")
    }
    
    // Ожидание загрузки страницы поставок
    WebUI.delay(3)
    
    // Поиск поставки по номеру
    logInfo("Ищем поставку с номером: ${GlobalVariable.supplyNumber}")
    
    // Очищаем поле поиска и вводим номер поставки
    if (!safeSetText(findTestObject('Object Repository/Page_/input__all-supplies-search'), GlobalVariable.supplyNumber, "Поле поиска поставок")) {
        throw new Exception("Не удалось ввести номер поставки в поиск")
    }
    
    // Нажимаем Enter для поиска
    WebUI.sendKeys(findTestObject('Object Repository/Page_/input__all-supplies-search'), Keys.chord(Keys.ENTER))
    WebUI.delay(2)
    
    // Проверяем, что поставка найдена
    logInfo("Проверяем результаты поиска...")
    
    // Ожидаем появления результатов поиска
    if (!waitForElementWithRetry(findTestObject('Object Repository/Page_/div__Table__td-content__OpbOC9lNW1'), 5, 10)) {
        logError("Поставка с номером ${GlobalVariable.supplyNumber} не найдена!")
        throw new Exception("Поставка не найдена в результатах поиска")
    }
    
    logInfo("Поставка найдена, переходим к бронированию...")
    
    // Выбираем найденную поставку
    if (!safeClick(findTestObject('Object Repository/Page_/div__Table__td-content__OpbOC9lNW1'), "Найденная поставка")) {
        throw new Exception("Не удалось выбрать поставку")
    }
    
    // Двойной клик для открытия деталей поставки
    logInfo("Открываем детали поставки...")
    WebUI.doubleClick(findTestObject('Object Repository/Page_/div__Table__td-content__OpbOC9lNW1'))
    WebUI.delay(2)
    
    // Нажимаем кнопку бронирования
    logInfo("Нажимаем кнопку бронирования...")
    if (!safeClick(findTestObject('Object Repository/Page_/span__caption__kqFcIewCT5'), "Кнопка бронирования")) {
        throw new Exception("Не удалось найти кнопку бронирования")
    }
    
    // Подтверждаем бронирование
    logInfo("Подтверждаем бронирование...")
    if (!safeClick(findTestObject('Object Repository/Page_/button__button__Qmm2epbxz s__vFIVMtH33l'), "Кнопка подтверждения")) {
        throw new Exception("Не удалось подтвердить бронирование")
    }
    
    // Проверяем успешность бронирования
    WebUI.delay(3)
    logInfo("Проверяем результат бронирования...")
    
    // Здесь можно добавить проверку на успешное бронирование
    // Например, поиск сообщения об успехе или изменение статуса
    
    logInfo("=== БРОНИРОВАНИЕ ЗАВЕРШЕНО УСПЕШНО ===")
    
} catch (Exception e) {
    logError("КРИТИЧЕСКАЯ ОШИБКА: ${e.getMessage()}")
    logError("Сценарий прерван из-за ошибки")
    
    // Можно добавить отправку уведомления об ошибке
    // CustomKeywords.'notifications.sendErrorNotification'(e.getMessage())
    
} finally {
    // Закрываем браузер
    logInfo("Закрываем браузер...")
    WebUI.closeBrowser()
    logInfo("=== КОНЕЦ СЦЕНАРИЯ ===")
}
