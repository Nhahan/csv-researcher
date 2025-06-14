'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileSpreadsheet, 
  Users, 
  BarChart3, 
  Clock, 
  MessageSquare, 
  ChevronRight, 
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react';

interface FileData {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  rowCount?: number;
  columnCount?: number;
  displayName?: string;
}

interface FileItemProps {
  file: FileData;
  onTitleUpdate: () => void;
  onDelete: (fileId: string) => void;
}

export default function FileItem({ file, onTitleUpdate, onDelete }: FileItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(file.displayName || file.name);
  const [isUpdating, setIsUpdating] = useState(false);

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleTitleSave = async () => {
    if (editTitle.trim() === '') return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: editTitle.trim() }),
      });

      if (response.ok) {
        setIsEditing(false);
        onTitleUpdate();
      } else {
        console.error('제목 업데이트 실패');
      }
    } catch (error) {
      console.error('제목 업데이트 오류:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTitleCancel = () => {
    setEditTitle(file.displayName || file.name);
    setIsEditing(false);
  };

  const displayTitle = file.displayName || file.name;

  return (
    <div className="bg-beige-50 rounded-xl shadow-card hover:shadow-card-hover border border-beige-200 overflow-hidden transition-all duration-200 transform hover:scale-[1.02] group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1 min-w-0 pr-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 text-sm font-semibold bg-white border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') handleTitleCancel();
                    }}
                    autoFocus
                    disabled={isUpdating}
                  />
                  <button
                    onClick={handleTitleSave}
                    disabled={isUpdating}
                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleTitleCancel}
                    disabled={isUpdating}
                    className="p-1 text-gray-400 hover:bg-gray-50 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h3 
                    className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors cursor-pointer flex-1" 
                    title={displayTitle}
                    onClick={() => setIsEditing(true)}
                  >
                    {displayTitle}
                  </h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-all duration-200"
                    title="제목 편집"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-all duration-200 flex-shrink-0 ml-2"
            title="파일 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {file.rowCount && (
            <div className="flex items-center text-sm text-gray-600">
              <Users className="w-4 h-4 mr-2 text-gray-400" />
              <span>{file.rowCount.toLocaleString()}개 행</span>
            </div>
          )}
          
          {file.columnCount && (
            <div className="flex items-center text-sm text-gray-600">
              <BarChart3 className="w-4 h-4 mr-2 text-gray-400" />
              <span>{file.columnCount}개 열</span>
            </div>
          )}
          
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2 text-gray-400" />
            <span>{formatDate(file.uploadedAt)}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => router.push(`/chat/${file.id}`)}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-primary-700 text-white text-sm font-medium rounded-lg hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 group shadow-md border border-primary-800"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            AI 분석
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
} 