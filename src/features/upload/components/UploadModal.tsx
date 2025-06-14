'use client';

import { X, Upload } from 'lucide-react';
import FileUpload from '@/features/file-upload/ui/FileUpload';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  if (!isOpen) return null;

  const handleUploadSuccess = () => {
    onUploadComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-md">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full transform transition-all duration-300 scale-100 animate-scale-in border border-beige-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-beige-300">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">파일 업로드</h3>
              <p className="text-sm text-gray-500">CSV 또는 Excel 파일을 업로드하세요 (최대 500MB)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-beige-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      </div>
    </div>
  );
} 