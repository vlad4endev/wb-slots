import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    console.log(`🔍 Проверка доступности WB API для пользователя: ${user.id}`);
    
    const endpoints = [
      {
        url: 'https://suppliers-api.wildberries.ru/api/v1/warehouses',
        name: 'Официальный WB API',
        description: 'Основной endpoint для получения складов'
      }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`⏳ Проверяю: ${endpoint.url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
        
        const startTime = Date.now();
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'WB-Slots/1.0.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const contentType = response.headers.get('content-type');
        
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          description: endpoint.description,
          status: response.status,
          statusText: response.statusText,
          responseTime: responseTime,
          contentType: contentType,
          isJson: contentType?.includes('application/json') || false,
          accessible: response.status >= 200 && response.status < 300,
          error: null
        });
        
        console.log(`✅ ${endpoint.name}: ${response.status} (${responseTime}ms)`);
        
      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - Date.now();
        
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          description: endpoint.description,
          status: null,
          statusText: null,
          responseTime: responseTime,
          contentType: null,
          isJson: false,
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        console.log(`❌ ${endpoint.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    const accessibleEndpoints = results.filter(r => r.accessible);
    const jsonEndpoints = results.filter(r => r.isJson);
    
    const summary = {
      totalEndpoints: results.length,
      accessibleEndpoints: accessibleEndpoints.length,
      jsonEndpoints: jsonEndpoints.length,
      hasWorkingApi: accessibleEndpoints.length > 0 && jsonEndpoints.length > 0,
      recommendation: accessibleEndpoints.length > 0 && jsonEndpoints.length > 0
        ? 'API доступен и возвращает JSON. Добавьте токен MARKETPLACE для получения всех складов.'
        : 'API недоступен или не возвращает JSON. Используются fallback данные.'
    };
    
    console.log('📊 Результат проверки WB API:', summary);
    
    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        userEmail: user.email,
        summary,
        endpoints: results,
        timestamp: new Date().toISOString()
      },
      message: summary.recommendation
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки WB API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка проверки доступности WB API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
