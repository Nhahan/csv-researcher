import { DatabaseRow } from '../lib/database';

// ==================== 채팅 관련 타입 ====================
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  fileId?: string;
}

// ==================== ReAct 관련 타입 ====================

// ReAct 논문 기반 추론 상태 추적
export interface ReActState {
  currentPlan: string[];
  completedActions: string[];
  observations: string[];
  currentThought: string;
  needsReplan: boolean;
  errorCount: number;
  apiCallCount: number; // LLM API 호출 횟수 추적
}

// 쿼리 결과 인터페이스 (ReAct 패턴 강화)
export interface QueryResult {
  success: boolean;
  data?: DatabaseRow[];
  rowCount?: number;
  error?: string;
  message: string;
  reasoning?: string;
  observation?: string; // ReAct 논문: 행동 결과 관찰
  shouldReplan?: boolean; // ReAct 논문: 계획 재수립 필요 여부
}

// ==================== ReAct 도구 파라미터 타입들 ====================
export interface PlanActionsParams {
  question: string;
  context: string;
  reasoning: string;
}

export interface TrackProgressParams {
  currentAction: string;
  result: string;
  reasoning: string;
}

export interface ExecuteSqlParams {
  query: string;
  fileId: string;
  reasoning?: string;
}

export interface GetTableSchemaParams {
  fileId: string;
  reasoning?: string;
}

export interface GetSampleDataParams {
  fileId: string;
  limit?: number;
  reasoning?: string;
}

export interface ReflectOnResultsParams {
  results: string;
  question: string;
  reasoning: string;
}

export interface SummarizeFindingsParams {
  findings: string[];
  question: string;
  reasoning: string;
}

// ==================== ReAct 설정 관련 ====================
export interface ReActAgentConfig {
  fileId: string;
  fileName: string;
  temperature?: number;
  maxRetries?: number;
}

// 진행 상황 추적 데이터
export interface ProgressData {
  completed: string[];
  remaining: string[];
  progress: number;
  observations: string[];
}

// ==================== 파일 및 데이터 관련 타입 ====================
export interface FileUploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  error?: string;
}

export interface AnalysisRequest {
  query: string;
  fileId: string;
  fileName: string;
}

export interface AnalysisResponse {
  success: boolean;
  result?: string;
  error?: string;
  reasoning?: string[];
} 