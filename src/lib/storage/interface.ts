import { MatchResult, ConciliationStats, UploadedFile } from '@/lib/types/conciliacion'

export interface StorageAdapter {
  saveSession(sessionId: string, data: any): Promise<void>
  getSession(sessionId: string): Promise<any>
  saveResults(sessionId: string, results: MatchResult[]): Promise<void>
  getResults(sessionId: string): Promise<MatchResult[]>
  saveStats(sessionId: string, stats: ConciliationStats): Promise<void>
  getStats(sessionId: string): Promise<ConciliationStats>
  saveFile(sessionId: string, file: UploadedFile): Promise<string>
  getFile(sessionId: string, fileType: string): Promise<File | null>
  deleteSession(sessionId: string): Promise<void>
  listSessions(): Promise<string[]>
}
