import Database from 'better-sqlite3';
import path from 'path';

// 데이터베이스 인터페이스 정의
export interface DatabaseRow {
  [key: string]: unknown;
}

export interface DatabaseResult {
  success: boolean;
  data?: DatabaseRow[];
  rowCount?: number;
  error?: string;
  lastInsertRowid?: number;
  changes?: number;
}

// 데이터베이스 추상화 클래스
export class DatabaseManager {
  private db: Database.Database;
  private static instance: DatabaseManager;

  private constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'database.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private initializeTables(): void {
    // files 테이블 생성
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        displayName TEXT,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        columns TEXT NOT NULL,
        columnCount INTEGER NOT NULL,
        rowCount INTEGER NOT NULL,
        columnMapping TEXT NOT NULL
      )
    `);

    // chat_history 테이블 생성
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fileId TEXT NOT NULL,
        userMessage TEXT NOT NULL,
        aiResponse TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fileId) REFERENCES files (id) ON DELETE CASCADE
      )
    `);
  }

  // SELECT 쿼리 실행
  public select(query: string, params: unknown[] = []): DatabaseResult {
    try {
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as DatabaseRow[];
      return {
        success: true,
        data: rows,
        rowCount: rows.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 단일 행 SELECT
  public selectOne(query: string, params: unknown[] = []): DatabaseResult {
    try {
      const stmt = this.db.prepare(query);
      const row = stmt.get(...params) as DatabaseRow | undefined;
      return {
        success: true,
        data: row ? [row] : [],
        rowCount: row ? 1 : 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // INSERT/UPDATE/DELETE 쿼리 실행
  public execute(query: string, params: unknown[] = []): DatabaseResult {
    try {
      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);
      return {
        success: true,
        lastInsertRowid: result.lastInsertRowid as number,
        changes: result.changes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 트랜잭션 실행
  public transaction<T>(callback: () => T): { success: boolean; result?: T; error?: string } {
    const transaction = this.db.transaction(() => {
      return callback();
    });

    try {
      const result = transaction();
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 테이블 정보 조회
  public getTableInfo(tableName: string): DatabaseResult {
    return this.select(`PRAGMA table_info("${tableName}")`);
  }

  // 테이블 존재 여부 확인
  public tableExists(tableName: string): boolean {
    const result = this.selectOne(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return result.success && result.rowCount! > 0;
  }

  // 테이블 삭제
  public dropTable(tableName: string): DatabaseResult {
    return this.execute(`DROP TABLE IF EXISTS "${tableName}"`);
  }

  // 데이터베이스 연결 종료
  public close(): void {
    this.db.close();
  }
}

// 싱글톤 인스턴스 내보내기
export const db = DatabaseManager.getInstance(); 