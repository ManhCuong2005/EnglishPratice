import {
  ArrowLeft, ArrowRight, Brain, Check, CheckCircle2, Gamepad2, Headphones, Keyboard, Layers3, Lightbulb, RefreshCw, RotateCcw, Sparkles, Trophy, Volume2, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState, ProgressBar } from '../components/Common.jsx';
import { normalizeAnswer, REVIEW_RATINGS, shuffle, speakEnglish } from '../lib/learning.js';

const modes = [
  { id: 'flashcard', label: 'Flashcard', icon: Layers3, description: 'Lật thẻ và tự đánh giá khả năng nhớ.' },
  { id: 'quiz', label: 'Trắc nghiệm', icon: Gamepad2, description: 'Chọn đúng nghĩa trong bốn đáp án.' },
  { id: 'typing', label: 'Gõ đáp án', icon: Keyboard, description: 'Nhìn nghĩa và chủ động nhớ từ tiếng Anh.' },
  { id: 'matching', label: 'Ghép cặp', icon: Brain, description: 'Kết nối từ với nghĩa tương ứng.' },
];

function SessionResult({ result, set, navigate, onRestart }) {
  const accuracy = result.answered ? Math.round(result.correct / result.answered * 100) : 0;
  return (
    <div className="study-result">
      <div className="result-celebration"><span><Trophy size={38} /></span><i /><i /><i /></div>
      <span className="eyebrow">HOÀN THÀNH PHIÊN HỌC</span>
      <h1>{accuracy >= 80 ? 'Tuyệt vời, bạn làm rất tốt!' : accuracy >= 50 ? 'Tiến bộ từng chút một!' : 'Mỗi lỗi sai là một bước tiến!'}</h1>
      <p>Tiến độ đã được lưu tự động vào “{set.title}”.</p>
      <div className="result-stats">
        <div><strong>{result.correct}</strong><span>Trả lời đúng</span></div>
        <div><strong>{accuracy}%</strong><span>Độ chính xác</span></div>
        <div><strong>{Math.max(1, Math.round(result.durationSeconds / 60))}</strong><span>Phút tập trung</span></div>
      </div>
      <div className="result-actions"><Button variant="soft" icon={ArrowLeft} onClick={() => navigate(`set/${set.id}`)}>Về bộ từ</Button><Button icon={RefreshCw} onClick={onRestart}>Học lại</Button></div>
    </div>
  );
}

function StudyHub({ set, navigate }) {
  return (
    <div className="study-hub">
      <span className="eyebrow">CHỌN CHẾ ĐỘ HỌC</span><h1>Học “{set.title}”</h1><p>Chọn một hoạt động phù hợp với năng lượng của bạn lúc này.</p>
      <div className="study-hub-grid">{modes.map(({ id, label, icon: Icon, description }) => <button key={id} onClick={() => navigate(`study/${set.id}/${id}`)}><span><Icon /></span><strong>{label}</strong><p>{description}</p><em>Bắt đầu <ArrowRight size={15} /></em></button>)}</div>
    </div>
  );
}

function Flashcards({ words, onReview, onFinish, settings }) {
  const [deck] = useState(() => shuffle(words));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const lastAutoSpokenWord = useRef(null);
  const word = deck[index];

  useEffect(() => {
    if (!settings.autoSpeak || !word || lastAutoSpokenWord.current === word.id) return;
    lastAutoSpokenWord.current = word.id;
    speakEnglish(word.term);
  }, [word, settings.autoSpeak]);

  const rate = async (rating) => {
    await onReview(word.id, rating);
    const nextAnswered = answered + 1;
    const nextCorrect = correct + (rating === 'again' ? 0 : 1);
    setAnswered(nextAnswered);
    setCorrect(nextCorrect);
    if (index >= deck.length - 1) onFinish(nextAnswered, nextCorrect);
    else { setIndex((value) => value + 1); setFlipped(false); }
  };

  useEffect(() => {
    const keyboard = (event) => {
      if (event.code === 'Space') { event.preventDefault(); setFlipped((value) => !value); }
      if (flipped && ['1', '2', '3', '4'].includes(event.key)) rate(['again', 'hard', 'good', 'easy'][Number(event.key) - 1]);
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  return (
    <div className="flashcard-mode">
      <div className="study-progress"><span>Thẻ {index + 1} / {deck.length}</span><ProgressBar value={index} max={deck.length} compact /><strong>{Math.round(index / deck.length * 100)}%</strong></div>
      <div
        className={`flashcard ${flipped ? 'flashcard--flipped' : ''}`}
        role="button"
        tabIndex="0"
        onClick={() => setFlipped((value) => !value)}
        onKeyDown={(event) => event.key === 'Enter' && setFlipped((value) => !value)}
      >
        <div className="flashcard__inner">
          <div className="flashcard__face flashcard__front">
            <span className="card-label">TIẾNG ANH</span>
            <button className="speak-button" onClick={(event) => { event.stopPropagation(); speakEnglish(word.term); }}><Volume2 size={21} /></button>
            <div><h2>{word.term}</h2><p>{word.pronunciation}</p><span className="level-badge">{word.level}</span></div>
            <small>Nhấn vào thẻ hoặc phím Space để xem nghĩa</small>
          </div>
          <div className="flashcard__face flashcard__back">
            <span className="card-label">NGHĨA TIẾNG VIỆT</span>
            <div><h2>{word.meaning}</h2>{word.example && <blockquote><p>{word.example}</p><small>{word.exampleMeaning}</small></blockquote>}{word.note && <p className="word-note"><Lightbulb size={15} />{word.note}</p>}</div>
            <small>Bạn nhớ từ này tốt đến đâu?</small>
          </div>
        </div>
      </div>
      {flipped ? <div className="rating-grid">{Object.entries(REVIEW_RATINGS).map(([id, item], ratingIndex) => <button key={id} className={`rating rating--${id}`} onClick={() => rate(id)}><strong>{item.label}</strong><span>{item.short}</span><kbd>{ratingIndex + 1}</kbd></button>)}</div> : <Button variant="soft" onClick={() => setFlipped(true)}>Hiện đáp án</Button>}
    </div>
  );
}

function Quiz({ words, onReview, onFinish }) {
  const [questions] = useState(() => shuffle(words).slice(0, 20).map((word) => {
    const distractors = shuffle(words.filter((item) => item.id !== word.id && item.meaning !== word.meaning)).slice(0, 3);
    return { word, options: shuffle([word, ...distractors]) };
  }));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const question = questions[index];

  const choose = async (option) => {
    if (selected) return;
    setSelected(option.id);
    const isCorrect = option.id === question.word.id;
    if (isCorrect) setCorrect((value) => value + 1);
    await onReview(question.word.id, isCorrect ? 'good' : 'again');
  };

  const next = () => {
    const nextCorrect = correct;
    if (index >= questions.length - 1) onFinish(questions.length, nextCorrect);
    else { setIndex((value) => value + 1); setSelected(null); }
  };

  return (
    <div className="quiz-mode">
      <div className="study-progress"><span>Câu {index + 1} / {questions.length}</span><ProgressBar value={index} max={questions.length} compact /><strong>{correct} đúng</strong></div>
      <section className="question-card">
        <span className="card-label">CHỌN NGHĨA ĐÚNG</span>
        <button className="speak-button" onClick={() => speakEnglish(question.word.term)}><Volume2 size={21} /></button>
        <h2>{question.word.term}</h2><p>{question.word.pronunciation}</p>
      </section>
      <div className="answer-grid">{question.options.map((option, optionIndex) => {
        const state = selected ? (option.id === question.word.id ? 'correct' : option.id === selected ? 'wrong' : 'muted') : '';
        return <button className={state} key={option.id} onClick={() => choose(option)}><i>{String.fromCharCode(65 + optionIndex)}</i><span>{option.meaning}</span>{state === 'correct' && <Check size={19} />}{state === 'wrong' && <X size={19} />}</button>;
      })}</div>
      {selected && <div className={`answer-feedback ${selected === question.word.id ? 'correct' : 'wrong'}`}><span>{selected === question.word.id ? <CheckCircle2 /> : <RotateCcw />}</span><div><strong>{selected === question.word.id ? 'Chính xác!' : 'Chưa đúng, ghi nhớ nhé!'}</strong><p>{question.word.term} — {question.word.meaning}</p></div><Button onClick={next}>Tiếp theo <ArrowRight size={16} /></Button></div>}
    </div>
  );
}

function Typing({ words, onReview, onFinish }) {
  const [questions] = useState(() => shuffle(words).slice(0, 20));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const inputRef = useRef(null);
  const word = questions[index];

  const check = async () => {
    if (!answer.trim() || checked !== null) return;
    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(word.term);
    setChecked(isCorrect);
    if (isCorrect) setCorrect((value) => value + 1);
    await onReview(word.id, isCorrect ? 'good' : 'again');
  };
  const next = () => {
    if (index >= questions.length - 1) onFinish(questions.length, correct);
    else { setIndex((value) => value + 1); setAnswer(''); setChecked(null); window.setTimeout(() => inputRef.current?.focus(), 50); }
  };

  return (
    <div className="typing-mode">
      <div className="study-progress"><span>Câu {index + 1} / {questions.length}</span><ProgressBar value={index} max={questions.length} compact /><strong>{correct} đúng</strong></div>
      <section className="typing-card">
        <span className="card-label">GÕ TỪ TIẾNG ANH</span><p>Nghĩa của từ là</p><h2>{word.meaning}</h2>
        {word.example && <blockquote>{word.example.replace(new RegExp(word.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '_____')}</blockquote>}
        <div className={`typing-input ${checked === true ? 'correct' : checked === false ? 'wrong' : ''}`}><input ref={inputRef} autoFocus value={answer} disabled={checked !== null} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') checked === null ? check() : next(); }} placeholder="Nhập từ tiếng Anh…" autoComplete="off" spellCheck="false" />{checked === true && <Check />}{checked === false && <X />}</div>
        {checked === false && <p className="correct-answer">Đáp án đúng: <strong>{word.term}</strong> <button onClick={() => speakEnglish(word.term)}><Volume2 size={16} /></button></p>}
        <Button onClick={checked === null ? check : next} disabled={!answer.trim()}>{checked === null ? 'Kiểm tra' : index === questions.length - 1 ? 'Xem kết quả' : 'Tiếp theo'}</Button>
      </section>
    </div>
  );
}

function Matching({ words, onReview, onFinish }) {
  const [batches] = useState(() => {
    const deck = shuffle(words);
    const output = [];
    for (let i = 0; i < deck.length; i += 6) output.push(deck.slice(i, i + 6));
    return output;
  });
  const [batchIndex, setBatchIndex] = useState(0);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [selectedMeaning, setSelectedMeaning] = useState(null);
  const [matched, setMatched] = useState([]);
  const [shakeIds, setShakeIds] = useState([]);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const batch = batches[batchIndex];
  const meanings = useMemo(() => shuffle(batch), [batch]);

  useEffect(() => {
    if (!selectedTerm || !selectedMeaning) return;
    const isMatch = selectedTerm === selectedMeaning;
    const word = batch.find((item) => item.id === selectedTerm);
    setAnswered((value) => value + 1);
    if (isMatch) {
      setMatched((current) => [...current, selectedTerm]);
      setCorrect((value) => value + 1);
      onReview(word.id, 'good');
    } else {
      setShakeIds([selectedTerm, selectedMeaning]);
      onReview(word.id, 'again');
      window.setTimeout(() => setShakeIds([]), 450);
    }
    window.setTimeout(() => { setSelectedTerm(null); setSelectedMeaning(null); }, isMatch ? 220 : 480);
  }, [selectedTerm, selectedMeaning, batch, onReview]);

  const nextBatch = () => {
    if (batchIndex >= batches.length - 1) onFinish(answered, correct);
    else { setBatchIndex((value) => value + 1); setSelectedTerm(null); setSelectedMeaning(null); setMatched([]); }
  };

  return (
    <div className="matching-mode">
      <div className="study-progress"><span>Vòng {batchIndex + 1} / {batches.length}</span><ProgressBar value={batchIndex} max={batches.length} compact /><strong>{correct} cặp đúng</strong></div>
      <div className="matching-instruction"><Brain size={22} /><div><strong>Ghép từ với nghĩa tương ứng</strong><p>Chọn một ô ở mỗi cột để tạo thành một cặp.</p></div></div>
      <div className="matching-board">
        <div><span className="card-label">TIẾNG ANH</span>{batch.map((word) => <button key={word.id} disabled={matched.includes(word.id)} className={`${selectedTerm === word.id ? 'selected' : ''} ${matched.includes(word.id) ? 'matched' : ''} ${shakeIds.includes(word.id) ? 'shake' : ''}`} onClick={() => setSelectedTerm(word.id)}>{word.term}{matched.includes(word.id) && <Check size={17} />}</button>)}</div>
        <div><span className="card-label">TIẾNG VIỆT</span>{meanings.map((word) => <button key={word.id} disabled={matched.includes(word.id)} className={`${selectedMeaning === word.id ? 'selected' : ''} ${matched.includes(word.id) ? 'matched' : ''} ${shakeIds.includes(word.id) ? 'shake' : ''}`} onClick={() => setSelectedMeaning(word.id)}>{word.meaning}{matched.includes(word.id) && <Check size={17} />}</button>)}</div>
      </div>
      {matched.length === batch.length && <div className="round-complete"><CheckCircle2 size={22} /><span>Bạn đã ghép xong vòng này!</span><Button size="sm" onClick={nextBatch}>{batchIndex === batches.length - 1 ? 'Xem kết quả' : 'Vòng tiếp theo'}</Button></div>}
    </div>
  );
}

export default function StudyPage({ set, initialMode, onReview, onComplete, settings, navigate }) {
  const validMode = modes.some((item) => item.id === initialMode) ? initialMode : null;
  const [result, setResult] = useState(null);
  const [run, setRun] = useState(0);
  const startedAt = useRef(Date.now());
  const setId = set?.id;
  const review = useCallback((wordId, rating) => {
    if (setId) return onReview(setId, wordId, rating);
    return undefined;
  }, [onReview, setId]);

  useEffect(() => { setResult(null); startedAt.current = Date.now(); }, [initialMode, run]);

  if (!set) return <div className="page"><EmptyState title="Không tìm thấy bộ từ" description="Hãy quay về thư viện và chọn một bộ từ khác." action={<Button onClick={() => navigate('library')}>Về thư viện</Button>} /></div>;
  if (!set.words.length) return <div className="page"><EmptyState title="Bộ từ đang trống" description="Thêm ít nhất một từ trước khi bắt đầu học." action={<Button onClick={() => navigate(`set/${set.id}`)}>Thêm từ</Button>} /></div>;
  if (!validMode) return <div className="page"><StudyHub set={set} navigate={navigate} /></div>;

  const dueWords = set.words.filter((word) => {
    const progress = set.progress?.[word.id];
    return !progress?.nextReviewAt || new Date(progress.nextReviewAt) <= new Date();
  });
  const studyWords = dueWords.length ? dueWords : set.words;
  const modeInfo = modes.find((item) => item.id === validMode);

  const finish = async (answered, correct) => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const nextResult = { answered, correct, durationSeconds };
    setResult(nextResult);
    await onComplete({ setId: set.id, mode: validMode, ...nextResult });
  };
  return (
    <div className="page study-page">
      {!result && <header className="study-header"><div><span className="eyebrow">{set.title}</span><h1>{modeInfo.label}</h1></div><div className="study-mode-switch">{modes.map(({ id, icon: Icon, label }) => <button key={id} className={validMode === id ? 'active' : ''} onClick={() => navigate(`study/${set.id}/${id}`)} title={label}><Icon size={18} /><span>{label}</span></button>)}</div></header>}
      {result ? <SessionResult result={result} set={set} navigate={navigate} onRestart={() => { setResult(null); setRun((value) => value + 1); startedAt.current = Date.now(); }} /> : (
        <>
          {validMode === 'flashcard' && <Flashcards key={run} words={studyWords} onReview={review} onFinish={finish} settings={settings} />}
          {validMode === 'quiz' && <Quiz key={run} words={studyWords} onReview={review} onFinish={finish} />}
          {validMode === 'typing' && <Typing key={run} words={studyWords} onReview={review} onFinish={finish} />}
          {validMode === 'matching' && <Matching key={run} words={studyWords} onReview={review} onFinish={finish} />}
        </>
      )}
    </div>
  );
}
