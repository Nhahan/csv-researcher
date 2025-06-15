import { ReActState } from '../types';

// 전역 reasoning 콜백 저장
let globalReasoningCallback: ((reasoning: string) => void) | undefined;

// 전역 ReAct 상태
let globalReActState: ReActState = {
  currentPlan: [],
  completedActions: [],
  observations: [],
  currentThought: '',
  needsReplan: false,
  errorCount: 0,
  apiCallCount: 0
};

// ReAct 상태 관리 함수들
export const ReActStateManager = {
  // reasoning 콜백 설정
  setReasoningCallback: (callback?: (reasoning: string) => void) => {
    globalReasoningCallback = callback;
  },

  // reasoning 콜백 가져오기
  getReasoningCallback: () => globalReasoningCallback,

  // 상태 초기화
  resetState: () => {
    globalReActState = {
      currentPlan: [],
      completedActions: [],
      observations: [],
      currentThought: '',
      needsReplan: false,
      errorCount: 0,
      apiCallCount: 0
    };
  },

  // 현재 상태 가져오기
  getState: () => ({ ...globalReActState }),

  // 계획 설정
  setPlan: (plan: string[]) => {
    globalReActState.currentPlan = plan;
    globalReActState.completedActions = [];
    globalReActState.observations = [];
    globalReActState.needsReplan = false;
    globalReActState.errorCount = 0;
    // apiCallCount는 리셋하지 않음 (전체 세션 동안 누적)
  },

  // 행동 완료 추가
  addCompletedAction: (action: string) => {
    if (!globalReActState.completedActions.includes(action)) {
      globalReActState.completedActions.push(action);
    }
  },

  // 관찰 추가
  addObservation: (observation: string) => {
    globalReActState.observations.push(observation);
  },

  // 현재 생각 설정
  setCurrentThought: (thought: string) => {
    globalReActState.currentThought = thought;
  },

  // 재계획 필요성 설정
  setNeedsReplan: (needsReplan: boolean) => {
    globalReActState.needsReplan = needsReplan;
  },

  // 오류 카운트 증가
  incrementErrorCount: () => {
    globalReActState.errorCount++;
  },

  // API 호출 카운트 증가
  incrementApiCallCount: () => {
    globalReActState.apiCallCount++;
  },

  // 진행률 계산
  getProgress: () => {
    const totalSteps = globalReActState.currentPlan.length;
    const completedSteps = globalReActState.completedActions.length;
    return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  },

  // 남은 계획 가져오기
  getRemainingPlan: () => {
    return globalReActState.currentPlan.filter(
      step => !globalReActState.completedActions.includes(step)
    );
  },

  // 재계획 필요성 판단
  shouldReplan: () => {
    return globalReActState.errorCount > 2 || globalReActState.needsReplan;
  },

  // 사용자 친화적 메시지 변환
  convertToUserFriendlyMessage: (reasoning: string): string => {
    return reasoning
      .replace(/테이블\s*조회/g, '데이터 분석')
      .replace(/컬럼\s*조회/g, '필드 분석')
      .replace(/스키마\s*조회/g, '구조 분석')
      .replace(/SQL\s*실행/g, '데이터 분석')
      .replace(/쿼리\s*실행/g, '데이터 분석')
      .replace(/테이블|컬럼|스키마|SQL|쿼리/g, '데이터')
      .replace(/조회|실행/g, '분석')
      .replace(/데이터베이스/g, '정보')
      .replace(/행|row/g, '항목')
      .replace(/데이터\s+데이터/g, '데이터')
      .replace(/분석\s+분석/g, '분석');
  },

  // reasoning 콜백 호출 (사용자 친화적 변환 포함)
  callReasoningCallback: (reasoning: string, prefix?: string) => {
    if (globalReasoningCallback && reasoning) {
      const userFriendlyReasoning = ReActStateManager.convertToUserFriendlyMessage(reasoning);
      const finalMessage = prefix ? `${prefix} ${userFriendlyReasoning}` : userFriendlyReasoning;
      globalReasoningCallback(finalMessage);
    }
  },



  // 내부용 상태 요약 (개발/디버깅용)
  generateInternalSummary: (): string => {
    const state = globalReActState;
    return `
## 분석 과정 요약 (내부용)
- **계획된 단계**: ${state.currentPlan.length}개
- **완료된 행동**: ${state.completedActions.length}개  
- **수집된 관찰**: ${state.observations.length}개
- **오류 복구**: ${state.errorCount}회
- **진행률**: ${ReActStateManager.getProgress()}%
- **LLM API 호출**: ${state.apiCallCount}회
`;
  }
};

// 레거시 호환성을 위한 직접 접근 함수들 (점진적 마이그레이션용)
export const getGlobalReActState = () => globalReActState;
export const setGlobalReActState = (state: Partial<ReActState>) => {
  globalReActState = { ...globalReActState, ...state };
}; 