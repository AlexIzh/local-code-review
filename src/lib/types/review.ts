export interface ReviewComment {
	id: string;
	filePath: string;
	lineNumber: number;
	side: 'old' | 'new';
	body: string;
	type: 'comment' | 'suggestion' | 'question';
	createdAt: string;
}

export interface ReviewThread {
	id: string;
	filePath: string;
	lineNumber: number;
	side: 'old' | 'new';
	comments: ReviewComment[];
	resolved: boolean;
	outdated: boolean;
	originalLineContent?: string;
}

export interface Review {
	id: string;
	threads: ReviewThread[];
	status: 'pending' | 'approved' | 'changes_requested';
	createdAt: string;
	summary?: string;
}

export interface ReviewExport {
	version: '1.0';
	repository: string;
	branch: string;
	exportedAt: string;
	review: {
		status: string;
		summary?: string;
		files: ReviewExportFile[];
	};
}

export interface ReviewExportFile {
	path: string;
	status: string;
	threads: ReviewExportThread[];
}

export interface ReviewExportThread {
	lineNumber: number;
	side: string;
	codeContext: string;
	comments: { body: string; type: string }[];
}
