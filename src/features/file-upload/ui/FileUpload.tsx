'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

interface UploadProgress {
  isUploading: boolean;
  progress: number;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  error: string | null;
  success: boolean;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    isUploading: false,
    progress: 0,
    fileName: '',
    fileSize: 0,
    uploadedBytes: 0,
    error: null,
    success: false
  });

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const uploadFileWithProgress = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // 업로드 진행률 추적
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            progress,
            uploadedBytes: event.loaded
          }));
        }
      });

      // 업로드 완료
      xhr.addEventListener('load', () => {
                 if (xhr.status >= 200 && xhr.status < 300) {
           try {
             const _response = JSON.parse(xhr.responseText);
             setUploadProgress(prev => ({
               ...prev,
               success: true,
               progress: 100
             }));
             resolve();
           } catch {
             reject(new Error('응답 파싱 실패'));
           }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || '업로드 실패'));
          } catch {
            reject(new Error(`업로드 실패: ${xhr.status}`));
          }
        }
      });

      // 업로드 오류
      xhr.addEventListener('error', () => {
        reject(new Error('네트워크 오류가 발생했습니다.'));
      });

      // 업로드 중단
      xhr.addEventListener('abort', () => {
        reject(new Error('업로드가 중단되었습니다.'));
      });

      xhr.open('POST', '/api/files/upload');
      xhr.send(formData);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // 초기 상태 설정
    setUploadProgress({
      isUploading: true,
      progress: 0,
      fileName: file.name,
      fileSize: file.size,
      uploadedBytes: 0,
      error: null,
      success: false
    });

    try {
      await uploadFileWithProgress(file);
      
      // 성공 후 잠시 대기
      setTimeout(() => {
        onUploadSuccess();
      }, 1500);

    } catch (error) {
      console.error('업로드 실패:', error);
      setUploadProgress(prev => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.'
      }));
    }
  }, [onUploadSuccess]);

  const resetUpload = () => {
    setUploadProgress({
      isUploading: false,
      progress: 0,
      fileName: '',
      fileSize: 0,
      uploadedBytes: 0,
      error: null,
      success: false
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500MB
    disabled: uploadProgress.isUploading
  });

  // 업로드 중이거나 완료된 경우 프로그레스 모달 표시
  if (uploadProgress.isUploading || uploadProgress.success || uploadProgress.error) {
    return (
      <div className="w-full">
        <div className="bg-white rounded-xl border border-beige-200 p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {uploadProgress.success ? '업로드 완료!' : uploadProgress.error ? '업로드 실패' : '업로드 중...'}
            </h3>
            {(uploadProgress.error || uploadProgress.success) && (
              <button
                onClick={resetUpload}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* 파일 정보 */}
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                uploadProgress.success ? 'bg-success-100' : 
                uploadProgress.error ? 'bg-error-100' : 'bg-primary-100'
              }`}>
                {uploadProgress.success ? (
                  <CheckCircle className="w-5 h-5 text-success-600" />
                ) : uploadProgress.error ? (
                  <AlertCircle className="w-5 h-5 text-error-600" />
                ) : (
                  <FileText className="w-5 h-5 text-primary-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadProgress.fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(uploadProgress.uploadedBytes)} / {formatFileSize(uploadProgress.fileSize)}
                </p>
              </div>
            </div>

            {/* 프로그레스바 */}
            {!uploadProgress.error && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {uploadProgress.success ? '업로드 완료' : '업로드 중...'}
                  </span>
                  <span className="text-gray-900 font-medium">
                    {uploadProgress.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadProgress.success ? 'bg-success-500' : 'bg-primary-500'
                    }`}
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 오류 메시지 */}
            {uploadProgress.error && (
              <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
                <p className="text-sm text-error-700">{uploadProgress.error}</p>
              </div>
            )}

            {/* 성공 메시지 */}
            {uploadProgress.success && (
              <div className="p-3 bg-success-50 border border-success-200 rounded-lg">
                <p className="text-sm text-success-700">
                  파일이 성공적으로 업로드되었습니다. 잠시 후 자동으로 닫힙니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 기본 드롭존 표시
  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-beige-300 hover:border-primary-400 hover:bg-beige-50'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-beige-100 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-beige-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {isDragActive ? '파일을 여기에 놓으세요' : '파일을 드래그하거나 클릭하여 선택'}
            </h3>
            <p className="text-sm text-gray-500">
              CSV, Excel 파일 지원 (최대 500MB)
            </p>
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-400">
            <div className="flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>.csv</span>
            </div>
            <div className="flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>.xlsx</span>
            </div>
            <div className="flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>.xls</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 