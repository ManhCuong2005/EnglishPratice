import {
  BarChart3, BookOpen, Brain, CheckCircle2, Edit3, Gamepad2, Headphones, Keyboard, Layers3, MoreHorizontal, Plus, Search, Sparkles, Trash2, Volume2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, ConfirmDialog, EmptyState, Modal, ProgressBar } from '../components/Common.jsx';
import { getSetMetrics, isDue, speakEnglish } from '../lib/learning.js';

const partLabels = { noun: 'danh từ', verb: 'động từ', adjective: 'tính từ', adverb: 'trạng từ', phrase: 'cụm từ', other: 'khác' };
const blankWord = () => ({ id: crypto.randomUUID(), term: '', meaning: '', englishMeaning: '', pronunciation: '', partOfSpeech: 'other', example: '', exampleMeaning: '', level: 'A2', tags: [], note: '', needsReview: false });

export default function SetDetail({ set, saveSet, deleteSet, navigate }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingWord, setEditingWord] = useState(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoDraft, setInfoDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const metrics = getSetMetrics(set);
  const filteredWords = useMemo(() => {
    if (!set) return [];
    const normalized = query.toLocaleLowerCase('vi').trim();
    return set.words.filter((word) => {
      const progress = set.progress?.[word.id];
      const matchesQuery = !normalized || word.term.toLocaleLowerCase('en').includes(normalized) || word.meaning.toLocaleLowerCase('vi').includes(normalized);
      const matchesFilter = filter === 'all'
        || (filter === 'due' && isDue(progress))
        || (filter === 'mastered' && progress?.mastered)
        || (filter === 'learning' && progress?.lastReviewedAt && !progress.mastered)
        || (filter === 'new' && !progress?.lastReviewedAt);
      return matchesQuery && matchesFilter;
    });
  }, [set, query, filter]);

  if (!set) {
    return <div className="page"><EmptyState icon={BookOpen} title="Không tìm thấy bộ từ" description="Bộ từ này có thể đã bị xóa hoặc không tồn tại." action={<Button onClick={() => navigate('library')}>Về thư viện</Button>} /></div>;
  }

  const saveWord = async () => {
    if (!editingWord.term.trim() || !editingWord.meaning.trim()) return;
    const exists = set.words.some((word) => word.id === editingWord.id);
    await saveSet({ ...set, words: exists ? set.words.map((word) => word.id === editingWord.id ? editingWord : word) : [...set.words, editingWord] });
    setEditingWord(null);
  };

  const removeWord = async (id) => {
    const progress = { ...(set.progress || {}) };
    delete progress[id];
    await saveSet({ ...set, words: set.words.filter((word) => word.id !== id), progress });
  };

  const openInfo = () => {
    setInfoDraft({ title: set.title, description: set.description || '', icon: set.icon || '📚', color: set.color || 'violet' });
    setEditingInfo(true);
  };

  const studyModes = [
    { id: 'flashcard', icon: Layers3, title: 'Flashcard', description: 'Lật thẻ và tự đánh giá', color: 'violet' },
    { id: 'quiz', icon: Gamepad2, title: 'Trắc nghiệm', description: 'Chọn nghĩa chính xác', color: 'green' },
    { id: 'typing', icon: Keyboard, title: 'Gõ đáp án', description: 'Nhớ chủ động từ vựng', color: 'orange' },
    { id: 'meaning-listen', icon: Headphones, title: 'Nghe & viết nghĩa', description: 'Nghe rồi tự viết nghĩa', color: 'blue' },
    { id: 'matching', icon: Brain, title: 'Ghép cặp', description: 'Nối từ với đúng nghĩa', color: 'blue' },
  ];

  return (
    <div className="page set-page">
      <section className={`set-hero set-hero--${set.color || 'violet'}`}>
        <div className="set-hero__main">
          <span className={`collection-icon collection-icon--${set.color || 'violet'} collection-icon--large`}>{set.icon || '📚'}</span>
          <div><span className="eyebrow">BỘ TỪ CỦA BẠN</span><h1>{set.title}</h1><p>{set.description || 'Bộ từ vựng của bạn'}</p><small>{set.words.length} từ · Cập nhật {new Date(set.updatedAt).toLocaleDateString('vi-VN')}</small></div>
        </div>
        <div className="set-hero__actions"><Button variant="soft" icon={Edit3} onClick={openInfo}>Chỉnh sửa</Button><button className="icon-button" onClick={() => setConfirmDelete(true)} title="Xóa bộ từ"><Trash2 size={18} /></button></div>
      </section>

      <section className="set-stats">
        <div><span><BookOpen size={18} /></span><p><strong>{metrics.total}</strong>Tổng số từ</p></div>
        <div><span><Sparkles size={18} /></span><p><strong>{metrics.due}</strong>Cần ôn hôm nay</p></div>
        <div><span><Brain size={18} /></span><p><strong>{metrics.learning}</strong>Đang học</p></div>
        <div><span><CheckCircle2 size={18} /></span><p><strong>{metrics.mastered}</strong>Đã ghi nhớ</p></div>
        <div className="set-stats__progress"><p><span>Tiến độ tổng thể</span><strong>{metrics.total ? Math.round(metrics.mastered / metrics.total * 100) : 0}%</strong></p><ProgressBar value={metrics.mastered} max={metrics.total || 1} compact /></div>
      </section>

      <section className="study-mode-section">
        <div className="section-heading"><div><span className="eyebrow">CHỌN CÁCH HỌC</span><h2>Hôm nay bạn muốn học thế nào?</h2></div><Button onClick={() => navigate(`study/${set.id}/flashcard`)} icon={Sparkles}>Ôn thông minh</Button></div>
        <div className="study-mode-grid">
          {studyModes.map(({ id, icon: Icon, title, description, color }) => (
            <button className={`study-mode-card study-mode-card--${color}`} key={id} onClick={() => navigate(`study/${set.id}/${id}`)}>
              <span><Icon size={22} /></span><div><strong>{title}</strong><small>{description}</small></div><MoreHorizontal size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="words-section">
        <div className="section-heading words-heading"><div><span className="eyebrow">DANH SÁCH TỪ</span><h2>Khám phá {set.words.length} từ vựng</h2></div><Button variant="soft" icon={Plus} onClick={() => setEditingWord(blankWord())}>Thêm từ</Button></div>
        <div className="words-toolbar">
          <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm từ hoặc nghĩa…" /></label>
          <div className="filter-pills">
            {[['all', 'Tất cả'], ['due', 'Cần ôn'], ['new', 'Từ mới'], ['learning', 'Đang học'], ['mastered', 'Đã thuộc']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}
          </div>
        </div>

        {filteredWords.length ? (
          <div className="word-table-wrap">
            <table className="word-table">
              <thead><tr><th>Từ vựng</th><th>Nghĩa tiếng Việt</th><th>Ví dụ</th><th>Trình độ</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {filteredWords.map((word) => {
                  const progress = set.progress?.[word.id];
                  const status = progress?.mastered ? 'mastered' : progress?.lastReviewedAt ? 'learning' : 'new';
                  return (
                    <tr key={word.id}>
                      <td><div className="term-cell"><button onClick={() => speakEnglish(word.term)} aria-label={`Phát âm ${word.term}`}><Volume2 size={16} /></button><div><strong>{word.term}</strong><small>{word.pronunciation} {word.partOfSpeech && `· ${partLabels[word.partOfSpeech] || word.partOfSpeech}`}</small></div></div></td>
                      <td><strong className="meaning-cell">{word.meaning}</strong></td>
                      <td><span className="example-cell">{word.example || '—'}</span></td>
                      <td><span className="level-badge">{word.level}</span></td>
                      <td><span className={`status-badge status-badge--${status}`}>{status === 'mastered' ? 'Đã thuộc' : status === 'learning' ? 'Đang học' : 'Từ mới'}</span></td>
                      <td><div className="row-actions"><button onClick={() => setEditingWord({ ...word })} aria-label="Sửa từ"><Edit3 size={16} /></button><button onClick={() => removeWord(word.id)} aria-label="Xóa từ"><Trash2 size={16} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Search} title="Không có từ phù hợp" description="Thử tìm kiếm khác hoặc chuyển bộ lọc." />}
      </section>

      <Modal open={Boolean(editingWord)} onClose={() => setEditingWord(null)} title={set.words.some((word) => word.id === editingWord?.id) ? 'Chỉnh sửa từ' : 'Thêm từ mới'} eyebrow="TỪ VỰNG" size="lg">
        {editingWord && (
          <div className="word-form">
            <label><span>Tiếng Anh *</span><input autoFocus value={editingWord.term} onChange={(event) => setEditingWord({ ...editingWord, term: event.target.value })} /></label>
            <label><span>Nghĩa tiếng Việt *</span><input value={editingWord.meaning} onChange={(event) => setEditingWord({ ...editingWord, meaning: event.target.value })} /></label>
            <label className="full"><span>Định nghĩa tiếng Anh <small>(dùng cho chế độ Nghe & viết nghĩa)</small></span><input value={editingWord.englishMeaning || ''} onChange={(event) => setEditingWord({ ...editingWord, englishMeaning: event.target.value })} placeholder="A simple English definition…" /></label>
            <label><span>Phiên âm IPA</span><input value={editingWord.pronunciation} onChange={(event) => setEditingWord({ ...editingWord, pronunciation: event.target.value })} placeholder="/ɪɡˈzɑːmpəl/" /></label>
            <label><span>Loại từ</span><select value={editingWord.partOfSpeech} onChange={(event) => setEditingWord({ ...editingWord, partOfSpeech: event.target.value })}>{Object.entries(partLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>Trình độ</span><select value={editingWord.level} onChange={(event) => setEditingWord({ ...editingWord, level: event.target.value })}>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => <option key={level}>{level}</option>)}</select></label>
            <label className="full"><span>Câu ví dụ tiếng Anh</span><input value={editingWord.example} onChange={(event) => setEditingWord({ ...editingWord, example: event.target.value })} /></label>
            <label className="full"><span>Dịch câu ví dụ</span><input value={editingWord.exampleMeaning} onChange={(event) => setEditingWord({ ...editingWord, exampleMeaning: event.target.value })} /></label>
            <label className="full"><span>Ghi chú</span><textarea value={editingWord.note} onChange={(event) => setEditingWord({ ...editingWord, note: event.target.value })} /></label>
            <div className="modal-actions full"><Button variant="ghost" onClick={() => setEditingWord(null)}>Hủy</Button><Button onClick={saveWord} disabled={!editingWord.term.trim() || !editingWord.meaning.trim()}>Lưu từ</Button></div>
          </div>
        )}
      </Modal>

      <Modal open={editingInfo} onClose={() => setEditingInfo(false)} title="Thông tin bộ từ" eyebrow="TÙY CHỈNH">
        {infoDraft && <div className="info-form"><label><span>Tên bộ từ</span><input value={infoDraft.title} onChange={(event) => setInfoDraft({ ...infoDraft, title: event.target.value })} /></label><label><span>Mô tả</span><textarea value={infoDraft.description} onChange={(event) => setInfoDraft({ ...infoDraft, description: event.target.value })} /></label><div className="appearance-fields"><label><span>Biểu tượng</span><input value={infoDraft.icon} maxLength={4} onChange={(event) => setInfoDraft({ ...infoDraft, icon: event.target.value })} /></label><label><span>Màu chủ đạo</span><select value={infoDraft.color} onChange={(event) => setInfoDraft({ ...infoDraft, color: event.target.value })}>{['violet', 'green', 'orange', 'blue', 'rose'].map((color) => <option key={color} value={color}>{color}</option>)}</select></label></div><div className="modal-actions"><Button variant="ghost" onClick={() => setEditingInfo(false)}>Hủy</Button><Button onClick={async () => { await saveSet({ ...set, ...infoDraft }); setEditingInfo(false); }} disabled={!infoDraft.title.trim()}>Lưu thay đổi</Button></div></div>}
      </Modal>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Xóa bộ từ này?" description={`“${set.title}” và toàn bộ tiến độ của bộ từ sẽ bị xóa khỏi thiết bị.`} onConfirm={async () => { await deleteSet(set.id); navigate('library'); }} />
    </div>
  );
}
