import { BookOpen, Grid2X2, List, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, EmptyState, ProgressBar } from '../components/Common.jsx';
import { formatRelativeDate, getSetMetrics } from '../lib/learning.js';

export default function LibraryPage({ sets, navigate }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [view, setView] = useState('grid');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    const result = sets.filter((set) => !normalized
      || set.title.toLocaleLowerCase('vi').includes(normalized)
      || set.description?.toLocaleLowerCase('vi').includes(normalized)
      || set.words.some((word) => word.term.toLocaleLowerCase('en').includes(normalized) || word.meaning.toLocaleLowerCase('vi').includes(normalized)));
    return result.sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title, 'vi');
      if (sort === 'words') return b.words.length - a.words.length;
      if (sort === 'due') return getSetMetrics(b).due - getSetMetrics(a).due;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [sets, query, sort]);

  return (
    <div className="page library-page">
      <header className="page-header">
        <div><span className="eyebrow">THƯ VIỆN CÁ NHÂN</span><h1>Bộ từ của tôi</h1><p>Quản lý mọi chủ đề bạn đang khám phá.</p></div>
        <Button icon={Plus} onClick={() => navigate('import')}>Tạo bộ từ mới</Button>
      </header>

      <div className="library-toolbar">
        <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên bộ từ, từ vựng hoặc nghĩa…" /></label>
        <div className="toolbar-actions">
          <label className="select-control"><SlidersHorizontal size={17} /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Mới cập nhật</option><option value="name">Tên A–Z</option><option value="words">Nhiều từ nhất</option><option value="due">Cần ôn nhất</option></select></label>
          <div className="view-switch"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Dạng lưới"><Grid2X2 size={18} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Dạng danh sách"><List size={19} /></button></div>
        </div>
      </div>

      <div className="library-count"><strong>{filtered.length}</strong> bộ từ {query && <span>phù hợp với “{query}”</span>}</div>

      {filtered.length ? (
        <div className={`collection-grid ${view === 'list' ? 'collection-grid--list' : ''}`}>
          {filtered.map((set) => {
            const metrics = getSetMetrics(set);
            return (
              <button className="collection-card" key={set.id} onClick={() => navigate(`set/${set.id}`)}>
                <div className="collection-card__top">
                  <span className={`collection-icon collection-icon--${set.color || 'violet'}`}>{set.icon || '📚'}</span>
                  <small>{formatRelativeDate(set.stats?.lastStudiedAt)}</small>
                </div>
                <div className="collection-card__body">
                  <h3>{set.title}</h3>
                  <p>{set.description || 'Bộ từ vựng của bạn'}</p>
                  <div className="word-preview">{set.words.slice(0, 3).map((word) => <span key={word.id}>{word.term}</span>)}</div>
                </div>
                <div className="collection-card__progress">
                  <ProgressBar value={metrics.mastered} max={metrics.total || 1} compact />
                  <footer><span>{metrics.total} từ · {metrics.mastered} đã thuộc</span><strong>{metrics.due} cần ôn</strong></footer>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title={query ? 'Không tìm thấy bộ từ' : 'Thư viện đang trống'} description={query ? 'Thử một từ khóa khác hoặc xóa bộ lọc tìm kiếm.' : 'Biến một đoạn văn hoặc danh sách thô thành bộ từ đầu tiên.'} action={!query && <Button icon={Plus} onClick={() => navigate('import')}>Tạo bộ từ</Button>} />
      )}
    </div>
  );
}
