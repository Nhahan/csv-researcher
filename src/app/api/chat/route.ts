import { NextRequest, NextResponse } from 'next/server';
import { processQueryWithEnhancedReAct } from '@/lib/enhanced-react-agent';
import { saveChatHistory } from '@/lib/chat-history';
import { db } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { message, fileId } = await request.json();

    if (!message || !fileId) {
      return NextResponse.json(
        { error: 'message와 fileId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 정보 조회
    const result = db.selectOne('SELECT * FROM files WHERE id = ?', [fileId]);
    
    if (!result.success || !result.data?.[0]) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const fileData = result.data[0];

    const fileName = (fileData.displayName as string) || (fileData.name as string);



    // 스트리밍 응답 설정
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // reasoning 콜백 함수
          const onReasoning = (reasoning: string) => {
            const data = JSON.stringify({ type: 'reasoning', content: reasoning });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          };

          // Enhanced ReAct 에이전트를 사용한 분석 (reasoning 콜백 포함)
          const response = await processQueryWithEnhancedReAct(
            message, 
            fileId, 
            fileName, 
            onReasoning
          );

          // 최종 응답 전송
          const finalData = JSON.stringify({ type: 'response', content: response });
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));

          // 채팅 히스토리 저장 (무제한)
          try {
            await saveChatHistory(fileId, message, response);
          } catch {
            // 히스토리 저장 실패는 사용자에게 영향을 주지 않음
          }

          controller.close();

        } catch {
          const errorData = JSON.stringify({ 
            type: 'error', 
            content: '죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' 
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch {
    return NextResponse.json(
      { error: '죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
} 