import { db } from './database';

export interface ChatHistoryItem {
  id: number;
  fileId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: string;
}

// 환경변수에서 컨텍스트 제한 개수 가져오기 (히스토리는 무제한 저장)
const getChatContextLimit = (): number => {
  const limit = process.env.CHAT_CONTEXT_LIMIT;
  return limit ? parseInt(limit, 10) : 3;
};

// 채팅 히스토리 저장 (무제한)
export async function saveChatHistory(
  fileId: string,
  userMessage: string,
  aiResponse: string
): Promise<void> {
  const result = db.execute(
    `INSERT INTO chat_history (fileId, userMessage, aiResponse) VALUES (?, ?, ?)`,
    [fileId, userMessage, aiResponse]
  );
  
  if (!result.success) {
    console.error('채팅 히스토리 저장 실패:', result.error);
    throw new Error(result.error);
  } else {
    console.log(`채팅 히스토리 저장됨: ID ${result.lastInsertRowid}`);
  }
}

// 컨텍스트용 최근 채팅 히스토리 조회 (제한된 개수)
export async function getRecentChatHistory(fileId: string): Promise<ChatHistoryItem[]> {
  const limit = getChatContextLimit();
  
  const result = db.select(
    `SELECT * FROM chat_history 
     WHERE fileId = ? 
     ORDER BY timestamp DESC 
     LIMIT ?`,
    [fileId, limit]
  );
  
  if (!result.success) {
    console.error('채팅 히스토리 조회 실패:', result.error);
    throw new Error(result.error);
  }
  
  // 시간순으로 정렬 (오래된 것부터)
  const history = (result.data as unknown as ChatHistoryItem[]).reverse();
  return history;
}

// 전체 채팅 히스토리 조회 (무제한)
export async function getAllChatHistory(fileId: string): Promise<ChatHistoryItem[]> {
  const result = db.select(
    `SELECT * FROM chat_history 
     WHERE fileId = ? 
     ORDER BY timestamp ASC`,
    [fileId]
  );
  
  if (!result.success) {
    console.error('전체 채팅 히스토리 조회 실패:', result.error);
    throw new Error(result.error);
  }
  
  return result.data as unknown as ChatHistoryItem[];
}

// 히스토리를 컨텍스트 문자열로 포맷팅
export function formatHistoryAsContext(history: ChatHistoryItem[]): string {
  if (history.length === 0) {
    return '';
  }

  const contextLines = history.map((item, index) => {
    return `[이전 대화 ${index + 1}]
사용자: ${item.userMessage}
AI: ${item.aiResponse}`;
  });

  return `이전 대화 컨텍스트:
${contextLines.join('\n\n')}

---

`;
}

// 특정 파일의 모든 히스토리 삭제 (파일 삭제 시 사용)
export async function clearChatHistory(fileId: string): Promise<void> {
  const result = db.execute(
    `DELETE FROM chat_history WHERE fileId = ?`,
    [fileId]
  );
  
  if (!result.success) {
    console.error('채팅 히스토리 삭제 실패:', result.error);
    throw new Error(result.error);
  } else {
    console.log(`파일 ${fileId}의 채팅 히스토리 ${result.changes}개가 삭제되었습니다.`);
  }
}

// 히스토리 개수 조회
export async function getChatHistoryCount(fileId: string): Promise<number> {
  const result = db.selectOne(
    `SELECT COUNT(*) as count FROM chat_history WHERE fileId = ?`,
    [fileId]
  );
  
  if (!result.success) {
    console.error('히스토리 개수 조회 실패:', result.error);
    throw new Error(result.error);
  }
  
  const row = result.data?.[0] as { count: number };
  return row?.count || 0;
}

// 페이지네이션된 채팅 히스토리 조회
export async function getChatHistoryPaginated(
  fileId: string, 
  page: number = 1, 
  limit: number = 10
): Promise<{
  history: ChatHistoryItem[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
}> {
  const offset = (page - 1) * limit;
  
  const historyResult = db.select(
    `SELECT * FROM chat_history 
     WHERE fileId = ? 
     ORDER BY timestamp DESC 
     LIMIT ? OFFSET ?`,
    [fileId, limit, offset]
  );
  
  if (!historyResult.success) {
    console.error('페이지네이션 히스토리 조회 실패:', historyResult.error);
    throw new Error(historyResult.error);
  }
  
  const totalCount = await getChatHistoryCount(fileId);
  
  // 시간순으로 정렬 (오래된 것부터)
  const history = (historyResult.data as unknown as ChatHistoryItem[]).reverse();
  const hasMore = offset + limit < totalCount;

  return {
    history,
    totalCount,
    hasMore,
    currentPage: page
  };
} 