import React, { useState, useCallback, useEffect } from 'react';
import { generateTableOfContents, generateChapterContent, assembleBook, generateBookCover, generateRandomBookIdea, BookMetadata } from './services/geminiService';
import type { Chapter, BookType, BookHistoryEntry } from './types';
import { LoadingSpinner, BookIcon, WandIcon, RefreshIcon, TrashIcon, HistoryIcon, MicrophoneIcon, PlusIcon, ChevronLeftIcon, DownloadIcon } from './components/icons';
import StorybookViewer from './components/StorybookViewer';

type AppStep = 'CONFIG' | 'COVERS' | 'WRITING';

const TONES = ['Dramatic', 'Humorous', 'Formal', 'Informal', 'Mysterious', 'Inspirational', 'Technical', 'Poetic', 'Satirical'];

const App: React.FC = () => {
  const [appStep, setAppStep] = useState<AppStep>('CONFIG');
  
  // Book Settings
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [addAuthorToCover, setAddAuthorToCover] = useState(true);
  const [description, setDescription] = useState('');
  const [numChapters, setNumChapters] = useState<number | string>(5);
  const [wordCount, setWordCount] = useState<number | string>(500);
  const [bookType, setBookType] = useState<BookType>('fiction');
  const [tone, setTone] = useState(TONES[0]);
  const [isRandomizing, setIsRandomizing] = useState(false);

  // Writing State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [continueFromPrevious, setContinueFromPrevious] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());

  // Viewer State
  const [showBookViewer, setShowBookViewer] = useState(false);
  const [finalBookContent, setFinalBookContent] = useState('');
  const [currentBook, setCurrentBook] = useState<{title: string, subtitle?: string, author?: string}>({title: ''});

  // History State
  const [bookHistory, setBookHistory] = useState<BookHistoryEntry[]>([]);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);

  // Covers State
  const [frontCoverPrompt, setFrontCoverPrompt] = useState('');
  const [backCoverPrompt, setBackCoverPrompt] = useState('');
  const [frontCoverImage, setFrontCoverImage] = useState<string | null>(null);
  const [backCoverImage, setBackCoverImage] = useState<string | null>(null);
  const [isGeneratingFrontCover, setIsGeneratingFrontCover] = useState(false);
  const [isGeneratingBackCover, setIsGeneratingBackCover] = useState(false);
  const [isGeneratingBothCovers, setIsGeneratingBothCovers] = useState(false);
  
  const [isDictating, setIsDictating] = useState(false);

  useEffect(() => {
    try {
      const savedBook = localStorage.getItem('robo-ai-book-progress');
      if (savedBook) {
        const data = JSON.parse(savedBook);
        setTitle(data.title || '');
        setSubtitle(data.subtitle || '');
        setAuthor(data.author || '');
        setAddAuthorToCover(data.addAuthorToCover === false ? false : true);
        setDescription(data.description || '');
        setNumChapters(data.numChapters || 5);
        setWordCount(data.wordCount || 500);
        setBookType(data.bookType || 'fiction');
        setTone(data.tone || TONES[0]);
        setChapters(data.chapters || []);
        setAppStep(data.appStep || (data.chapters.length > 0 ? 'WRITING' : 'CONFIG'));
        setFrontCoverImage(data.frontCoverImage);
        setBackCoverImage(data.backCoverImage);
        setFrontCoverPrompt(data.frontCoverPrompt || '');
        setBackCoverPrompt(data.backCoverPrompt || '');
      }
      const savedHistory = localStorage.getItem('robo-ai-book-history');
      if (savedHistory) {
        setBookHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load data from local storage", e);
      localStorage.clear(); // Clear corrupted storage
    }
  }, []);

  useEffect(() => {
      const bookData = JSON.stringify({
        appStep, title, subtitle, author, addAuthorToCover, description, numChapters, wordCount, bookType, tone, chapters,
        frontCoverImage, backCoverImage, frontCoverPrompt, backCoverPrompt
      });
      localStorage.setItem('robo-ai-book-progress', bookData);
  }, [appStep, title, subtitle, author, addAuthorToCover, description, numChapters, wordCount, bookType, tone, chapters, frontCoverImage, backCoverImage, frontCoverPrompt, backCoverPrompt]);
  
  useEffect(() => {
    localStorage.setItem('robo-ai-book-history', JSON.stringify(bookHistory));
  }, [bookHistory]);

  const handleClearBook = () => {
    if (window.confirm("Are you sure you want to start a new book? Your current progress will be lost.")) {
      // Reset all state to initial values. The useEffect hook will automatically
      // persist this cleared state to local storage.
      setAppStep('CONFIG');
      setTitle('');
      setSubtitle('');
      setAuthor('');
      setAddAuthorToCover(true);
      setDescription('');
      setNumChapters(5);
      setWordCount(500);
      setBookType('fiction');
      setTone(TONES[0]);
      setIsRandomizing(false);
      setChapters([]);
      setIsLoading(false);
      setLoadingMessage('');
      setError(null);
      setContinueFromPrevious(true);
      setExpandedChapters(new Set());
      setShowBookViewer(false);
      setFinalBookContent('');
      setCurrentBook({title: ''});
      setFrontCoverPrompt('');
      setBackCoverPrompt('');
      setFrontCoverImage(null);
      setBackCoverImage(null);
      setIsGeneratingFrontCover(false);
      setIsGeneratingBackCover(false);
      setIsGeneratingBothCovers(false);
      setIsDictating(false);
    }
  };

  const getMetadata = (): BookMetadata => ({
    title, subtitle, author, description, bookType, tone, numChapters: +numChapters
  });

  const handleRandomizeBookSettings = async () => {
    setIsRandomizing(true);
    setError(null);
    try {
        const idea = await generateRandomBookIdea(bookType, tone);
        setTitle(idea.title);
        setSubtitle(idea.subtitle);
        setAuthor(idea.author);
        setDescription(idea.description);
    } catch (e) {
        setError(e instanceof Error ? e.message : 'An unknown error occurred while generating an idea.');
    } finally {
        setIsRandomizing(false);
    }
  };

  const handleGenerateToc = async () => {
    if (!title || !description || !numChapters || +numChapters <= 0) {
      setError('Please provide a title, description, and number of chapters.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Crafting your table of contents...');
    setError(null);
    setChapters([]);
    try {
      const metadata = getMetadata();
      const titles = await generateTableOfContents(metadata);
      setChapters(titles.map(t => ({ title: t, content: '', status: 'pending' })));
      setFrontCoverPrompt(`A cinematic book cover for a ${bookType} book titled "${title}". Style: ${tone}.`);
      setBackCoverPrompt(`The back cover for the book titled "${title}", showing a complementary scene or theme.`);
      setAppStep('COVERS');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
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
          const imageData = await generateBookCover(prompt, title, author, addAuthorToCover);
          setImage(imageData);
      } catch (e) {
          setError(e instanceof Error ? e.message : `Failed to generate ${type} cover.`);
      } finally {
          setLoading(false);
      }
  };

  const handleGenerateBothCovers = async () => {
    if (!frontCoverPrompt || !backCoverPrompt) {
        setError("Please provide descriptions for both covers.");
        return;
    }
    setIsGeneratingBothCovers(true);
    try {
        const [frontData, backData] = await Promise.all([
            generateBookCover(frontCoverPrompt, title, author, addAuthorToCover),
            generateBookCover(backCoverPrompt, title, author, addAuthorToCover)
        ]);
        setFrontCoverImage(frontData);
        setBackCoverImage(backData);
    } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate one or both covers.");
    } finally {
        setIsGeneratingBothCovers(false);
    }
  };
  
  const startDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    setIsDictating(true);
    recognition.onresult = (event: any) => setDescription(event.results[0][0].transcript);
    recognition.onerror = (event: any) => setError(`Speech recognition error: ${event.error}`);
    recognition.onend = () => setIsDictating(false);
    recognition.start();
  };

  const handleChapterContentChange = (index: number, newContent: string) => setChapters(p => p.map((c, i) => i === index ? { ...c, content: newContent } : c));
  const handleChapterTitleChange = (index: number, newTitle: string) => setChapters(p => p.map((c, i) => i === index ? { ...c, title: newTitle } : c));
  const handleToggleExpandChapter = (index: number) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      newSet.has(index) ? newSet.delete(index) : newSet.add(index);
      return newSet;
    });
  };
  
  const handleGenerateSingleChapter = useCallback(async (chapterIndex: number) => {
    setChapters(prev => prev.map((ch, i) => i === chapterIndex ? { ...ch, status: 'generating' } : ch));
    
    const prevContent = (continueFromPrevious && chapterIndex > 0) 
        ? chapters.slice(0, chapterIndex).reverse().find(c => c.status === 'done' && c.content)?.content
        : undefined;
    
    try {
        const metadata = getMetadata();
        const content = await generateChapterContent(metadata, chapters[chapterIndex].title, +wordCount, prevContent);
        setChapters(prev => prev.map((ch, i) => i === chapterIndex ? { ...ch, status: 'done', content } : ch));
    } catch (e) {
        setError(`Failed to generate chapter ${chapterIndex + 1}.`);
        setChapters(prev => prev.map((ch, i) => i === chapterIndex ? { ...ch, status: 'pending' } : ch));
    }
  }, [chapters, continueFromPrevious, wordCount, title, subtitle, author, description, bookType, tone]);

  const handleGenerateAllChapters = async () => {
    setIsLoading(true);
    setError(null);
    let currentChapters = [...chapters];
    let lastContent: string | undefined = undefined;

    for (let i = 0; i < currentChapters.length; i++) {
        if (currentChapters[i].status === 'done') {
            lastContent = continueFromPrevious ? currentChapters[i].content : undefined;
            continue;
        }
        setLoadingMessage(`Generating Chapter ${i + 1}/${currentChapters.length}...`);
        currentChapters[i].status = 'generating';
        setChapters([...currentChapters]);
        
        try {
            const metadata = getMetadata();
            const content = await generateChapterContent(metadata, currentChapters[i].title, +wordCount, lastContent);
            lastContent = continueFromPrevious ? content : undefined;
            currentChapters[i] = { ...currentChapters[i], status: 'done', content };
            setChapters([...currentChapters]);
        } catch (e) {
            setError(`Generation failed at chapter ${i + 1}.`);
            currentChapters[i].status = 'pending';
            setChapters([...currentChapters]);
            setIsLoading(false);
            return;
        }
    }
    setIsLoading(false);
  };

  const handleAssembleBook = async () => {
    setIsLoading(true);
    setLoadingMessage('Assembling your final book...');
    setError(null);
    try {
        const metadata = getMetadata();
        const fullBook = await assembleBook(metadata, chapters);
        setFinalBookContent(fullBook);
        setCurrentBook({ title, subtitle, author });
        setShowBookViewer(true);
        const newHistoryEntry: BookHistoryEntry = {
            id: Date.now().toString(),
            title, subtitle, author,
            assembledContent: fullBook,
            timestamp: Date.now(),
            frontCoverImage: frontCoverImage || undefined,
            backCoverImage: backCoverImage || undefined,
        };
        setBookHistory(prev => [newHistoryEntry, ...prev.filter(b => b.title !== title)]);
    } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to assemble the book.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleReadFromHistory = (book: BookHistoryEntry) => {
    setFinalBookContent(book.assembledContent);
    setCurrentBook({ title: book.title, subtitle: book.subtitle, author: book.author });
    setFrontCoverImage(book.frontCoverImage || null);
    setBackCoverImage(book.backCoverImage || null);
    setShowBookViewer(true);
  };
  
  const handleDeleteFromHistory = (id: string) => {
    if(window.confirm("Delete this book from history?")) setBookHistory(p => p.filter(b => b.id !== id));
  };


  const isBookReady = chapters.length > 0 && chapters.every(c => c.status === 'done' && c.content);

  const renderConfigScreen = () => (
    <div className="bg-white/5 p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-indigo-300">Book Settings</h2>
        <button onClick={handleRandomizeBookSettings} disabled={isLoading || isRandomizing} className="flex items-center gap-2 text-sm bg-purple-600/80 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg transition">
            {isRandomizing ? <LoadingSpinner className="w-4 h-4"/> : <WandIcon className="w-4 h-4"/>}
            {isRandomizing ? 'Inspiring...' : 'Inspire Me!'}
        </button>
      </div>
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">Book Title</label>
                <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., The Last Starship" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
                <label htmlFor="subtitle" className="block text-sm font-medium text-gray-300 mb-1">Subtitle / Tagline (Optional)</label>
                <input type="text" id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="An epic space opera" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
        </div>
        <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-300 mb-1">Author Name(s) (Optional)</label>
            <input type="text" id="author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Jane Doe" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            <div className="mt-2">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer"><input type="checkbox" checked={addAuthorToCover} onChange={(e) => setAddAuthorToCover(e.target.checked)} className="form-checkbox h-4 w-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>Add author to book covers</label>
            </div>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Book Topic or Description</label>
          <div className="relative"><textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief summary of the book's plot or subject..." className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-4 pr-12 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" rows={3}></textarea><button onClick={startDictation} disabled={isDictating} title="Dictate description" className="absolute right-2 top-3 p-2 text-gray-400 hover:text-white transition rounded-full hover:bg-white/10"><MicrophoneIcon isListening={isDictating} className="w-5 h-5"/></button></div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div><label className="block text-sm font-medium text-gray-300 mb-1">Book Type</label><div className="flex items-center gap-1 p-1 bg-gray-900/50 border border-gray-700 rounded-lg"><button onClick={() => setBookType('fiction')} className={`flex-1 px-2 py-1.5 rounded-md text-sm transition ${bookType === 'fiction' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}>Fiction</button><button onClick={() => setBookType('non-fiction')} className={`flex-1 px-2 py-1.5 rounded-md text-sm transition ${bookType === 'non-fiction' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}>Non-Fiction</button></div></div>
             <div><label htmlFor="tone" className="block text-sm font-medium text-gray-300 mb-1">Tone / Style</label><select id="tone" value={tone} onChange={e => setTone(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">{TONES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
             <div><label htmlFor="chapters" className="block text-sm font-medium text-gray-300 mb-1">Chapters</label><input type="number" id="chapters" value={numChapters} onChange={(e) => setNumChapters(e.target.value ? parseInt(e.target.value) : '')} min="1" max="20" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
             <div><label htmlFor="wordcount" className="block text-sm font-medium text-gray-300 mb-1">Words/Chapter</label><input type="number" id="wordcount" value={wordCount} onChange={(e) => setWordCount(e.target.value ? parseInt(e.target.value) : '')} min="100" step="50" className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
        </div>
        <button onClick={handleGenerateToc} disabled={isLoading || isRandomizing || !title || !description || !numChapters} className="w-full flex items-center justify-center gap-2 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-transform duration-200 ease-in-out transform hover:scale-105 disabled:transform-none">
            {isLoading ? <><LoadingSpinner /> {loadingMessage}</> : <><WandIcon /> Generate Table of Contents</>}
        </button>
      </div>
    </div>
  );
  
  const renderCoverScreen = () => (
    <div className="bg-white/5 p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
        <h2 className="text-2xl font-bold text-indigo-300 mb-1">Book Cover Design</h2>
        <p className="text-gray-400 mb-6">Describe the covers for your book, "{title}".</p>
        <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3"><h3 className="text-lg font-semibold">Front Cover</h3><textarea value={frontCoverPrompt} onChange={e => setFrontCoverPrompt(e.target.value)} placeholder="e.g., A lone astronaut staring at a swirling nebula" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition"/><button onClick={() => handleGenerateCover('front')} disabled={isGeneratingBothCovers || isGeneratingFrontCover} className="w-full flex justify-center items-center gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition">{isGeneratingFrontCover ? <><LoadingSpinner className="w-4 h-4" /> Generating...</> : 'Generate Front Cover'}</button><div className="w-full aspect-[2/3] bg-gray-900/50 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">{isGeneratingFrontCover ? <LoadingSpinner /> : (frontCoverImage ? <img src={`data:image/png;base64,${frontCoverImage}`} alt="Front cover" className="w-full h-full object-cover" /> : <span className="text-sm text-gray-500">Image will appear here</span>)}</div></div>
            <div className="space-y-3"><h3 className="text-lg font-semibold">Back Cover</h3><textarea value={backCoverPrompt} onChange={e => setBackCoverPrompt(e.target.value)} placeholder="e.g., A shadowy figure silhouetted against a futuristic city" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition"/><button onClick={() => handleGenerateCover('back')} disabled={isGeneratingBothCovers || isGeneratingBackCover} className="w-full flex justify-center items-center gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-4 py-2 rounded-lg transition">{isGeneratingBackCover ? <><LoadingSpinner className="w-4 h-4" /> Generating...</> : 'Generate Back Cover'}</button><div className="w-full aspect-[2/3] bg-gray-900/50 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">{isGeneratingBackCover ? <LoadingSpinner /> : (backCoverImage ? <img src={`data:image/png;base64,${backCoverImage}`} alt="Back cover" className="w-full h-full object-cover" /> : <span className="text-sm text-gray-500">Image will appear here</span>)}</div></div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 flex flex-col gap-4">
            <button onClick={handleGenerateBothCovers} disabled={isGeneratingBothCovers} className="w-full flex justify-center items-center gap-2 font-bold bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-3 rounded-lg transition">{isGeneratingBothCovers ? <><LoadingSpinner /> Generating Both...</> : 'Generate Both Covers At Once'}</button>
            <div className="flex justify-between items-center w-full"><button onClick={() => setAppStep('CONFIG')} className="flex items-center gap-2 text-sm bg-gray-600/50 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"><ChevronLeftIcon className="w-4 h-4" /> Back to Settings</button><button onClick={() => setAppStep('WRITING')} className="font-bold bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">Continue to Writing &rarr;</button></div>
        </div>
    </div>
  );

  const renderWritingScreen = () => (
    <div className="bg-white/5 p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
      <div className="flex justify-between items-start sm:items-center border-b border-white/10 pb-4 mb-6 flex-col sm:flex-row gap-2">
        <div><h2 className="text-2xl font-bold text-indigo-300">Table of Contents</h2><p className="text-gray-400">Title: <span className="font-semibold text-gray-200">{title}</span></p></div>
        <div className="flex items-center gap-2"><button onClick={() => setAppStep('COVERS')} title="Back to cover design" className="flex items-center gap-2 text-sm bg-gray-600/50 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"><ChevronLeftIcon className="w-4 h-4" /> Back to Covers</button><button onClick={handleClearBook} title="Start a new book" className="flex items-center gap-2 text-sm bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg transition"><PlusIcon className="w-4 h-4" /> New Book</button></div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6"><button onClick={handleGenerateAllChapters} disabled={isLoading || isBookReady} className="flex-1 flex items-center justify-center gap-2 font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white px-4 py-3 rounded-lg transition disabled:cursor-not-allowed">{isLoading ? <><LoadingSpinner/> {loadingMessage}</> : (isBookReady ? 'Book Complete' : <><WandIcon/> Generate All Chapters</>)}</button><button onClick={handleAssembleBook} disabled={!isBookReady || isLoading} className="flex-1 flex items-center justify-center gap-2 font-semibold bg-green-600 hover:bg-green-700 disabled:bg-green-800/50 text-white px-4 py-3 rounded-lg transition disabled:cursor-not-allowed"><BookIcon /> Assemble Final Book</button></div>
      <div className="mb-4"><label className="flex items-center gap-2 cursor-pointer text-gray-300"><input type="checkbox" checked={continueFromPrevious} onChange={(e) => setContinueFromPrevious(e.target.checked)} className="form-checkbox h-5 w-5 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"/>Maintain continuity between chapters</label></div>
      <ul className="space-y-4">
        {chapters.map((chapter, index) => (
          <li key={index} className="bg-gray-900/50 p-4 rounded-lg border border-white/10 transition-all duration-300">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-grow"><div className="flex items-center gap-2"><span className="font-bold text-lg text-gray-100 select-none">{`${index + 1}.`}</span><input type="text" value={chapter.title} onChange={(e) => handleChapterTitleChange(index, e.target.value)} className="w-full bg-transparent font-bold text-lg text-gray-100 focus:bg-gray-800/50 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 outline-none transition" aria-label={`Chapter ${index + 1} title`}/></div></div>
              <div className="flex-shrink-0 flex items-center gap-2 flex-wrap justify-end">
                {chapter.status === 'pending' && <button onClick={() => handleGenerateSingleChapter(index)} disabled={isLoading} className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-600 text-white px-3 py-1 rounded-md text-sm font-semibold transition">Generate</button>}
                {chapter.status === 'generating' && <div className="flex items-center gap-2 text-sm text-indigo-400"><LoadingSpinner className="w-4 h-4" /><span>Generating...</span></div>}
                {chapter.status === 'done' && (<><button onClick={() => handleToggleExpandChapter(index)} className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm font-semibold transition">{expandedChapters.has(index) ? 'Hide' : 'Read/Edit'}</button><button onClick={() => handleGenerateSingleChapter(index)} disabled={isLoading} className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white p-1.5 rounded-md text-sm font-semibold transition" title="Regenerate Chapter"><RefreshIcon className="w-4 h-4"/></button><span className="text-sm font-semibold text-green-400">✓ Done</span></>)}
              </div>
            </div>
             {expandedChapters.has(index) && (<div className="mt-4 pt-4 border-t border-white/10"><textarea value={chapter.content} onChange={(e) => handleChapterContentChange(index, e.target.value)} placeholder="Chapter content..." className="w-full h-60 bg-gray-900/70 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition text-gray-300"/></div>)}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white bg-gradient-to-br from-[#111827] to-[#1e1b4b] p-4 sm:p-8">
      {showBookViewer && <StorybookViewer title={currentBook.title} subtitle={currentBook.subtitle} author={currentBook.author} content={finalBookContent} onClose={() => setShowBookViewer(false)} frontCoverUrl={frontCoverImage || undefined} backCoverUrl={backCoverImage || undefined} />}
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">Robo AI</h1>
          <p className="text-xl font-light text-gray-300">Auto Book Generator</p>
        </header>
        
        {appStep === 'CONFIG' && renderConfigScreen()}
        {appStep === 'COVERS' && renderCoverScreen()}
        {appStep === 'WRITING' && renderWritingScreen()}
        
        {error && <div className="mt-6 bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg text-center">{error}</div>}

        {bookHistory.length > 0 && (
             <div className="mt-10 bg-white/5 p-6 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
                <button onClick={() => setIsHistoryVisible(!isHistoryVisible)} className="w-full flex justify-between items-center text-left text-xl font-bold text-indigo-300 mb-4"><div className="flex items-center gap-2"><HistoryIcon /> Book History</div><span>{isHistoryVisible ? '▼' : '▶'}</span></button>
                {isHistoryVisible && (
                     <ul className="space-y-3">
                        {bookHistory.map(book => (
                            <li key={book.id} className="bg-gray-900/50 p-3 rounded-lg border border-white/10 flex justify-between items-center">
                                <div><p className="font-semibold">{book.title}</p><p className="text-xs text-gray-400">{new Date(book.timestamp).toLocaleString()}</p></div>
                                <div className="flex items-center gap-2"><button onClick={() => handleReadFromHistory(book)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-semibold transition">Read</button><button onClick={() => handleDeleteFromHistory(book.id)} className="bg-red-600/50 hover:bg-red-600 p-1.5 rounded-md" title="Delete from history"><TrashIcon className="w-4 h-4"/></button></div>
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