import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 === INCOMING REQUEST DEBUG ===');
    console.log('URL:', request.url);
    console.log('Method:', request.method);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    // Get request body
    let body;
    try {
      body = await request.json();
      console.log('Request body:', JSON.stringify(body, null, 2));
    } catch (error) {
      console.log('Error parsing body:', error);
      body = 'Could not parse body';
    }
    
    console.log('=== END REQUEST DEBUG ===');
    
    return NextResponse.json({
      success: true,
      message: 'Request logged successfully',
      receivedData: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: body
      }
    });
    
  } catch (error) {
    console.error('Error in log-request:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
