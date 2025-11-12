import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import { marked } from 'marked';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import { DownloadIcon, LoadingSpinner } from './icons';

interface StorybookViewerProps {
  title: string;
  subtitle?: string;
  author?: string;
  content: string;
  onClose: () => void;
  frontCoverUrl?: string;
  backCoverUrl?: string;
}

const CHARS_PER_PAGE = 2000;

const StorybookViewer: React.FC<StorybookViewerProps> = ({ title, subtitle, author, content, onClose, frontCoverUrl, backCoverUrl }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const generatedPages: string[] = [];

    if (content) {
        const sections = content.split(/(?=^## )/m).filter(s => s.trim());
        let contentToPaginate: string[] = [];
        
        // If splitting works as expected (Preface, TOC, Chapters)
        if (sections.length > 2) {
            const preface = sections.shift();
            if (preface) generatedPages.push(preface);
            
            const toc = sections.shift();
            if (toc) generatedPages.push(toc);

            contentToPaginate = sections; // The rest are chapters
        } else {
            // Fallback: If splitting fails, treat the whole content as one block to be paginated.
            contentToPaginate = sections.length > 0 ? sections : [content];
        }
        
        contentToPaginate.forEach(textContent => {
            if (!textContent) return;
            let currentPos = 0;
            while (currentPos < textContent.length) {
                let endPos = currentPos + CHARS_PER_PAGE;
                if (endPos < textContent.length) {
                    let lastSpace = textContent.lastIndexOf(' ', endPos);
                    let lastNewline = textContent.lastIndexOf('\n', endPos);
                    endPos = Math.max(lastSpace, lastNewline) > currentPos ? Math.max(lastSpace, lastNewline) : endPos;
                }
                generatedPages.push(textContent.substring(currentPos, endPos));
                currentPos = endPos;
            }
        });
    }

    if (generatedPages.length === 0) {
        generatedPages.push('This book is empty.');
    }

    const allPages = [...generatedPages];
    if (frontCoverUrl) allPages.unshift(`IMAGE:${frontCoverUrl}`);
    if (backCoverUrl) allPages.push(`IMAGE:${backCoverUrl}`);
    
    return allPages;
  }, [content, frontCoverUrl, backCoverUrl]);

  const totalPages = pages.length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentPage < totalPages - 1) {
        setCurrentPage(p => p + 1);
      } else if (e.key === 'ArrowLeft' && currentPage > 0) {
        setCurrentPage(p => p - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleClickOutside = (event: MouseEvent) => {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
            setShowExportMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [currentPage, totalPages, onClose]);

  const handleExport = async (format: 'PDF' | 'DOCX' | 'HTML' | 'MD') => {
    setIsExporting(true);
    setShowExportMenu(false);
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    try {
        if (format === 'PDF') {
            const doc = new jsPDF();
            // Simple text export for now, as html2canvas is complex for pagination
            const fullText = content.replace(/## /g, '\n\n').replace(/### /g, '\n');
            doc.text(fullText, 10, 10, { maxWidth: 180 });
            doc.save(`${sanitizedTitle}.pdf`);

        } else if (format === 'DOCX') {
            const paragraphs: (Paragraph | any)[] = [];
            const lines = content.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                if (line.startsWith('## ')) {
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: line.substring(3), bold: true, size: 32 })],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 240, after: 120 }
                    }));
                } else {
                     paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
                }
            }
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 48 })], heading: HeadingLevel.TITLE }),
                        new Paragraph({ children: [new TextRun({ text: subtitle || '', italics: true, size: 28 })] }),
                        new Paragraph({ children: [new TextRun({ text: author || '', size: 24 })] }),
                        ...paragraphs
                    ]
                }]
            });
            const blob = await Packer.toBlob(doc);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${sanitizedTitle}.docx`;
            link.click();

        } else if (format === 'HTML') {
            const htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>${title}</title>
                    <style>body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 2rem auto; } h1, h2 { color: #333; }</style>
                </head>
                <body>
                    <h1>${title}</h1>
                    ${subtitle ? `<h2>${subtitle}</h2>` : ''}
                    ${author ? `<h3>By ${author}</h3>` : ''}
                    ${await marked(content)}
                </body>
                </html>`;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${sanitizedTitle}.html`;
            link.click();
        } else if (format === 'MD') {
            const mdContent = `# ${title}\n${subtitle ? `## ${subtitle}\n` : ''}${author ? `### By ${author}\n\n` : ''}${content}`;
            const blob = new Blob([mdContent], { type: 'text/markdown' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${sanitizedTitle}.md`;
            link.click();
        }
    } catch (e) {
        console.error("Export failed", e);
        alert("Export failed. See console for details.");
    } finally {
        setIsExporting(false);
    }
  };

  const renderPageContent = (pageContent: string) => {
    if (pageContent.startsWith('IMAGE:')) {
      const imageUrl = pageContent.substring(6);
      return <div className="flex items-center justify-center h-full"><img src={`data:image/png;base64,${imageUrl}`} alt="Book Cover" className="w-full h-full object-contain" /></div>;
    }
    
    return pageContent.split('\n').map((paragraph, index) => {
      paragraph = paragraph.trim();
      if (paragraph.startsWith('## ')) {
        return <h2 key={index} className="text-3xl font-bold font-serif mb-4 mt-6 text-[#5C4033]">{paragraph.substring(3)}</h2>;
      }
      if (paragraph === '') return null;
      return <p key={index} className="mb-4 indent-8">{paragraph}</p>;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="relative bg-[#FBF3D9] text-[#3A2D23] rounded-lg shadow-2xl max-w-2xl w-full h-[90vh] flex flex-col p-6 sm:p-10 font-serif animate-[fade-in_0.5s_ease-out]">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#3A2D23] hover:text-red-700 font-sans text-2xl font-bold z-20">&times;</button>
        <div className="text-center mb-4">
            <h1 className="font-sans font-bold text-xl text-[#3A2D23]/80 whitespace-normal break-words">{title}</h1>
            {subtitle && <p className="font-sans text-md text-[#3A2D23]/70">{subtitle}</p>}
            {author && <p className="font-sans text-sm text-[#3A2D23]/60 mt-1">By {author}</p>}
        </div>
        <div className="flex-grow overflow-hidden relative mt-2 bg-white/30 rounded">
            <div key={currentPage} className="prose max-w-none h-full text-lg leading-relaxed animate-[fade-in_0.5s_ease-out] overflow-y-auto p-4">
                {renderPageContent(pages[currentPage])}
            </div>
        </div>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#3A2D23]/20 font-sans">
          <button 
            onClick={() => setCurrentPage(p => p - 1)} 
            disabled={currentPage === 0}
            className="px-4 py-2 rounded-md bg-[#eaddc0] hover:bg-[#d4c8a8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
           <div ref={exportMenuRef} className="relative">
                <button onClick={() => setShowExportMenu(prev => !prev)} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-700/80 text-white hover:bg-green-700 disabled:bg-gray-500 transition-colors">
                    {isExporting ? <LoadingSpinner className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
                    {isExporting ? 'Exporting...' : 'Export'}
                </button>
                {showExportMenu && (
                    <div className="absolute bottom-full mb-2 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-30">
                        <button onClick={() => handleExport('PDF')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">PDF</button>
                        <button onClick={() => handleExport('DOCX')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">DOCX</button>
                        <button onClick={() => handleExport('HTML')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">HTML</button>
                        <button onClick={() => handleExport('MD')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Markdown</button>
                    </div>
                )}
            </div>
          <span className="text-sm font-medium">{`Page ${currentPage + 1} of ${totalPages}`}</span>
          <button 
            onClick={() => setCurrentPage(p => p + 1)} 
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 rounded-md bg-[#eaddc0] hover:bg-[#d4c8a8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
       <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default StorybookViewer;