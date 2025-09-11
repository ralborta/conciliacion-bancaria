import { NextRequest, NextResponse } from 'next/server'
import { memoryStorage } from '@/lib/storage/memory'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    
    const results = await memoryStorage.getResults(sessionId)
    const stats = await memoryStorage.getStats(sessionId)
    const session = await memoryStorage.getSession(sessionId)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      sessionId,
      results,
      stats,
      session
    })
    
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
