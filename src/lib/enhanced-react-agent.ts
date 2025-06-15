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

      // 세미콜론 제거 (sqlite3는 단일 SQL 문만 허용)
      const cleanQuery = query.trim().replace(/;+$/, '');
      
      // 안전을 위해 최대 1000개 행으로 제한
      const limitedQuery = cleanQuery.toLowerCase().includes('limit') ? cleanQuery : `${cleanQuery} LIMIT 1000`;
      
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
      reasoning: z.string().optional().describe('이 쿼리를 실행하는 구체적인 목적과 검증하려는 가설 (예: "매출 증가 패턴 가설 검증을 위한 월별 트렌드 분석")')
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
      reasoning: z.string().optional().describe('스키마를 조회하는 구체적인 목적과 후속 분석 계획 (예: "고객 세분화 분석을 위한 데이터 구조 파악")')
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
      reasoning: z.string().optional().describe('샘플 데이터를 조회하는 구체적인 목적과 확인하려는 가설 (예: "데이터 품질 검증 및 이상치 패턴 사전 확인")')
    })
  }
);

// 4. EDA 리포트 생성 도구 (새로운 도구)
const generateEdaReportTool = tool(
  async ({ fileId, reasoning }: { fileId: string; reasoning?: string }) => {
    try {
      const thoughtMessage = `[THOUGHT] ${reasoning || 'EDA 리포트 생성 필요'}`;
      console.log(thoughtMessage);
      console.log(`[ACTION] Generating EDA report for file ${fileId}`);
      
      // reasoning 콜백 호출
      if (globalReasoningCallback && reasoning) {
        const userFriendlyReasoning = reasoning
          .replace(/스키마|테이블|컬럼/g, '데이터 구조');
        globalReasoningCallback(userFriendlyReasoning);
      }
      
      const tableName = `data_${fileId}`;
      
      // 1. 스키마 정보 조회
      const schemaResult = db.select(`PRAGMA table_info("${tableName}")`);
      if (!schemaResult.success) {
        throw new Error(`스키마 조회 실패: ${schemaResult.error}`);
      }
      
      const schema = schemaResult.data || [];
      const columns = schema.map((col: DatabaseRow) => ({
        name: col.name as string,
        type: (col.type as string).toLowerCase()
      }));
      
      // 2. 전체 행 수 조회
      const countResult = db.select(`SELECT COUNT(*) as total_rows FROM "${tableName}"`);
      const totalRows = countResult.success ? (countResult.data?.[0] as { total_rows: number })?.total_rows || 0 : 0;
      
      const reportSections: string[] = [];
      reportSections.push(`# 📊 탐색적 데이터 분석 (EDA) 리포트\n`);
      reportSections.push(`**총 데이터 수**: ${totalRows.toLocaleString()}개`);
      reportSections.push(`**총 필드 수**: ${columns.length}개\n`);
      
      // 3. 수치형 컬럼 분석
      const numericColumns = columns.filter(col => 
        col.type.includes('int') || col.type.includes('real') || 
        col.type.includes('numeric') || col.type.includes('decimal') ||
        col.type.includes('float') || col.type.includes('double')
      );
      
      if (numericColumns.length > 0) {
        reportSections.push(`## 📈 수치형 데이터 분석\n`);
        reportSections.push(`| 필드명 | 개수 | 평균 | 최솟값 | 최댓값 | 결측값 |`);
        reportSections.push(`|--------|------|------|--------|--------|--------|`);
        
        for (const col of numericColumns.slice(0, 10)) { // 최대 10개 컬럼만
          try {
            const statsQuery = `
              SELECT 
                COUNT("${col.name}") as count,
                AVG(CAST("${col.name}" AS REAL)) as mean,
                MIN(CAST("${col.name}" AS REAL)) as min_val,
                MAX(CAST("${col.name}" AS REAL)) as max_val,
                COUNT(*) - COUNT("${col.name}") as null_count
              FROM "${tableName}"
              WHERE "${col.name}" IS NOT NULL AND "${col.name}" != ''
            `;
            
            const statsResult = db.select(statsQuery);
            if (statsResult.success && statsResult.data?.[0]) {
              const stats = statsResult.data[0] as {
                count: number;
                mean: number;
                min_val: number;
                max_val: number;
                null_count: number;
              };
              
              reportSections.push(
                `| ${col.name} | ${stats.count.toLocaleString()} | ${stats.mean?.toFixed(2) || 'N/A'} | ${stats.min_val?.toFixed(2) || 'N/A'} | ${stats.max_val?.toFixed(2) || 'N/A'} | ${stats.null_count} |`
              );
            }
          } catch (error) {
            console.warn(`수치형 컬럼 ${col.name} 분석 실패:`, error);
          }
        }
        reportSections.push('');
      }
      
      // 4. 범주형 컬럼 분석
      const categoricalColumns = columns.filter(col => 
        col.type.includes('text') || col.type.includes('varchar') || 
        col.type.includes('char') || col.type === ''
      );
      
      if (categoricalColumns.length > 0) {
        reportSections.push(`## 📝 범주형 데이터 분석\n`);
        reportSections.push(`| 필드명 | 총 개수 | 고유값 수 | 최빈값 | 최빈값 빈도 | 결측값 |`);
        reportSections.push(`|--------|---------|-----------|--------|-----------|--------|`);
        
        for (const col of categoricalColumns.slice(0, 10)) { // 최대 10개 컬럼만
          try {
            const statsQuery = `
              SELECT 
                COUNT("${col.name}") as count,
                COUNT(DISTINCT "${col.name}") as unique_count,
                COUNT(*) - COUNT("${col.name}") as null_count
              FROM "${tableName}"
              WHERE "${col.name}" IS NOT NULL AND "${col.name}" != ''
            `;
            
            const topValueQuery = `
              SELECT "${col.name}" as top_value, COUNT(*) as frequency
              FROM "${tableName}"
              WHERE "${col.name}" IS NOT NULL AND "${col.name}" != ''
              GROUP BY "${col.name}"
              ORDER BY COUNT(*) DESC
              LIMIT 1
            `;
            
            const statsResult = db.select(statsQuery);
            const topResult = db.select(topValueQuery);
            
            if (statsResult.success && statsResult.data?.[0]) {
              const stats = statsResult.data[0] as {
                count: number;
                unique_count: number;
                null_count: number;
              };
              
              const topValue = topResult.success && topResult.data?.[0] ? 
                topResult.data[0] as { top_value: string; frequency: number } : 
                { top_value: 'N/A', frequency: 0 };
              
              reportSections.push(
                `| ${col.name} | ${stats.count.toLocaleString()} | ${stats.unique_count.toLocaleString()} | ${topValue.top_value} | ${topValue.frequency.toLocaleString()} | ${stats.null_count} |`
              );
            }
          } catch (error) {
            console.warn(`범주형 컬럼 ${col.name} 분석 실패:`, error);
          }
        }
        reportSections.push('');
      }
      
      // 5. 데이터 품질 요약
      reportSections.push(`## 🔍 데이터 품질 요약\n`);
      reportSections.push(`- **수치형 필드**: ${numericColumns.length}개`);
      reportSections.push(`- **범주형 필드**: ${categoricalColumns.length}개`);
      reportSections.push(`- **기타 필드**: ${columns.length - numericColumns.length - categoricalColumns.length}개`);
      
      const finalReport = reportSections.join('\n');
      
      console.log(`[OBSERVATION] EDA 리포트 생성 완료: ${columns.length}개 컬럼 분석`);
      
      return {
        success: true,
        report: finalReport,
        summary: {
          totalRows,
          totalColumns: columns.length,
          numericColumns: numericColumns.length,
          categoricalColumns: categoricalColumns.length
        },
        message: `EDA 리포트가 성공적으로 생성되었습니다. ${columns.length}개 필드에 대한 종합 분석을 완료했습니다.`,
        reasoning: reasoning
      };
    } catch (error) {
      console.error('[ERROR] EDA 리포트 생성 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'EDA 리포트 생성 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'generate_eda_report',
    description: '데이터의 전체적인 구조와 특성을 파악하기 위한 포괄적인 탐색적 데이터 분석(EDA) 리포트를 자동 생성합니다. 분석 초기 단계에서 데이터 이해를 위해 사용하세요.',
    schema: z.object({
      fileId: z.string().describe('현재 분석 중인 파일의 ID'),
      reasoning: z.string().optional().describe('EDA 리포트를 생성하는 구체적인 목적과 가설 (예: "데이터 구조 파악을 통해 매출 패턴 분석 방향 설정")')
    })
  }
);

// 5. 결과 검증 및 반성 도구 (업그레이드된 도구)
const reflectOnResultsTool = tool(
  async ({ 
    stepHistory, 
    originalGoal, 
    currentStatus,
    reasoning 
  }: { 
    stepHistory: Array<{step: string; action: string; result: string; success: boolean}>; 
    originalGoal: string; 
    currentStatus: string;
    reasoning: string;
  }) => {
    try {
      console.log(`[THOUGHT] ${reasoning}`);
      console.log(`[ACTION] Strategic reflection on analysis progress`);
      
      // reasoning 콜백 호출
      if (globalReasoningCallback && reasoning) {
        const userFriendlyReasoning = reasoning
          .replace(/반성|검토/g, '분석 점검')
          .replace(/전략|계획/g, '방향성')
          .replace(/히스토리|단계/g, '진행 상황');
        globalReasoningCallback(userFriendlyReasoning);
      }
      
      // 고급 반성 분석
      const analysis = {
        totalSteps: stepHistory.length,
        successfulSteps: stepHistory.filter(s => s.success).length,
        failedSteps: stepHistory.filter(s => !s.success).length,
        repeatedActions: new Set(stepHistory.map(s => s.action)).size < stepHistory.length,
        hasDataExploration: stepHistory.some(s => s.action.includes('schema') || s.action.includes('sample') || s.action.includes('eda')),
        hasAnalysis: stepHistory.some(s => s.action.includes('sql') || s.action.includes('execute')),
        hasInsights: currentStatus.includes('인사이트') || currentStatus.includes('결론') || currentStatus.includes('권장'),
        progressStalled: stepHistory.length > 3 && stepHistory.slice(-2).every(s => !s.success)
      };
      
      // 전략적 평가
      let strategicAssessment = '';
      let nextBestAction = '';
      let needsRevision = false;
      
      if (analysis.failedSteps > analysis.successfulSteps) {
        strategicAssessment = '현재 접근 방법에 문제가 있습니다. 전략을 재검토해야 합니다.';
        nextBestAction = '기본적인 데이터 탐색부터 다시 시작하거나, 더 간단한 분석 방법을 시도해보세요.';
        needsRevision = true;
      } else if (analysis.repeatedActions && !analysis.hasInsights) {
        strategicAssessment = '반복적인 행동 패턴이 감지되었습니다. 새로운 접근이 필요합니다.';
        nextBestAction = '다른 각도에서 데이터를 분석하거나, 다른 도구를 사용해보세요.';
        needsRevision = true;
      } else if (!analysis.hasDataExploration) {
        strategicAssessment = '데이터 탐색이 부족합니다. 기초 분석이 필요합니다.';
        nextBestAction = 'EDA 리포트 생성이나 스키마 조회를 통해 데이터 구조를 먼저 파악하세요.';
        needsRevision = false;
      } else if (analysis.hasDataExploration && !analysis.hasAnalysis) {
        strategicAssessment = '데이터 탐색은 완료되었으나 심층 분석이 부족합니다.';
        nextBestAction = '구체적인 SQL 쿼리를 통해 사용자 질문에 직접적으로 답하는 분석을 수행하세요.';
        needsRevision = false;
      } else if (analysis.hasAnalysis && !analysis.hasInsights) {
        strategicAssessment = '분석은 수행되었으나 인사이트 도출이 부족합니다.';
        nextBestAction = '분석 결과를 해석하고 비즈니스적 의미를 찾아 구체적인 권장사항을 제시하세요.';
        needsRevision = false;
      } else if (analysis.progressStalled) {
        strategicAssessment = '진행이 정체되었습니다. 접근 방법을 변경해야 합니다.';
        nextBestAction = '현재까지의 결과를 종합하여 부분적인 답변이라도 제시하거나, 완전히 다른 방법을 시도하세요.';
        needsRevision = true;
      } else {
        strategicAssessment = '분석이 순조롭게 진행되고 있습니다.';
        nextBestAction = '현재 방향을 유지하면서 더 깊이 있는 분석이나 추가 인사이트를 도출하세요.';
        needsRevision = false;
      }
      
      // 목표 달성도 평가
      const goalAlignment = {
        onTrack: currentStatus.toLowerCase().includes(originalGoal.toLowerCase().split(' ')[0]),
        hasQuantitativeResults: /\d+/.test(currentStatus),
        hasQualitativeInsights: currentStatus.includes('인사이트') || currentStatus.includes('패턴') || currentStatus.includes('특징'),
        completeness: analysis.hasDataExploration && analysis.hasAnalysis && analysis.hasInsights ? 'high' : 
                     analysis.hasDataExploration && analysis.hasAnalysis ? 'medium' : 'low'
      };
      
      const reflectionSummary = `
**전략적 분석 현황**:
- 총 수행 단계: ${analysis.totalSteps}개
- 성공/실패: ${analysis.successfulSteps}/${analysis.failedSteps}
- 목표 달성도: ${goalAlignment.completeness}
- 전략 수정 필요: ${needsRevision ? '예' : '아니오'}

**현재 상황 평가**: ${strategicAssessment}

**다음 권장 액션**: ${nextBestAction}
      `.trim();
      
      console.log(`[OBSERVATION] 전략적 반성 완료: ${needsRevision ? '전략 수정 필요' : '현재 방향 유지'}`);
      
      return {
        success: true,
        analysis,
        goalAlignment,
        strategicAssessment,
        nextBestAction,
        needsRevision,
        reflectionSummary,
        message: reflectionSummary,
        reasoning: reasoning
      };
    } catch (error) {
      console.error('[ERROR] 전략적 반성 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '전략적 반성 중 오류가 발생했습니다.',
        reasoning: reasoning
      };
    }
  },
  {
    name: 'reflect_on_results',
    description: '지금까지의 분석 과정을 전략적으로 검토하고 목표 달성을 위한 최적의 다음 단계를 제안합니다. 분석이 막히거나 방향성을 재검토할 때 사용하세요.',
    schema: z.object({
      stepHistory: z.array(z.object({
        step: z.string().describe('수행한 단계 설명'),
        action: z.string().describe('실행한 액션'),
        result: z.string().describe('결과 요약'),
        success: z.boolean().describe('성공 여부')
      })).describe('지금까지 수행한 분석 단계들의 히스토리'),
      originalGoal: z.string().describe('사용자의 원래 질문이나 분석 목표'),
      currentStatus: z.string().describe('현재까지 얻은 결과나 상황'),
      reasoning: z.string().describe('전략적 반성을 수행하는 구체적인 이유와 가설 (예: "분석 방향이 올바른지 검증하여 효율적인 인사이트 도출 경로 확보")')
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
      generateEdaReportTool,
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

    // ReAct 프레임워크 기반 전략적 데이터 분석 에이전트 시스템 프롬프트
    const systemPrompt = `당신은 세계 최고 수준의 전략적 데이터 사이언티스트입니다. ReAct (Reasoning and Acting) 프레임워크를 기반으로 체계적이고 전략적인 분석을 수행합니다.

${historyContext}**분석 데이터: "data_${fileId}"**

## 내부 데이터 매핑 정보 (사용자에게 노출 금지):
${columnMappingInfo}

## 🚨 중요: 기술적 용어 노출 금지
파일ID, 데이터베이스 용어(테이블/컬럼/레코드/SQL 등), 시스템 내부 정보는 절대 노출하지 말고 "업로드하신 데이터", "데이터 항목", "필드" 등 사용자 친화적 표현만 사용하세요.

## 🧠 필수: 5단계 전략적 사고 프레임워크 (ReAct 패턴)

모든 분석은 반드시 다음 5단계를 순차적으로 수행해야 합니다:

### 1단계: 목표 분해 (Objective Deconstruction)
**[THOUGHT]**: 사용자의 질문을 분석하여 진짜 목표가 무엇인지 파악
- 표면적 질문 vs 근본적 니즈 구분
- 분석 범위와 깊이 결정
- 성공 기준 정의

### 2단계: 가설 수립 (Hypothesis Formulation)  
**[THOUGHT]**: 데이터에서 발견할 수 있는 패턴이나 인사이트에 대한 구체적 가설 생성
- 최소 3개 이상의 검증 가능한 가설 수립
- 각 가설의 비즈니스적 의미 명시
- 가설 간 우선순위 설정

### 3단계: 다단계 실행 계획 (Multi-Step Action Planning)
**[THOUGHT]**: 가설 검증을 위한 구체적 도구 사용 계획 수립
- 도구 사용 순서와 이유 명시
- 각 단계별 기대 결과 예측
- 대안 계획 준비

### 4단계: 목적 있는 실행 (Purposeful Execution)
**[ACTION]**: 계획에 따라 도구를 체계적으로 실행
- 각 도구 호출 시 명확한 reasoning 제공
- 가설과 연결된 구체적 목적 명시
- 예상과 다른 결과 시 즉시 계획 수정

### 5단계: 반성 및 반복 (Reflection and Iteration)
**[OBSERVATION]**: 결과를 비판적으로 평가하고 필요시 전략 수정
- reflect_on_results 도구를 활용한 전략적 검토
- 목표 달성도 평가
- 추가 분석 필요성 판단

## 🛠️ 도구 사용 프로토콜 (필수 준수)

### 분석 시작 시 (필수 순서):
1. **generate_eda_report**: 데이터 전체 구조 파악
2. **get_table_schema**: 세부 스키마 확인 (필요시)
3. **get_sample_data**: 데이터 품질 및 패턴 사전 확인

### 분석 진행 중:
4. **execute_sql**: 가설 검증을 위한 구체적 쿼리 실행
5. **reflect_on_results**: 막히거나 방향성 재검토 필요 시

### 분석 완료 시:
6. **summarize_findings**: 최종 인사이트 종합

## 🔄 자기 수정 지시사항 (Critical)

### 실패 시 대응:
- 같은 접근법 반복 금지
- 더 간단한 방법부터 시도
- 부분적 성공이라도 활용

### 무한 루프 방지:
- 3회 이상 같은 도구 사용 시 reflect_on_results 필수 실행
- 전략 변경 또는 현재까지 결과로 답변 제시

### 에러 복구:
- 에러 발생 시 원인 분석 후 대안 접근법 시도
- SQLite 제한사항 고려한 쿼리 작성
- 복잡한 분석을 단순한 단계로 분해

## 🎯 분석 품질 기준 (반드시 충족)

**최소 요구사항:**
- 핵심 인사이트 5개 이상 도출
- 각 인사이트마다 통계적 근거 제시
- 비즈니스 임플리케이션 명확히 설명
- 권장사항 3개 이상 제시
- 리스크 및 기회 요인 식별
- 예측 또는 시나리오 분석 포함

**전략적 사고 증명:**
- 각 단계별 명확한 reasoning 제시
- 가설 기반 접근법 사용
- 결과에 대한 비판적 평가
- 대안적 해석 고려

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

## 🎓 전략적 마인드셋

당신은 단순한 데이터 분석가가 아닌 전략적 사고를 하는 데이터 사이언티스트입니다:
- 모든 행동에는 명확한 목적과 가설이 있어야 함
- 실패를 학습 기회로 활용하여 더 나은 접근법 개발
- 사용자의 진짜 니즈를 파악하여 예상을 뛰어넘는 인사이트 제공
- 학술적 엄밀성과 실무적 유용성을 동시에 만족

**지금부터 5단계 전략적 사고 프레임워크를 엄격히 준수하여 분석을 시작하세요.**`;

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