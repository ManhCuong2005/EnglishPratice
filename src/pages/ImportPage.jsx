import {
  AlertCircle, ArrowLeft, ArrowRight, Check, FileText, LoaderCircle, Plus, Sparkles, Trash2, UploadCloud, WandSparkles, X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button, ProgressBar } from '../components/Common.jsx';
import { analyzeVocabulary, getGeminiConfig, parseLocally } from '../lib/gemini.js';

const sampleInput = `abandon | từ bỏ, ruồng bỏ
breakthrough | bước đột phá
come up with | nghĩ ra, nảy ra ý tưởng
determined | quyết tâm
make progress | tiến bộ
overcome | vượt qua khó khăn`;

const emptyWord = () => ({
  id: crypto.randomUUID(), term: '', meaning: '', pronunciation: '', partOfSpeech: 'other',
  englishMeaning: '', example: '', exampleMeaning: '', level: 'A2', tags: [], note: '', needsReview: true,
});

export default function ImportPage({ settings, saveSet, navigate, toast }) {
  const [step, setStep] = useState('input');
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const gemini = getGeminiConfig(settings);

  const reviewCount = useMemo(() => result?.words.filter((word) => word.needsReview || !word.term || !word.meaning).length || 0, [result]);

  const readFile = async (file) => {
    const allowed = ['.txt', '.md', '.csv', '.tsv', '.json'];
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!allowed.includes(extension)) {
      toast('Định dạng chưa hỗ trợ', 'Hãy chọn file TXT, MD, CSV, TSV hoặc JSON.', 'warning');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast('File quá lớn', 'Kích thước tối đa cho mỗi lần nhập là 3 MB.', 'warning');
      return;
    }
    try {
      const text = await file.text();
      setSource(text);
      setFileName(file.name);
      toast('Đã đọc file', `${file.name} · ${Math.max(1, text.split(/\r?\n/).length)} dòng`, 'success');
    } catch (_error) {
      toast('Không đọc được file', 'Hãy kiểm tra lại file và thử lần nữa.', 'error');
    }
  };

  const runAnalysis = async (useAI) => {
    if (!source.trim()) {
      toast('Chưa có nội dung', 'Hãy dán danh sách từ hoặc chọn một file.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = useAI ? await analyzeVocabulary(source, settings) : parseLocally(source);
      setResult(data);
      setStep('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast(useAI ? 'Gemini đã xử lý xong' : 'Đã tách dữ liệu cục bộ', `Tìm thấy ${data.words.length} mục từ vựng.`);
    } catch (error) {
      toast('Chưa thể phân tích', error.message, 'error', 7000);
    } finally {
      setLoading(false);
    }
  };

  const updateWord = (id, field, value) => {
    setResult((current) => ({
      ...current,
      words: current.words.map((word) => word.id === id
        ? { ...word, [field]: value, needsReview: field === 'term' || field === 'meaning' ? !String(value).trim() : word.needsReview }
        : word),
    }));
  };

  const removeWord = (id) => setResult((current) => ({ ...current, words: current.words.filter((word) => word.id !== id) }));

  const createSet = async () => {
    const validWords = result.words.filter((word) => word.term.trim() && word.meaning.trim());
    if (!result.title.trim()) {
      toast('Thiếu tên bộ từ', 'Hãy đặt tên để dễ tìm lại sau này.', 'warning');
      return;
    }
    if (!validWords.length) {
      toast('Chưa có từ hợp lệ', 'Mỗi mục cần có cả từ tiếng Anh và nghĩa tiếng Việt.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const icons = ['🌿', '🌏', '💡', '📚', '🚀', '🎯', '☕', '✨'];
      const colors = ['violet', 'green', 'orange', 'blue', 'rose'];
      const saved = await saveSet({
        id: crypto.randomUUID(),
        title: result.title.trim(),
        description: result.description.trim(),
        icon: icons[Math.floor(Math.random() * icons.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        source: fileName || 'Nội dung dán trực tiếp',
        words: validWords.map((word) => ({ ...word, term: word.term.trim(), meaning: word.meaning.trim() })),
        progress: {},
        stats: { sessions: 0, totalAnswered: 0, totalCorrect: 0, lastStudiedAt: null },
      });
      setStep('done');
      window.setTimeout(() => navigate(`set/${saved.id}`), 650);
    } catch (error) {
      toast('Không lưu được bộ từ', error.message, 'error');
      setSaving(false);
    }
  };

  return (
    <div className="page import-page">
      <header className="page-header import-header">
        <div><span className="eyebrow">AI VOCAB BUILDER</span><h1>Tạo bộ từ thông minh</h1><p>Đưa nội dung thô vào, Gemini sẽ biến nó thành tài liệu học có cấu trúc.</p></div>
        <div className="stepper" aria-label="Tiến trình tạo bộ từ">
          <span className={step === 'input' ? 'active' : 'done'}><i>{step === 'input' ? '1' : <Check size={14} />}</i> Nhập nội dung</span>
          <b />
          <span className={step === 'review' ? 'active' : step === 'done' ? 'done' : ''}><i>{step === 'done' ? <Check size={14} /> : '2'}</i> Kiểm tra</span>
          <b />
          <span className={step === 'done' ? 'active' : ''}><i>3</i> Hoàn tất</span>
        </div>
      </header>

      {step === 'input' && (
        <div className="import-layout">
          <section className="panel import-main">
            <div className="input-tabs"><button className="active"><FileText size={17} /> Dán nội dung hoặc tải file</button></div>
            <div
              className={`drop-zone ${dragging ? 'drop-zone--active' : ''} ${fileName ? 'drop-zone--has-file' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) readFile(event.dataTransfer.files[0]); }}
            >
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.tsv,.json" onChange={(event) => event.target.files[0] && readFile(event.target.files[0])} hidden />
              {fileName ? (
                <div className="selected-file"><span><FileText size={22} /></span><div><strong>{fileName}</strong><small>{source.length.toLocaleString('vi-VN')} ký tự đã đọc</small></div><button onClick={() => { setFileName(''); setSource(''); }} aria-label="Gỡ file"><X size={18} /></button></div>
              ) : (
                <><span className="drop-zone__icon"><UploadCloud size={27} /></span><strong>Thả file vào đây</strong><p>hoặc <button onClick={() => fileRef.current?.click()}>chọn từ máy tính</button></p><small>TXT, MD, CSV, TSV, JSON · tối đa 3 MB</small></>
              )}
            </div>

            <div className="divider"><span>hoặc dán trực tiếp</span></div>
            <label className="field-label" htmlFor="raw-vocab">Nội dung từ vựng <span>{source.length.toLocaleString('vi-VN')} / 120.000</span></label>
            <textarea
              id="raw-vocab"
              className="raw-textarea"
              value={source}
              maxLength={120000}
              onChange={(event) => { setSource(event.target.value); if (fileName) setFileName(''); }}
              placeholder={'Mỗi dòng có thể ở bất kỳ dạng nào, ví dụ:\nresilient - kiên cường\nmake up one’s mind | quyết định\n…'}
            />
            <div className="textarea-footer"><button className="text-link" onClick={() => { setSource(sampleInput); setFileName(''); }}>Dùng nội dung mẫu</button><span>Gemini sẽ giữ nghĩa Việt có sẵn và bổ sung thông tin học tập.</span></div>

            <div className="import-actions">
              <Button variant="soft" onClick={() => runAnalysis(false)} disabled={loading || !source.trim()}>Tách nhanh không AI</Button>
              <Button icon={loading ? LoaderCircle : WandSparkles} className={loading ? 'is-loading' : ''} onClick={() => runAnalysis(true)} disabled={loading || !source.trim()}>{loading ? 'Gemini đang phân tích…' : 'Phân tích bằng Gemini'}</Button>
            </div>
          </section>

          <aside className="import-aside">
            <div className={`api-card ${gemini.apiKey ? 'api-card--ready' : ''}`}>
              <span className="api-card__icon"><Sparkles size={20} /></span>
              <div><strong>{gemini.apiKey ? 'Gemini đã sẵn sàng' : 'Chưa có Gemini API key'}</strong><p>{gemini.apiKey ? `Model: ${gemini.model}` : 'Thêm key trong .env.local hoặc Cài đặt.'}</p></div>
              <i />
            </div>
            <div className="guide-card">
              <span className="eyebrow">ĐỂ CÓ KẾT QUẢ TỐT</span>
              <h3>Dữ liệu nguồn nên có</h3>
              <ul><li><Check size={15} /> Mỗi từ tiếng Anh có nghĩa Việt</li><li><Check size={15} /> Một mục trên mỗi dòng</li><li><Check size={15} /> Giữ nguyên ngữ cảnh nếu có</li></ul>
              <div className="format-example"><code>take part in | tham gia</code><code>reliable - đáng tin cậy</code></div>
            </div>
            <div className="privacy-note"><AlertCircle size={17} /><p>Nội dung chỉ được gửi tới Gemini khi bạn nhấn phân tích. Bộ từ sau đó được lưu trên thiết bị này.</p></div>
          </aside>
        </div>
      )}

      {step === 'review' && result && (
        <div className="review-wrap">
          <section className="panel review-summary">
            <div className="review-title-fields">
              <label><span>Tên bộ từ</span><input value={result.title} onChange={(event) => setResult({ ...result, title: event.target.value })} /></label>
              <label><span>Mô tả ngắn</span><input value={result.description} onChange={(event) => setResult({ ...result, description: event.target.value })} /></label>
            </div>
            <div className="review-metrics"><span><strong>{result.words.length}</strong> từ được nhận diện</span><span className={reviewCount ? 'warning' : 'success'}><strong>{reviewCount}</strong> mục cần xem kỹ</span></div>
            <ProgressBar value={result.words.length - reviewCount} max={result.words.length || 1} />
          </section>

          <div className="review-heading"><div><h2>Kiểm tra từ vựng</h2><p>Bạn có thể sửa mọi trường trước khi tạo bộ từ.</p></div><Button variant="soft" icon={Plus} onClick={() => setResult((current) => ({ ...current, words: [...current.words, emptyWord()] }))}>Thêm từ</Button></div>

          <section className="word-review-list">
            {result.words.map((word, index) => (
              <article className={`word-review-card ${word.needsReview ? 'word-review-card--warning' : ''}`} key={word.id}>
                <div className="word-review-card__number">{index + 1}</div>
                <div className="word-review-card__fields">
                  <label className="field-term"><span>Tiếng Anh *</span><input value={word.term} onChange={(event) => updateWord(word.id, 'term', event.target.value)} placeholder="English word" /></label>
                  <label className="field-meaning"><span>Nghĩa tiếng Việt *</span><input value={word.meaning} onChange={(event) => updateWord(word.id, 'meaning', event.target.value)} placeholder="Nghĩa tiếng Việt" /></label>
                  <label><span>Định nghĩa tiếng Anh</span><input value={word.englishMeaning || ''} onChange={(event) => updateWord(word.id, 'englishMeaning', event.target.value)} placeholder="A simple English definition…" /></label>
                  <label><span>Phiên âm</span><input value={word.pronunciation} onChange={(event) => updateWord(word.id, 'pronunciation', event.target.value)} placeholder="/…/" /></label>
                  <label><span>Loại từ</span><select value={word.partOfSpeech} onChange={(event) => updateWord(word.id, 'partOfSpeech', event.target.value)}><option value="noun">Danh từ</option><option value="verb">Động từ</option><option value="adjective">Tính từ</option><option value="adverb">Trạng từ</option><option value="phrase">Cụm từ</option><option value="other">Khác</option></select></label>
                  <label><span>Trình độ</span><select value={word.level} onChange={(event) => updateWord(word.id, 'level', event.target.value)}>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => <option key={level}>{level}</option>)}</select></label>
                  <label className="field-example"><span>Câu ví dụ</span><input value={word.example} onChange={(event) => updateWord(word.id, 'example', event.target.value)} placeholder="A natural example sentence…" /></label>
                  <label className="field-example"><span>Dịch câu ví dụ</span><input value={word.exampleMeaning} onChange={(event) => updateWord(word.id, 'exampleMeaning', event.target.value)} placeholder="Bản dịch câu ví dụ…" /></label>
                </div>
                <div className="word-review-card__actions">
                  {word.needsReview && <button className="review-warning" onClick={() => updateWord(word.id, 'needsReview', false)} title="Đánh dấu đã kiểm tra"><AlertCircle size={17} /> Cần kiểm tra</button>}
                  <button className="icon-button icon-button--danger" onClick={() => removeWord(word.id)} aria-label="Xóa từ"><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </section>

          <footer className="review-footer">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep('input')}>Quay lại nội dung</Button>
            <div><span>{result.words.filter((word) => word.term && word.meaning).length} từ hợp lệ</span><Button icon={saving ? LoaderCircle : ArrowRight} className={saving ? 'is-loading' : ''} disabled={saving} onClick={createSet}>{saving ? 'Đang tạo…' : 'Tạo bộ từ'}</Button></div>
          </footer>
        </div>
      )}

      {step === 'done' && (
        <div className="creation-success"><span><Check size={34} /></span><h2>Bộ từ đã nở rộ!</h2><p>Đang đưa bạn tới không gian học…</p></div>
      )}
    </div>
  );
}
