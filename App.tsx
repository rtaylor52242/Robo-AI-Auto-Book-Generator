
import React, { useState, useCallback, useEffect } from 'react';
import { generateTableOfContents, generateChapterContent, assembleBook, generateBookCover } from './services/geminiService';
import type { Chapter, BookType, BookHistoryEntry } from './types';
import { LoadingSpinner, BookIcon, WandIcon, RefreshIcon, TrashIcon, HistoryIcon, MicrophoneIcon, PlusIcon, ChevronLeftIcon } from './components/icons';
import StorybookViewer from './components/StorybookViewer';

type AppStep = 'CONFIG' | 'COVERS' | 'WRITING';

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const App: React.FC = () => {
  const [appStep, setAppStep] = useState<AppStep>('CONFIG');
  const [topic, setTopic] = useState('');
  const [numChapters, setNumChapters] = useState<number | string>(5);
  const [wordCount, setWordCount] = useState<number | string>(500);
  const [bookType, setBookType] = useState<BookType>('fiction');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [continueFromPrevious, setContinueFromPrevious] = useState(true);
  const [showBookViewer, setShowBookViewer] = useState(false);
  const [finalBookContent, setFinalBookContent] = useState('');
  const [currentBookTitle, setCurrentBookTitle] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [bookHistory, setBookHistory] = useState<BookHistoryEntry[]>([]);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);

  // New state for covers
  const [frontCoverPrompt, setFrontCoverPrompt] = useState('');
  const [backCoverPrompt, setBackCoverPrompt] = useState('');
  const [frontCoverImage, setFrontCoverImage] = useState<string | null>(null);
  const [backCoverImage, setBackCoverImage] = useState<string | null>(null);
  const [isGeneratingFrontCover, setIsGeneratingFrontCover] = useState(false);
  const [isGeneratingBackCover, setIsGeneratingBackCover] = useState(false);
  
  // New state for voice input
  const [isDictating, setIsDictating] = useState(false);

  useEffect(() => {
    try {
      const savedBook = localStorage.getItem('robo-ai-book-progress');
      if (savedBook) {
        const data = JSON.parse(savedBook);
        setTopic(data.topic);
        setNumChapters(data.numChapters);
        setWordCount(data.wordCount);
        setBookType(data.bookType);
        setChapters(data.chapters);
        setAppStep(data.appStep || (data.chapters.length > 0 ? 'WRITING' : 'CONFIG'));
        setFrontCoverImage(data.frontCoverImage);
        setBackCoverImage(data.backCoverImage);
        setFrontCoverPrompt(data.frontCoverPrompt || `A book cover for a ${data.bookType} book titled "${data.topic}".`);
        setBackCoverPrompt(data.backCoverPrompt || `The back cover for the book titled "${data.topic}", showing a complementary scene or theme.`);
      }
      const savedHistory = localStorage.getItem('robo-ai-book-history');
      if (savedHistory) {
        setBookHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load data from local storage", e);
      localStorage.removeItem('robo-ai-book-progress');
      localStorage.removeItem('robo-ai-book-history');
    }
  }, []);

  useEffect(() => {
    if (appStep !== 'CONFIG' || topic || chapters.length > 0) {
      const bookData = JSON.stringify({
        appStep, topic, numChapters, wordCount, bookType, chapters,
        frontCoverImage, backCoverImage, frontCoverPrompt, backCoverPrompt
      });
      localStorage.setItem('robo-ai-book-progress', bookData);
    }
  }, [appStep, topic, numChapters, wordCount, bookType, chapters, frontCoverImage, backCoverImage, frontCoverPrompt, backCoverPrompt]);
  
  useEffect(() => {
    localStorage.setItem('robo-ai-book-history', JSON.stringify(bookHistory));
  }, [bookHistory]);

  const handleClearBook = () => {
    if (window.confirm("Are you sure you want to start a new book? Your current progress will be lost.")) {
      setTopic('');
      setNumChapters(5);
      setWordCount(500);
      setBookType('fiction');
      setChapters([]);
      setError(null);
      setIsLoading(false);
      setLoadingMessage('');
      setFinalBookContent('');
      setAppStep('CONFIG');
      setFrontCoverImage(null);
      setBackCoverImage(null);
      setFrontCoverPrompt('');
      setBackCoverPrompt('');
      localStorage.removeItem('robo-ai-book-progress');
    }
  };

  const handleGenerateToc = async () => {
    if (!topic || !numChapters || +numChapters <= 0) {
      setError('Please provide a valid topic and number of chapters.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Crafting your table of contents...');
    setError(null);
    setChapters([]);
    try {
      const titles = await generateTableOfContents(topic, +numChapters, bookType);
      setChapters(titles.map(title => ({ title, content: '', status: 'pending' })));
      setFrontCoverPrompt(`A book cover for a ${bookType} book titled "${topic}". Cinematic, detailed, epic fantasy style.`);
      setBackCoverPrompt(`The back cover for the book titled "${topic}", showing a complementary and mysterious scene or theme.`);
      setAppStep('COVERS');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleGenerateCover = async (type: 'front' | 'back') => {
      const prompt = type === 'front' ? frontCoverPrompt : backCoverPrompt;
      const setLoading = type === 'front' ? setIsGeneratingFrontCover : setIsGeneratingBackCover;
      const setImage = type === 'front' ? setFrontCoverImage : setBackCoverImage;

      if (!prompt) {
          setError(`Please provide a description for the ${type} cover.`);
          return;
      }
      setLoading(true);
      setError(null);
      try {
          const imageData = await generateBookCover(prompt);
          setImage(imageData);
      } catch (e) {
          setError(e instanceof Error ? e.message : `Failed to generate ${type} cover.`);
      } finally {
          setLoading(false);
      }
  };
  
  // Speech Recognition Logic
  const startDictation = () => {
    // Fix: Cast window to any to access browser-specific SpeechRecognition API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsDictating(true);
    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      setTopic(speechResult);
    };
    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
    };
    recognition.onend = () => {
      setIsDictating(false);
    };
    recognition.start();
  };

  const handleChapterContentChange = (index: number, newContent: string) => {
    setChapters(prev => prev.map((ch, i) => i === index ? { ...ch, content: newContent } : ch));
  };


  const handleToggleExpandChapter = (index: number) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };
  
  const handleGenerateSingleChapter = useCallback(async (chapterIndex: number) => {
    setChapters(prev => prev.map((ch, i) => i === chapterIndex ? { ...ch, status: 'generating' } : ch));
    
    let previousChapterContent: string | undefined = undefined;
    if (continueFromPrevious && chapterIndex > 0) {
        for (let i = chapterIndex - 1; i >= 0; i--) {
            const prevChapter = chapters[i];
            if (prevChapter.status === 'done' && prevChapter.content) {
                previousChapterContent = prevChapter.content;
                break;
            }
        }
    }
    
    try {
        const content = await generateChapterContent(topic, chapters[chapterIndex].title, +wordCount, bookType, previousChapterContent);
        setChapters(prev => prev.map((ch, i) => i === chapterIndex ? { ...ch, status: 'done', content } : ch));
    } catch (e) {
        setError(`Failed to generate chapter ${chapterIndex + 1}.`);
        setChapters(prev => prev.map((ch, i) => i === chapterIndex ? { ...ch, status: 'pending' } : ch));
    }
  }, [chapters, topic, continueFromPrevious, wordCount, bookType]);

  const handleGenerateAllChapters = async () => {
    setIsLoading(true);
    setError(null);

    let currentChapters = [...chapters];
    let lastContent = '';

    for (let i = 0; i < currentChapters.length; i++) {
        const chapter = currentChapters[i];
        if (chapter.status === 'done' && chapter.content) {
            lastContent = continueFromPrevious ? chapter.content : '';
            continue;
        }

        setLoadingMessage(`Generating Chapter ${i + 1}/${currentChapters.length}: ${chapter.title}`);
        
        currentChapters = currentChapters.map((ch, idx) => idx === i ? { ...ch, status: 'generating' } : ch);
        setChapters(currentChapters);
        
        try {
            const content = await generateChapterContent(topic, chapter.title, +wordCount, bookType, lastContent);
            lastContent = continueFromPrevious ? content : '';
            currentChapters = currentChapters.map((ch, idx) => idx === i ? { ...ch, status: 'done', content } : ch);
            setChapters(currentChapters);
        } catch (e) {
            setError(`Generation failed at chapter ${i + 1}. Please try again.`);
            currentChapters = currentChapters.map((ch, idx) => idx === i ? { ...ch, status: 'pending' } : ch);
            setChapters(currentChapters);
            setIsLoading(false);
            setLoadingMessage('');
            return;
        }
    }
    setIsLoading(false);
    setLoadingMessage('');
  };

  const handleAssembleBook = async () => {
    setIsLoading(true);
    setLoadingMessage('Assembling your final book...');
    setError(null);
    try {
        const bookTitle = toSentenceCase(topic);
        const fullBook = await assembleBook(bookTitle, chapters, bookType);
        setFinalBookContent(fullBook);
        setCurrentBookTitle(bookTitle);
        setShowBookViewer(true);
        const newHistoryEntry: BookHistoryEntry = {
            id: Date.now().toString(),
            title: bookTitle,
            assembledContent: fullBook,
            timestamp: Date.now(),
            frontCoverImage: frontCoverImage || undefined,
            backCoverImage: backCoverImage || undefined,
        };
        setBookHistory(prev => [newHistoryEntry, ...prev]);

    } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to assemble the book.");
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };
  
  const handleReadFromHistory = (book: BookHistoryEntry) => {
    setFinalBookContent(book.assembledContent);
    setCurrentBookTitle(toSentenceCase(book.title));
    setFrontCoverImage(book.frontCoverImage || null);
    setBackCoverImage(book.backCoverImage || null);
    setShowBookViewer(true);
  };
  
  const handleDeleteFromHistory = (id: string) => {
    if(window.confirm("Are you sure you want to delete this book from your history?")) {
        setBookHistory(prev => prev.filter(book => book.id !== id));
    }
  };


  const isBookReady = chapters.length > 0 && chapters.every(c => c.status === 'done' && c.content);

  const renderConfigScreen = () => (
    <div className="bg-white/5 p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
      <div className="space-y-6">
         <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Book Type</label>
           <div className="flex items-center gap-2 p-1 bg-gray-900/50 border border-gray-700 rounded-lg">
                <button onClick={() => setBookType('fiction')} className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${bookType === 'fiction' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}>Fiction</button>
                <button onClick={() => setBookType('non-fiction')} className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${bookType === 'non-fiction' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}>Non-Fiction</button>
            </div>
        </div>
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-300 mb-2">Book Topic or Description</label>
          <div className="relative">
            <input
              type="text" id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., A space opera about sentient robots"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-4 pr-12 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              disabled={isLoading}
            />
            <button onClick={startDictation} disabled={isDictating} title="Dictate topic" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition rounded-full hover:bg-white/10">
                <MicrophoneIcon isListening={isDictating} className="w-5 h-5"/>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="chapters" className="block text-sm font-medium text-gray-300 mb-2">Number of Chapters</label>
            <input type="number" id="chapters" value={numChapters} onChange={(e) => setNumChapters(e.target.value ? parseInt(e.target.value) : '')} min="1" max="20" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" disabled={isLoading}/>
          </div>
          <div>
            <label htmlFor="wordcount" className="block text-sm font-medium text-gray-300 mb-2">Words per Chapter (approx.)</label>
            <input type="number" id="wordcount" value={wordCount} onChange={(e) => setWordCount(e.target.value ? parseInt(e.target.value) : '')} min="100" step="50" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" disabled={isLoading}/>
          </div>
        </div>
        <button onClick={handleGenerateToc} disabled={isLoading || !topic || !numChapters || +numChapters <= 0} className="w-full flex items-center justify-center gap-2 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg transition-transform duration-200 ease-in-out transform hover:scale-105 disabled:transform-none">
            {isLoading ? <LoadingSpinner /> : <WandIcon />}
            {loadingMessage || 'Generate Table of Contents'}
        </button>
      </div>
    </div>
  );
  
  const renderCoverScreen = () => (
    <div className="bg-white/5 p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
        <h2 className="text-2xl font-bold text-indigo-300 mb-1">Book Cover Design</h2>
        <p className="text-gray-400 mb-6">Describe the front and back covers for your book, "{topic}".</p>
        <div className="grid md:grid-cols-2 gap-8">
            {/* Front Cover */}
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Front Cover</h3>
                <textarea value={frontCoverPrompt} onChange={e => setFrontCoverPrompt(e.target.value)} placeholder="e.g., A lone astronaut staring at a swirling nebula" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition"/>
                <button onClick={() => handleGenerateCover('front')} disabled={isGeneratingFrontCover || isGeneratingBackCover} className="w-full flex justify-center items-center gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition">
                    {isGeneratingFrontCover ? <><LoadingSpinner className="w-4 h-4" /> Generating...</> : 'Generate Front Cover'}
                </button>
                <div className="w-full aspect-[2/3] bg-gray-900/50 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                    {isGeneratingFrontCover && <LoadingSpinner />}
                    {!isGeneratingFrontCover && frontCoverImage && <img src={`data:image/png;base64,${frontCoverImage}`} alt="Generated front cover" className="w-full h-full object-cover" />}
                    {!isGeneratingFrontCover && !frontCoverImage && <span className="text-sm text-gray-500">Image will appear here</span>}
                </div>
            </div>

            {/* Back Cover */}
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Back Cover</h3>
                <textarea value={backCoverPrompt} onChange={e => setBackCoverPrompt(e.target.value)} placeholder="e.g., A shadowy figure silhouetted against a futuristic city" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition"/>
                <button onClick={() => handleGenerateCover('back')} disabled={isGeneratingFrontCover || isGeneratingBackCover} className="w-full flex justify-center items-center gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition">
                    {isGeneratingBackCover ? <><LoadingSpinner className="w-4 h-4" /> Generating...</> : 'Generate Back Cover'}
                </button>
                <div className="w-full aspect-[2/3] bg-gray-900/50 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                    {isGeneratingBackCover && <LoadingSpinner />}
                    {!isGeneratingBackCover && backCoverImage && <img src={`data:image/png;base64,${backCoverImage}`} alt="Generated back cover" className="w-full h-full object-cover" />}
                    {!isGeneratingBackCover && !backCoverImage && <span className="text-sm text-gray-500">Image will appear here</span>}
                </div>
            </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 flex justify-between items-center">
            <button onClick={() => setAppStep('CONFIG')} className="text-sm text-gray-400 hover:text-white transition">Back to Start</button>
            <button onClick={() => setAppStep('WRITING')} className="font-bold bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">
                Continue to Writing &rarr;
            </button>
        </div>
    </div>
  );

  const renderWritingScreen = () => (
    <div className="bg-white/5 p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
      <div className="flex justify-between items-start sm:items-center border-b border-white/10 pb-4 mb-6 flex-col sm:flex-row gap-2">
        <div>
            <h2 className="text-2xl font-bold text-indigo-300">Table of Contents</h2>
            <p className="text-gray-400">Topic: <span className="font-semibold text-gray-200">{topic}</span></p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setAppStep('COVERS')} title="Back to cover design" className="flex items-center gap-2 text-sm bg-gray-600/50 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition">
                <ChevronLeftIcon className="w-4 h-4" /> Back to Covers
            </button>
            <button onClick={handleClearBook} title="Start a new book" className="flex items-center gap-2 text-sm bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg transition">
                <PlusIcon className="w-4 h-4" /> New Book
            </button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <button onClick={handleGenerateAllChapters} disabled={isLoading || isBookReady} className="flex-1 flex items-center justify-center gap-2 font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white px-4 py-3 rounded-lg transition disabled:cursor-not-allowed">
              {isLoading ? <LoadingSpinner/> : <WandIcon/>} {isLoading ? loadingMessage : (isBookReady ? 'Book Complete' : 'Generate All Chapters')}
          </button>
          <button onClick={handleAssembleBook} disabled={!isBookReady || isLoading} className="flex-1 flex items-center justify-center gap-2 font-semibold bg-green-600 hover:bg-green-700 disabled:bg-green-800/50 text-white px-4 py-3 rounded-lg transition disabled:cursor-not-allowed">
              <BookIcon /> Assemble Final Book
          </button>
      </div>
      
      <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-gray-300">
              <input type="checkbox" checked={continueFromPrevious} onChange={(e) => setContinueFromPrevious(e.target.checked)} className="form-checkbox h-5 w-5 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>
              Maintain continuity between chapters
          </label>
      </div>

      <ul className="space-y-4">
        {chapters.map((chapter, index) => (
          <li key={index} className="bg-gray-900/50 p-4 rounded-lg border border-white/10 transition-all duration-300">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-grow">
                <h3 className="font-bold text-lg text-gray-100">{`${index + 1}. ${chapter.title}`}</h3>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2 flex-wrap justify-end">
                {chapter.status === 'pending' && <button onClick={() => handleGenerateSingleChapter(index)} disabled={isLoading} className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-600 text-white px-3 py-1 rounded-md text-sm font-semibold transition">Generate</button>}
                {chapter.status === 'generating' && <div className="flex items-center gap-2 text-sm text-indigo-400"><LoadingSpinner className="w-4 h-4" /><span>Generating...</span></div>}
                {chapter.status === 'done' && (
                  <>
                    <button onClick={() => handleToggleExpandChapter(index)} className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm font-semibold transition">{expandedChapters.has(index) ? 'Hide' : 'Read/Edit'}</button>
                    <button onClick={() => handleGenerateSingleChapter(index)} disabled={isLoading} className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white p-1.5 rounded-md text-sm font-semibold transition" title="Regenerate Chapter"><RefreshIcon className="w-4 h-4"/></button>
                    <span className="text-sm font-semibold text-green-400">✓ Done</span>
                  </>
                )}
              </div>
            </div>
             {expandedChapters.has(index) && (
                <div className="mt-4 pt-4 border-t border-white/10">
                    <textarea value={chapter.content} onChange={(e) => handleChapterContentChange(index, e.target.value)} placeholder="Chapter content will appear here... and you can edit it!" className="w-full h-60 bg-gray-900/70 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-gray-300"/>
                </div>
             )}
          </li>
        ))}
      </ul>
    </div>
  );

  const renderCurrentStep = () => {
    switch (appStep) {
        case 'CONFIG': return renderConfigScreen();
        case 'COVERS': return renderCoverScreen();
        case 'WRITING': return renderWritingScreen();
        default: return renderConfigScreen();
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white bg-gradient-to-br from-[#111827] to-[#1e1b4b] p-4 sm:p-8">
      {showBookViewer && <StorybookViewer title={currentBookTitle} content={finalBookContent} onClose={() => setShowBookViewer(false)} frontCoverUrl={frontCoverImage || undefined} backCoverUrl={backCoverImage || undefined} />}
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">Robo AI</h1>
          <p className="text-xl font-light text-gray-300">Auto Book Generator</p>
        </header>
        
        {renderCurrentStep()}
        
        {error && <div className="mt-6 bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg text-center">{error}</div>}

        {bookHistory.length > 0 && (
             <div className="mt-10 bg-white/5 p-6 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
                <button onClick={() => setIsHistoryVisible(!isHistoryVisible)} className="w-full flex justify-between items-center text-left text-xl font-bold text-indigo-300 mb-4">
                    <div className="flex items-center gap-2"><HistoryIcon /> Book History</div>
                    <span>{isHistoryVisible ? '▼' : '▶'}</span>
                </button>
                {isHistoryVisible && (
                     <ul className="space-y-3">
                        {bookHistory.map(book => (
                            <li key={book.id} className="bg-gray-900/50 p-3 rounded-lg border border-white/10 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{book.title}</p>
                                    <p className="text-xs text-gray-400">{new Date(book.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleReadFromHistory(book)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-semibold transition">Read</button>
                                    <button onClick={() => handleDeleteFromHistory(book.id)} className="bg-red-600/50 hover:bg-red-600 p-1.5 rounded-md" title="Delete from history"><TrashIcon className="w-4 h-4"/></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
             </div>
        )}
      </div>
    </div>
  );
};

export default App;