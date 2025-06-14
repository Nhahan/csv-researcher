'use client';

import { useState, useEffect } from 'react';

import { 
  FileText, 
  BarChart3, 
  Search,
  Filter,
  Plus,
  Database,
  TrendingUp,
  FileSpreadsheet,
  Activity
} from 'lucide-react';
import { UploadModal } from '@/features/upload/components/UploadModal';
import FileItem from './components/FileItem';

interface FileData {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  rowCount?: number;
  columnCount?: number;
  displayName?: string;
}

export default function HomePage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');


  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('파일 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('이 파일과 관련된 모든 데이터(채팅 메시지, 분석 결과 등)가 삭제됩니다. 계속하시겠습니까?')) return;
    
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setFiles(files.filter(file => file.id !== fileId));
      } else {
        const errorData = await response.json();
        alert(`파일 삭제 실패: ${errorData.error}`);
      }
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      alert('파일 삭제 중 오류가 발생했습니다.');
    }
  };



  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (selectedFilter === 'all') return matchesSearch;
    if (selectedFilter === 'recent') {
      const fileDate = new Date(file.uploadedAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return matchesSearch && fileDate > weekAgo;
    }
    return matchesSearch;
  });

  const totalFiles = files.length;
  const totalRows = files.reduce((sum, file) => sum + (file.rowCount || 0), 0);
  const recentFiles = files.filter(file => {
    const fileDate = new Date(file.uploadedAt);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return fileDate > weekAgo;
  }).length;

  return (
    <div className="min-h-screen bg-beige-100">
      {/* Header */}
              <header className="bg-beige-50 border-b border-beige-300 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-medium">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Proba</h1>
                  <p className="text-sm text-gray-500">CSV 데이터 분석 플랫폼</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-primary-700 text-white text-sm font-semibold rounded-lg hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border border-primary-800"
            >
              <Plus className="w-5 h-5 mr-2" />
              새 파일 업로드
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-beige-50 rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-200 border border-beige-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">전체 파일</p>
                {loading ? (
                  <div className="h-8 w-16 bg-beige-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{totalFiles}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>

          <div className="bg-beige-50 rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-200 border border-beige-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 데이터 행</p>
                {loading ? (
                  <div className="h-8 w-20 bg-beige-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{totalRows.toLocaleString()}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-success-600" />
              </div>
            </div>
          </div>

          <div className="bg-beige-50 rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-200 border border-beige-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">최근 업로드</p>
                {loading ? (
                  <div className="h-8 w-12 bg-beige-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{recentFiles}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-warning-600" />
              </div>
            </div>
          </div>

          <div className="bg-beige-50 rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-200 border border-beige-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">활성 분석</p>
                {loading ? (
                  <div className="h-8 w-12 bg-beige-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{files.length > 0 ? files.length : 0}</p>
                )}
              </div>
              <div className="w-12 h-12 bg-beige-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-beige-50 rounded-xl shadow-card border border-beige-200 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="파일명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-beige-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="px-3 py-2.5 border border-beige-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
                <option value="all">전체 파일</option>
                <option value="recent">최근 7일</option>
              </select>
            </div>
          </div>
        </div>

        {/* Files Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-600">파일 목록을 불러오는 중...</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="bg-beige-50 rounded-xl shadow-card border border-beige-200 p-12 text-center">
            <div className="w-16 h-16 bg-beige-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8 text-beige-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? '검색 결과가 없습니다' : '업로드된 파일이 없습니다'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? '다른 검색어를 시도해보세요' : 'CSV 파일을 업로드하여 AI 분석을 시작하세요'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center px-6 py-3 bg-primary-700 text-white text-sm font-semibold rounded-lg hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors shadow-lg hover:shadow-xl border border-primary-800"
              >
                <Plus className="w-5 h-5 mr-2" />
                첫 번째 파일 업로드
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredFiles.map((file) => (
              <FileItem 
                key={file.id} 
                file={file} 
                onTitleUpdate={fetchFiles} 
                onDelete={handleDelete} 
              />
            ))}
          </div>
        )}
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={fetchFiles}
          />
    </div>
  );
}
