import { NextRequest, NextResponse } from 'next/server';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { generateId, normalizeColumnNames } from '@/shared/lib/utils';
import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';
import { db } from '@/lib/database';

function detectEncoding(buffer: Buffer): string {
  const detected = jschardet.detect(buffer);
  return detected.encoding || 'utf-8';
}

function parseCSV(buffer: Buffer): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const results: Record<string, unknown>[] = [];
    const encoding = detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    
    const stream = Readable.from([content]);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseExcel(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

// 데이터 타입 추론 함수
function inferColumnType(values: unknown[]): string {
  // null이나 undefined가 아닌 값들만 필터링
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) return 'TEXT';
  
  // 샘플링: 최대 100개 값만 확인 (성능 최적화)
  const sampleValues = nonNullValues.slice(0, 100);
  
  let isAllInteger = true;
  let isAllReal = true;
  let isAllDate = true;
  
  for (const value of sampleValues) {
    const strValue = String(value).trim();
    
    // 정수 체크
    if (isAllInteger && !/^-?\d+$/.test(strValue)) {
      isAllInteger = false;
    }
    
    // 실수 체크
    if (isAllReal && !/^-?\d*\.?\d+$/.test(strValue)) {
      isAllReal = false;
    }
    
    // 날짜 체크 (다양한 날짜 형식 지원)
    if (isAllDate) {
      const dateValue = new Date(strValue);
      const isValidDate = !isNaN(dateValue.getTime());
      const hasDatePattern = /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(strValue) || 
                            /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(strValue) ||
                            /^\d{4}\d{2}\d{2}$/.test(strValue);
      
      if (!isValidDate || !hasDatePattern) {
        isAllDate = false;
      }
    }
  }
  
  // 타입 결정 우선순위: INTEGER > REAL > DATE > TEXT
  if (isAllInteger) return 'INTEGER';
  if (isAllReal) return 'REAL';
  if (isAllDate) return 'DATE';
  return 'TEXT';
}

export async function POST(request: NextRequest) {
  const uploadStartTime = Date.now();
  console.log(`[UPLOAD] 업로드 시작`);
  
  try {
    // 데이터베이스는 자동으로 초기화됩니다

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log(`[UPLOAD] 파일 정보: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    const buffer = Buffer.from(await file.arrayBuffer());
    let data: Record<string, unknown>[];

    // 파일 형식에 따라 파싱
    const parseStartTime = Date.now();
    console.log(`[UPLOAD] 파일 파싱 시작`);
    
    if (file.name.endsWith('.csv')) {
      data = await parseCSV(buffer);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      data = parseExcel(buffer);
    } else {
      return NextResponse.json({ error: '지원되지 않는 파일 형식입니다.' }, { status: 400 });
    }

    const parseEndTime = Date.now();
    console.log(`[UPLOAD] 파일 파싱 완료: ${parseEndTime - parseStartTime}ms, ${data.length}행 파싱됨`);

    if (data.length === 0) {
      return NextResponse.json({ error: '파일에 데이터가 없습니다.' }, { status: 400 });
    }

    // 파일 정보 생성
    const fileId = generateId();
    const tableName = `data_${fileId}`;
    const columns = Object.keys(data[0]);
    const { normalizedColumns } = normalizeColumnNames(columns);
    
    // 컬럼 매핑을 원본 -> 정규화 형태로 변환
    const columnMapping: Record<string, string> = {};
    columns.forEach((originalCol, index) => {
      columnMapping[originalCol] = normalizedColumns[index];
    });

    // 데이터 정규화
    const normalizedData = data.map(row => {
      const normalizedRow: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = columnMapping[key];
        normalizedRow[normalizedKey] = value;
      });
      return normalizedRow;
    });

    // 1. 테이블 생성
    console.log(`[UPLOAD] 테이블 생성 시작: ${tableName}`);
    
    // 각 컬럼의 데이터 타입 추론
    const columnTypes: Record<string, string> = {};
    normalizedColumns.forEach((col) => {
      const columnValues = normalizedData.map(row => row[col]);
      columnTypes[col] = inferColumnType(columnValues);
    });
    
    console.log(`[UPLOAD] 추론된 컬럼 타입:`, columnTypes);
    
    const createTableColumns = normalizedColumns.map(col => `"${col}" ${columnTypes[col]}`).join(', ');
    const createTableQuery = `CREATE TABLE IF NOT EXISTS "${tableName}" (${createTableColumns})`;
    
    const createTableResult = db.execute(createTableQuery);
    if (!createTableResult.success) {
      throw new Error(createTableResult.error);
    } else {
      console.log(`[UPLOAD] 테이블 생성 완료: ${tableName}`);
    }

    // 2. 데이터 삽입 (배치 처리로 성능 최적화)
    console.log(`[UPLOAD] 데이터 삽입 시작: ${normalizedData.length}개 행`);
    const startTime = Date.now();
    
    // 트랜잭션으로 배치 삽입
    const placeholders = normalizedColumns.map(() => '?').join(', ');
    const insertQuery = `INSERT INTO "${tableName}" (${normalizedColumns.map(col => `"${col}"`).join(', ')}) VALUES (${placeholders})`;
    
    const transactionResult = db.transaction(() => {
      for (const row of normalizedData) {
        const values = normalizedColumns.map(col => {
          const value = row[col];
          if (value === null || value === undefined || value === '') return null;
          
          const columnType = columnTypes[col];
          const strValue = String(value).trim();
          
          // 타입에 따른 변환
          switch (columnType) {
            case 'INTEGER':
              const intValue = parseInt(strValue, 10);
              return isNaN(intValue) ? null : intValue;
            case 'REAL':
              const floatValue = parseFloat(strValue);
              return isNaN(floatValue) ? null : floatValue;
            case 'DATE':
              const dateValue = new Date(strValue);
              return isNaN(dateValue.getTime()) ? strValue : dateValue.toISOString();
            default:
              return strValue;
          }
        });
        
        const insertResult = db.execute(insertQuery, values);
        if (!insertResult.success) {
          throw new Error(insertResult.error);
        }
      }
    });
    
    if (!transactionResult.success) {
      throw new Error(transactionResult.error);
    }
    
    const endTime = Date.now();
    console.log(`[UPLOAD] 데이터 삽입 완료: ${endTime - startTime}ms`);

    // 3. 파일 메타데이터 저장
    const fileMetadata = {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      columns: JSON.stringify(columns),
      columnCount: columns.length,
      rowCount: data.length,
      columnMapping: JSON.stringify(columnMapping)
    };

    // 파일 메타데이터 삽입
    const insertFileQuery = `
      INSERT INTO files (id, name, type, size, uploadedAt, columns, columnCount, rowCount, columnMapping)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const insertFileResult = db.execute(insertFileQuery, [
      fileId,
      file.name,
      file.type,
      file.size,
      fileMetadata.uploadedAt,
      fileMetadata.columns,
      fileMetadata.columnCount,
      fileMetadata.rowCount,
      fileMetadata.columnMapping
    ]);
    
    if (!insertFileResult.success) {
      throw new Error(insertFileResult.error);
    } else {
      console.log(`[UPLOAD] 메타데이터 저장 완료`);
    }

    const uploadEndTime = Date.now();
    console.log(`[UPLOAD] 전체 업로드 완료: ${uploadEndTime - uploadStartTime}ms`);

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: fileMetadata.uploadedAt,
        columns,
        columnCount: columns.length,
        rowCount: data.length,
        columnMapping
      }
    });

  } catch (error) {
    console.error('파일 업로드 실패:', error);
    return NextResponse.json(
      { error: `파일 업로드 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 