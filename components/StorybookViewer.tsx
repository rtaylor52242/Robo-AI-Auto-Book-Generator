import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { LoadingSpinner, DownloadIcon } from './icons';


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
  const [exportMessage, setExportMessage] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const pages = useMemo(() => {
    const generatedPages: string[] = [];

    if (content) {
        const sections = content.split(/(?=^## )/m).filter(s => s.trim());
        if (sections.length > 0) {
            const preface = sections.shift();
            if (preface) generatedPages.push(preface);
        }
        if (sections.length > 0) {
            const toc = sections.shift();
            if (toc) generatedPages.push(toc);
        }
        sections.forEach(chapterContent => {
            if (!chapterContent) return;
            let currentPos = 0;
            while (currentPos < chapterContent.length) {
                let endPos = currentPos + CHARS_PER_PAGE;
                if (endPos < chapterContent.length) {
                    let lastSpace = chapterContent.lastIndexOf(' ', endPos);
                    let lastNewline = chapterContent.lastIndexOf('\n', endPos);
                    endPos = Math.max(lastSpace, lastNewline) > currentPos ? Math.max(lastSpace, lastNewline) : endPos;
                }
                generatedPages.push(chapterContent.substring(currentPos, endPos));
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, onClose]);
  
  const createSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleExport = async (format: 'pdf' | 'docx' | 'html' | 'md') => {
      setIsDropdownOpen(false);
      setIsExporting(true);
      setExportMessage(`Exporting as ${format.toUpperCase()}...`);
      const slug = createSlug(title);

      try {
        // Use a short timeout to allow the UI to update before blocking the thread
        await new Promise(resolve => setTimeout(resolve, 100));

        if (format === 'md') {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            saveAs(blob, `${slug}.md`);
        } else if (format === 'html') {
            const htmlContent = `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:serif;line-height:1.6;}h1,h2{font-family:sans-serif;}</style></head><body><h1>${title}</h1>${subtitle ? `<h2>${subtitle}</h2>` : ''}${author ? `<h3>By ${author}</h3>` : ''}${marked.parse(content)}</body></html>`;
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            saveAs(blob, `${slug}.html`);
        } else if (format === 'pdf') {
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageContainer = document.createElement('div');
            pageContainer.style.position = 'absolute';
            pageContainer.style.left = '-9999px';
            document.body.appendChild(pageContainer);

            for(let i = 0; i < pages.length; i++) {
                setExportMessage(`Processing page ${i + 1}/${pages.length}...`);
                const pageElement = document.createElement('div');
                pageElement.style.width = '595pt'; // A4 width
                pageElement.style.padding = '40pt';
                pageElement.style.backgroundColor = '#FBF3D9';
                pageElement.innerHTML = pages[i].startsWith('IMAGE:') ? 
                    `<img src="data:image/png;base64,${pages[i].substring(6)}" style="width:100%;height:auto;"/>` :
                    marked.parse(pages[i]) as string;
                pageContainer.appendChild(pageElement);
                const canvas = await html2canvas(pageElement, { scale: 2 });
                pageContainer.removeChild(pageElement);
                
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, 595, 842); // A4 dimensions in pt
            }

            document.body.removeChild(pageContainer);
            pdf.save(`${slug}.pdf`);

        } else if (format === 'docx') {
            const docChildren: any[] = [
                new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
            ];
            if (subtitle) docChildren.push(new Paragraph({ text: subtitle, heading: HeadingLevel.HEADING_2 }));
            if (author) docChildren.push(new Paragraph({ text: `By ${author}`, heading: HeadingLevel.HEADING_3 }));

            content.split('\n').forEach(line => {
                if (line.startsWith('## ')) {
                    docChildren.push(new Paragraph({ text: line.substring(3), heading: HeadingLevel.HEADING_2 }));
                } else if (line.trim()) {
                    docChildren.push(new Paragraph({ children: [new TextRun(line)] }));
                }
            });

            const doc = new Document({ sections: [{ children: docChildren }] });
            const blob = await Packer.toBlob(doc);
            saveAs(blob, `${slug}.docx`);
        }
      } catch (err) {
          console.error("Export failed", err);
          alert("An error occurred during export. Please try again.");
      } finally {
        setIsExporting(false);
        setExportMessage('');
      }
  };
  
  const saveAs = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
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
        <button onClick={onClose} className="absolute top-4 right-4 text-[#3A2D23] hover:text-red-700 font-sans text-2xl font-bold z-10">&times;</button>
        <div className="text-center mb-4">
            <h1 className="font-sans font-bold text-xl text-[#3A2D23]/80 whitespace-normal break-words">{title}</h1>
            {subtitle && <h2 className="font-sans text-md text-[#3A2D23]/70">{subtitle}</h2>}
            {author && <h3 className="font-sans text-sm text-[#3A2D23]/60 italic mt-1">By {author}</h3>}
        </div>
        <div className="flex-grow overflow-hidden relative mt-2 bg-white/30 rounded">
            <div key={currentPage} className="prose max-w-none h-full text-lg leading-relaxed animate-[fade-in_0.5s_ease-out] overflow-y-auto p-4">
                {renderPageContent(pages[currentPage])}
            </div>
        </div>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#3A2D23]/20 font-sans">
            <div className="relative">
                <button
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    disabled={isExporting}
                    className="px-4 py-2 rounded-md bg-[#eaddc0] hover:bg-[#d4c8a8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {isExporting ? <><LoadingSpinner className="w-4 h-4" /> {exportMessage}</> : <><DownloadIcon className="w-5 h-5" /> Export</>}
                </button>
                {isDropdownOpen && !isExporting && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-md shadow-lg border border-gray-200 z-20 w-40">
                        <button onClick={() => handleExport('pdf')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">PDF</button>
                        <button onClick={() => handleExport('docx')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">DOCX</button>
                        <button onClick={() => handleExport('html')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">HTML</button>
                        <button onClick={() => handleExport('md')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Markdown</button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setCurrentPage(p => p - 1)} 
                    disabled={currentPage === 0}
                    className="px-4 py-2 rounded-md bg-[#eaddc0] hover:bg-[#d4c8a8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Previous
                </button>
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