'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  BarChart3, 
  Users, 
  Calendar,
  MessageSquare,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { ChatInterface } from '@/features/chat-interface/ui/ChatInterface';

interface FileData {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    const fetchFileData = async () => {
      try {
        setLoading(true);
        
        // 개별 파일 정보 조회
        const response = await fetch(`/api/files/${id}`);
        if (response.ok) {
          const data = await response.json();
          setFile(data.file);
        } else {
          console.error('파일 정보 조회 실패');
          setFile(null);
        }
      } catch (error) {
        console.error('파일 정보 로드 실패:', error);
        setFile(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchFileData();
    }
  }, [id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">파일 정보 로드 중</h3>
          <p className="text-gray-600">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-beige-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-beige-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">파일을 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-8">요청하신 파일이 존재하지 않거나 삭제되었습니다.</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-6 py-3 bg-primary-700 text-white font-medium rounded-lg hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border border-primary-800"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            파일 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
          <div className="min-h-screen bg-beige-100">
      {/* Header */}
              <header className="bg-beige-50 border-b border-beige-300 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-beige-50 rounded-lg transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                파일 목록
              </button>
              
              <div className="h-6 w-px bg-beige-300"></div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-medium">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{file.name}</h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    {file.rowCount && (
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {file.rowCount.toLocaleString()}행
                      </span>
                    )}
                    {file.columnCount && (
                      <span className="flex items-center">
                        <BarChart3 className="w-3 h-3 mr-1" />
                        {file.columnCount}열
                      </span>
                    )}
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(file.uploadedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center px-3 py-1.5 bg-gradient-to-r from-primary-100 to-primary-200 text-primary-700 rounded-full">
                <Sparkles className="w-4 h-4 mr-1" />
                AI 분석 모드
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-beige-50 rounded-2xl shadow-card border border-beige-200 overflow-hidden h-[calc(100vh-8rem)]">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-4 border-b border-primary-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-primary-900">AI 데이터 분석</h2>
                <p className="text-sm text-primary-700">데이터에 대해 자유롭게 질문해보세요</p>
              </div>
            </div>
          </div>
          
          {/* Chat Interface */}
          <div className="h-full">
            <ChatInterface fileId={id} fileName={file.name} />
          </div>
        </div>
      </main>
    </div>
  );
} 