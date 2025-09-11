import { StorageAdapter } from './interface'
import { MatchResult, ConciliationStats, UploadedFile } from '@/lib/types/conciliacion'

interface SessionData {
  id: string
  createdAt: Date
  results: MatchResult[]
  stats: ConciliationStats
  files: Record<string, UploadedFile>
  metadata: Record<string, unknown>
}

export class MemoryStorage implements StorageAdapter {
  private sessions: Map<string, SessionData> = new Map()

  async saveSession(sessionId: string, data: Record<string, unknown>): Promise<void> {
    const existing = this.sessions.get(sessionId) || {
      id: sessionId,
      createdAt: new Date(),
      results: [],
      stats: {
        totalMovimientos: 0,
        conciliados: 0,
        pendientes: 0,
        montoTotal: 0,
        porcentajeConciliacion: 0
      },
      files: {},
      metadata: {}
    }
    
    this.sessions.set(sessionId, {
      ...existing,
      ...data,
      id: sessionId
    })
  }

  async getSession(sessionId: string): Promise<Record<string, unknown> | null> {
    const session = this.sessions.get(sessionId)
    return session ? session as unknown as Record<string, unknown> : null
  }

  async saveResults(sessionId: string, results: MatchResult[]): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.results = results
      this.sessions.set(sessionId, session)
    }
  }

  async getResults(sessionId: string): Promise<MatchResult[]> {
    const session = this.sessions.get(sessionId)
    return session?.results || []
  }

  async saveStats(sessionId: string, stats: ConciliationStats): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.stats = stats
      this.sessions.set(sessionId, session)
    }
  }

  async getStats(sessionId: string): Promise<ConciliationStats> {
    const session = this.sessions.get(sessionId)
    return session?.stats || {
      totalMovimientos: 0,
      conciliados: 0,
      pendientes: 0,
      montoTotal: 0,
      porcentajeConciliacion: 0
    }
  }

  async saveFile(sessionId: string, file: UploadedFile): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.files[file.type] = file
      this.sessions.set(sessionId, session)
    }
    return `${sessionId}/${file.type}`
  }

  async getFile(sessionId: string, fileType: string): Promise<File | null> {
    const session = this.sessions.get(sessionId)
    return session?.files[fileType]?.file || null
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  async listSessions(): Promise<string[]> {
    return Array.from(this.sessions.keys())
  }
}

// Singleton instance
export const memoryStorage = new MemoryStorage()
