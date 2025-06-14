import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { clearChatHistory } from '@/lib/chat-history';

// DELETE: 파일 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 파일 정보 조회
    const result = db.selectOne('SELECT * FROM files WHERE id = ?', [id]);
    
    if (!result.success || !result.data?.[0]) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const _fileData = result.data[0];

    // 1. 채팅 히스토리 삭제
    try {
      await clearChatHistory(id);
      console.log(`파일 ${id}의 채팅 히스토리가 삭제되었습니다.`);
    } catch (historyError) {
      console.error('채팅 히스토리 삭제 실패:', historyError);
      // 히스토리 삭제 실패해도 파일 삭제는 계속 진행
    }

    // 2. 데이터 테이블 삭제
    const tableName = `data_${id}`;
    const dropResult = db.execute(`DROP TABLE IF EXISTS "${tableName}"`);
    if (!dropResult.success) {
      console.error(`테이블 ${tableName} 삭제 실패:`, dropResult.error);
      throw new Error(dropResult.error);
    } else {
      console.log(`테이블 ${tableName}이 삭제되었습니다.`);
    }

    // 3. 파일 메타데이터 삭제
    const deleteResult = db.execute('DELETE FROM files WHERE id = ?', [id]);
    if (!deleteResult.success) {
      console.error('파일 메타데이터 삭제 실패:', deleteResult.error);
      throw new Error(deleteResult.error);
    } else {
      console.log(`파일 메타데이터가 삭제되었습니다. (${deleteResult.changes}개 행)`);
    }

    return NextResponse.json({
      success: true,
      message: '파일과 관련 데이터가 모두 삭제되었습니다.'
    });

  } catch (error) {
    console.error('파일 삭제 실패:', error);
    return NextResponse.json(
      { error: `파일 삭제 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// GET: 개별 파일 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = db.selectOne('SELECT * FROM files WHERE id = ?', [id]);
    
    if (!result.success || !result.data?.[0]) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const fileData = result.data[0];

    return NextResponse.json({
      success: true,
      file: {
        id: fileData.id,
        name: fileData.name,
        displayName: fileData.displayName,
        size: fileData.size,
        type: fileData.type,
        uploadedAt: fileData.uploadedAt
      }
    });

  } catch (error) {
    console.error('파일 조회 실패:', error);
    return NextResponse.json(
      { error: `파일 조회 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

// PUT: 파일 제목 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { displayName } = await request.json();

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json(
        { error: '유효한 제목을 입력해주세요.' },
        { status: 400 }
      );
    }

    const updateResult = db.execute(
      'UPDATE files SET displayName = ? WHERE id = ?',
      [displayName.trim(), id]
    );
    
    if (!updateResult.success) {
      console.error('파일 제목 수정 실패:', updateResult.error);
      throw new Error(updateResult.error);
    } else if (updateResult.changes === 0) {
      throw new Error('파일을 찾을 수 없습니다.');
    } else {
      console.log(`파일 제목이 수정되었습니다: ${displayName}`);
    }

    return NextResponse.json({
      success: true,
      message: '파일 제목이 수정되었습니다.',
      displayName: displayName.trim()
    });

  } catch (error) {
    console.error('파일 제목 수정 실패:', error);
    return NextResponse.json(
      { error: `파일 제목 수정 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 