import React, { useState, useEffect, useRef } from 'react';
import { 
  Stethoscope, 
  Settings, 
  MessageSquare, 
  BookOpen, 
  Send, 
  Eye, 
  EyeOff, 
  Key, 
  Brain, 
  Layers, 
  Volume2, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Info, 
  RefreshCw, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { queryAI } from './services/ai';
import './App.css';

function App() {
  // Config & API Settings
  const [provider, setProvider] = useState(() => localStorage.getItem('mq_provider') || 'groq');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mq_api_key') || '');
  const [customModel, setCustomModel] = useState(() => localStorage.getItem('mq_model') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMobileSidebar, setActiveMobileSidebar] = useState(false);

  // Creative Parameters
  const [specialty, setSpecialty] = useState('Kedokteran Umum');
  const [difficulty, setDifficulty] = useState('Mahasiswa Kedokteran');
  const [tone, setTone] = useState('Formal & Akademis');
  const [mode, setMode] = useState('quiz'); // 'quiz' or 'study'

  // Chat State (Study Mode)
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Quiz State (Quiz Mode)
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, wrong: 0, total: 0 });
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [quizHistory, setQuizHistory] = useState([]);

  // UI Error/Status Message
  const [apiError, setApiError] = useState(null);

  const messagesEndRef = useRef(null);

  // Save API Config to LocalStorage
  useEffect(() => {
    localStorage.setItem('mq_provider', provider);
    localStorage.setItem('mq_api_key', apiKey);
    localStorage.setItem('mq_model', customModel);
  }, [provider, apiKey, customModel]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-fetch first quiz question if in quiz mode and none exists
  useEffect(() => {
    if (mode === 'quiz' && !currentQuestion && !isGeneratingQuestion && apiKey) {
      handleNextQuizQuestion();
    }
  }, [mode, apiKey]);

  // Handle Switch Mode
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setApiError(null);
    if (newMode === 'quiz' && !currentQuestion && apiKey) {
      handleNextQuizQuestion();
    }
  };

  // Chat Submission (Study Mode)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    if (!apiKey) {
      setApiError('API Key belum diisi. Silakan masukkan API Key di panel pengaturan.');
      return;
    }

    setApiError(null);
    const userMessage = { role: 'user', content: inputText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const activeModel = customModel.trim() || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemini-2.5-flash');
      const response = await queryAI({
        provider,
        apiKey,
        model: activeModel,
        specialty,
        difficulty,
        tone,
        mode: 'study',
        messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error(err);
      setApiError(err.message);
      setMessages(prev => [...prev, { role: 'assistant', content: `Maaf, terjadi kesalahan: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Fetch Next Quiz Question (Quiz Mode)
  const handleNextQuizQuestion = async () => {
    if (!apiKey) {
      setApiError('API Key belum diisi. Silakan masukkan API Key di panel pengaturan.');
      return;
    }

    setIsGeneratingQuestion(true);
    setApiError(null);
    setSelectedAnswer(null);
    setCurrentQuestion(null);

    try {
      const activeModel = customModel.trim() || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemini-2.5-flash');
      const questionData = await queryAI({
        provider,
        apiKey,
        model: activeModel,
        specialty,
        difficulty,
        tone,
        mode: 'quiz',
        quizHistory: quizHistory.slice(-5) // avoid repeating last 5 questions
      });

      setCurrentQuestion(questionData);
      if (questionData.question) {
        setQuizHistory(prev => [...prev, questionData.question]);
      }
    } catch (err) {
      console.error(err);
      setApiError(`Gagal memuat soal kuis: ${err.message}`);
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  // Answer Selection (Quiz Mode)
  const handleSelectAnswer = (index) => {
    if (selectedAnswer !== null) return; // Answer already submitted

    setSelectedAnswer(index);
    const isCorrect = index === currentQuestion.correct_answer;

    setQuizScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      total: prev.total + 1
    }));
  };

  // Reset Quiz Progress
  const handleResetQuiz = () => {
    setQuizScore({ correct: 0, wrong: 0, total: 0 });
    setQuizHistory([]);
    setCurrentQuestion(null);
    if (apiKey) {
      handleNextQuizQuestion();
    }
  };

  // Helper to format simple markdown text from LLM response
  const renderFormattedText = (text) => {
    if (!text) return '';
    
    // Convert newlines, bold, bullets
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${activeMobileSidebar ? 'active-mobile' : ''}`}>
        <div className="sidebar-header">
          <Stethoscope className="logo-icon" size={28} />
          <h1 className="logo-text">MedQuiz AI</h1>
        </div>

        <div className="sidebar-content">
          {/* API Configuration */}
          <div className="form-group">
            <span className="section-title">Konfigurasi API</span>
            <label>API Provider</label>
            <div className="input-container">
              <Key className="input-icon" size={16} />
              <select 
                className="form-control select-control"
                value={provider} 
                onChange={(e) => {
                  setProvider(e.target.value);
                  setCustomModel('');
                }}
              >
                <option value="groq">Groq (Free Tier)</option>
                <option value="openrouter">OpenRouter (Premium)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>API Key</label>
            <div className="input-container">
              <Key className="input-icon" size={16} />
              <input 
                type={showApiKey ? 'text' : 'password'}
                className="form-control api-key-input"
                placeholder={`Masukkan API Key ${provider === 'groq' ? 'Groq' : 'OpenRouter'}`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button 
                type="button" 
                className="toggle-password-btn"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Model (Opsional)</label>
            <div className="input-container">
              <Sparkles className="input-icon" size={16} />
              <input 
                type="text"
                className="form-control"
                placeholder={provider === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemini-2.5-flash'}
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="form-group">
            <span className="section-title">Mode Belajar</span>
            <div className="mode-toggle">
              <div 
                className={`mode-card ${mode === 'quiz' ? 'active' : ''}`}
                onClick={() => handleModeChange('quiz')}
              >
                <Brain size={20} />
                <span>Quiz Mode</span>
              </div>
              <div 
                className={`mode-card ${mode === 'study' ? 'active' : ''}`}
                onClick={() => handleModeChange('study')}
              >
                <BookOpen size={20} />
                <span>Study Mode</span>
              </div>
            </div>
          </div>

          {/* Creative Parameters */}
          <div className="form-group">
            <span className="section-title">Parameter Kreatif</span>
            
            <label>Spesialisasi Medis</label>
            <div className="input-container">
              <Stethoscope className="input-icon" size={16} />
              <select 
                className="form-control select-control"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              >
                <option>Kedokteran Umum</option>
                <option>Kardiologi & Pembuluh Darah</option>
                <option>Pediatri (Kesehatan Anak)</option>
                <option>Neurologi (Saraf)</option>
                <option>Anatomi & Fisiologi</option>
                <option>Farmakologi & Terapi</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Tingkat Kesulitan</label>
            <div className="input-container">
              <Layers className="input-icon" size={16} />
              <select 
                className="form-control select-control"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option>Masyarakat Umum</option>
                <option>Mahasiswa Kedokteran</option>
                <option>Profesional / Dokter Spesialis</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Gaya Bahasa AI</label>
            <div className="input-container">
              <Volume2 className="input-icon" size={16} />
              <select 
                className="form-control select-control"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option>Formal & Akademis</option>
                <option>Santai & Ramah</option>
                <option>Mentor yang Tegas</option>
              </select>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <p>MedQuiz AI &copy; 2026</p>
          <p>Pengembang: <strong>dokterarif</strong></p>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="main-area">
        {/* Top Navbar */}
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="toggle-sidebar-btn"
              onClick={() => {
                setSidebarCollapsed(!sidebarCollapsed);
                setActiveMobileSidebar(!activeMobileSidebar);
              }}
              aria-label="Toggle settings panel"
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
            <div className="header-title-container">
              <h2 className="header-title">
                {mode === 'quiz' ? <Brain size={20} /> : <BookOpen size={20} />}
                {mode === 'quiz' ? 'Mode Kuis Klinis' : 'Mode Asisten Belajar'}
              </h2>
              <span className="header-subtitle">
                {specialty} &bull; {difficulty} ({tone})
              </span>
            </div>
          </div>

          <div>
            {apiError ? (
              <span className="status-badge error">
                <Info size={14} /> Error API
              </span>
            ) : (
              <span className="status-badge">
                <CheckCircle2 size={14} /> MedQuiz Engine Active
              </span>
            )}
          </div>
        </header>

        {/* Dynamic viewport depending on mode */}
        <div className="viewport-content">
          {!apiKey ? (
            <div className="welcome-container animate-fade">
              <div className="welcome-badge">
                <Sparkles size={14} /> Selamat Datang di MedQuiz AI
              </div>
              <h2 className="welcome-title">Asisten Pembelajaran & Kuis Medis Interaktif Berbasis AI</h2>
              <p className="welcome-description">
                Mulailah dengan memasukkan API Key Anda di panel pengaturan sebelah kiri. Aplikasi ini mendukung **Groq (Free Tier)** menggunakan model Llama-3 atau **OpenRouter** berbayar untuk berbagai model AI premium.
              </p>
              
              <div className="welcome-steps">
                <div className="step-item">
                  <div className="step-icon-wrapper">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3>1. Masukkan API Key</h3>
                    <p>Gunakan API Key Groq atau OpenRouter Anda untuk mengaktifkan kuis & asisten belajar.</p>
                  </div>
                </div>
                <div className="step-item">
                  <div className="step-icon-wrapper">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3>2. Atur Parameter Kreatif</h3>
                    <p>Sesuaikan spesialisasi medis, tingkat kesulitan, dan gaya bahasa kuis yang ingin dipelajari.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : mode === 'quiz' ? (
            /* Quiz Mode View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
              {/* Scoreboard */}
              <div className="quiz-dashboard animate-fade">
                <div className="quiz-stats">
                  <div className="stat-box">
                    <div className="stat-icon total">
                      <Layers size={18} />
                    </div>
                    <div className="stat-value">
                      <span className="stat-num">{quizScore.total}</span>
                      <span className="stat-label">Total Soal</span>
                    </div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-icon correct">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="stat-value">
                      <span className="stat-num">{quizScore.correct}</span>
                      <span className="stat-label">Benar</span>
                    </div>
                  </div>

                  <div className="stat-box">
                    <div className="stat-icon wrong">
                      <XCircle size={18} />
                    </div>
                    <div className="stat-value">
                      <span className="stat-num">{quizScore.wrong}</span>
                      <span className="stat-label">Salah</span>
                    </div>
                  </div>

                  <button 
                    className="primary-btn" 
                    style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'none', border: '1px solid var(--glass-border)' }}
                    onClick={handleResetQuiz}
                  >
                    <RefreshCw size={14} /> Reset Progress
                  </button>
                </div>

                <div className="progress-container">
                  <div className="progress-text">
                    <span>Akurasi Jawaban</span>
                    <span>
                      {quizScore.total > 0 
                        ? `${Math.round((quizScore.correct / quizScore.total) * 100)}%` 
                        : '0%'}
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div 
                      className="progress-bar-fill"
                      style={{ 
                        width: quizScore.total > 0 
                          ? `${(quizScore.correct / quizScore.total) * 100}%` 
                          : '0%' 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Loader or Question Panel */}
              {isGeneratingQuestion ? (
                <div className="page-loader">
                  <div className="spinner"></div>
                  <p style={{ color: 'var(--text-secondary)' }}>Menghasilkan kasus klinis & soal kuis baru...</p>
                </div>
              ) : currentQuestion ? (
                <div className="quiz-card animate-fade">
                  <div className="question-text">
                    {currentQuestion.question}
                  </div>

                  <div className="options-list">
                    {currentQuestion.options && currentQuestion.options.map((option, idx) => {
                      // Determine classes for buttons after submission
                      let optionClass = 'option-button';
                      if (selectedAnswer !== null) {
                        optionClass += ' disabled';
                        if (idx === currentQuestion.correct_answer) {
                          optionClass += ' correct';
                        } else if (selectedAnswer === idx) {
                          optionClass += ' wrong';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          className={optionClass}
                          onClick={() => handleSelectAnswer(idx)}
                          disabled={selectedAnswer !== null}
                        >
                          <span className="option-badge">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback explanation block */}
                  {selectedAnswer !== null && (
                    <div className={`feedback-box ${selectedAnswer === currentQuestion.correct_answer ? 'correct' : 'wrong'}`}>
                      <div className={`feedback-header ${selectedAnswer === currentQuestion.correct_answer ? 'correct' : 'wrong'}`}>
                        {selectedAnswer === currentQuestion.correct_answer ? (
                          <>
                            <CheckCircle2 size={20} /> Jawaban Anda Benar!
                          </>
                        ) : (
                          <>
                            <XCircle size={20} /> Jawaban Kurang Tepat
                          </>
                        )}
                      </div>
                      <div className="feedback-explanation">
                        <strong>Penjelasan Medis:</strong>
                        <p style={{ marginTop: '6px' }}>
                          {renderFormattedText(currentQuestion.explanation)}
                        </p>
                      </div>
                      <div className="action-buttons">
                        <button className="primary-btn" onClick={handleNextQuizQuestion}>
                          Soal Berikutnya <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="page-loader">
                  <Brain size={48} className="logo-icon" style={{ opacity: 0.5 }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Tekan tombol di bawah untuk mulai kuis</p>
                  <button className="primary-btn" onClick={handleNextQuizQuestion}>
                    Mulai Kuis
                  </button>
                </div>
              )}

              {apiError && (
                <div className="feedback-box wrong animate-fade" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                  <div className="feedback-header wrong">
                    <Info size={20} /> Kesalahan Koneksi API
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{apiError}</p>
                </div>
              )}
            </div>
          ) : (
            /* Study/Chat Mode View */
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px', height: '100%' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {messages.length === 0 ? (
                  <div className="welcome-container animate-fade" style={{ marginTop: '20px' }}>
                    <div className="welcome-badge">
                      <MessageSquare size={14} /> Mode Belajar Interaktif
                    </div>
                    <h2 className="welcome-title" style={{ fontSize: '28px' }}>Tanyakan Topik Medis Apa Saja</h2>
                    <p className="welcome-description">
                      Di sini Anda dapat berkonsultasi mengenai patofisiologi penyakit, farmakoterapi, struktur anatomi, atau menanyakan penjelasan kasus medis secara mendalam.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
                      <button 
                        className="option-button" 
                        style={{ width: 'auto', padding: '10px 16px', fontSize: '13px' }}
                        onClick={() => {
                          setInputText(`Jelaskan patofisiologi serangan jantung koroner secara ringkas.`);
                        }}
                      >
                        Patofisiologi Infark Miokard
                      </button>
                      <button 
                        className="option-button" 
                        style={{ width: 'auto', padding: '10px 16px', fontSize: '13px' }}
                        onClick={() => {
                          setInputText(`Bagaimana mekanisme kerja obat antihipertensi golongan ACE Inhibitor?`);
                        }}
                      >
                        Mekanisme Kerja ACE Inhibitor
                      </button>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`message-wrapper ${msg.role}`}>
                      <div className="message-avatar">
                        {msg.role === 'user' ? 'U' : <Stethoscope size={18} />}
                      </div>
                      <div className="message-bubble">
                        {msg.role === 'user' ? msg.content : renderFormattedText(msg.content)}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="message-wrapper assistant">
                    <div className="message-avatar">
                      <Stethoscope size={18} />
                    </div>
                    <div className="message-bubble" style={{ padding: '12px 20px' }}>
                      <div className="loading-dots">
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Input bar only visible in study mode */}
        {mode === 'study' && apiKey && (
          <div className="chat-input-container">
            <form onSubmit={handleSendMessage} className="chat-form">
              <input 
                type="text"
                className="chat-input"
                placeholder="Ajukan pertanyaan Anda mengenai medis..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTyping}
              />
              <button 
                type="submit" 
                className="chat-submit-btn"
                disabled={isTyping || !inputText.trim()}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
