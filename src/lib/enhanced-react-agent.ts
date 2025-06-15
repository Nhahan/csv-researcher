import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { db, DatabaseRow } from './database';
import { getRecentChatHistory, formatHistoryAsContext } from './chat-history';

// 전역 reasoning 콜백 저장
let globalReasoningCallback: ((reasoning: string) => void) | undefined;

// 환경변수에서 모델명 가져오기
const getGeminiModel = () => {
  const modelName = process.env.GEMINI_MODEL;
  if (!modelName) {
    throw new Error('GEMINI_MODEL 환경변수가 설정되지 않았습니다.');
  }
  return modelName;
};



interface QueryResult {
  success: boolean;
  data?: DatabaseRow[];
  rowCount?: number;
  error?: string;
  message: string;
  reasoning?: string;
}

// 1. SQL 실행 도구
const executeSqlTool = tool(
  async ({ query, fileId, reasoning }: { query: string; fileId: string; reasoning?: string }) => {
    try {
      const thoughtMessage = `[THOUGHT] ${reasoning || '쿼리 실행'}`;
      console.log(thoughtMessage);
      console.log(`[ACTION] Executing SQL for file ${fileId}:`, query);
      
      // reasoning 콜백 호출
      if (globalReasoningCallback && reasoning) {
        const userFriendlyReasoning = reasoning
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
        globalReasoningCallback(userFriendlyReasoning);
      }
      
      // 보안: SELECT 쿼리만 허용
      const trimmedQuery = query.trim().toLowerCase();
      if (!trimmedQuery.startsWith('select')) {
        throw new Error('보안상 SELECT 쿼리만 허용됩니다.');
      }

      // 현재 파일의 테이블명 확인
      const tableName = `data_${fileId}`;
      
      // 쿼리에서 테이블명 검증 (따옴표 포함 버전도 확인)
      const queryLower = query.toLowerCase();
      if (!queryLower.includes(tableName.toLowerCase()) && 
          !queryLower.includes(`"${tableName}"`.toLowerCase()) &&
          !queryLower.includes(`'${tableName}'`.toLowerCase())) {
        throw new Error(`현재 파일의 테이블(${tableName})에만 접근할 수 있습니다.`);
      }

      // 안전을 위해 최대 1000개 행으로 제한
      const limitedQuery = query.toLowerCase().includes('limit') ? query : `${query} LIMIT 1000`;
      
      const dbResult = db.select(limitedQuery);
      if (!dbResult.success) {
        throw new Error(dbResult.error);
      }
      const result = dbResult.data || [];

      const response: QueryResult = {
        success: true,
        data: result,
        rowCount: result.length,
        message: `쿼리가 성공적으로 실행되었습니다. ${result.length}개의 행을 반환했습니다.`,
        reasoning: reasoning
      };

      console.log(`[OBSERVATION] 쿼리 결과: ${result.length}개 행 반환`);
      return response;
    } catch (error) {
      console.error('[ERROR] SQL 실행 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '쿼리 실행 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'execute_sql',
    description: '현재 파일의 데이터에 대해 SELECT 쿼리를 실행합니다. fileId 파라미터는 시스템에서 제공된 정확한 값을 사용하세요.',
    schema: z.object({
      query: z.string().describe('실행할 SQL SELECT 쿼리'),
      fileId: z.string().describe('현재 분석 중인 파일의 ID (시스템에서 제공된 정확한 값 사용)'),
      reasoning: z.string().optional().describe('이 쿼리를 실행하는 이유나 가설')
    })
  }
);

// 2. 테이블 스키마 조회 도구
const getTableSchemaTool = tool(
  async ({ fileId, reasoning }: { fileId: string; reasoning?: string }) => {
    try {
      const thoughtMessage = `[THOUGHT] ${reasoning || '테이블 스키마 분석 필요'}`;
      console.log(thoughtMessage);
      console.log(`[ACTION] Getting schema for file ${fileId}`);
      
      // reasoning 콜백 호출 (사용자 친화적 메시지로 변환)
      if (globalReasoningCallback && reasoning) {
        const userFriendlyReasoning = reasoning
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
        globalReasoningCallback(userFriendlyReasoning);
      }
      
      const tableName = `data_${fileId}`;
      
      const schemaResult = db.select(`PRAGMA table_info("${tableName}")`);
      if (!schemaResult.success) {
        console.error(`스키마 조회 오류 - 테이블명: ${tableName}`, schemaResult.error);
        throw new Error(schemaResult.error);
      }
      console.log(`스키마 조회 성공 - 테이블명: ${tableName}, 컬럼 수: ${schemaResult.data?.length}`);
      const schema = schemaResult.data || [];

      const formattedSchema = schema.map((col: DatabaseRow) => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        defaultValue: col.dflt_value
      }));

      console.log(`[OBSERVATION] 테이블 구조 파악: ${formattedSchema.length}개 컬럼`);
      
      return {
        success: true,
        tableName,
        schema: formattedSchema,
        message: `테이블 ${tableName}의 스키마 정보를 조회했습니다. 총 ${formattedSchema.length}개의 컬럼이 있습니다.`,
        reasoning: reasoning
      };
    } catch (error) {
      console.error('[ERROR] 스키마 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '테이블 스키마 조회 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'get_table_schema',
    description: '현재 파일의 테이블 스키마를 조회하여 데이터 구조를 파악합니다. fileId 파라미터는 시스템에서 제공된 정확한 값을 사용하세요.',
    schema: z.object({
      fileId: z.string().describe('현재 분석 중인 파일의 ID (시스템에서 제공된 정확한 값 사용)'),
      reasoning: z.string().optional().describe('스키마를 조회하는 이유')
    })
  }
);

// 3. 데이터 샘플 조회 도구
const getSampleDataTool = tool(
  async ({ fileId, limit = 10, reasoning }: { fileId: string; limit?: number; reasoning?: string }) => {
    try {
      const thoughtMessage = `[THOUGHT] ${reasoning || '데이터 샘플 확인 필요'}`;
      console.log(thoughtMessage);
      console.log(`[ACTION] Getting sample data for file ${fileId}, limit: ${limit}`);
      
      // reasoning 콜백 호출 (사용자 친화적 메시지로 변환)
      if (globalReasoningCallback && reasoning) {
        const userFriendlyReasoning = reasoning
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
        globalReasoningCallback(userFriendlyReasoning);
      }
      
      const tableName = `data_${fileId}`;
      
      // 안전을 위해 최대 50개 행으로 제한
      const safeLimit = Math.min(limit, 50);
      
      const sampleResult = db.select(`SELECT * FROM "${tableName}" LIMIT ?`, [safeLimit]);
      if (!sampleResult.success) {
        console.error(`샘플 데이터 조회 오류 - 테이블명: ${tableName}`, sampleResult.error);
        throw new Error(sampleResult.error);
      }
      console.log(`샘플 데이터 조회 성공 - 테이블명: ${tableName}, 행 수: ${sampleResult.data?.length}`);
      const sampleData = sampleResult.data || [];

      console.log(`[OBSERVATION] 샘플 데이터 확인: ${sampleData.length}개 행`);

      return {
        success: true,
        tableName,
        sampleData,
        rowCount: sampleData.length,
        message: `테이블 ${tableName}에서 ${sampleData.length}개의 샘플 데이터를 조회했습니다.`,
        reasoning: reasoning
      };
    } catch (error) {
      console.error('[ERROR] 샘플 데이터 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '샘플 데이터 조회 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'get_sample_data',
    description: '현재 파일의 테이블에서 샘플 데이터를 조회하여 실제 데이터 형태를 파악합니다.',
    schema: z.object({
      fileId: z.string().describe('현재 분석 중인 파일의 ID'),
      limit: z.number().optional().describe('조회할 샘플 데이터 개수 (기본값: 5)'),
      reasoning: z.string().optional().describe('샘플 데이터를 조회하는 이유')
    })
  }
);

// 4. 결과 검증 및 반성 도구 (새로운 도구)
const reflectOnResultsTool = tool(
  async ({ results, question, reasoning }: { results: string; question: string; reasoning: string }) => {
    try {
      console.log(`[THOUGHT] ${reasoning}`);
      console.log(`[ACTION] Reflecting on results`);
      
      // 간단한 결과 검증 로직
      const reflection = {
        hasData: results.includes('개의 행') || results.includes('데이터'),
        hasError: results.includes('오류') || results.includes('실패'),
        answersQuestion: results.toLowerCase().includes(question.toLowerCase().split(' ')[0]),
        needsMoreAnalysis: results.length < 100 || !results.includes('결론')
      };

      let reflectionMessage = '';
      if (reflection.hasError) {
        reflectionMessage = '이전 결과에 오류가 있습니다. 다른 접근 방법을 시도해야 합니다.';
      } else if (reflection.needsMoreAnalysis) {
        reflectionMessage = '현재 결과가 불충분합니다. 더 자세한 분석이 필요합니다.';
      } else if (reflection.hasData && reflection.answersQuestion) {
        reflectionMessage = '결과가 사용자의 질문에 적절히 답변하고 있습니다.';
      } else {
        reflectionMessage = '결과를 검토한 결과, 추가 분석이 도움이 될 것 같습니다.';
      }

      console.log(`[OBSERVATION] 반성 결과: ${reflectionMessage}`);

      return {
        success: true,
        reflection,
        message: reflectionMessage,
        reasoning: reasoning
      };
    } catch (error) {
      console.error('[ERROR] 결과 반성 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '결과 반성 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'reflect_on_results',
    description: '이전 분석 결과를 검토하고 추가 분석이 필요한지 판단합니다.',
    schema: z.object({
      results: z.string().describe('검토할 이전 분석 결과'),
      question: z.string().describe('원래 사용자 질문'),
      reasoning: z.string().describe('반성하는 이유와 목적')
    })
  }
);

// 5. 발견사항 요약 도구 (새로운 도구)
const summarizeFindingsTool = tool(
  async ({ findings, question, reasoning }: { findings: string[]; question: string; reasoning: string }) => {
    try {
      console.log(`[THOUGHT] ${reasoning}`);
      console.log(`[ACTION] Summarizing findings`);
      
      const summary = {
        totalFindings: findings.length,
        keyInsights: findings.filter(f => f.includes('중요') || f.includes('주요') || f.includes('핵심')),
        dataPoints: findings.filter(f => f.includes('개') || f.includes('건') || f.includes('%')),
        conclusions: findings.filter(f => f.includes('결론') || f.includes('따라서') || f.includes('결과적으로'))
      };

      const summaryMessage = `
분석 요약:
- 총 ${summary.totalFindings}개의 발견사항
- 주요 인사이트: ${summary.keyInsights.length}개
- 데이터 포인트: ${summary.dataPoints.length}개
- 결론: ${summary.conclusions.length}개

사용자 질문 "${question}"에 대한 종합적인 답변이 준비되었습니다.
      `.trim();

      console.log(`[OBSERVATION] 요약 완료: ${summary.totalFindings}개 발견사항 정리`);

      return {
        success: true,
        summary,
        message: summaryMessage,
        reasoning: reasoning
      };
    } catch (error) {
      console.error('[ERROR] 발견사항 요약 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '발견사항 요약 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'summarize_findings',
    description: '분석 과정에서 얻은 여러 발견사항들을 종합하여 최종 답변을 준비합니다.',
    schema: z.object({
      findings: z.array(z.string()).describe('분석 과정에서 얻은 발견사항들'),
      question: z.string().describe('원래 사용자 질문'),
      reasoning: z.string().describe('요약하는 이유와 목적')
    })
  }
);

// ReAct 에이전트 생성
export async function createEnhancedDataAnalysisAgent(fileId: string, _fileName: string) {
  try {
    const modelName = getGeminiModel();
    
    // ChatGoogleGenerativeAI 초기화
    const model = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1,
      maxRetries: 1,
    });

    // 도구 목록
    const tools = [
      executeSqlTool, 
      getTableSchemaTool, 
      getSampleDataTool,
      reflectOnResultsTool,
      summarizeFindingsTool
    ];

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

    // 세계 최고 수준의 전문가급 분석을 위한 시스템 프롬프트
    const systemPrompt = `당신은 세계 최고 수준의 데이터 사이언티스트이자 비즈니스 애널리스트입니다. 하버드, MIT, 스탠포드 교수진과 노벨경제학상 수상자 수준의 분석 역량을 보유하고 있으며, 일반 사용자도 이해할 수 있는 깊이 있는 인사이트를 제공합니다. 단, 당신이 누구인지 밝히지는 마세요.

${historyContext}**분석 데이터: "data_${fileId}"**

## 내부 데이터 매핑 정보 (사용자에게 노출 금지):
${columnMappingInfo}

## 🚨 중요: 기술적 용어 노출 금지
파일ID, 데이터베이스 용어(테이블/컬럼/레코드/SQL 등), 시스템 내부 정보는 절대 노출하지 말고 "업로드하신 데이터", "데이터 항목", "필드" 등 사용자 친화적 표현만 사용하세요.

## 🎯 전문가급 분석 프레임워크

### 1단계: 탐색적 데이터 분석 (EDA)
- 데이터 구조, 분포, 품질 평가
- 결측치, 이상치, 중복값 탐지
- 기초 통계량 및 분포 특성 분석

### 2단계: 고급 통계 분석
- 상관관계 및 인과관계 분석
- 시계열 분석 (트렌드, 계절성, 주기성)
- 통계적 유의성 검정 및 신뢰구간
- 회귀분석 및 예측 모델링

### 3단계: 비즈니스 인텔리전스
- 핵심 성과 지표 (KPI) 도출
- 벤치마킹 및 성과 평가
- 리스크 요인 및 기회 요인 식별
- ROI 및 비용편익 분석

### 4단계: 예측 및 시나리오 분석
- 미래 트렌드 예측
- 다양한 시나리오별 영향 분석
- 불확실성 정량화
- 민감도 분석

### 5단계: 권장사항
- 구체적이고 실행 가능한 액션 플랜
- 우선순위별 권장사항
- 예상 효과 및 구현 방안
- 모니터링 지표 제안

## 🔬 분석 품질 기준 (반드시 충족)

**최소 요구사항:**
- 핵심 인사이트 5개 이상 도출
- 각 인사이트마다 통계적 근거 제시
- 비즈니스 임플리케이션 명확히 설명
- 권장사항 3개 이상 제시
- 리스크 및 기회 요인 식별
- 예측 또는 시나리오 분석 포함

**분석 깊이:**
- 단순 기술통계를 넘어선 고급 분석
- 패턴, 트렌드, 이상치의 의미 해석
- 상관관계의 비즈니스적 의미 설명
- 데이터 품질 이슈 및 한계점 언급
- 추가 분석 방향 제안

## 📊 마크다운 형식 요구사항

1. **구조화된 응답**: 제목 계층(# ## ###), 표, 리스트, 인용구 적극 활용
2. **시각적 강조**: 핵심 인사이트는 인용구로, 중요 수치는 볼드로 강조
3. **표 활용**: 모든 통계와 수치는 마크다운 표로 정리
4. **논리적 흐름**: 분석 → 인사이트 → 임플리케이션 → 권장사항 순서

## ⚠️ 기술적 지침 (사용자에게 노출 금지)

- 모든 도구 호출 시 fileId: "${fileId}" 사용
- 데이터 조회 시 "data_${fileId}" 사용
- 한글 필드명은 따옴표로 감싸기
- 대용량 처리를 위한 자동 제한: 조회 1000행, 샘플 50행

## 🎓 전문가 마인드셋

당신은 단순한 데이터 요약이 아닌, 데이터 속에 숨겨진 스토리를 발견하고 비즈니스 가치를 창출하는 전문가입니다. 모든 분석은 실무진이 즉시 활용할 수 있는 액션 아이템으로 연결되어야 하며, 학술적 엄밀성과 실무적 유용성을 동시에 만족해야 합니다.
사용자의 질문에 대해 세계 최고 수준의 분석을 제공하세요.`;

    // ReAct 에이전트 생성
    const agent = createReactAgent({
      llm: model,
      tools,
      prompt: systemPrompt
    });

    return agent;
  } catch (error) {
    console.error('Enhanced ReAct 에이전트 생성 실패:', error);
    throw error;
  }
}

export async function processQueryWithEnhancedReAct(
  userQuery: string, 
  fileId: string, 
  fileName: string,
  onReasoning?: (reasoning: string) => void
): Promise<string> {
  try {
    // 전역 reasoning 콜백 설정
    globalReasoningCallback = onReasoning;
    
    // reasoning 콜백 호출
    if (onReasoning) {
      onReasoning('분석을 준비하고 있어요...');
    }
    
    const agent = await createEnhancedDataAnalysisAgent(fileId, fileName);
    
    if (onReasoning) {
      onReasoning('질문을 이해하고 있습니다.');
    }
    
    // 에이전트 실행 (개별 API 호출에 타임아웃/재시도 적용됨)
    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: userQuery
        }
      ]
    });
    
    if (onReasoning) {
      onReasoning('답변을 정리하고 있어요...');
    }
    
    // 마지막 메시지에서 응답 추출
    const messages = result.messages;
    const lastMessage = messages[messages.length - 1];
    
    // content가 string이 아닐 수 있으므로 안전하게 처리
    let responseContent = '';
    if (typeof lastMessage.content === 'string') {
      responseContent = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
      // MessageContentComplex[] 타입인 경우 텍스트 부분만 추출
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
    
    const finalResponse = responseContent || '죄송합니다. 답변을 생성할 수 없습니다. 다시 시도해주세요.';
    
    return finalResponse;
    
  } catch (error) {
    console.error('Enhanced ReAct 처리 오류:', error);
    
    // 타임아웃 오류인 경우
    if (error instanceof Error && error.message.includes('분석 시간이 초과')) {
      return '분석이 예상보다 오래 걸리고 있습니다. 더 간단한 질문으로 나누어서 시도해보시거나, 잠시 후 다시 시도해주세요.';
    }
    
    // 기타 오류
    return '죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
  } finally {
    // 전역 콜백 정리
    globalReasoningCallback = undefined;
  }
} 