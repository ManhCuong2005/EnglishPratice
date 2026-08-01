import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileAudio,
  FilePenLine,
  Headphones,
  History,
  Languages,
  ListChecks,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Target,
  Trash2,
  Trophy,
  Volume2,
  WandSparkles,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState, Modal, ProgressBar } from '../components/Common.jsx';
import {
  buildAttempt,
  createListeningLesson,
  generateListeningPassage,
  renderSentenceParts,
  scoreClozeAnswers,
} from '../lib/listening.js';
import { speakEnglish } from '../lib/learning.js';

const EXAMS = [
  { id: 'general', label: 'Tiếng Anh tổng quát', short: 'General', description: 'Tình huống đời sống và chủ đề quen thuộc.' },
  { id: 'toeic', label: 'TOEIC', short: 'TOEIC', description: 'Hội thoại và bài nói trong môi trường công việc.' },
  { id: 'ielts', label: 'IELTS', short: 'IELTS', description: 'Nội dung học thuật theo phong cách bài thi.' },
];

const LEVELS = {
  general: ['A1', 'A2', 'B1', 'B2', 'C1'],
  toeic: ['250–450', '450–650', '650–800', '800+'],
  ielts: ['Band 4.0–5.0', 'Band 5.5–6.0', 'Band 6.5–7.0', 'Band 7.5+'],
};

const PASSAGE_TYPES = {
  general: [
    { id: 'story', label: 'Truyện ngắn' },
    { id: 'conversation', label: 'Hội thoại' },
    { id: 'daily-life', label: 'Đời sống' },
    { id: 'news', label: 'Tin ngắn' },
  ],
  toeic: [
    { id: 'part-3', label: 'Part 3 · Hội thoại' },
    { id: 'part-4', label: 'Part 4 · Bài nói ngắn' },
    { id: 'announcement', label: 'Thông báo' },
    { id: 'voicemail', label: 'Tin nhắn thoại' },
  ],
  ielts: [
    { id: 'conversation', label: 'Section 1 · Hội thoại' },
    { id: 'monologue', label: 'Section 2 · Độc thoại' },
    { id: 'academic-dialogue', label: 'Section 3 · Thảo luận' },
    { id: 'lecture', label: 'Section 4 · Bài giảng' },
  ],
};

const LENGTHS = [
  { value: 80, label: 'Ngắn', helper: '≈ 1 phút' },
  { value: 140, label: 'Vừa', helper: '≈ 2 phút' },
  { value: 220, label: 'Dài', helper: '≈ 3 phút' },
  { value: 320, label: 'Chuyên sâu', helper: '≈ 4–5 phút' },
];

const BLANK_MODES = [
  { id: 'content', label: 'Từ nội dung', description: 'Ưu tiên danh từ, động từ và tính từ.', icon: Target },
  { id: 'difficult', label: 'Từ khó', description: 'Tập trung từ phù hợp với cấp độ đã chọn.', icon: Brain },
  { id: 'phrases', label: 'Cụm từ', description: 'Che collocation và cụm từ thường gặp.', icon: Languages },
  { id: 'random', label: 'Ngẫu nhiên', description: 'Phân bố đều trong toàn bộ đoạn nghe.', icon: WandSparkles },
];

const DEFAULT_CONFIG = {
  sourceMode: 'ai',
  title: '',
  exam: 'general',
  level: 'B1',
  topic: 'Travel and everyday experiences',
  passageType: 'story',
  targetWordCount: 140,
  blankPercentage: 20,
  blankMode: 'content',
  manualText: '',
};

const RATE_OPTIONS = [0.7, 0.85, 1, 1.15];

function safeDate(value) {
  if (!value) return 'Chưa luyện';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa luyện';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function countWords(text = '') {
  return String(text).trim().match(/[A-Za-zÀ-ỹ0-9]+(?:['’-][A-Za-zÀ-ỹ0-9]+)*/g)?.length || 0;
}

function normalizeText(value = '') {
  return String(value)
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function latestAttempt(lesson) {
  const attempts = lesson?.attempts || [];
  return attempts.length ? attempts[attempts.length - 1] : null;
}

function attemptPercentage(attempt) {
  const value = attempt?.combinedPercentage ?? attempt?.percentage ?? attempt?.cloze?.percentage ?? attempt?.score?.percentage;
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
}

function lessonExamLabel(lesson) {
  const exam = EXAMS.find((item) => item.id === String(lesson?.exam || '').toLowerCase());
  return exam?.short || lesson?.exam || 'General';
}

function getLessonSentences(lesson) {
  if (lesson?.sentences?.length) return lesson.sentences;
  const passage = lesson?.passage || '';
  const chunks = passage.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return chunks.map((text, index) => ({ id: `sentence-${index}`, index, text: text.trim(), tokens: [] }));
}

function questionSummary(lesson, questionAnswers) {
  const questions = lesson?.questions || [];
  const results = questions.map((question, index) => {
    const answer = questionAnswers[question.id] ?? questionAnswers[index];
    const selectedIndex = answer === '' || answer === undefined ? null : Number(answer);
    return {
      question,
      selectedIndex,
      isCorrect: selectedIndex === Number(question.correctIndex),
    };
  });
  const correct = results.filter((item) => item.isCorrect).length;
  return {
    results,
    total: questions.length,
    correct,
    percentage: questions.length ? Math.round((correct / questions.length) * 100) : null,
  };
}

function usePassagePlayer(sentences, initialRate = 0.85) {
  const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const [voices, setVoices] = useState(() => synthesis?.getVoices?.().filter((voice) => voice.lang?.toLowerCase().startsWith('en')) || []);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(initialRate);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState('idle');
  const runRef = useRef(0);

  useEffect(() => {
    if (!synthesis) return undefined;
    const refresh = () => setVoices(synthesis.getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith('en')));
    synthesis.addEventListener('voiceschanged', refresh);
    return () => synthesis.removeEventListener('voiceschanged', refresh);
  }, [synthesis]);

  useEffect(() => () => {
    runRef.current += 1;
    synthesis?.cancel();
  }, [synthesis]);

  const stop = useCallback(() => {
    runRef.current += 1;
    synthesis?.cancel();
    setStatus('idle');
  }, [synthesis]);

  const playRange = useCallback((from, to) => {
    if (!synthesis || !sentences.length) return false;
    runRef.current += 1;
    const run = runRef.current;
    synthesis.cancel();
    const start = Math.max(0, Math.min(sentences.length - 1, from));
    const end = Math.max(start, Math.min(sentences.length - 1, to));
    const selectedVoice = voices.find((voice) => voice.voiceURI === voiceURI)
      || voices.find((voice) => voice.localService && voice.lang.toLowerCase() === 'en-us')
      || voices.find((voice) => voice.localService)
      || voices[0];

    const speakAt = (index) => {
      if (runRef.current !== run || index > end) {
        if (runRef.current === run) setStatus('idle');
        return;
      }
      const text = sentences[index]?.text;
      if (!text) {
        speakAt(index + 1);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedVoice?.lang || 'en-US';
      utterance.rate = rate;
      utterance.pitch = 1;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onstart = () => {
        if (runRef.current === run) {
          setCurrentIndex(index);
          setStatus('playing');
        }
      };
      utterance.onend = () => {
        if (runRef.current === run) speakAt(index + 1);
      };
      utterance.onerror = (event) => {
        if (runRef.current === run && event.error !== 'canceled' && event.error !== 'interrupted') {
          setStatus('idle');
        }
      };
      synthesis.speak(utterance);
    };

    window.setTimeout(() => speakAt(start), 14);
    return true;
  }, [rate, sentences, synthesis, voiceURI, voices]);

  const togglePause = useCallback(() => {
    if (!synthesis) return;
    if (status === 'paused') {
      synthesis.resume();
      setStatus('playing');
    } else if (status === 'playing') {
      synthesis.pause();
      setStatus('paused');
    }
  }, [status, synthesis]);

  const goTo = useCallback((index) => {
    stop();
    setCurrentIndex(Math.max(0, Math.min(Math.max(0, sentences.length - 1), index)));
  }, [sentences.length, stop]);

  const reset = useCallback(() => {
    stop();
    setCurrentIndex(0);
  }, [stop]);

  return {
    supported: Boolean(synthesis && typeof SpeechSynthesisUtterance !== 'undefined'),
    voices,
    voiceURI,
    setVoiceURI,
    rate,
    setRate,
    currentIndex,
    status,
    playSentence: (index) => playRange(index, index),
    playCurrent: () => playRange(currentIndex, currentIndex),
    playAll: () => playRange(0, Math.max(0, sentences.length - 1)),
    playFromCurrent: () => playRange(currentIndex, Math.max(0, sentences.length - 1)),
    togglePause,
    stop,
    goTo,
    reset,
  };
}

function ListeningStepper({ stage }) {
  const order = ['create', 'review', 'practice', 'results'];
  const current = Math.max(0, order.indexOf(stage));
  const labels = ['Thiết lập', 'Kiểm tra', 'Luyện nghe', 'Kết quả'];
  return (
    <div className="listening-stepper" aria-label="Tiến trình tạo bài luyện nghe">
      {labels.map((label, index) => (
        <div className={`listening-stepper__item ${index === current ? 'listening-stepper__item--active' : ''} ${index < current ? 'listening-stepper__item--done' : ''}`} key={label}>
          <span>{index < current ? <Check size={14} /> : index + 1}</span>
          <small>{label}</small>
          {index < labels.length - 1 && <i />}
        </div>
      ))}
    </div>
  );
}

function ListeningHeader({ stage, onHome }) {
  if (stage === 'home') return null;
  return (
    <header className="listening-workflow-header">
      <button className="listening-back" type="button" onClick={onHome}><ArrowLeft size={17} /> Thư viện bài nghe</button>
      <ListeningStepper stage={stage} />
    </header>
  );
}

function LessonCard({ lesson, onOpen, onDelete }) {
  const attempts = lesson.attempts || [];
  const latest = latestAttempt(lesson);
  const percentage = attemptPercentage(latest);
  return (
    <article className="listening-lesson-card">
      <div className="listening-lesson-card__accent"><Headphones size={22} /></div>
      <div className="listening-lesson-card__head">
        <div className="listening-chip-row">
          <span className="listening-chip listening-chip--exam">{lessonExamLabel(lesson)}</span>
          <span className="listening-chip">{lesson.estimatedLevel || lesson.level || 'Tự chọn'}</span>
        </div>
        <button className="listening-icon-button listening-icon-button--danger" type="button" onClick={() => onDelete(lesson)} aria-label={`Xóa ${lesson.title}`}><Trash2 size={16} /></button>
      </div>
      <h3>{lesson.title || 'Bài luyện nghe chưa đặt tên'}</h3>
      <p>{lesson.description || lesson.topic || 'Bài luyện nghe cá nhân của bạn.'}</p>
      <div className="listening-lesson-card__meta">
        <span><FileAudio size={15} /> {countWords(lesson.passage)} từ</span>
        <span><ListChecks size={15} /> {lesson.blanks?.length || 0} chỗ trống</span>
        <span><History size={15} /> {attempts.length} lượt</span>
      </div>
      <div className="listening-lesson-card__footer">
        <div>
          <small>{latest ? `Lần gần nhất · ${safeDate(latest.submittedAt)}` : `Tạo ngày ${safeDate(lesson.createdAt)}`}</small>
          <strong>{percentage === null ? 'Chưa luyện' : `${percentage}% chính xác`}</strong>
        </div>
        <Button size="sm" icon={Play} onClick={() => onOpen(lesson)}>{latest ? 'Luyện lại' : 'Bắt đầu'}</Button>
      </div>
    </article>
  );
}

function ListeningHome({ lessons, onCreate, onOpen, onDelete }) {
  const [tab, setTab] = useState('library');
  const history = useMemo(() => lessons
    .flatMap((lesson) => (lesson.attempts || []).map((attempt) => ({ lesson, attempt })))
    .sort((a, b) => new Date(b.attempt.submittedAt || 0) - new Date(a.attempt.submittedAt || 0)), [lessons]);
  const totalAttempts = history.length;
  const scoredAttempts = history.map(({ attempt }) => attemptPercentage(attempt)).filter((value) => value !== null);
  const average = scoredAttempts.length ? Math.round(scoredAttempts.reduce((sum, value) => sum + value, 0) / scoredAttempts.length) : 0;
  const best = scoredAttempts.length ? Math.max(...scoredAttempts) : 0;

  return (
    <div className="listening-home">
      <header className="listening-hero">
        <div className="listening-hero__copy">
          <span className="listening-eyebrow"><Volume2 size={14} /> LISTENING LAB</span>
          <h1>Nghe rõ hơn, hiểu nhanh hơn.</h1>
          <p>Tạo bài nghe đúng trình độ, luyện điền từ và biến những chỗ nghe sai thành từ vựng cần nhớ.</p>
          <div className="listening-hero__actions">
            <Button size="lg" icon={Sparkles} onClick={onCreate}>Tạo bài luyện mới</Button>
            {lessons.length > 0 && <Button size="lg" variant="ghost" icon={Play} onClick={() => onOpen(lessons[0])}>Luyện bài gần nhất</Button>}
          </div>
        </div>
        <div className="listening-hero__visual" aria-hidden="true">
          <div className="listening-orbit listening-orbit--one" />
          <div className="listening-orbit listening-orbit--two" />
          <span className="listening-hero__headphones"><Headphones size={48} /></span>
          <div className="listening-wave">{[20, 38, 56, 30, 66, 46, 24, 52, 34].map((height, index) => <i style={{ height }} key={`${height}-${index}`} />)}</div>
        </div>
      </header>

      <section className="listening-stat-grid" aria-label="Thống kê luyện nghe">
        <article><span className="listening-stat-icon listening-stat-icon--violet"><BookOpen size={19} /></span><div><strong>{lessons.length}</strong><small>Bài nghe đã lưu</small></div></article>
        <article><span className="listening-stat-icon listening-stat-icon--blue"><Headphones size={19} /></span><div><strong>{totalAttempts}</strong><small>Lượt đã luyện</small></div></article>
        <article><span className="listening-stat-icon listening-stat-icon--green"><BarChart3 size={19} /></span><div><strong>{average}%</strong><small>Độ chính xác TB</small></div></article>
        <article><span className="listening-stat-icon listening-stat-icon--orange"><Trophy size={19} /></span><div><strong>{best}%</strong><small>Điểm tốt nhất</small></div></article>
      </section>

      <section className="listening-library">
        <div className="listening-library__heading">
          <div className="listening-tabs" role="tablist" aria-label="Bài luyện nghe">
            <button className={tab === 'library' ? 'listening-tabs__active' : ''} type="button" onClick={() => setTab('library')}><BookOpen size={17} /> Bài của tôi <span>{lessons.length}</span></button>
            <button className={tab === 'history' ? 'listening-tabs__active' : ''} type="button" onClick={() => setTab('history')}><History size={17} /> Lịch sử <span>{history.length}</span></button>
          </div>
          <Button size="sm" variant="soft" icon={Plus} onClick={onCreate}>Tạo bài</Button>
        </div>

        {tab === 'library' && (lessons.length ? (
          <div className="listening-lesson-grid">{lessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onOpen={onOpen} onDelete={onDelete} />)}</div>
        ) : (
          <EmptyState icon={Headphones} title="Chưa có bài luyện nghe" description="Tạo bài đầu tiên bằng Gemini hoặc dán một đoạn văn của riêng bạn. Bài và tiến độ sẽ được lưu ngay trên thiết bị." action={<Button icon={Sparkles} onClick={onCreate}>Tạo bài đầu tiên</Button>} />
        ))}

        {tab === 'history' && (history.length ? (
          <div className="listening-history-list">
            {history.map(({ lesson, attempt }) => {
              const percentage = attemptPercentage(attempt) || 0;
              return (
                <button type="button" key={attempt.id} onClick={() => onOpen(lesson)}>
                  <span className={`listening-history-list__score ${percentage >= 80 ? 'listening-history-list__score--great' : ''}`}>{percentage}%</span>
                  <div><strong>{lesson.title}</strong><small>{safeDate(attempt.submittedAt)} · {attempt.correct ?? attempt.cloze?.correct ?? 0}/{attempt.total ?? attempt.cloze?.total ?? lesson.blanks?.length ?? 0} chỗ đúng</small></div>
                  <ProgressBar value={percentage} />
                  <ArrowRight size={18} />
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={History} title="Chưa có lịch sử" description="Kết quả mỗi lần hoàn thành bài sẽ xuất hiện ở đây để bạn theo dõi sự tiến bộ." />
        ))}
      </section>
    </div>
  );
}

function ChoiceCard({ active, icon: Icon, title, description, onClick }) {
  return (
    <button className={`listening-choice ${active ? 'listening-choice--active' : ''}`} type="button" onClick={onClick}>
      <span><Icon size={21} /></span>
      <div><strong>{title}</strong><small>{description}</small></div>
      <i>{active && <Check size={13} />}</i>
    </button>
  );
}

function CreateWizard({ config, setConfig, onContinue, loading }) {
  const wordCount = countWords(config.manualText);
  const updateExam = (exam) => {
    const firstType = PASSAGE_TYPES[exam][0].id;
    const preferredLevel = exam === 'general' ? 'B1' : exam === 'toeic' ? '450–650' : 'Band 5.5–6.0';
    setConfig((current) => ({ ...current, exam, level: preferredLevel, passageType: firstType }));
  };
  return (
    <div className="listening-create">
      <header className="listening-section-intro">
        <span className="listening-eyebrow">THIẾT KẾ BÀI LUYỆN</span>
        <h1>{config.sourceMode === 'ai' ? 'Hôm nay bạn muốn nghe gì?' : 'Biến nội dung của bạn thành bài nghe.'}</h1>
        <p>{config.sourceMode === 'ai' ? 'Chọn đúng mục tiêu, Vocabloom sẽ điều chỉnh từ vựng, tốc độ nội dung và độ khó của chỗ trống.' : 'Chỉ cần đặt tên và dán đoạn tiếng Anh. Nội dung này không được gửi đến Gemini.'}</p>
      </header>

      <div className="listening-create__layout">
        <main className="listening-builder">
          <section className="listening-form-section">
            <div className="listening-form-section__title"><span>1</span><div><h2>Nguồn nội dung</h2><p>Dùng AI để tạo mới hoặc mang đoạn văn của bạn vào.</p></div></div>
            <div className="listening-source-grid">
              <ChoiceCard active={config.sourceMode === 'ai'} icon={Sparkles} title="Gemini tạo giúp tôi" description="Tạo bài mới theo cấp độ, chủ đề và dạng thi." onClick={() => setConfig((current) => ({ ...current, sourceMode: 'ai' }))} />
              <ChoiceCard active={config.sourceMode === 'manual'} icon={FilePenLine} title="Tôi có nội dung" description="Dán transcript tiếng Anh và tự tạo bài điền từ." onClick={() => setConfig((current) => ({ ...current, sourceMode: 'manual' }))} />
            </div>
            {config.sourceMode === 'manual' && (
              <div className="listening-manual-fields">
                <label className="listening-field">
                  <span>Tên bài / chủ đề</span>
                  <input value={config.title} onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))} placeholder="Ví dụ: A day at the airport" />
                </label>
                <label className="listening-field listening-field--textarea">
                  <span>Đoạn văn tiếng Anh <em>{wordCount} từ</em></span>
                  <textarea value={config.manualText} onChange={(event) => setConfig((current) => ({ ...current, manualText: event.target.value }))} placeholder="Dán nội dung tiếng Anh của bạn vào đây…" />
                  <small>Nên dùng từ 40–500 từ và có dấu câu rõ ràng để giọng đọc ngắt nghỉ tự nhiên.</small>
                </label>
              </div>
            )}
          </section>

          {config.sourceMode === 'ai' && <section className="listening-form-section">
            <div className="listening-form-section__title"><span>2</span><div><h2>Mục tiêu và cấp độ</h2><p>Nội dung AI tạo sẽ mô phỏng phong cách bạn chọn.</p></div></div>
            <div className="listening-exam-grid">
              {EXAMS.map((exam) => (
                <button className={config.exam === exam.id ? 'listening-exam-card--active' : ''} type="button" key={exam.id} onClick={() => updateExam(exam.id)}>
                  <strong>{exam.label}</strong><small>{exam.description}</small><i>{config.exam === exam.id && <Check size={13} />}</i>
                </button>
              ))}
            </div>
            <div className="listening-field-grid">
              <label className="listening-field"><span>Trình độ mục tiêu</span><select value={config.level} onChange={(event) => setConfig((current) => ({ ...current, level: event.target.value }))}>{LEVELS[config.exam].map((level) => <option key={level}>{level}</option>)}</select></label>
              <label className="listening-field"><span>Dạng bài nghe</span><select value={config.passageType} onChange={(event) => setConfig((current) => ({ ...current, passageType: event.target.value }))}>{PASSAGE_TYPES[config.exam].map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}</select></label>
              <label className="listening-field listening-field--wide"><span>Chủ đề</span><input value={config.topic} onChange={(event) => setConfig((current) => ({ ...current, topic: event.target.value }))} placeholder="Ví dụ: Airport, work-life balance, environment…" /></label>
            </div>
          </section>}

          <section className="listening-form-section">
            <div className="listening-form-section__title"><span>{config.sourceMode === 'ai' ? 3 : 2}</span><div><h2>{config.sourceMode === 'ai' ? 'Độ dài và chỗ trống' : 'Thiết lập chỗ trống'}</h2><p>{config.sourceMode === 'ai' ? 'Điều chỉnh khối lượng nghe phù hợp với thời gian của bạn.' : 'Chọn số lượng và cách chọn từ sẽ được ẩn trong bài luyện.'}</p></div></div>
            {config.sourceMode === 'ai' && <>
              <span className="listening-mini-label">Độ dài đoạn nghe</span>
              <div className="listening-length-grid">
                {LENGTHS.map((item) => <button className={Number(config.targetWordCount) === item.value ? 'listening-length-card--active' : ''} type="button" key={item.value} onClick={() => setConfig((current) => ({ ...current, targetWordCount: item.value }))}><strong>{item.label}</strong><small>{item.value} từ · {item.helper}</small></button>)}
              </div>
            </>}

            <div className="listening-blank-control">
              <div><span>Tỷ lệ đục lỗ</span><strong>{config.blankPercentage}%</strong></div>
              <input type="range" min="5" max="40" step="5" value={config.blankPercentage} onChange={(event) => setConfig((current) => ({ ...current, blankPercentage: Number(event.target.value) }))} aria-label="Tỷ lệ đục lỗ" />
              <div className="listening-blank-control__legend"><span>5% · Làm quen</span><span>20% · Vừa sức</span><span>40% · Thử thách</span></div>
            </div>

            <span className="listening-mini-label">Cách chọn từ bị ẩn</span>
            <div className="listening-mode-grid">
              {BLANK_MODES.map(({ id, label, description, icon: Icon }) => <ChoiceCard key={id} active={config.blankMode === id} icon={Icon} title={label} description={description} onClick={() => setConfig((current) => ({ ...current, blankMode: id }))} />)}
            </div>
          </section>
        </main>

        <aside className="listening-create__summary">
          <div className="listening-summary-card">
            <span className="listening-eyebrow">BÀI LUYỆN CỦA BẠN</span>
            <div className="listening-summary-card__icon"><Headphones size={27} /></div>
            <h3>{config.sourceMode === 'manual' ? config.title || 'Bài nghe của tôi' : config.topic || 'Chủ đề tự chọn'}</h3>
            <ul>
              {config.sourceMode === 'ai' && <li><span>Kỳ thi</span><strong>{EXAMS.find((item) => item.id === config.exam)?.short}</strong></li>}
              {config.sourceMode === 'ai' && <li><span>Cấp độ</span><strong>{config.level}</strong></li>}
              <li><span>Độ dài</span><strong>{config.sourceMode === 'manual' ? `${wordCount} từ` : `≈ ${config.targetWordCount} từ`}</strong></li>
              <li><span>Chỗ trống</span><strong>{config.blankPercentage}% · {BLANK_MODES.find((item) => item.id === config.blankMode)?.label}</strong></li>
            </ul>
            <Button className={loading ? 'is-loading' : ''} size="lg" icon={loading ? LoaderCircle : config.sourceMode === 'ai' ? Sparkles : ArrowRight} disabled={loading} onClick={onContinue}>{loading ? 'Đang chuẩn bị bài…' : config.sourceMode === 'ai' ? 'Tạo bằng Gemini' : 'Kiểm tra nội dung'}</Button>
            <p><CircleAlert size={14} /> Bạn sẽ được đọc và chỉnh sửa transcript trước khi tạo bài.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewLesson({ draft, setDraft, config, onBack, onStart, saving }) {
  const words = countWords(draft.passage);
  const estimatedBlanks = Math.max(1, Math.round(words * config.blankPercentage / 100));
  return (
    <div className="listening-review">
      <header className="listening-section-intro">
        <span className="listening-eyebrow">KIỂM TRA TRƯỚC KHI HỌC</span>
        <h1>Nghe tốt bắt đầu từ nội dung tốt.</h1>
        <p>Sửa bất kỳ chi tiết nào chưa tự nhiên. Chỗ trống sẽ được tạo lại từ phiên bản cuối cùng.</p>
      </header>
      <div className="listening-review__layout">
        <main className="listening-review-editor">
          <div className="listening-review-editor__head"><div><FilePenLine size={20} /><span><strong>Transcript tiếng Anh</strong><small>{words} từ · khoảng {getLessonSentences(draft).length} câu</small></span></div><span className="listening-status-pill"><CheckCircle2 size={14} /> Sẵn sàng chỉnh sửa</span></div>
          <label className="listening-field"><span>Tiêu đề bài nghe</span><input value={draft.title || ''} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Tên bài luyện nghe" /></label>
          <label className="listening-field listening-field--textarea listening-field--review"><span>Nội dung sẽ được đọc</span><textarea value={draft.passage || ''} onChange={(event) => setDraft((current) => ({ ...current, passage: event.target.value }))} /></label>
          <label className="listening-field"><span>Mô tả ngắn <small>(không bắt buộc)</small></span><input value={draft.description || ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Bài nghe nói về điều gì?" /></label>
          {draft.questions?.length > 0 && (
            <div className="listening-question-preview">
              <div><ListChecks size={19} /><span><strong>{draft.questions.length} câu hỏi hiểu nội dung</strong><small>Câu hỏi sẽ xuất hiện sau phần điền từ.</small></span></div>
              {draft.questions.slice(0, 3).map((question, index) => <p key={question.id || index}><b>{index + 1}</b>{question.question}</p>)}
            </div>
          )}
        </main>
        <aside className="listening-review__summary">
          <div className="listening-review-metric"><Target size={20} /><div><strong>≈ {estimatedBlanks}</strong><span>từ/cụm từ sẽ bị ẩn</span></div></div>
          <div className="listening-review-metric"><Clock3 size={20} /><div><strong>≈ {Math.max(1, Math.ceil(words / 110))} phút</strong><span>thời lượng nghe dự kiến</span></div></div>
          <div className="listening-review-tips"><span className="listening-eyebrow">MẸO NHỎ</span><p>Thêm dấu chấm, dấu phẩy đúng chỗ sẽ giúp giọng đọc ngắt nghỉ tự nhiên hơn.</p></div>
        </aside>
      </div>
      <footer className="listening-review__actions">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>Sửa thiết lập</Button>
        <Button className={saving ? 'is-loading' : ''} icon={saving ? LoaderCircle : Headphones} disabled={saving} onClick={onStart}>{saving ? 'Đang tạo bài…' : 'Lưu và bắt đầu luyện'}</Button>
      </footer>
    </div>
  );
}

function AudioConsole({ player, sentences, listens, setListens }) {
  const current = sentences[player.currentIndex];
  const startListening = (action) => {
    const started = action();
    if (started !== false) setListens((value) => value + 1);
  };
  return (
    <section className="listening-player">
      <div className="listening-player__now">
        <span className={`listening-player__art ${player.status === 'playing' ? 'listening-player__art--playing' : ''}`}><Headphones size={26} /></span>
        <div><span>ĐANG NGHE</span><strong>Câu {Math.min(player.currentIndex + 1, sentences.length)} / {sentences.length}</strong><small>{current?.text ? `${countWords(current.text)} từ trong câu này` : 'Sẵn sàng phát âm thanh'}</small></div>
      </div>
      <div className="listening-player__progress"><ProgressBar value={player.currentIndex + 1} max={sentences.length || 1} compact /></div>
      <div className="listening-player__controls">
        <button type="button" onClick={() => player.goTo(player.currentIndex - 1)} disabled={player.currentIndex <= 0} aria-label="Câu trước"><SkipBack size={19} /></button>
        {player.status === 'playing' || player.status === 'paused' ? (
          <button className="listening-player__main" type="button" onClick={player.togglePause} aria-label={player.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}>{player.status === 'paused' ? <Play size={22} /> : <Pause size={22} />}</button>
        ) : (
          <button className="listening-player__main" type="button" onClick={() => startListening(player.playCurrent)} aria-label="Phát câu hiện tại"><Play size={22} /></button>
        )}
        <button type="button" onClick={() => player.goTo(player.currentIndex + 1)} disabled={player.currentIndex >= sentences.length - 1} aria-label="Câu tiếp theo"><SkipForward size={19} /></button>
        <button type="button" onClick={player.stop} disabled={player.status === 'idle'} aria-label="Dừng"><Square size={16} /></button>
      </div>
      <div className="listening-player__secondary">
        <Button size="sm" variant="soft" icon={RotateCcw} onClick={() => startListening(player.playCurrent)}>Nghe lại câu</Button>
        <Button size="sm" variant="ghost" icon={Play} onClick={() => startListening(player.playFromCurrent)}>Nghe từ đây</Button>
        <Button size="sm" variant="ghost" icon={FileAudio} onClick={() => startListening(player.playAll)}>Nghe toàn bài</Button>
      </div>
      <div className="listening-player__settings">
        <label><Volume2 size={15} /><span>Giọng đọc</span><select value={player.voiceURI} onChange={(event) => { player.stop(); player.setVoiceURI(event.target.value); }}><option value="">Tự động · English</option>{player.voices.map((voice) => <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} ({voice.lang}){voice.localService ? ' · offline' : ''}</option>)}</select></label>
        <label><Settings2 size={15} /><span>Tốc độ</span><select value={player.rate} onChange={(event) => { player.stop(); player.setRate(Number(event.target.value)); }}>{RATE_OPTIONS.map((rate) => <option value={rate} key={rate}>{rate}×</option>)}</select></label>
        <span><Headphones size={14} /> {listens} lượt phát</span>
      </div>
      {!player.supported && <p className="listening-player__warning"><CircleAlert size={15} /> Trình duyệt này chưa hỗ trợ Web Speech API. Hãy dùng Chrome hoặc Edge phiên bản mới.</p>}
    </section>
  );
}

function SentenceCloze({ sentence, blanks, answers, setAnswer, current, resultMap }) {
  const parts = renderSentenceParts(sentence, blanks);
  if (!parts.length) {
    return <p className={`listening-cloze-sentence__fallback ${current ? 'listening-cloze-sentence__fallback--current' : ''}`}>{sentence.text}</p>;
  }
  const output = parts.map((part) => {
    if (part.type === 'text') return <span className="listening-token" key={part.key}>{part.text}</span>;
    const blank = part.blank;
    const result = resultMap?.[blank.id];
    const answer = answers[blank.id] || '';
    const width = Math.max(76, Math.min(220, String(blank.answer || '').length * 10 + 38));
    return (
      <span className={`listening-inline-answer ${result ? result.isCorrect ? 'listening-inline-answer--correct' : 'listening-inline-answer--wrong' : ''}`} key={blank.id}>
        <input
          style={{ width }}
          value={answer}
          disabled={Boolean(resultMap)}
          onChange={(event) => setAnswer(blank.id, event.target.value)}
          aria-label={`Từ còn thiếu trong câu ${Number(sentence.index) + 1}`}
          autoComplete="off"
          spellCheck="false"
          placeholder={`${Math.max(1, String(blank.answer || '').split(/\s+/).length)} từ`}
        />
        {result && <i>{result.isCorrect ? <Check size={13} /> : <X size={13} />}</i>}
      </span>
    );
  });
  return <p>{output}</p>;
}

function ComprehensionQuestions({ questions, answers, setAnswer }) {
  if (!questions.length) return null;
  return (
    <section className="listening-comprehension">
      <div className="listening-exercise-heading"><span><ListChecks size={21} /></span><div><h2>Hiểu nội dung</h2><p>Chọn đáp án dựa trên những gì bạn vừa nghe.</p></div></div>
      {questions.map((question, questionIndex) => (
        <article className="listening-question" key={question.id || questionIndex}>
          <h3><span>{questionIndex + 1}</span>{question.question}</h3>
          <div>{(question.options || []).map((option, optionIndex) => {
            const key = question.id || questionIndex;
            const selected = Number(answers[key]) === optionIndex;
            return <button className={selected ? 'listening-question__option--selected' : ''} type="button" onClick={() => setAnswer(key, optionIndex)} key={`${option}-${optionIndex}`}><i>{String.fromCharCode(65 + optionIndex)}</i><span>{option}</span>{selected && <CheckCircle2 size={17} />}</button>;
          })}</div>
        </article>
      ))}
    </section>
  );
}

function PracticeLesson({ lesson, player, answers, setAnswers, questionAnswers, setQuestionAnswers, onSubmit, onExit, submitting }) {
  const [exerciseVisible, setExerciseVisible] = useState(false);
  const [listens, setListens] = useState(0);
  const sentences = getLessonSentences(lesson);
  const answered = Object.values(answers).filter((value) => String(value).trim()).length;
  const total = lesson.blanks?.length || 0;
  const setAnswer = (id, value) => setAnswers((current) => ({ ...current, [id]: value }));

  return (
    <div className="listening-practice">
      <header className="listening-practice__header">
        <div><span className="listening-eyebrow">{lessonExamLabel(lesson)} · {lesson.estimatedLevel || lesson.level || 'Tự chọn'}</span><h1>{lesson.title}</h1><p>{lesson.topic || lesson.description}</p></div>
        <button className="listening-exit" type="button" onClick={onExit}><X size={17} /> Thoát bài</button>
      </header>

      <AudioConsole player={player} sentences={sentences} listens={listens} setListens={setListens} />

      {!exerciseVisible ? (
        <section className="listening-audio-first">
          <span><Headphones size={31} /></span>
          <div><span className="listening-eyebrow">BƯỚC 1 · CHỈ NGHE</span><h2>Nghe toàn bài trước khi nhìn transcript</h2><p>Tập trung vào ý chính, người nói và các từ khóa. Khi đã sẵn sàng, mở bài điền khuyết để nghe lần hai.</p></div>
          <Button icon={ArrowRight} onClick={() => setExerciseVisible(true)}>Bắt đầu điền từ</Button>
        </section>
      ) : (
        <>
          <section className="listening-cloze">
            <div className="listening-exercise-heading">
              <span><FilePenLine size={21} /></span>
              <div><h2>Điền vào chỗ trống</h2><p>Nghe lại từng câu và nhập chính xác từ hoặc cụm từ còn thiếu.</p></div>
              <strong>{answered}/{total} đã điền</strong>
            </div>
            <ProgressBar value={answered} max={total || 1} compact />
            <div className="listening-cloze__sentences">
              {sentences.map((sentence, index) => {
                const sentenceBlanks = (lesson.blanks || []).filter((blank) => Number(blank.sentenceIndex) === index);
                return (
                  <article className={`listening-cloze-sentence ${player.currentIndex === index ? 'listening-cloze-sentence--current' : ''}`} key={sentence.id || index}>
                    <button type="button" onClick={() => player.playSentence(index)} aria-label={`Nghe câu ${index + 1}`}><Volume2 size={17} /></button>
                    <span>{index + 1}</span>
                    <SentenceCloze sentence={sentence} blanks={sentenceBlanks} answers={answers} setAnswer={setAnswer} current={player.currentIndex === index} />
                  </article>
                );
              })}
            </div>
          </section>

          <ComprehensionQuestions questions={lesson.questions || []} answers={questionAnswers} setAnswer={(id, value) => setQuestionAnswers((current) => ({ ...current, [id]: value }))} />

          <footer className="listening-submit-bar">
            <div><strong>{answered === total ? 'Bạn đã điền tất cả chỗ trống!' : `Còn ${Math.max(0, total - answered)} chỗ chưa điền`}</strong><small>Bạn vẫn có thể nộp bài khi chưa hoàn thành.</small></div>
            <Button className={submitting ? 'is-loading' : ''} size="lg" icon={submitting ? LoaderCircle : CheckCircle2} disabled={submitting} onClick={() => onSubmit(listens)}>{submitting ? 'Đang chấm…' : 'Nộp bài và xem kết quả'}</Button>
          </footer>
        </>
      )}
    </div>
  );
}

function ResultLesson({ lesson, result, answers, onRetry, onHome, onAddWords, addingWords, wordsAdded, rate }) {
  const resultMap = Object.fromEntries((result.cloze.results || []).map((item) => [item.blankId, item]));
  const sentences = getLessonSentences(lesson);
  const missed = result.cloze.results.filter((item) => !item.isCorrect);
  const percentage = result.combinedPercentage;
  const tone = percentage >= 85 ? 'excellent' : percentage >= 65 ? 'good' : 'practice';
  const toneCopy = tone === 'excellent'
    ? ['Xuất sắc!', 'Tai nghe của bạn đang rất nhạy. Hãy thử tăng độ khó ở bài tiếp theo.']
    : tone === 'good'
      ? ['Tiến bộ rất tốt!', 'Bạn đã nắm được phần lớn nội dung. Nghe lại những câu sai để củng cố.']
      : ['Một lượt luyện đáng giá!', 'Mỗi lỗi sai là một từ khóa mới. Hãy nghe lại chậm hơn rồi thử lần nữa.'];

  return (
    <div className="listening-results">
      <section className={`listening-score-hero listening-score-hero--${tone}`}>
        <div className="listening-score-ring" style={{ '--listening-score': `${percentage * 3.6}deg` }}><span><strong>{percentage}%</strong><small>Tổng điểm</small></span></div>
        <div><span className="listening-eyebrow">HOÀN THÀNH BÀI NGHE</span><h1>{toneCopy[0]}</h1><p>{toneCopy[1]}</p><div className="listening-score-hero__actions"><Button icon={RotateCcw} onClick={onRetry}>Luyện lại bài này</Button><Button variant="ghost" icon={BookOpen} onClick={onHome}>Về thư viện</Button></div></div>
      </section>

      <section className="listening-result-stats">
        <article><span className="listening-stat-icon listening-stat-icon--green"><CheckCircle2 size={19} /></span><div><strong>{result.cloze.correct}</strong><small>Chỗ điền đúng</small></div></article>
        <article><span className="listening-stat-icon listening-stat-icon--orange"><XCircle size={19} /></span><div><strong>{result.cloze.incorrect + result.cloze.unanswered}</strong><small>Cần nghe lại</small></div></article>
        <article><span className="listening-stat-icon listening-stat-icon--blue"><ListChecks size={19} /></span><div><strong>{result.questions.total ? `${result.questions.correct}/${result.questions.total}` : '—'}</strong><small>Hiểu nội dung</small></div></article>
        <article><span className="listening-stat-icon listening-stat-icon--violet"><Headphones size={19} /></span><div><strong>{result.listens}</strong><small>Lượt phát âm thanh</small></div></article>
      </section>

      <section className="listening-answer-review">
        <div className="listening-answer-review__heading"><div><span className="listening-eyebrow">TRANSCRIPT & ĐÁP ÁN</span><h2>Xem lại từng câu</h2></div><span><i className="listening-answer-review__correct" /> Chính xác <i className="listening-answer-review__wrong" /> Cần ôn</span></div>
        <div className="listening-answer-review__sentences">
          {sentences.map((sentence, index) => {
            const sentenceBlanks = (lesson.blanks || []).filter((blank) => Number(blank.sentenceIndex) === index);
            const sentenceWrong = sentenceBlanks.some((blank) => !resultMap[blank.id]?.isCorrect);
            return (
              <article className={sentenceWrong ? 'listening-answer-sentence--wrong' : 'listening-answer-sentence--correct'} key={sentence.id || index}>
                <button type="button" onClick={() => speakEnglish(sentence.text, rate)} aria-label={`Nghe lại câu ${index + 1}`}><Volume2 size={17} /></button>
                <span>{sentenceWrong ? <X size={14} /> : <Check size={14} />}</span>
                <div><SentenceCloze sentence={sentence} blanks={sentenceBlanks} answers={answers} setAnswer={() => {}} resultMap={resultMap} />
                  {sentenceBlanks.filter((blank) => !resultMap[blank.id]?.isCorrect).map((blank) => <small key={blank.id}>Bạn nhập: <del>{answers[blank.id] || '(bỏ trống)'}</del> · Đáp án: <strong>{blank.answer}</strong></small>)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {result.questions.total > 0 && (
        <section className="listening-question-results">
          <div className="listening-exercise-heading"><span><ListChecks size={21} /></span><div><h2>Đáp án hiểu nội dung</h2><p>{result.questions.correct}/{result.questions.total} câu chính xác.</p></div></div>
          {result.questions.results.map(({ question, selectedIndex, isCorrect }, index) => (
            <article className={isCorrect ? 'listening-question-result--correct' : 'listening-question-result--wrong'} key={question.id || index}>
              <span>{isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</span>
              <div><strong>{index + 1}. {question.question}</strong><p>Đáp án: {question.options?.[question.correctIndex]}</p>{!isCorrect && selectedIndex !== null && <small>Bạn chọn: {question.options?.[selectedIndex]}</small>}{question.explanation && <em>{question.explanation}</em>}</div>
            </article>
          ))}
        </section>
      )}

      {missed.length > 0 && (
        <section className="listening-missed-words">
          <div><span><Brain size={22} /></span><div><h2>Biến lỗi sai thành từ đã thuộc</h2><p>Thêm {missed.length} từ/cụm từ nghe chưa đúng vào một bộ flashcard để ôn lại bằng lặp ngắt quãng.</p></div></div>
          <div className="listening-missed-words__chips">{missed.slice(0, 8).map((item) => <button type="button" key={item.blankId} onClick={() => speakEnglish(item.answer, rate)}><Volume2 size={13} /> {item.answer}</button>)}</div>
          <Button variant="soft" icon={wordsAdded ? Check : Plus} disabled={addingWords || wordsAdded} onClick={onAddWords}>{wordsAdded ? 'Đã thêm vào flashcard' : addingWords ? 'Đang thêm…' : 'Thêm từ sai vào flashcard'}</Button>
        </section>
      )}

      <footer className="listening-results__footer"><Button variant="ghost" icon={BookOpen} onClick={onHome}>Về thư viện bài nghe</Button><Button icon={RotateCcw} onClick={onRetry}>Luyện lại</Button></footer>
    </div>
  );
}

export default function ListeningPage({ lessons = [], settings = {}, saveLesson, deleteLesson, addWordsToSet, navigate, toast }) {
  const [stage, setStage] = useState('home');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [draft, setDraft] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addingWords, setAddingWords] = useState(false);
  const [wordsAdded, setWordsAdded] = useState(false);
  const sentences = useMemo(() => getLessonSentences(activeLesson), [activeLesson]);
  const player = usePassagePlayer(sentences, 0.85);

  const notify = useCallback((title, message = '', type = 'success') => {
    if (typeof toast === 'function') toast(title, message, type);
  }, [toast]);

  const goHome = useCallback(() => {
    player.stop();
    setStage('home');
    setActiveLesson(null);
    setResult(null);
    setAnswers({});
    setQuestionAnswers({});
    setWordsAdded(false);
    if (typeof navigate === 'function') navigate('listening');
  }, [navigate, player]);

  const startCreate = () => {
    player.stop();
    setConfig(DEFAULT_CONFIG);
    setDraft(null);
    setStage('create');
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prepareDraft = async () => {
    if (config.sourceMode === 'manual' && !config.title.trim()) {
      notify('Chưa có tên bài nghe', 'Hãy đặt tên để bạn dễ tìm lại bài luyện này.', 'warning');
      return;
    }
    if (config.sourceMode === 'manual' && countWords(config.manualText) < 5) {
      notify('Đoạn văn quá ngắn', 'Hãy nhập ít nhất 5 từ tiếng Anh để tạo bài nghe.', 'warning');
      return;
    }
    if (config.sourceMode === 'ai' && !config.topic.trim()) {
      notify('Chưa có chủ đề', 'Hãy nhập chủ đề bạn muốn Gemini viết.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const generated = config.sourceMode === 'ai'
        ? await generateListeningPassage(config, settings)
        : await generateListeningPassage({ ...config, manualText: config.manualText }, settings);
      setDraft({
        ...generated,
        title: generated.title || (config.sourceMode === 'manual' ? config.title.trim() : `${EXAMS.find((item) => item.id === config.exam)?.short} Listening · ${config.topic || 'My passage'}`),
        description: generated.description || (config.sourceMode === 'manual' ? 'Bài luyện nghe từ nội dung tự nhập.' : ''),
        passage: generated.passage || config.manualText,
        exam: config.sourceMode === 'manual' ? 'General' : generated.exam || config.exam,
        topic: config.sourceMode === 'manual' ? config.title.trim() : generated.topic || config.topic,
        passageType: config.sourceMode === 'manual' ? 'Đoạn văn' : generated.passageType || config.passageType,
        sourceMode: config.sourceMode,
        estimatedLevel: config.sourceMode === 'manual' ? 'Tự chọn' : generated.estimatedLevel || config.level,
      });
      setStage('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      notify(config.sourceMode === 'ai' ? 'Gemini đã tạo xong bài nghe' : 'Đã đọc nội dung của bạn', 'Hãy kiểm tra transcript trước khi bắt đầu luyện.');
    } catch (error) {
      const fallbackMessage = config.sourceMode === 'ai'
        ? 'Hãy kiểm tra Gemini API key và thử lại.'
        : 'Hãy kiểm tra tên bài và nội dung tiếng Anh rồi thử lại.';
      notify('Chưa thể tạo bài nghe', error.message || fallbackMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const beginPractice = useCallback((lesson) => {
    player.reset();
    setActiveLesson(lesson);
    setAnswers({});
    setQuestionAnswers({});
    setResult(null);
    setWordsAdded(false);
    setStage('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [player]);

  const saveAndStart = async () => {
    if (!draft?.title?.trim() || countWords(draft?.passage) < 5) {
      notify('Nội dung chưa hoàn chỉnh', 'Bài cần có tiêu đề và ít nhất 5 từ tiếng Anh.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const lesson = createListeningLesson({ ...draft, title: draft.title.trim(), passage: draft.passage.trim() }, {
        blankPercentage: config.blankPercentage,
        percentage: config.blankPercentage,
        mode: config.blankMode,
        blankMode: config.blankMode,
      });
      if (!lesson.blanks?.length) throw new Error('Đoạn văn chưa có đủ từ phù hợp để tạo chỗ trống.');
      const saved = typeof saveLesson === 'function' ? await saveLesson(lesson) : lesson;
      beginPractice(saved || lesson);
      notify('Đã lưu bài luyện nghe', `${lesson.blanks.length} chỗ trống đã sẵn sàng.`);
    } catch (error) {
      notify('Không thể tạo bài luyện', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitAttempt = async (listens) => {
    if (!activeLesson) return;
    setSubmitting(true);
    player.stop();
    try {
      const cloze = scoreClozeAnswers(activeLesson, answers);
      const questions = questionSummary(activeLesson, questionAnswers);
      const combinedPercentage = questions.total
        ? Math.round((cloze.percentage * 0.75) + (questions.percentage * 0.25))
        : cloze.percentage;
      const attempt = buildAttempt(activeLesson, answers, questionAnswers);
      const normalizedAttempt = { ...attempt, listens, combinedPercentage, percentage: combinedPercentage };
      const updated = {
        ...activeLesson,
        attempts: [...(activeLesson.attempts || []), normalizedAttempt],
        updatedAt: new Date().toISOString(),
      };
      if (typeof saveLesson === 'function') await saveLesson(updated);
      setActiveLesson(updated);
      setResult({ cloze, questions, attempt: normalizedAttempt, combinedPercentage, listens });
      setStage('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      notify('Đã lưu kết quả', `Bạn đạt ${combinedPercentage}% cho bài nghe này.`, combinedPercentage >= 70 ? 'success' : 'info');
    } catch (error) {
      notify('Chưa lưu được kết quả', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (typeof deleteLesson === 'function') await deleteLesson(deleteTarget.id);
      notify('Đã xóa bài nghe', `“${deleteTarget.title}” đã được gỡ khỏi thiết bị.`, 'info');
      setDeleteTarget(null);
    } catch (error) {
      notify('Không thể xóa bài', error.message, 'error');
    }
  };

  const addMissedWords = async () => {
    const missed = result?.cloze?.results?.filter((item) => !item.isCorrect) || [];
    if (!missed.length || typeof addWordsToSet !== 'function') return;
    const uniqueAnswers = [...new Set(missed.map((item) => item.answer).filter(Boolean))];
    const words = uniqueAnswers.map((answer) => {
      const vocabulary = activeLesson.vocabulary?.find((item) => normalizeText(item.term) === normalizeText(answer));
      return {
        id: crypto.randomUUID(),
        term: answer,
        meaning: vocabulary?.meaning || 'Bổ sung nghĩa tiếng Việt',
        pronunciation: vocabulary?.pronunciation || '',
        partOfSpeech: vocabulary?.partOfSpeech || 'other',
        example: vocabulary?.example || '',
        exampleMeaning: vocabulary?.exampleMeaning || '',
        level: activeLesson.estimatedLevel || activeLesson.level || 'B1',
        tags: ['listening', String(activeLesson.topic || '').toLocaleLowerCase('vi')].filter(Boolean),
        note: `Nghe chưa chính xác trong bài “${activeLesson.title}”.`,
        needsReview: !vocabulary?.meaning,
      };
    });
    setAddingWords(true);
    try {
      await addWordsToSet(words, activeLesson);
      setWordsAdded(true);
      notify('Đã thêm từ cần ôn', `${words.length} từ/cụm từ đã được chuyển sang flashcard.`);
    } catch (error) {
      notify('Chưa thêm được từ', error.message, 'error');
    } finally {
      setAddingWords(false);
    }
  };

  return (
    <div className="page listening-page">
      <ListeningHeader stage={stage} onHome={goHome} />
      {stage === 'home' && <ListeningHome lessons={lessons} onCreate={startCreate} onOpen={beginPractice} onDelete={setDeleteTarget} />}
      {stage === 'create' && <CreateWizard config={config} setConfig={setConfig} onContinue={prepareDraft} loading={loading} />}
      {stage === 'review' && draft && <ReviewLesson draft={draft} setDraft={setDraft} config={config} onBack={() => setStage('create')} onStart={saveAndStart} saving={saving} />}
      {stage === 'practice' && activeLesson && <PracticeLesson lesson={activeLesson} player={player} answers={answers} setAnswers={setAnswers} questionAnswers={questionAnswers} setQuestionAnswers={setQuestionAnswers} onSubmit={submitAttempt} onExit={goHome} submitting={submitting} />}
      {stage === 'results' && activeLesson && result && <ResultLesson lesson={activeLesson} result={result} answers={answers} onRetry={() => beginPractice(activeLesson)} onHome={goHome} onAddWords={addMissedWords} addingWords={addingWords} wordsAdded={wordsAdded} rate={player.rate} />}

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Xóa bài luyện nghe?" eyebrow="XÁC NHẬN" size="sm">
        <div className="listening-delete-dialog">
          <span><Trash2 size={24} /></span>
          <p>Bài <strong>“{deleteTarget?.title}”</strong> và toàn bộ lịch sử luyện liên quan sẽ bị xóa khỏi thiết bị này.</p>
          <div><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Giữ lại</Button><Button variant="danger" icon={Trash2} onClick={confirmDelete}>Xóa bài</Button></div>
        </div>
      </Modal>
    </div>
  );
}
