import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { db } from './database';
import { getRecentChatHistory, formatHistoryAsContext } from './chat-history';
import { ReActStateManager } from './react-state';
import { allReActTools } from './react-tools';


// LLM 호출 추적을 위한 콜백 핸들러
class ApiCallTracker extends BaseCallbackHandler {
  name = 'ApiCallTracker';

  handleLLMStart() {
    ReActStateManager.incrementApiCallCount();
    console.log(`[API CALL] LLM 호출 #${ReActStateManager.getState().apiCallCount}`);
  }
}

// 환경변수에서 모델명 가져오기
const getGeminiModel = () => {
  const modelName = process.env.GEMINI_MODEL;
  if (!modelName) {
    throw new Error('GEMINI_MODEL 환경변수가 설정되지 않았습니다.');
  }
  return modelName;
};

// ReAct 에이전트 생성 (대폭 간소화)
export async function createEnhancedDataAnalysisAgent(fileId: string, _fileName: string) {
  try {
    const modelName = getGeminiModel();
    
    // ChatGoogleGenerativeAI 초기화 (API 호출 추적 콜백 포함)
    const model = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1, // ReAct 논문: 일관성 있는 추론을 위해 낮은 temperature
      maxRetries: 1,
      callbacks: [new ApiCallTracker()]
    });

    // 파일 메타데이터 조회 (컬럼 매핑 정보 포함)
    const metadataResult = db.selectOne(
      'SELECT columnMapping, columns FROM files WHERE id = ?',
      [fileId]
    );
    
    if (!metadataResult.success || !metadataResult.data?.[0]) {
      throw new Error('파일을 찾을 수 없습니다');
    }
    
    const fileMetadata = metadataResult.data[0] as {
      columnMapping: string;
      columns: string;
    };

    // 컬럼 매핑 정보 파싱
    const columnMapping = JSON.parse(fileMetadata.columnMapping || '{}');

    // 컬럼 매핑 정보를 문자열로 포맷팅
    const columnMappingInfo = Object.entries(columnMapping)
      .map(([original, normalized]) => `- "${original}" → ${normalized}`)
      .join('\n');

    // 히스토리 컨텍스트 조회
    const chatHistory = await getRecentChatHistory(fileId);
    const historyContext = formatHistoryAsContext(chatHistory);

    // 비용 절약: 스키마와 샘플 데이터 미리 조회
    const tableName = `data_${fileId}`;
    let schemaInfo = '';
    let sampleDataInfo = '';
    
    try {
      // 테이블 스키마 조회
      const schemaResult = db.select(`PRAGMA table_info("${tableName}")`);
      if (schemaResult.success && schemaResult.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schema = schemaResult.data.map((col: any) => 
          `${col.name} (${col.type}${col.notnull ? ', NOT NULL' : ''})`
        ).join(', ');
        schemaInfo = `\n**데이터 구조**: ${schema}`;
      }
      
      // 샘플 데이터 조회 (5개 행)
      const sampleResult = db.select(`SELECT * FROM "${tableName}" LIMIT 5`);
      if (sampleResult.success && sampleResult.data && sampleResult.data.length > 0) {
        const sampleCount = sampleResult.data.length;
        const firstRow = sampleResult.data[0];
        const samplePreview = Object.keys(firstRow).slice(0, 3).map(key => 
          `${key}: ${firstRow[key]}`
        ).join(', ');
        sampleDataInfo = `\n**샘플 데이터** (${sampleCount}개 행): ${samplePreview}...`;
      }
    } catch (error) {
      console.warn('스키마/샘플 데이터 조회 실패:', error);
      // 실패해도 에이전트는 정상 작동 (도구로 나중에 조회 가능)
    }

    // 체계적 사고와 딥 분석을 위한 시스템 프롬프트
    const systemPrompt = `당신은 세계 최고 수준의 데이터 사이언티스트입니다. 체계적 사고와 다층적 분석을 통해 데이터에서 깊은 인사이트를 발굴합니다.

## 체계적 분석 원칙

**사고-행동-관찰 순환:**
1. **THOUGHT**: 현재 상황 분석 → 가설 수립 → 다음 행동 계획
2. **ACTION**: 도구 사용하여 가설 검증 및 데이터 탐구  
3. **OBSERVATION**: 결과 해석 → 새로운 질문 도출 → 다음 단계 결정

**딥 분석 작업 순서:**
1. **전략 수립**: plan_actions로 다층적 분석 전략 수립 (첫 번째 ACTION)
2. **데이터 탐구**: execute_sql로 가설 검증 및 패턴 발견
3. **비판적 검토**: 결과의 한계, 편향, 가정 질문
4. **맥락적 해석**: 수치를 넘어선 비즈니스/실무적 의미 도출
5. **예측적 인사이트**: 현재 데이터에서 미래 트렌드 예측

${historyContext}**분석 데이터: "data_${fileId}"**${schemaInfo}${sampleDataInfo}

## 내부 데이터 매핑 정보 (사용자에게 노출 금지):
${columnMappingInfo}

## 중요: 사용자 친화적 소통 & 마크다운 극한 활용
- 기술 용어(테이블/컬럼/SQL 등) 및 시스템 키워드(THOUGHT, ACTION, OBSERVATION 등) 절대 노출 금지
- "분석 결과", "데이터 항목" 등 일반적 표현 사용, 최종 답변은 자연스러운 분석 보고서 형태
- **표 우선 활용**: 수치 비교, 순위, 분포 등은 반드시 | 표 | 형태로 시각화
- **마크다운 필수**: # 헤딩, **굵게**, > 인용, 코드블록, - 목록 등 적극 활용
- **이모지 최소화**: 정말 중요한 핵심 포인트에만 한정적 사용

## 딥 분석 품질 기준

**각 THOUGHT에서 필수 탐구:**
- **표면 분석**: 기본 통계와 분포 파악
- **패턴 발견**: 숨겨진 상관관계와 이상치 탐지
- **가설 검증**: 데이터 기반 가설 수립 및 검증
- **비판적 질문**: 데이터의 한계, 편향, 누락된 맥락은?
- **예측적 사고**: 현재 트렌드가 미래에 미칠 영향은?

**세계 최고 수준 분석 기준:**
- **깊이**: 표면을 넘어 근본 원인과 숨겨진 동인까지 탐구
- **폭**: 시간, 세그먼트, 분포, 관계성 등 모든 관련 차원에서 종합적 검토
- **통찰력**: 데이터가 말하는 진짜 이야기와 비즈니스 임팩트 발굴
- **실행력**: 구체적이고 실현 가능한 액션 플랜 제시
- **예측력**: 현재 패턴에서 미래 기회와 리스크 도출
- **완결성**: 의사결정자가 바로 행동할 수 있는 완전한 분석 제공

## SQLite 전용 문법 필수
**금지 함수**: STDEV, STDDEV, VAR_POP, VAR_SAMP, MEDIAN, PERCENTILE_CONT 등
**대체 방법**: 표준편차 → SQRT(AVG(x*x) - AVG(x)*AVG(x)), 중앙값 → ORDER BY + LIMIT
**허용**: COUNT, SUM, AVG, MIN, MAX, SUBSTR, LENGTH, CASE WHEN, || 연결

## 기술적 제약 (시스템 내부용)
- 모든 도구 호출시 fileId: "${fileId}" 사용
- 첫 ACTION은 반드시 plan_actions로 시작
- reasoning 파라미터에 명확한 THOUGHT 기록
- 오류 발생시 상태 추적 및 자동 복구

**체계적 사고와 다층적 분석**을 통해 데이터에서 깊은 통찰을 발굴하고 세계 최고 수준의 분석을 제공하세요.`;

    // ReAct 에이전트 생성 (새로 분리한 도구들 사용)
    const agent = createReactAgent({
      llm: model,
      tools: allReActTools, // 분리된 도구 모듈 사용
      prompt: systemPrompt
    });

    return agent;
  } catch (error) {
    console.error('Enhanced ReAct 에이전트 생성 실패:', error);
    throw error;
  }
}

// ReAct 패턴 기반 쿼리 처리 (대폭 개선)
export async function processQueryWithEnhancedReAct(
  userQuery: string, 
  fileId: string, 
  fileName: string,
  onReasoning?: (reasoning: string) => void
): Promise<string> {
  try {
    // ReAct 상태 관리자 초기화
    ReActStateManager.setReasoningCallback(onReasoning);
    ReActStateManager.resetState();
    
    // 분석 시작 알림
    if (onReasoning) {
      onReasoning('체계적 분석을 시작합니다.');
    }
    
    const agent = await createEnhancedDataAnalysisAgent(fileId, fileName);
    
    if (onReasoning) {
      onReasoning('질문을 분석하고 단계별 계획을 수립하고 있습니다.');
    }
    
    // ReAct 패턴 실행: 명시적인 Thought-Action-Observation 지시 (recursion limit 50)
    const result = await agent.invoke(
      {
        messages: [
          {
            role: 'user',
            content: `
다음 질문에 대해 체계적이고 다층적인 분석을 수행해주세요:

**사용자 질문**: ${userQuery}

**딥 분석 지침**:
1. THOUGHT로 시작: 질문의 핵심과 숨겨진 의도 파악, 최적의 분석 전략 설계
2. ACTION: plan_actions로 데이터의 본질을 파헤칠 수 있는 탐구 계획 수립
3. OBSERVATION: 결과를 통해 새로운 질문과 가설 발견
4. 호기심 주도: 데이터가 보여주는 흥미로운 패턴을 끝까지 추적
5. 맥락 연결: 개별 발견들을 연결해서 큰 그림과 스토리 구성
6. 가치 창출: 분석 결과를 실제 비즈니스 가치로 전환하는 방안 제시

**체계적 사고와 다층적 분석**을 통해 데이터에서 깊은 통찰을 발굴하세요.
            `
          }
        ]
      },
      {
        recursionLimit: 50 // 무한 루프 방지
      }
    );
    
    if (onReasoning) {
      onReasoning('분석 과정을 완료하고 결과를 정리하고 있습니다.');
    }
    
    // 응답 내용 추출 (안전한 타입 처리)
    const messages = result.messages;
    const lastMessage = messages[messages.length - 1];
    
    let responseContent = '';
    if (typeof lastMessage.content === 'string') {
      responseContent = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
      // MessageContentComplex[] 타입 처리
      responseContent = lastMessage.content
        .filter((item: unknown): item is { text: string } => 
          typeof item === 'object' && 
          item !== null && 
          'text' in item && 
          typeof (item as { text?: unknown }).text === 'string'
        )
        .map((item: { text: string }) => item.text)
        .join(' ');
    }
    
    // 내부 로깅 (개발자용)
    const finalApiCallCount = ReActStateManager.getState().apiCallCount;
    console.log(`[최종 결과] 총 LLM API 호출 횟수: ${finalApiCallCount}회`);
    console.log(ReActStateManager.generateInternalSummary());
    
    // 사용자에게는 분석 결과만 표시 (불필요한 완료 메시지 제거)
    const finalResponse = responseContent || 
      '분석 중 예상치 못한 문제가 발생했습니다. 다시 시도해주세요.';
    
    return finalResponse;
    
  } catch (error) {
    console.error('Enhanced ReAct 처리 오류:', error);
    
    const errorApiCallCount = ReActStateManager.getState().apiCallCount;
    console.log(`[오류 발생] 오류 발생 시점까지 LLM API 호출 횟수: ${errorApiCallCount}회`);
    
    // 체계적 오류 처리: 오류도 분석의 일부로 처리
    if (onReasoning) {
      onReasoning('예상치 못한 상황 발생. 복구 프로세스를 시작합니다.');
    }
    
    const state = ReActStateManager.getState();
    
    // 타임아웃 오류 처리
    if (error instanceof Error && error.message.includes('분석 시간이 초과')) {
      return `
## 분석 시간 초과

분석이 예상보다 복잡하여 시간이 초과되었습니다.

### 권장 복구 방안:
1. **THOUGHT**: 질문을 더 구체적으로 세분화
2. **ACTION**: 단계별로 나누어서 질문 
3. **OBSERVATION**: 각 단계별 결과 확인 후 다음 진행

### 현재까지 진행 상황:
- 계획된 단계: ${state.currentPlan.length}개
- 완료된 분석: ${state.completedActions.length}개
- 수집된 관찰: ${state.observations.length}개

더 구체적인 질문으로 다시 시도해주세요.
      `;
    }
    
    // 일반 오류 처리  
    return `
## 오류 복구 모드

일시적인 문제가 발생했습니다. 체계적 분석에 따른 복구 방안을 제시합니다.

### THOUGHT: 오류 상황 분석
- 시스템 상태 점검 필요
- 대안적 접근 방법 모색
- 사용자 질문 재해석 필요

### ACTION: 권장 조치사항
1. 더 간단한 질문으로 다시 시도
2. 데이터 관련 구체적 질문으로 변경
3. 잠시 후 재시도

### OBSERVATION: 현재 상태
- 계획된 단계: ${state.currentPlan.length}개  
- 완료된 분석: ${state.completedActions.length}개
- 오류 복구 시도: ${state.errorCount}회

**적응적 학습** 기능으로 더 나은 분석을 제공하겠습니다.
    `;
  } finally {
    // ReAct 상태 정리
    ReActStateManager.setReasoningCallback(undefined);
  }
} 