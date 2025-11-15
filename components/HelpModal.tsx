import React from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={onClose}>
      <div 
        className="relative bg-gray-900/80 text-white rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10 max-w-2xl w-full max-h-[90vh] flex flex-col p-6 sm:p-8 animate-[fade-in_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside the modal from closing it
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white font-sans text-2xl font-bold z-10">&times;</button>
        <h2 className="text-2xl font-bold text-indigo-300 mb-4 text-center">How to Use the Auto Book Generator</h2>
        
        <div className="overflow-y-auto space-y-6 pr-4 -mr-4 text-gray-300">
          <section>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Step 1: Configure Your Book</h3>
            <p>This is where your book's journey begins. Fill in the details to give the AI a clear direction.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
              <li><strong>Title & Description:</strong> The most important fields! Be descriptive to get the best results.</li>
              <li><strong>Inspire Me:</strong> Stuck for an idea? Click this button to generate a unique book concept based on your selected category and tone.</li>
              <li><strong>Book Type & Category:</strong> Choose whether you're writing Fiction or Non-Fiction, then select a genre. This heavily influences the AI's writing style.</li>
              <li><strong>Chapters & Word Count:</strong> Define the structure of your book. The AI will generate content close to your specified length per chapter.</li>
              <li>Once you're happy, click <strong>"Generate Table of Contents"</strong> to proceed.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Step 2: Design Your Covers</h3>
            <p>A great book needs a great cover. The AI will generate prompts for you, but you can edit them for a more custom design.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
              <li><strong>Edit Prompts:</strong> Refine the text in the "Front Cover" and "Back Cover" boxes. Be descriptive! Mention colors, styles, objects, and moods.</li>
              <li><strong>Generate:</strong> Click the generate buttons to create the cover images. You can regenerate them as many times as you like.</li>
              <li>Click <strong>"Continue to Writing"</strong> when you have covers you're happy with.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Step 3: Write the Chapters</h3>
            <p>This is the core of the app. Here, you'll bring your book to life, chapter by chapter.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
              <li><strong>Generate All Chapters:</strong> The easiest way to write the book. The AI will write all chapters sequentially, maintaining story continuity if the checkbox is ticked.</li>
              <li><strong>Generate Single Chapter:</strong> Click the "Generate" button on any chapter to write just that one.</li>
              <li><strong>Read/Edit:</strong> After a chapter is generated, you can read its content and make any edits you want directly in the text box.</li>
              <li><strong>Regenerate:</strong> Not happy with a chapter? Click the refresh icon to have the AI try writing it again.</li>
              <li><strong>Continuity:</strong> The "Maintain continuity" checkbox tells the AI to read the end of the previous chapter before writing the next one, ensuring a smooth narrative flow.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Step 4: Assemble & Export</h3>
            <p>Once all your chapters are complete, you can assemble the final manuscript.</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
              <li>Click <strong>"Assemble Final Book"</strong>. The AI will add a preface and format everything into a complete book.</li>
              <li>A book viewer will pop up. From here, you can read your book page by page.</li>
              <li>Use the <strong>"Export"</strong> button to download your book as a PDF, DOCX, HTML, or Markdown file.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Additional Features</h3>
            <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                <li><strong>Voice Dictation:</strong> Use the microphone icon in the description box to dictate your book's concept with your voice.</li>
                <li><strong>Book History:</strong> All assembled books are automatically saved. You can read or delete them from the history section at the bottom of the page.</li>
                <li><strong>Clear Memory:</strong> The red "Clear Memory" button will permanently erase all your progress and history from this browser. Use with caution!</li>
            </ul>
          </section>
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

export default HelpModal;
