import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sslDiagnostics } from '@/lib/wb-client/ssl-diagnostics';
import { sslErrorHandler } from '@/lib/wb-client/ssl-error-handler';
import { robustHTTPClient } from '@/lib/wb-client/robust-http-client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    
    const apiType = searchParams.get('apiType') || 'all';
    const detailed = searchParams.get('detailed') === 'true';

    console.log(`🔍 Запуск SSL диагностики для пользователя ${user.id}, API: ${apiType}`);

    let reports;

    if (apiType === 'all') {
      reports = await sslDiagnostics.diagnoseAllAPIs();
    } else {
      const report = await sslDiagnostics.diagnoseAPI(apiType);
      reports = [report];
    }

    const summary = sslDiagnostics.generateSummaryReport(reports);

    // Получаем статистику по endpoints
    const endpointStats = sslErrorHandler.getEndpointStats();

    const response = {
      success: true,
      data: {
        summary,
        reports: detailed ? reports : reports.map(report => ({
          apiType: report.apiType,
          totalEndpoints: report.totalEndpoints,
          workingEndpoints: report.workingEndpoints,
          sslIssues: report.sslIssues,
          overallHealth: report.summary.overallHealth,
          bestEndpoint: report.summary.bestEndpoint,
          recommendations: report.recommendations
        })),
        endpointStats,
        timestamp: new Date().toISOString(),
        userId: user.id
      }
    };

    console.log(`✅ SSL диагностика завершена для пользователя ${user.id}`);
    console.log(`📊 Результат: ${summary.workingEndpoints}/${summary.totalEndpoints} endpoints работают`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Ошибка SSL диагностики:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'SSL diagnostics failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    const { action, endpoint, apiType } = body;

    console.log(`🔧 SSL диагностика POST запрос от пользователя ${user.id}:`, { action, endpoint, apiType });

    switch (action) {
      case 'check_endpoint':
        if (!endpoint) {
          return NextResponse.json(
            { success: false, error: 'Endpoint is required' },
            { status: 400 }
          );
        }

        const health = await robustHTTPClient.checkEndpointHealth(endpoint);
        
        return NextResponse.json({
          success: true,
          data: {
            endpoint,
            health,
            timestamp: new Date().toISOString()
          }
        });

      case 'check_all_endpoints':
        if (!apiType) {
          return NextResponse.json(
            { success: false, error: 'API type is required' },
            { status: 400 }
          );
        }

        const allEndpoints = await robustHTTPClient.checkAllEndpoints(apiType);
        
        return NextResponse.json({
          success: true,
          data: {
            apiType,
            endpoints: allEndpoints,
            timestamp: new Date().toISOString()
          }
        });

      case 'update_endpoint_status':
        const { url, isWorking } = body;
        
        if (!url || typeof isWorking !== 'boolean') {
          return NextResponse.json(
            { success: false, error: 'URL and isWorking status are required' },
            { status: 400 }
          );
        }

        sslErrorHandler.updateEndpointStatus(url, isWorking);
        
        return NextResponse.json({
          success: true,
          data: {
            message: 'Endpoint status updated',
            url,
            isWorking,
            timestamp: new Date().toISOString()
          }
        });

      case 'get_endpoint_stats':
        const stats = sslErrorHandler.getEndpointStats();
        
        return NextResponse.json({
          success: true,
          data: {
            stats,
            timestamp: new Date().toISOString()
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Ошибка SSL диагностики POST:', error);
    
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'SSL diagnostics action failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
