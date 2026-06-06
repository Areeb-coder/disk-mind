export interface ScanSession {
  id: string;
  rootPath?: string;
  root_path?: string;
  startedAt?: string;
  started_at?: string;
  completedAt?: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed';
  filesScanned?: number;
  files_scanned?: number;
  foldersScanned?: number;
  folders_scanned?: number;
  totalBytes?: number;
  total_bytes?: number;
}

export interface ScanStatus {
  sessionId: string;
  isRunning: boolean;
  filesScanned: number;
  foldersScanned: number;
  bytesScanned: number;
  totalDiskBytes: number;
  currentFile: string;
  status: string;
}

export interface StorageAllocation {
  category: string;
  totalBytes: number;
  fileCount: number;
  percentage: number;
}

export interface FileTypeInfo {
  extension: string;
  totalBytes: number;
  count: number;
}

export interface StorageRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  estimatedBytes: number;
  riskLevel: 'Safe' | 'Moderate' | 'Caution' | 'Review';
  riskScore: number;
  paths: string[];
}

export interface IntelligenceReport {
  sessionId: string;
  totalBytes: number;
  totalFiles: number;
  healthScore: number;
  allocations: StorageAllocation[];
  fileTypes: FileTypeInfo[];
  recommendations: StorageRecommendation[];
  extensionAnalysis: Record<string, number>;
  totalDuplicateBytes: number;
  duplicateGroupCount: number;
}

export interface DuplicateGroup {
  groupId: string;
  fileHash: string;
  fileCount: number;
  wastedBytes: number;
  fileSizeBytes: number;
  files: { full_path: string; size_bytes: number; last_modified: string }[];
}

export interface CleanupRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  riskLevel: string;
  riskScore: number;
  estimatedBytes: number;
  paths: string[];
}

export interface CleanupHistory {
  id: string;
  executedAt: string;
  filesDeleted: number;
  bytesFreed: number;
  status: string;
  rollbackPath?: string;
}

export interface ExplorerItem {
  name: string;
  full_path: string;
  size_bytes: number;
  file_count: number;
  is_directory: number;
  extension?: string;
  category?: string;
}
