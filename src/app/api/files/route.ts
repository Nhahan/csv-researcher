import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    // files 테이블에서 파일 목록 조회
    const result = db.select('SELECT * FROM files ORDER BY uploadedAt DESC');
    
    if (!result.success) {
      console.error('파일 목록 조회 실패:', result.error);
      return NextResponse.json({ files: [] });
    }

    // 데이터 형식 변환
    const files = (result.data || []).map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: file.uploadedAt,
      columns: JSON.parse((file.columns as string) || '[]'),
      columnCount: file.columnCount,
      rowCount: file.rowCount,
      columnMapping: JSON.parse((file.columnMapping as string) || '{}'),
      displayName: file.displayName as string || undefined
    }));

    return NextResponse.json({ files });

  } catch (error) {
    console.error('파일 목록 조회 실패:', error);
    return NextResponse.json(
      { error: `파일 목록 조회 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 