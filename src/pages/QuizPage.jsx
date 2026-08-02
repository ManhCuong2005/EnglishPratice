import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileQuestion,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, EmptyState, Modal, ProgressBar } from '../components/Common.jsx';
import {
  analyzeQuizQuestions,
  buildQuizAttempt,
  createEmptyQuizQuestion,
  createQuizSet,
  shuffleQuizQuestions,
  validateQuizQuestion,
} from '../lib/quiz.js';
import { getGeminiConfig } from '../lib/gemini.js';

const SAMPLE_QUIZ = `Câu 1. Which planet is known as the Red Planet?
A. Venus
B. Mars
C. Jupiter
D. Mercury
Đáp án: B
Giải thích: Mars appears red because iron minerals in its soil oxidize, or rust.

Câu 2. The word "rapid" is closest in meaning to:
A. slow
B. careful
C. fast
Đáp án: C
Giải thích: Rapid means happening in a short time or at a fast speed.`;

function formatDate(value) {
  if (!value) return 'Chưa làm';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function latestAttempt(quizSet) {
  return quizSet?.attempts?.at(-1) || null;
}

function QuizCard({ quizSet, onStart, onDelete }) {
  const attempts = quizSet.attempts || [];
  const latest = latestAttempt(quizSet);
  const best = attempts.length ? Math.max(...attempts.map((attempt) => Number(attempt.percentage) || 0)) : null;
  return (
    <article className="quiz-set-card">
      <div className="quiz-set-card__top">
        <span className="quiz-set-card__icon"><ListChecks size={23} /></span>
        <button className="quiz-icon-button quiz-icon-button--danger" type="button" onClick={() => onDelete(quizSet)} aria-label={`Xóa ${quizSet.title}`}><Trash2 size={17} /></button>
      </div>
      <h3>{quizSet.title}</h3>
      <p>{quizSet.description || 'Bộ câu hỏi trắc nghiệm của bạn.'}</p>
      <div className="quiz-set-card__meta">
        <span><CircleHelp size={15} /> {quizSet.questions?.length || 0} câu</span>
        <span><History size={15} /> {attempts.length} lượt làm</span>
        <span><Trophy size={15} /> {best === null ? 'Chưa có điểm' : `Cao nhất ${best}%`}</span>
      </div>
      <footer>
        <div><small>{latest ? `Lần gần nhất · ${formatDate(latest.completedAt)}` : `Tạo ngày ${formatDate(quizSet.createdAt)}`}</small><strong>{latest ? `${latest.correct}/${latest.total} câu đúng` : 'Sẵn sàng bắt đầu'}</strong></div>
        <Button size="sm" icon={ArrowRight} onClick={() => onStart(quizSet)}>Làm bài</Button>
      </footer>
    </article>
  );
}

function QuizHome({ quizSets, onCreate, onStart, onDelete }) {
  const attempts = quizSets.flatMap((set) => set.attempts || []);
  const totalQuestions = quizSets.reduce((sum, set) => sum + (set.questions?.length || 0), 0);
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + (Number(attempt.percentage) || 0), 0) / attempts.length) : 0;
  const best = attempts.length ? Math.max(...attempts.map((attempt) => Number(attempt.percentage) || 0)) : 0;
  return (
    <div className="quiz-home">
      <header className="quiz-hero">
        <div>
          <span className="quiz-eyebrow"><Sparkles size={15} /> AI QUIZ LAB</span>
          <h1>Biến tài liệu thành bộ câu hỏi để chinh phục.</h1>
          <p>Gemini nhận diện câu hỏi, đáp án và lời giải. Bạn kiểm duyệt một lần rồi luyện tập bất cứ lúc nào, ngay trên thiết bị.</p>
          <Button size="lg" icon={Plus} onClick={onCreate}>Tạo bộ câu hỏi</Button>
        </div>
        <span className="quiz-hero__visual" aria-hidden="true"><FileQuestion size={58} /><i /><b /></span>
      </header>

      <section className="quiz-stat-grid" aria-label="Thống kê trắc nghiệm">
        <article><span><FileQuestion size={20} /></span><div><strong>{quizSets.length}</strong><small>Bộ câu hỏi</small></div></article>
        <article><span><CircleHelp size={20} /></span><div><strong>{totalQuestions}</strong><small>Tổng số câu</small></div></article>
        <article><span><BarChart3 size={20} /></span><div><strong>{average}%</strong><small>Điểm trung bình</small></div></article>
        <article><span><Trophy size={20} /></span><div><strong>{best}%</strong><small>Điểm cao nhất</small></div></article>
      </section>

      <section className="quiz-library">
        <div className="quiz-section-heading"><div><span className="quiz-eyebrow">THƯ VIỆN CỦA BẠN</span><h2>Bộ câu hỏi đã lưu</h2></div>{quizSets.length > 0 && <Button size="sm" variant="soft" icon={Plus} onClick={onCreate}>Tạo bộ mới</Button>}</div>
        {quizSets.length ? <div className="quiz-set-grid">{quizSets.map((set) => <QuizCard key={set.id} quizSet={set} onStart={onStart} onDelete={onDelete} />)}</div> : <EmptyState icon={FileQuestion} title="Chưa có bộ câu hỏi" description="Dán nội dung hoặc tải file lên để Gemini chuẩn hóa bộ trắc nghiệm đầu tiên." action={<Button icon={Sparkles} onClick={onCreate}>Tạo bằng Gemini</Button>} />}
      </section>
    </div>
  );
}

function QuizInput({ source, setSource, fileName, setFileName, settings, onAnalyze, loading, toast }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const gemini = getGeminiConfig(settings);
  const readFile = async (file) => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!['.txt', '.md', '.csv', '.tsv', '.json'].includes(extension)) {
      toast('Định dạng chưa hỗ trợ', 'Hãy chọn file TXT, MD, CSV, TSV hoặc JSON.', 'warning');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast('File quá lớn', 'Kích thước tối đa là 3 MB.', 'warning');
      return;
    }
    try {
      const text = await file.text();
      setSource(text);
      setFileName(file.name);
      toast('Đã đọc file', `${file.name} · ${Math.max(1, text.split(/\r?\n/).length)} dòng`);
    } catch (_error) {
      toast('Không đọc được file', 'Hãy kiểm tra file rồi thử lại.', 'error');
    }
  };
  return (
    <div className="quiz-import-layout">
      <main className="quiz-import-panel">
        <div className="quiz-panel-heading"><span><UploadCloud size={22} /></span><div><h2>Đưa ngân hàng câu hỏi vào</h2><p>Giữ nguyên câu hỏi, các lựa chọn, đáp án và phần giải thích nếu có.</p></div></div>
        <div className={`quiz-drop-zone ${dragging ? 'quiz-drop-zone--active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) readFile(file); }}>
          <span><FileText size={27} /></span>
          <strong>{fileName || 'Kéo thả file câu hỏi vào đây'}</strong>
          <p>hoặc <button type="button" onClick={() => fileRef.current?.click()}>chọn file từ thiết bị</button></p>
          <small>TXT, MD, CSV, TSV, JSON · tối đa 3 MB</small>
          <input ref={fileRef} type="file" hidden accept=".txt,.md,.csv,.tsv,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); event.target.value = ''; }} />
        </div>
        <div className="quiz-divider"><span>HOẶC DÁN TRỰC TIẾP</span></div>
        <label className="quiz-source-field"><span>Nội dung câu hỏi <em>{source.length.toLocaleString('vi-VN')} ký tự</em></span><textarea value={source} onChange={(event) => { setSource(event.target.value); if (fileName) setFileName(''); }} placeholder="Câu 1...&#10;A...&#10;B...&#10;C...&#10;Đáp án...&#10;Giải thích..." /></label>
        <div className="quiz-input-actions"><button type="button" onClick={() => { setSource(SAMPLE_QUIZ); setFileName(''); }}>Dùng nội dung mẫu</button><Button icon={loading ? LoaderCircle : Sparkles} className={loading ? 'is-loading' : ''} disabled={loading} onClick={onAnalyze}>{loading ? 'Gemini đang phân tích…' : 'Phân tích bằng Gemini'}</Button></div>
      </main>
      <aside className="quiz-import-aside">
        <div className={`quiz-api-status ${gemini.apiKey ? 'quiz-api-status--ready' : ''}`}><span><Sparkles size={20} /></span><div><strong>{gemini.apiKey ? 'Gemini đã sẵn sàng' : 'Chưa có Gemini API key'}</strong><small>{gemini.apiKey ? `Model: ${gemini.model}` : 'Thêm key trong mục Cài đặt.'}</small></div><i /></div>
        <div className="quiz-guide-card"><span className="quiz-eyebrow">ĐỊNH DẠNG GỢI Ý</span><h3>Mỗi câu nên có</h3><ul><li><Check size={16} /> Nội dung câu hỏi rõ ràng</li><li><Check size={16} /> 3 hoặc 4 phương án</li><li><Check size={16} /> Một đáp án đúng</li><li><Check size={16} /> Lời giải chi tiết</li></ul><p><AlertCircle size={15} /> Gemini sẽ đánh dấu các câu thiếu hoặc mơ hồ để bạn kiểm tra.</p></div>
      </aside>
    </div>
  );
}

function QuizReview({ draft, setDraft, onBack, onSave, saving }) {
  const updateQuestion = (questionId, changes) => setDraft((current) => ({ ...current, questions: current.questions.map((question) => question.id === questionId ? { ...question, ...changes } : question) }));
  const updateOption = (questionId, optionId, text) => setDraft((current) => ({ ...current, questions: current.questions.map((question) => question.id === questionId ? { ...question, options: question.options.map((option) => option.id === optionId ? { ...option, text } : option) } : question) }));
  const removeOption = (questionId, optionId) => setDraft((current) => ({ ...current, questions: current.questions.map((question) => {
    if (question.id !== questionId || question.options.length <= 3) return question;
    const options = question.options.filter((option) => option.id !== optionId);
    return { ...question, options, correctOptionId: question.correctOptionId === optionId ? options[0]?.id || '' : question.correctOptionId };
  }) }));
  const addOption = (questionId) => setDraft((current) => ({ ...current, questions: current.questions.map((question) => question.id === questionId && question.options.length < 4 ? { ...question, options: [...question.options, { id: crypto.randomUUID(), text: '' }] } : question) }));
  const invalidCount = draft.questions.filter((question) => question.needsReview || validateQuizQuestion(question)).length;
  return (
    <div className="quiz-review">
      <section className="quiz-review-summary">
        <div className="quiz-review-title"><label><span>Tên bộ câu hỏi</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label><span>Mô tả ngắn</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label></div>
        <div className="quiz-review-metrics"><span><strong>{draft.questions.length}</strong> câu được nhận diện</span><span className={invalidCount ? 'quiz-review-warning' : 'quiz-review-ready'}><strong>{invalidCount}</strong> câu cần xem kỹ</span></div>
        <ProgressBar value={draft.questions.length - invalidCount} max={draft.questions.length || 1} />
      </section>
      <div className="quiz-section-heading"><div><span className="quiz-eyebrow">KIỂM DUYỆT NỘI DUNG</span><h2>Kiểm tra từng câu hỏi</h2><p>Chọn vòng tròn bên trái phương án để đặt đáp án đúng.</p></div><Button variant="soft" size="sm" icon={Plus} onClick={() => setDraft((current) => ({ ...current, questions: [...current.questions, createEmptyQuizQuestion()] }))}>Thêm câu</Button></div>
      <section className="quiz-review-list">
        {draft.questions.map((question, questionIndex) => {
          const error = validateQuizQuestion(question);
          return (
            <article className={`quiz-review-card ${question.needsReview || error ? 'quiz-review-card--warning' : ''}`} key={question.id}>
              <header><span>Câu {questionIndex + 1}</span>{(question.needsReview || error) && <button type="button" onClick={() => updateQuestion(question.id, { needsReview: false })}><AlertCircle size={15} /> {error || 'Cần kiểm tra'}</button>}<button className="quiz-icon-button quiz-icon-button--danger" type="button" onClick={() => setDraft((current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) }))} aria-label={`Xóa câu ${questionIndex + 1}`}><Trash2 size={17} /></button></header>
              <label className="quiz-review-field"><span>Nội dung câu hỏi *</span><textarea value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} placeholder="Nhập câu hỏi…" /></label>
              <div className="quiz-option-editor"><span>Phương án trả lời và đáp án đúng</span>{question.options.map((option, optionIndex) => <div key={option.id}><button className={question.correctOptionId === option.id ? 'quiz-option-radio--active' : ''} type="button" onClick={() => updateQuestion(question.id, { correctOptionId: option.id, needsReview: false })} aria-label={`Chọn ${String.fromCharCode(65 + optionIndex)} là đáp án đúng`}>{question.correctOptionId === option.id && <Check size={14} />}</button><b>{String.fromCharCode(65 + optionIndex)}</b><input value={option.text} onChange={(event) => updateOption(question.id, option.id, event.target.value)} placeholder={`Phương án ${String.fromCharCode(65 + optionIndex)}`} />{question.options.length > 3 && <button className="quiz-remove-option" type="button" onClick={() => removeOption(question.id, option.id)} aria-label="Xóa phương án"><X size={16} /></button>}</div>)}{question.options.length < 4 && <button className="quiz-add-option" type="button" onClick={() => addOption(question.id)}><Plus size={15} /> Thêm phương án</button>}</div>
              <label className="quiz-review-field quiz-review-field--explanation"><span><Lightbulb size={15} /> Giải thích chi tiết</span><textarea value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} placeholder="Giải thích vì sao đáp án đúng…" /></label>
            </article>
          );
        })}
      </section>
      <footer className="quiz-review-footer"><Button variant="ghost" icon={ArrowLeft} onClick={onBack}>Quay lại nội dung</Button><div><span>{draft.questions.filter((question) => !validateQuizQuestion(question)).length} câu hợp lệ</span><Button icon={saving ? LoaderCircle : CheckCircle2} className={saving ? 'is-loading' : ''} disabled={saving} onClick={onSave}>{saving ? 'Đang tạo…' : 'Tạo bộ câu hỏi'}</Button></div></footer>
    </div>
  );
}

function QuizPractice({ quizSet, questions, currentIndex, setCurrentIndex, answers, setAnswers, checked, setChecked, onFinish, onExit, toast, saving }) {
  const question = questions[currentIndex];
  const selected = answers[question.id] || '';
  const isChecked = checked.has(question.id);
  const correct = selected === question.correctOptionId;
  const checkAnswer = () => {
    if (!selected) { toast('Chưa chọn đáp án', 'Hãy chọn một phương án trước khi kiểm tra.', 'warning'); return; }
    setChecked((current) => new Set([...current, question.id]));
  };
  return (
    <div className="quiz-practice">
      <header className="quiz-practice-header"><div><span className="quiz-eyebrow">ĐANG LÀM BÀI</span><h1>{quizSet.title}</h1><p>Kiểm tra từng câu để xem đáp án và lời giải ngay lập tức.</p></div><button type="button" onClick={onExit}><X size={18} /> Thoát</button></header>
      <div className="quiz-progress-card"><div><span>Câu {currentIndex + 1}/{questions.length}</span><strong>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</strong></div><ProgressBar value={currentIndex + 1} max={questions.length} /></div>
      <main className="quiz-question-card">
        <div className="quiz-question-card__number"><span>Câu hỏi {currentIndex + 1}</span><small>{question.options.length} phương án · Chọn 1 đáp án</small></div>
        <h2>{question.prompt}</h2>
        <div className="quiz-answer-list">
          {question.options.map((option, index) => {
            const isSelected = selected === option.id;
            const isCorrect = isChecked && option.id === question.correctOptionId;
            const isWrong = isChecked && isSelected && !isCorrect;
            return <button className={`${isSelected ? 'quiz-answer--selected' : ''} ${isCorrect ? 'quiz-answer--correct' : ''} ${isWrong ? 'quiz-answer--wrong' : ''}`} disabled={isChecked} type="button" key={option.id} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}><span>{String.fromCharCode(65 + index)}</span><strong>{option.text}</strong><i>{isCorrect ? <CheckCircle2 size={21} /> : isWrong ? <XCircle size={21} /> : isSelected ? <Check size={17} /> : null}</i></button>;
          })}
        </div>
        {!isChecked ? <Button size="lg" icon={CheckCircle2} disabled={!selected} onClick={checkAnswer}>Kiểm tra đáp án</Button> : <div className={`quiz-feedback ${correct ? 'quiz-feedback--correct' : 'quiz-feedback--wrong'}`}><span>{correct ? <CheckCircle2 size={24} /> : <XCircle size={24} />}</span><div><strong>{correct ? 'Chính xác!' : 'Chưa chính xác'}</strong><p>{correct ? 'Bạn đã chọn đúng đáp án.' : `Đáp án đúng là ${String.fromCharCode(65 + question.options.findIndex((option) => option.id === question.correctOptionId))}.`}</p></div></div>}
        {isChecked && <section className="quiz-explanation"><span><Lightbulb size={20} /></span><div><strong>Giải thích chi tiết</strong><p>{question.explanation || 'Câu hỏi này chưa có phần giải thích.'}</p></div></section>}
      </main>
      <footer className="quiz-practice-nav"><Button variant="ghost" icon={ChevronLeft} disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>Câu trước</Button>{currentIndex < questions.length - 1 ? <Button icon={ChevronRight} disabled={!isChecked} onClick={() => setCurrentIndex((index) => index + 1)}>Câu tiếp theo</Button> : <Button icon={saving ? LoaderCircle : Trophy} className={saving ? 'is-loading' : ''} disabled={!isChecked || saving} onClick={onFinish}>{saving ? 'Đang lưu…' : 'Xem kết quả'}</Button>}</footer>
    </div>
  );
}

function QuizResults({ quizSet, questions, answers, attempt, onHome, onRetry, onRetryWrong }) {
  const wrongIds = new Set(attempt.details.filter((detail) => !detail.isCorrect).map((detail) => detail.questionId));
  const tone = attempt.percentage >= 80 ? 'great' : attempt.percentage >= 60 ? 'good' : 'practice';
  return (
    <div className="quiz-results">
      <section className={`quiz-result-hero quiz-result-hero--${tone}`}><div className="quiz-result-score"><strong>{attempt.percentage}%</strong><small>{attempt.correct}/{attempt.total} câu đúng</small></div><div><span className="quiz-eyebrow">HOÀN THÀNH BỘ CÂU HỎI</span><h1>{attempt.percentage >= 80 ? 'Kết quả rất tốt!' : attempt.percentage >= 60 ? 'Bạn đang tiến bộ!' : 'Mỗi lần làm lại là một lần nhớ lâu hơn.'}</h1><p>{quizSet.title}</p><div><Button icon={RotateCcw} onClick={onRetry}>Làm lại toàn bộ</Button>{wrongIds.size > 0 && <Button variant="soft" icon={RefreshCw} onClick={() => onRetryWrong([...wrongIds])}>Làm lại {wrongIds.size} câu sai</Button>}<Button variant="ghost" onClick={onHome}>Về thư viện</Button></div></div></section>
      <section className="quiz-result-stats"><article><CheckCircle2 size={21} /><div><strong>{attempt.correct}</strong><span>Trả lời đúng</span></div></article><article><XCircle size={21} /><div><strong>{attempt.incorrect}</strong><span>Cần xem lại</span></div></article><article><Target size={21} /><div><strong>{attempt.percentage}%</strong><span>Độ chính xác</span></div></article></section>
      <section className="quiz-result-review"><div className="quiz-section-heading"><div><span className="quiz-eyebrow">ĐÁP ÁN VÀ LỜI GIẢI</span><h2>Xem lại từng câu</h2></div></div>{questions.map((question, index) => {
        const selectedId = answers[question.id];
        const isCorrect = selectedId === question.correctOptionId;
        return <article className={isCorrect ? 'quiz-result-item--correct' : 'quiz-result-item--wrong'} key={question.id}><header><span>{isCorrect ? <Check size={16} /> : <X size={16} />}</span><strong>Câu {index + 1}. {question.prompt}</strong></header><div className="quiz-result-answer"><span>Đáp án đúng</span><strong>{question.options.find((option) => option.id === question.correctOptionId)?.text}</strong></div>{!isCorrect && <div className="quiz-result-user-answer"><span>Bạn chọn</span><strong>{question.options.find((option) => option.id === selectedId)?.text || 'Chưa trả lời'}</strong></div>}<p><Lightbulb size={16} /> {question.explanation || 'Chưa có lời giải.'}</p></article>;
      })}</section>
    </div>
  );
}

export default function QuizPage({ quizSets = [], settings = {}, saveQuizSet, deleteQuizSet, toast }) {
  const [stage, setStage] = useState('home');
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeSet, setActiveSet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(new Set());
  const [attempt, setAttempt] = useState(null);

  const goHome = () => { setStage('home'); setActiveSet(null); setAttempt(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startImport = () => { setSource(''); setFileName(''); setDraft(null); setStage('input'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const analyze = async () => {
    if (!source.trim()) { toast('Chưa có nội dung', 'Hãy dán câu hỏi hoặc chọn một file.', 'warning'); return; }
    setLoading(true);
    try {
      const result = await analyzeQuizQuestions(source, settings);
      setDraft(result);
      setStage('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Gemini đã phân tích xong', `Nhận diện được ${result.questions.length} câu hỏi.`);
    } catch (error) { toast('Chưa thể phân tích', error.message, 'error', 8000); } finally { setLoading(false); }
  };
  const saveDraft = async () => {
    if (!draft.title.trim()) { toast('Thiếu tên bộ câu hỏi', 'Hãy đặt tên để dễ tìm lại.', 'warning'); return; }
    const invalid = draft.questions.filter(validateQuizQuestion);
    if (invalid.length) { toast('Còn câu chưa hoàn chỉnh', `Hãy kiểm tra ${invalid.length} câu đang thiếu nội dung, phương án hoặc đáp án đúng.`, 'warning'); return; }
    setSaving(true);
    try {
      const quizSet = createQuizSet(draft, fileName || 'Nội dung dán trực tiếp');
      const saved = await saveQuizSet(quizSet, false);
      toast('Đã tạo bộ câu hỏi', `${saved.questions.length} câu đã được lưu trên thiết bị.`);
      beginPractice(saved, saved.questions, false);
    } catch (error) { toast('Không thể tạo bộ câu hỏi', error.message, 'error'); } finally { setSaving(false); }
  };
  const beginPractice = (quizSet, subset = quizSet.questions, shuffle = true) => {
    setActiveSet(quizSet);
    setQuestions(shuffle ? shuffleQuizQuestions(subset) : [...subset]);
    setCurrentIndex(0);
    setAnswers({});
    setChecked(new Set());
    setAttempt(null);
    setStage('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const finish = async () => {
    setSaving(true);
    try {
      const nextAttempt = buildQuizAttempt({ ...activeSet, questions }, answers);
      const updated = { ...activeSet, attempts: [...(activeSet.attempts || []), nextAttempt] };
      const saved = await saveQuizSet(updated, false);
      setActiveSet(saved);
      setAttempt(nextAttempt);
      setStage('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Đã lưu kết quả', `Bạn đạt ${nextAttempt.percentage}% · ${nextAttempt.correct}/${nextAttempt.total} câu đúng.`);
    } catch (error) { toast('Chưa lưu được kết quả', error.message, 'error'); } finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteQuizSet(deleteTarget.id); toast('Đã xóa bộ câu hỏi', deleteTarget.title, 'info'); setDeleteTarget(null); } catch (error) { toast('Không thể xóa', error.message, 'error'); }
  };

  return (
    <div className="page quiz-page">
      {stage !== 'home' && stage !== 'practice' && stage !== 'results' && <button className="quiz-back" type="button" onClick={stage === 'review' ? () => setStage('input') : goHome}><ArrowLeft size={17} /> {stage === 'review' ? 'Quay lại nội dung' : 'Thư viện bộ câu hỏi'}</button>}
      {stage === 'home' && <QuizHome quizSets={quizSets} onCreate={startImport} onStart={(set) => beginPractice(set)} onDelete={setDeleteTarget} />}
      {stage === 'input' && <><header className="quiz-page-intro"><span className="quiz-eyebrow">TẠO BỘ CÂU HỎI</span><h1>Để Gemini sắp xếp phần thô.</h1><p>Sau bước phân tích, bạn luôn được kiểm tra và sửa từng câu trước khi lưu.</p></header><QuizInput source={source} setSource={setSource} fileName={fileName} setFileName={setFileName} settings={settings} onAnalyze={analyze} loading={loading} toast={toast} /></>}
      {stage === 'review' && draft && <><header className="quiz-page-intro"><span className="quiz-eyebrow">BƯỚC KIỂM DUYỆT</span><h1>Đảm bảo mỗi câu đều chính xác.</h1><p>Gemini hỗ trợ nhận diện; quyết định cuối cùng vẫn nằm trong tay bạn.</p></header><QuizReview draft={draft} setDraft={setDraft} onBack={() => setStage('input')} onSave={saveDraft} saving={saving} /></>}
      {stage === 'practice' && activeSet && questions.length > 0 && <QuizPractice quizSet={activeSet} questions={questions} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} answers={answers} setAnswers={setAnswers} checked={checked} setChecked={setChecked} onFinish={finish} onExit={goHome} toast={toast} saving={saving} />}
      {stage === 'results' && activeSet && attempt && <QuizResults quizSet={activeSet} questions={questions} answers={answers} attempt={attempt} onHome={goHome} onRetry={() => beginPractice(activeSet)} onRetryWrong={(ids) => beginPractice(activeSet, activeSet.questions.filter((question) => ids.includes(question.id)), false)} />}
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Xóa bộ câu hỏi?" eyebrow="XÁC NHẬN" size="sm"><div className="quiz-delete-dialog"><span><Trash2 size={25} /></span><p>Bộ <strong>“{deleteTarget?.title}”</strong> và toàn bộ lịch sử làm bài sẽ bị xóa khỏi thiết bị.</p><div><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Giữ lại</Button><Button variant="danger" icon={Trash2} onClick={confirmDelete}>Xóa bộ đề</Button></div></div></Modal>
    </div>
  );
}
