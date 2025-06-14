import { NextRequest, NextResponse } from 'next/server';
import { getRecentChatHistory, getAllChatHistory, clearChatHistory, getChatHistoryCount, getChatHistoryPaginated } from '@/lib/chat-history';

// GET: 특정 파일의 채팅 히스토리 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const all = searchParams.get('all') === 'true'; // 전체 히스토리 조회 여부
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    if (all) {
      // 전체 히스토리 조회 (기존 방식)
      const history = await getAllChatHistory(fileId);
      const totalCount = await getChatHistoryCount(fileId);

      return NextResponse.json({
        success: true,
        history,
        count: history.length,
        totalCount,
        isPartial: false
      });
    } else if (page > 1 || limit !== 10) {
      // 페이지네이션 조회
      const result = await getChatHistoryPaginated(fileId, page, limit);

      return NextResponse.json({
        success: true,
        history: result.history,
        count: result.history.length,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        currentPage: result.currentPage,
        isPartial: true
      });
    } else {
      // 컨텍스트용 최근 히스토리만 조회 (기존 방식)
      const history = await getRecentChatHistory(fileId);
      const totalCount = await getChatHistoryCount(fileId);

      return NextResponse.json({
        success: true,
        history,
        count: history.length,
        totalCount,
        isPartial: totalCount > history.length
      });
    }

  } catch (error) {
    console.error('채팅 히스토리 조회 실패:', error);
    return NextResponse.json(
      { error: `히스토리 조회 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// DELETE: 특정 파일의 채팅 히스토리 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId가 필요합니다.' },
        { status: 400 }
      );
    }

    await clearChatHistory(fileId);

    return NextResponse.json({
      success: true,
      message: `파일 ${fileId}의 채팅 히스토리가 삭제되었습니다.`
    });

  } catch (error) {
    console.error('채팅 히스토리 삭제 실패:', error);
    return NextResponse.json(
      { error: `히스토리 삭제 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 