import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STYLES = [
  { id: 'none', label: 'None', image: 'https://picsum.photos/seed/none/200/200' },
  { id: 'cinematic', label: 'Cinematic', image: 'https://picsum.photos/seed/cinematic/200/200' },
  { id: 'anime', label: 'Anime', image: 'https://picsum.photos/seed/anime/200/200' },
  { id: 'watercolor', label: 'Watercolor', image: 'https://picsum.photos/seed/watercolor/200/200' },
  { id: 'cyberpunk', label: 'Cyberpunk', image: 'https://picsum.photos/seed/cyberpunk/200/200' },
  { id: 'sketch', label: 'Pencil Sketch', image: 'https://picsum.photos/seed/sketch/200/200' },
  { id: 'oil_painting', label: 'Oil Painting', image: 'https://picsum.photos/seed/oil/200/200' },
  { id: '3d_render', label: '3D Render', image: 'https://picsum.photos/seed/3d/200/200' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square (1:1)' },
  { id: '16:9', label: 'Landscape (16:9)' },
  { id: '9:16', label: 'Portrait (9:16)' },
  { id: '4:3', label: 'Classic (4:3)' },
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setRetryMessage(null);

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // The AI Studio environment automatically provides a free key behind the scenes
        // via process.env.GEMINI_API_KEY. No billing or personal key is required.
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        let finalPrompt = prompt;
        if (selectedStyle !== 'none') {
          const styleLabel = STYLES.find(s => s.id === selectedStyle)?.label;
          finalPrompt = `${prompt}, in the style of ${styleLabel}`;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { text: finalPrompt },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio,
            },
          },
        });

        let foundImage = false;
        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              const base64EncodeString = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/png';
              setGeneratedImage(`data:${mimeType};base64,${base64EncodeString}`);
              foundImage = true;
              break;
            }
          }
        }

        if (!foundImage) {
          throw new Error('No image was generated. Please try a different prompt.');
        }
        
        // Success! Break out of the retry loop.
        break;

      } catch (err: any) {
        console.error(`Generation error (Attempt ${attempt + 1}):`, err);
        
        const errorMessage = err.message?.toLowerCase() || '';
        
        // If it's a rate limit error, we wait and retry automatically
        if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('exhausted')) {
          attempt++;
          if (attempt >= maxRetries) {
            setError('The free service is currently very busy. Please try again in a few minutes.');
            break;
          }
          // Wait a few seconds before retrying (exponential backoff)
          const waitTime = attempt * 4000; // 4s, 8s, 12s...
          setRetryMessage(`Free tier is busy. Retrying automatically in a few seconds... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // For other errors (safety, etc.), show the error and stop retrying
          if (errorMessage.includes('safety') || errorMessage.includes('policy') || errorMessage.includes('blocked')) {
            setError('Your prompt may violate safety policies. Please try modifying your description.');
          } else if (errorMessage.includes('too long') || errorMessage.includes('maximum context length') || errorMessage.includes('token limit')) {
            setError('Your prompt is too long. Please try a shorter description.');
          } else if (errorMessage.includes('500') || errorMessage.includes('internal server error') || errorMessage.includes('unavailable')) {
            setError('The image generation service is currently experiencing issues. Please try again later.');
          } else {
            setError(err.message || 'Failed to generate image. Please try again.');
          }
          break;
        }
      }
    }
    
    setIsGenerating(false);
    setRetryMessage(null);
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-10 md:px-16 md:py-10 flex justify-between items-end">
        <div className="logo">Neural.Canvas</div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[480px_1fr] px-8 pb-16 md:px-16 md:pb-16 gap-16">
        <div className="control-panel flex flex-col">
          <h1 className="massive-title">CREATE</h1>

          <label className="prompt-label">Text Prompt</label>
          <input
            type="text"
            className="text-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A monolithic concrete structure..."
          />

          <label className="prompt-label">Aspect Ratio</label>
          <div className="style-grid">
            {ASPECT_RATIOS.map((ratio) => (
              <div
                key={ratio.id}
                onClick={() => setAspectRatio(ratio.id)}
                className={`style-chip ${aspectRatio === ratio.id ? 'active' : ''}`}
              >
                {ratio.label}
              </div>
            ))}
          </div>

          <label className="prompt-label">Select Style</label>
          <div className="style-grid">
            {STYLES.map((style) => (
              <div
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`style-chip ${selectedStyle === style.id ? 'active' : ''}`}
              >
                {style.label}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-8 p-4 border border-[var(--accent)] text-[var(--accent)] text-sm flex items-start gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={generateImage}
            disabled={isGenerating || !prompt.trim()}
            className="btn-generate flex items-center justify-center gap-3"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating
              </>
            ) : (
              'Generate Image'
            )}
          </button>
        </div>

        <div className="flex flex-col items-center justify-start">
          <div className="preview-canvas w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {generatedImage ? (
                <motion.div
                  key="image"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full relative group"
                >
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={handleDownload}
                      className="bg-white text-black px-6 py-3 text-sm font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </motion.div>
              ) : isGenerating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="canvas-placeholder"
                >
                  <Loader2 className="w-12 h-12 animate-spin text-[var(--accent)] mb-4" />
                  <span className="font-bold uppercase tracking-widest text-[var(--ink)]">
                    {retryMessage ? 'Waiting...' : 'Processing'}
                  </span>
                  {retryMessage && (
                    <span className="text-xs text-[#666] mt-2 max-w-[80%] text-center">
                      {retryMessage}
                    </span>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="canvas-placeholder"
                >
                  <div className="plus-icon">+</div>
                  <span className="font-bold uppercase tracking-widest">Ready for prompt</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="preview-info">
              {aspectRatio} • Gemini 2.5 Flash
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
