import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db, DatabaseRow } from './database';
import { ReActStateManager } from './react-state';
import { 
  QueryResult, 
  PlanActionsParams, 
  TrackProgressParams, 
  ExecuteSqlParams,
  GetTableSchemaParams,
  GetSampleDataParams,
  ReflectOnResultsParams,
  SummarizeFindingsParams,
  ProgressData
} from '../types';

// ReAct 논문 기반: 행동 계획 수립 도구
export const planActionsTool = tool(
  async ({ question, context: _context, reasoning }: PlanActionsParams): Promise<QueryResult> => {
    try {
      console.log(`[THOUGHT] ${reasoning}`);
      console.log(`[ACTION] Planning analysis strategy`);
      
      // reasoning 콜백 호출
      ReActStateManager.callReasoningCallback(reasoning, '분석 전략을 수립하고 있습니다.');
      
      // 질문 유형에 따른 체계적 계획 수립
      const planSteps: string[] = [];
      
      // 1. 데이터 구조 파악
      planSteps.push("데이터 구조와 스키마 분석");
      
      // 2. 질문 유형별 계획
      const questionLower = question.toLowerCase();
      if (questionLower.includes('분포') || questionLower.includes('빈도')) {
        planSteps.push("분포 및 빈도 분석");
        planSteps.push("통계적 특성 계산");
      }
      if (questionLower.includes('상관관계') || questionLower.includes('관계')) {
        planSteps.push("변수 간 상관관계 분석");
        planSteps.push("연관성 패턴 탐색");
      }
      if (questionLower.includes('트렌드') || questionLower.includes('변화')) {
        planSteps.push("시간별 트렌드 분석");
        planSteps.push("변화 패턴 식별");
      }
      if (questionLower.includes('이상') || questionLower.includes('특이')) {
        planSteps.push("이상치 탐지 및 분석");
      }
      if (questionLower.includes('예측') || questionLower.includes('미래')) {
        planSteps.push("예측 모델링 및 시나리오 분석");
      }
      if (questionLower.includes('최적화') || questionLower.includes('개선')) {
        planSteps.push("최적화 방안 분석");
      }
      
      // 3. 필수 단계
      planSteps.push("핵심 인사이트 도출");
      planSteps.push("비즈니스 임플리케이션 분석");
      planSteps.push("분석 기반 권장사항 제시");
      
      // ReAct 상태 업데이트
      ReActStateManager.setPlan(planSteps);
      ReActStateManager.setCurrentThought(reasoning);
      
      const observation = `계획된 단계: ${planSteps.join(' → ')}`;
      console.log(`[OBSERVATION] 분석 계획 수립 완료: ${planSteps.length}단계`);
      
      return {
        success: true,
        data: planSteps.map((step, index) => ({ step, index: index + 1 }) as unknown as DatabaseRow),
        message: `${planSteps.length}단계 분석 계획을 수립했습니다.`,
        reasoning: reasoning,
        observation: observation
      };
    } catch (error) {
      console.error('[ERROR] 계획 수립 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '분석 계획 수립 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'plan_actions',
    description: 'ReAct 패턴: 사용자 질문에 대한 체계적인 분석 계획을 수립합니다.',
    schema: z.object({
      question: z.string().describe('사용자의 질문'),
      context: z.string().describe('현재 컨텍스트'),
      reasoning: z.string().describe('계획 수립 이유')
    })
  }
);

// ReAct 논문 기반: 진행 상황 추적 도구
export const trackProgressTool = tool(
  async ({ currentAction, result, reasoning }: TrackProgressParams): Promise<QueryResult> => {
    try {
      console.log(`[THOUGHT] ${reasoning}`);
      console.log(`[ACTION] Tracking progress for: ${currentAction}`);
      
      // reasoning 콜백 호출
      ReActStateManager.callReasoningCallback(reasoning, '진행 상황을 점검하고 있습니다.');
      
      // 현재 행동 완료 처리
      ReActStateManager.addCompletedAction(currentAction);
      ReActStateManager.addObservation(result);
      
      // 다음 단계 확인
      const remainingPlan = ReActStateManager.getRemainingPlan();
      const progressPercentage = ReActStateManager.getProgress();
      const state = ReActStateManager.getState();
      
      // 재계획 필요성 판단
      const needsReplan = ReActStateManager.shouldReplan() || 
                         result.includes('오류') || 
                         result.includes('실패');
      
      ReActStateManager.setNeedsReplan(needsReplan);
      ReActStateManager.setCurrentThought(reasoning);
      
      const observation = `현재까지 관찰: ${state.observations.join(', ')}`;
      console.log(`[OBSERVATION] 진행률: ${progressPercentage}%, 남은 단계: ${remainingPlan.length}`);
      
      const progressData: ProgressData = {
        completed: state.completedActions,
        remaining: remainingPlan,
        progress: progressPercentage,
        observations: state.observations
      };
      
      return {
        success: true,
        data: [progressData] as unknown as DatabaseRow[],
        message: `분석 진행률: ${progressPercentage}% (${state.completedActions.length}/${state.currentPlan.length} 단계 완료)`,
        reasoning: reasoning,
        observation: observation,
        shouldReplan: needsReplan
      };
    } catch (error) {
      ReActStateManager.incrementErrorCount();
      console.error('[ERROR] 진행 추적 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '진행 상황 추적 중 오류가 발생했습니다.',
        reasoning: reasoning,
        shouldReplan: true
      };
    }
  },
  {
    name: 'track_progress',
    description: 'ReAct 패턴: 현재 분석 진행 상황을 추적하고 다음 단계를 결정합니다.',
    schema: z.object({
      currentAction: z.string().describe('방금 완료한 행동'),
      result: z.string().describe('행동의 결과'),
      reasoning: z.string().describe('진행 추적 이유')
    })
  }
);

// SQL 실행 도구 (ReAct 패턴 강화)
export const executeSqlTool = tool(
  async ({ query, fileId, reasoning }: ExecuteSqlParams): Promise<QueryResult> => {
    try {
      const thoughtMessage = `[THOUGHT] ${reasoning || '쿼리 실행'}`;
      console.log(thoughtMessage);
      console.log(`[ACTION] Executing SQL for file ${fileId}:`, query);
      
      // reasoning 콜백 호출
      if (reasoning) {
        ReActStateManager.callReasoningCallback(reasoning);
      }
      
      // 보안: SELECT 쿼리만 허용
      const trimmedQuery = query.trim().toLowerCase();
      if (!trimmedQuery.startsWith('select')) {
        throw new Error('보안상 SELECT 쿼리만 허용됩니다.');
      }

      // SQLite 비호환 문법 체크 (통계 함수 포함)
      const sqliteIncompatible = [
        'top ', 'first ', 'isnull(', 'charindex(', 'patindex(', 
        'datediff(', 'concat(', 'row_number()', 'over(', 'pivot', 'unpivot',
        'stdev(', 'stddev(', 'var_pop(', 'var_samp(', 'variance(',
        'median(', 'percentile_cont(', 'percentile_disc('
      ];
      
      const foundIncompatible = sqliteIncompatible.find(syntax => 
        trimmedQuery.includes(syntax)
      );
      
      if (foundIncompatible) {
        throw new Error(`SQLite에서 지원하지 않는 함수입니다: ${foundIncompatible.toUpperCase()}. 기본 집계 함수(COUNT, SUM, AVG, MIN, MAX)나 수식으로 대체해주세요.`);
      }

      // 현재 파일의 테이블명 확인
      const tableName = `data_${fileId}`;
      
      // 쿼리에서 테이블명 검증
      const queryLower = query.toLowerCase();
      if (!queryLower.includes(tableName.toLowerCase()) && 
          !queryLower.includes(`"${tableName}"`.toLowerCase()) &&
          !queryLower.includes(`'${tableName}'`.toLowerCase())) {
        throw new Error(`현재 파일의 테이블(${tableName})에만 접근할 수 있습니다.`);
      }

      // 쿼리 정제 및 제한
      const cleanQuery = query.trim().replace(/;+$/, '');
      const limitedQuery = cleanQuery.toLowerCase().includes('limit') ? cleanQuery : `${cleanQuery} LIMIT 1000`;
      
      const dbResult = db.select(limitedQuery);
      if (!dbResult.success) {
        ReActStateManager.incrementErrorCount();
        throw new Error(dbResult.error);
      }
      const result = dbResult.data || [];

      // ReAct 패턴: 관찰 기록
      const observation = `쿼리 실행 완료: ${result.length}개 항목 분석`;
      
      const response: QueryResult = {
        success: true,
        data: result,
        rowCount: result.length,
        message: `쿼리가 성공적으로 실행되었습니다. ${result.length}개의 행을 반환했습니다.`,
        reasoning: reasoning,
        observation: observation
      };

      console.log(`[OBSERVATION] ${observation}`);
      return response;
    } catch (error) {
      ReActStateManager.incrementErrorCount();
      console.error('[ERROR] SQL 실행 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '쿼리 실행 중 오류가 발생했습니다.',
        reasoning: reasoning,
        observation: '쿼리 실행 실패 - 다른 접근 방법 필요',
        shouldReplan: ReActStateManager.shouldReplan()
      };
    }
  },
  {
    name: 'execute_sql',
    description: '현재 파일의 데이터에 대해 SELECT 쿼리를 실행합니다.',
    schema: z.object({
      query: z.string().describe('실행할 SQL SELECT 쿼리'),
      fileId: z.string().describe('현재 분석 중인 파일의 ID'),
      reasoning: z.string().optional().describe('이 쿼리를 실행하는 이유나 가설')
    })
  }
);

// 테이블 스키마 조회 도구 (ReAct 패턴 강화)
export const getTableSchemaTool = tool(
  async ({ fileId, reasoning }: GetTableSchemaParams): Promise<QueryResult> => {
    try {
      const thoughtMessage = `[THOUGHT] ${reasoning || '테이블 스키마 분석 필요'}`;
      console.log(thoughtMessage);
      console.log(`[ACTION] Getting schema for file ${fileId}`);
      
      if (reasoning) {
        ReActStateManager.callReasoningCallback(reasoning);
      }
      
      const tableName = `data_${fileId}`;
      
      const schemaResult = db.select(`PRAGMA table_info("${tableName}")`);
      if (!schemaResult.success) {
        ReActStateManager.incrementErrorCount();
        throw new Error(schemaResult.error);
      }
      
      const schema = schemaResult.data || [];
      const formattedSchema = schema.map((col: DatabaseRow) => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        defaultValue: col.dflt_value
      }));

      const observation = `데이터 구조 파악 완료: ${formattedSchema.length}개 필드 식별`;
      console.log(`[OBSERVATION] ${observation}`);
      
      return {
        success: true,
        data: formattedSchema as unknown as DatabaseRow[],
        message: `테이블의 스키마 정보를 조회했습니다. 총 ${formattedSchema.length}개의 컬럼이 있습니다.`,
        reasoning: reasoning,
        observation: observation
      };
    } catch (error) {
      ReActStateManager.incrementErrorCount();
      console.error('[ERROR] 스키마 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '테이블 스키마 조회 중 오류가 발생했습니다.',
        reasoning: reasoning,
        observation: '스키마 조회 실패 - 대안적 접근 필요',
        shouldReplan: ReActStateManager.shouldReplan()
      };
    }
  },
  {
    name: 'get_table_schema',
    description: '현재 파일의 테이블 스키마를 조회하여 데이터 구조를 파악합니다.',
    schema: z.object({
      fileId: z.string().describe('현재 분석 중인 파일의 ID'),
      reasoning: z.string().optional().describe('스키마를 조회하는 이유')
    })
  }
);

// 데이터 샘플 조회 도구 (ReAct 패턴 강화)
export const getSampleDataTool = tool(
  async ({ fileId, limit = 10, reasoning }: GetSampleDataParams): Promise<QueryResult> => {
    try {
      const thoughtMessage = `[THOUGHT] ${reasoning || '데이터 샘플 확인 필요'}`;
      console.log(thoughtMessage);
      console.log(`[ACTION] Getting sample data for file ${fileId}, limit: ${limit}`);
      
      if (reasoning) {
        ReActStateManager.callReasoningCallback(reasoning);
      }
      
      const tableName = `data_${fileId}`;
      const safeLimit = Math.min(limit, 50);
      
      const sampleResult = db.select(`SELECT * FROM "${tableName}" LIMIT ?`, [safeLimit]);
      if (!sampleResult.success) {
        ReActStateManager.incrementErrorCount();
        throw new Error(sampleResult.error);
      }
      
      const sampleData = sampleResult.data || [];
      const observation = `샘플 데이터 확인 완료: ${sampleData.length}개 항목의 실제 데이터 패턴 파악`;
      console.log(`[OBSERVATION] ${observation}`);

      return {
        success: true,
        data: sampleData,
        rowCount: sampleData.length,
        message: `${sampleData.length}개의 샘플 데이터를 조회했습니다.`,
        reasoning: reasoning,
        observation: observation
      };
    } catch (error) {
      ReActStateManager.incrementErrorCount();
      console.error('[ERROR] 샘플 데이터 조회 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '샘플 데이터 조회 중 오류가 발생했습니다.',
        reasoning: reasoning,
        observation: '샘플 데이터 조회 실패 - 다른 방법으로 데이터 파악 필요',
        shouldReplan: ReActStateManager.shouldReplan()
      };
    }
  },
  {
    name: 'get_sample_data',
    description: '현재 파일의 테이블에서 샘플 데이터를 조회하여 실제 데이터 형태를 파악합니다.',
    schema: z.object({
      fileId: z.string().describe('현재 분석 중인 파일의 ID'),
      limit: z.number().optional().describe('조회할 샘플 데이터 개수 (기본값: 10)'),
      reasoning: z.string().optional().describe('샘플 데이터를 조회하는 이유')
    })
  }
);

// 결과 검증 및 반성 도구 (ReAct 패턴 핵심)
export const reflectOnResultsTool = tool(
  async ({ results, question, reasoning }: ReflectOnResultsParams): Promise<QueryResult> => {
    try {
      console.log(`[THOUGHT] ${reasoning}`);
      console.log(`[ACTION] Reflecting on results`);
      
      ReActStateManager.callReasoningCallback(reasoning, '분석 결과를 검토하고 있습니다.');
      
      // 간단한 결과 검증 로직 (ReAct 논문의 자기 반성 기능)
      const reflection = {
        hasData: results.includes('개의 행') || results.includes('데이터') || results.includes('항목'),
        hasError: results.includes('오류') || results.includes('실패') || results.includes('ERROR'),
        answersQuestion: results.toLowerCase().includes(question.toLowerCase().split(' ')[0]),
        hasInsights: results.includes('인사이트') || results.includes('패턴') || results.includes('트렌드'),
        hasRecommendations: results.includes('권장') || results.includes('제안') || results.includes('개선'),
        needsMoreAnalysis: results.length < 200 || !results.includes('결론')
      };

      let reflectionMessage = '';
      let shouldContinue = false;
      
      if (reflection.hasError) {
        reflectionMessage = '이전 결과에 오류가 있습니다. 다른 접근 방법을 시도해야 합니다.';
        shouldContinue = true;
        ReActStateManager.setNeedsReplan(true);
      } else if (reflection.needsMoreAnalysis) {
        reflectionMessage = '현재 결과가 불충분합니다. 더 자세한 분석이 필요합니다.';
        shouldContinue = true;
      } else if (reflection.hasData && reflection.answersQuestion && reflection.hasInsights) {
        reflectionMessage = '결과가 사용자의 질문에 적절히 답변하고 충분한 인사이트를 제공하고 있습니다.';
        shouldContinue = false;
      } else {
        reflectionMessage = '결과를 검토한 결과, 추가 분석이 도움이 될 것 같습니다.';
        shouldContinue = true;
      }

      const observation = `반성 결과: ${reflectionMessage}`;
      console.log(`[OBSERVATION] ${observation}`);

      return {
        success: true,
        data: [reflection] as unknown as DatabaseRow[],
        message: reflectionMessage,
        reasoning: reasoning,
        observation: observation,
        shouldReplan: shouldContinue
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
    description: '이전 분석 결과를 검토하고 추가 분석이 필요한지 판단합니다. ReAct 패턴의 자기 반성 기능입니다.',
    schema: z.object({
      results: z.string().describe('검토할 이전 분석 결과'),
      question: z.string().describe('원래 사용자 질문'),
      reasoning: z.string().describe('반성하는 이유와 목적')
    })
  }
);

// 발견사항 요약 도구 (ReAct 패턴 완성)
export const summarizeFindingsTool = tool(
  async ({ findings, question, reasoning }: SummarizeFindingsParams): Promise<QueryResult> => {
    try {
      console.log(`[THOUGHT] ${reasoning}`);
      console.log(`[ACTION] Summarizing findings`);
      
      ReActStateManager.callReasoningCallback(reasoning, '모든 발견사항을 종합하고 있습니다.');
      
      const summary = {
        totalFindings: findings.length,
        keyInsights: findings.filter(f => 
          f.includes('중요') || f.includes('주요') || f.includes('핵심') || 
          f.includes('인사이트') || f.includes('발견')
        ),
        dataPoints: findings.filter(f => 
          f.includes('개') || f.includes('건') || f.includes('%') || 
          f.includes('증가') || f.includes('감소') || f.includes('비율')
        ),
        conclusions: findings.filter(f => 
          f.includes('결론') || f.includes('따라서') || f.includes('결과적으로') ||
          f.includes('권장') || f.includes('제안')
        ),
        qualityScore: Math.min(100, (findings.length * 10) + 
          (findings.filter(f => f.includes('통계')).length * 5) +
          (findings.filter(f => f.includes('분석')).length * 3))
      };

      const summaryMessage = `
## 📊 ReAct 분석 결과 종합
- **총 발견사항**: ${summary.totalFindings}개
- **주요 인사이트**: ${summary.keyInsights.length}개
- **데이터 포인트**: ${summary.dataPoints.length}개
- **결론 및 권장사항**: ${summary.conclusions.length}개
- **분석 품질 점수**: ${summary.qualityScore}/100

사용자 질문 "${question}"에 대한 종합적인 ReAct 기반 분석이 완료되었습니다.
      `.trim();

      const observation = `요약 완료: ${summary.totalFindings}개 발견사항을 ${summary.qualityScore}점 품질로 정리`;
      console.log(`[OBSERVATION] ${observation}`);

      return {
        success: true,
        data: [summary] as unknown as DatabaseRow[],
        message: summaryMessage,
        reasoning: reasoning,
        observation: observation
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
    description: '분석 과정에서 얻은 여러 발견사항들을 종합하여 최종 답변을 준비합니다. ReAct 패턴의 마지막 단계입니다.',
    schema: z.object({
      findings: z.array(z.string()).describe('분석 과정에서 얻은 발견사항들'),
      question: z.string().describe('원래 사용자 질문'),
      reasoning: z.string().describe('요약하는 이유와 목적')
    })
  }
);

// 모든 ReAct 도구들을 배열로 내보내기
export const allReActTools = [
  planActionsTool,
  trackProgressTool,
  executeSqlTool,
  getTableSchemaTool,
  getSampleDataTool,
  reflectOnResultsTool,
  summarizeFindingsTool
]; 