import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 컬럼명을 SQLite에서 안전한 형태로 정규화 (의미 있는 이름 유지)
export function normalizeColumnNames(columns: string[]): {
  normalizedColumns: string[];
  columnMapping: Record<string, string>;
} {
  const normalizedColumns: string[] = [];
  const columnMapping: Record<string, string> = {};
  const usedNames = new Set<string>();
  
  // SQLite 예약어 목록 (주요한 것들만)
  const reservedWords = new Set([
    'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop', 
    'table', 'index', 'view', 'database', 'schema', 'primary', 'key', 'foreign',
    'references', 'constraint', 'unique', 'not', 'null', 'default', 'check',
    'and', 'or', 'in', 'like', 'between', 'exists', 'case', 'when', 'then',
    'else', 'end', 'as', 'order', 'by', 'group', 'having', 'limit', 'offset',
    'union', 'intersect', 'except', 'join', 'inner', 'left', 'right', 'full',
    'outer', 'on', 'using', 'distinct', 'all', 'any', 'some'
  ]);
  
  columns.forEach((originalColumn, index) => {
    let normalizedColumn = originalColumn
      // 앞뒤 공백 제거
      .trim()
      // 연속된 공백을 단일 언더스코어로 변경
      .replace(/\s+/g, '_')
      // 특수문자를 언더스코어로 변경 (한글, 영문, 숫자, 언더스코어만 유지)
      .replace(/[^\w가-힣]/g, '_')
      // 연속된 언더스코어를 단일 언더스코어로 변경
      .replace(/_+/g, '_')
      // 앞뒤 언더스코어 제거
      .replace(/^_+|_+$/g, '');
    
    // 빈 문자열이거나 숫자로만 시작하는 경우 처리
    if (!normalizedColumn || /^\d/.test(normalizedColumn)) {
      normalizedColumn = `column_${index + 1}`;
    }
    
    // SQLite 예약어인 경우 접미사 추가
    if (reservedWords.has(normalizedColumn.toLowerCase())) {
      normalizedColumn = `${normalizedColumn}_col`;
    }
    
    // 중복된 컬럼명 처리
    let finalColumnName = normalizedColumn;
    let counter = 1;
    while (usedNames.has(finalColumnName.toLowerCase())) {
      finalColumnName = `${normalizedColumn}_${counter}`;
      counter++;
    }
    
    usedNames.add(finalColumnName.toLowerCase());
    normalizedColumns.push(finalColumnName);
    columnMapping[originalColumn] = finalColumnName;
  });
  
  return {
    normalizedColumns,
    columnMapping
  };
}
 