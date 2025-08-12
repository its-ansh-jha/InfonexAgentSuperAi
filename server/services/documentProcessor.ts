
import { Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';

// For PDF processing
import pdf from 'pdf-parse';

// For DOC/DOCX processing
import mammoth from 'mammoth';

// For HTML processing
import { JSDOM } from 'jsdom';

// Configure multer for document uploads
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/html',
      'text/csv',
      'application/json',
      'text/xml',
      'application/xml'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

export interface DocumentProcessingResult {
  success: boolean;
  content?: string;
  metadata?: {
    filename: string;
    fileType: string;
    fileSize: number;
    pageCount?: number;
    wordCount?: number;
  };
  error?: string;
}

/**
 * Extract text content from PDF files
 */
async function processPDF(buffer: Buffer, filename: string): Promise<DocumentProcessingResult> {
  try {
    const data = await pdf(buffer);
    
    return {
      success: true,
      content: data.text,
      metadata: {
        filename,
        fileType: 'PDF',
        fileSize: buffer.length,
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Extract text content from DOC/DOCX files
 */
async function processWordDocument(buffer: Buffer, filename: string): Promise<DocumentProcessingResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      success: true,
      content: result.value,
      metadata: {
        filename,
        fileType: filename.endsWith('.docx') ? 'DOCX' : 'DOC',
        fileSize: buffer.length,
        wordCount: result.value.split(/\s+/).length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process Word document: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Extract text content from HTML files
 */
function processHTML(buffer: Buffer, filename: string): DocumentProcessingResult {
  try {
    const htmlContent = buffer.toString('utf-8');
    const dom = new JSDOM(htmlContent);
    const textContent = dom.window.document.body?.textContent || dom.window.document.textContent || '';
    
    return {
      success: true,
      content: textContent.trim(),
      metadata: {
        filename,
        fileType: 'HTML',
        fileSize: buffer.length,
        wordCount: textContent.trim().split(/\s+/).length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process HTML: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process plain text files (TXT, MD, CSV, JSON, XML)
 */
function processTextFile(buffer: Buffer, filename: string): DocumentProcessingResult {
  try {
    const content = buffer.toString('utf-8');
    const fileExtension = path.extname(filename).toLowerCase();
    
    let fileType = 'TEXT';
    switch (fileExtension) {
      case '.md':
        fileType = 'Markdown';
        break;
      case '.csv':
        fileType = 'CSV';
        break;
      case '.json':
        fileType = 'JSON';
        break;
      case '.xml':
        fileType = 'XML';
        break;
      case '.txt':
        fileType = 'Text';
        break;
    }
    
    return {
      success: true,
      content: content.trim(),
      metadata: {
        filename,
        fileType,
        fileSize: buffer.length,
        wordCount: content.trim().split(/\s+/).length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process text file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Main document processing function
 */
export async function processDocument(file: Express.Multer.File): Promise<DocumentProcessingResult> {
  const { buffer, originalname, mimetype } = file;
  
  try {
    // Route to appropriate processor based on file type
    if (mimetype === 'application/pdf') {
      return await processPDF(buffer, originalname);
    }
    
    if (mimetype === 'application/msword' || 
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await processWordDocument(buffer, originalname);
    }
    
    if (mimetype === 'text/html') {
      return processHTML(buffer, originalname);
    }
    
    // Handle text-based files
    if (mimetype.startsWith('text/') || 
        originalname.endsWith('.txt') || 
        originalname.endsWith('.md') ||
        mimetype === 'application/json' ||
        mimetype === 'application/xml') {
      return processTextFile(buffer, originalname);
    }
    
    return {
      success: false,
      error: `Unsupported file type: ${mimetype}`
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Express route handler for document upload and processing
 */
export async function handleDocumentUpload(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const result = await processDocument(req.file);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
    
  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during document processing'
    });
  }
}
