"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WBSuppliesClient = void 0;
const base_client_1 = require("./base-client");
class WBSuppliesClient extends base_client_1.BaseWBClient {
    constructor(token) {
        super(token, 'https://supplies-api.wildberries.ru');
    }
    async getCoefficients(warehouseIds, dateFrom, dateTo, isSortingCenter) {
        const params = {
            warehouseIDs: warehouseIds.join(','),
        };
        if (dateFrom) {
            params.dateFrom = dateFrom;
        }
        if (dateTo) {
            params.dateTo = dateTo;
        }
        if (isSortingCenter !== undefined) {
            params.isSortingCenter = isSortingCenter;
        }
        const startTime = Date.now();
        console.log(`🌐 WB API запрос: GET /api/v1/acceptance/coefficients`);
        console.log(`📋 Параметры:`, params);
        console.log(`🕐 Время запроса: ${new Date().toISOString()}`);
        console.log(`🏪 Склады: ${warehouseIds.join(', ')}`);
        console.log(`📅 Период: ${dateFrom || 'не указано'} - ${dateTo || 'не указано'}`);
        console.log(`🏭 Сортировочный центр: ${isSortingCenter ? 'Да' : 'Нет'}`);
        const response = await this.get('/api/v1/acceptance/coefficients', params);
        const endTime = Date.now();
        const requestDuration = endTime - startTime;
        const coefficients = Array.isArray(response) ? response : (response.data || []);
        console.log(`📥 Ответ WB API получен за ${requestDuration}ms`);
        console.log(`📊 Статистика ответа:`, {
            dataLength: coefficients.length,
            hasData: coefficients.length > 0,
            requestDuration: `${requestDuration}ms`,
            timestamp: new Date().toISOString()
        });
        if (coefficients.length > 0) {
            console.log(`📋 Пример данных из ответа (${coefficients.length} записей):`);
            console.log(JSON.stringify(coefficients[0], null, 2));
            const coefficientStats = {
                min: Math.min(...coefficients.map((c) => c.coefficient)),
                max: Math.max(...coefficients.map((c) => c.coefficient)),
                avg: coefficients.reduce((sum, c) => sum + c.coefficient, 0) / coefficients.length,
                available: coefficients.filter((c) => c.allowUnload).length,
                total: coefficients.length
            };
            console.log(`📈 Статистика коэффициентов:`, coefficientStats);
        }
        else {
            console.log(`⚠️ WB API вернул пустой массив. Возможные причины:`);
            console.log(`   - Неправильные параметры запроса`);
            console.log(`   - Проблемы с авторизацией`);
            console.log(`   - Склад не имеет доступных слотов`);
            console.log(`   - Неправильный формат дат`);
            console.log(`   - Период поиска не содержит доступных дат`);
        }
        const result = coefficients;
        console.log(`✅ Успешно получено коэффициентов: ${result.length}`);
        return result;
    }
    async getWarehouses() {
        const response = await this.get('/api/v1/warehouses');
        return response.data || [];
    }
    async getAcceptanceOptions(barcodes, quantities) {
        if (barcodes.length !== quantities.length) {
            throw new Error('Barcodes and quantities arrays must have the same length');
        }
        const data = barcodes.map((barcode, index) => ({
            barcode,
            quantity: quantities[index],
        }));
        const response = await this.post('/api/v1/acceptance/options', data);
        return response.data || [];
    }
    async getSupplies(limit = 1000, offset = 0, statusIDs = [5, 6], dateFrom, dateTo) {
        const params = {
            limit,
            offset,
        };
        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        const fromDate = dateFrom || oneWeekAgo.toISOString().split('T')[0];
        const toDate = dateTo || now.toISOString().split('T')[0];
        const requestBody = {
            statusIDs: statusIDs,
            dates: [
                {
                    from: fromDate,
                    till: toDate,
                    type: "factDate"
                }
            ]
        };
        console.log(`🌐 WB API запрос: POST /api/v1/supplies`);
        console.log(`📋 Параметры:`, params);
        console.log(`📦 Тело запроса:`, requestBody);
        console.log(`🕐 Время запроса: ${new Date().toISOString()}`);
        console.log(`📅 Период поиска: ${fromDate} - ${toDate} (последняя неделя)`);
        console.log(`📊 Статусы поставок: [${statusIDs.join(', ')}] (1 = не запланировано)`);
        const curlCommand = `curl -X POST "https://supplies-api.wildberries.ru/api/v1/supplies?limit=${limit}&offset=${offset}" \\
  -H "Authorization: ${this.token.substring(0, 10)}..." \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestBody, null, 2)}'`;
        console.log(`🔧 Эквивалентный curl запрос:`);
        console.log(curlCommand);
        const response = await this.post('/api/v1/supplies', requestBody, params);
        console.log(`📥 Ответ WB API получен`);
        console.log(`📊 Статистика ответа:`, {
            dataLength: response.data?.length || 0,
            hasData: response.data?.length > 0,
            timestamp: new Date().toISOString()
        });
        return response.data || [];
    }
    async getSupplyDetails(supplyId) {
        const response = await this.get(`/api/v1/supplies/${supplyId}`);
        return response.data;
    }
    async getSupplyGoods(supplyId) {
        const response = await this.get(`/api/v1/supplies/${supplyId}/goods`);
        return response.data || [];
    }
    async searchAvailableSlots(warehouseIds, boxTypeIds, dateFrom, dateTo, coefficientThreshold = 0, allowUnload = true) {
        const coefficients = await this.getCoefficients(warehouseIds, dateFrom, dateTo);
        return coefficients.filter(coeff => warehouseIds.includes(coeff.warehouseID) &&
            coeff.coefficient >= coefficientThreshold &&
            coeff.allowUnload === allowUnload);
    }
    async checkSlotAvailability(warehouseId, boxTypeId, date) {
        try {
            const coefficients = await this.getCoefficients([warehouseId], date, date);
            const coeff = coefficients.find(c => c.warehouseID === warehouseId);
            return coeff ? coeff.coefficient >= 0 && coeff.allowUnload : false;
        }
        catch (error) {
            console.error('Error checking slot availability:', error);
            return false;
        }
    }
}
exports.WBSuppliesClient = WBSuppliesClient;
//# sourceMappingURL=supplies-client.js.map