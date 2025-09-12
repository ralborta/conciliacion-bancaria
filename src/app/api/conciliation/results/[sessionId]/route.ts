import { NextRequest, NextResponse } from 'next/server'
import { memoryStorage } from '@/lib/storage/memory'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  console.log("🔍 RESULTS API - Inicio");
  
  try {
    const { sessionId } = await params
    console.log("🆔 Session ID recibido:", sessionId);
    
    const results = await memoryStorage.getResults(sessionId)
    const stats = await memoryStorage.getStats(sessionId)
    const session = await memoryStorage.getSession(sessionId)
    
    console.log("📊 Datos obtenidos:", {
      resultsLength: results?.length || 0,
      hasStats: !!stats,
      hasSession: !!session,
      sessionId
    });
    
    if (!session) {
      console.error("❌ SESIÓN NO ENCONTRADA:", sessionId);
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404, headers: corsHeaders }
      )
    }
    
    console.log("✅ Enviando resultados:", {
      sessionId,
      resultsCount: results?.length || 0,
      stats: stats
    });
    
    return NextResponse.json({
      sessionId,
      results,
      stats,
      session
    }, { headers: corsHeaders })
    
  } catch (error) {
    console.error("❌ ERROR EN RESULTS API:", error);
    const errorObj = error as Error;
    return NextResponse.json(
      { error: 'Error interno del servidor', details: errorObj.message },
      { status: 500, headers: corsHeaders }
    )
  }
}
