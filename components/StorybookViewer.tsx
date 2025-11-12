import React, { useState, useMemo, useEffect } from 'react';

interface StorybookViewerProps {
  title: string;
  content: string;
  onClose: () => void;
  frontCoverUrl?: string;
  backCoverUrl?: string;
}

const CHARS_PER_PAGE = 2000;

const StorybookViewer: React.FC<StorybookViewerProps> = ({ title, content, onClose, frontCoverUrl, backCoverUrl }) => {
  const [currentPage, setCurrentPage] = useState(0);

  const pages = useMemo(() => {
    const generatedPages: string[] = [];

    if (content) {
        // Split by markdown H2 '##' at the start of a line
        const sections = content.split(/(?=^## )/m).filter(s => s.trim());

        // Preface and TOC are the first two sections, they get their own page each.
        if (sections.length > 0) {
            const preface = sections.shift();
            if (preface) generatedPages.push(preface);
        }
        if (sections.length > 0) {
            const toc = sections.shift();
            if (toc) generatedPages.push(toc);
        }
        
        // Paginate remaining sections (chapters)
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

  const renderPageContent = (pageContent: string) => {
    if (pageContent.startsWith('IMAGE:')) {
      const imageUrl = pageContent.substring(6);
      return <div className="flex items-center justify-center h-full"><img src={`data:image/png;base64,${imageUrl}`} alt="Book Cover" className="w-full h-full object-contain" /></div>;
    }
    
    return pageContent.split('\n').map((paragraph, index) => {
      paragraph = paragraph.trim();
      if (paragraph.startsWith('# ')) {
        return <h1 key={index} className="text-4xl font-bold font-serif mb-6 mt-8 text-center text-[#4a2c1a]">{paragraph.substring(2)}</h1>;
      }
      if (paragraph.startsWith('## ')) {
        return <h2 key={index} className="text-3xl font-bold font-serif mb-4 mt-6 text-[#5C4033]">{paragraph.substring(3)}</h2>;
      }
       if (paragraph.startsWith('### ')) {
        return <h3 key={index} className="text-2xl font-bold font-serif mb-4 mt-6 text-[#5C4033]">{paragraph.substring(4)}</h3>;
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