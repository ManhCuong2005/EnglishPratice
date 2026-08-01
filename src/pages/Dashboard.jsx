import { ArrowRight, BookOpen, Brain, CalendarCheck, Check, Flame, Plus, Sparkles, Target, Trophy } from 'lucide-react';
import { Button, EmptyState, ProgressBar } from '../components/Common.jsx';
import { formatRelativeDate, getSetMetrics, startOfDay } from '../lib/learning.js';

function getStreak(sessions) {
  const days = new Set(sessions.map((session) => startOfDay(session.completedAt).getTime()));
  let streak = 0;
  const cursor = startOfDay();
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getWeek(sessions) {
  const today = startOfDay();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const count = sessions
      .filter((session) => new Date(session.completedAt) >= date && new Date(session.completedAt) < next)
      .reduce((sum, session) => sum + (session.answered || 0), 0);
    return { label: date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('Th ', 'T'), count, today: index === 6 };
  });
}

export default function Dashboard({ sets, sessions, settings, navigate }) {
  const totalWords = sets.reduce((sum, set) => sum + set.words.length, 0);
  const metrics = sets.map(getSetMetrics);
  const mastered = metrics.reduce((sum, item) => sum + item.mastered, 0);
  const due = metrics.reduce((sum, item) => sum + item.due, 0);
  const today = startOfDay();
  const todayAnswered = sessions
    .filter((session) => new Date(session.completedAt) >= today)
    .reduce((sum, session) => sum + (session.answered || 0), 0);
  const streak = getStreak(sessions);
  const week = getWeek(sessions);
  const chartMax = Math.max(10, ...week.map((item) => item.count));
  const recommended = sets
    .map((set) => ({ set, metrics: getSetMetrics(set) }))
    .sort((a, b) => b.metrics.due - a.metrics.due)[0];

  return (
    <div className="page dashboard-page">
      <header className="page-header dashboard-header">
        <div>
          <span className="eyebrow">KHÔNG GIAN CỦA BẠN</span>
          <h1>Chào bạn, sẵn sàng <span>nở rộ</span> vốn từ?</h1>
          <p>Một chút mỗi ngày, một bước gần hơn đến sự tự tin.</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('import')}>Tạo bộ từ mới</Button>
      </header>

      <section className="dashboard-grid dashboard-grid--stats">
        <article className="stat-card stat-card--violet">
          <div className="stat-card__icon"><BookOpen size={21} /></div>
          <div><span>Tổng vốn từ</span><strong>{totalWords}</strong><small>trong {sets.length} bộ từ</small></div>
        </article>
        <article className="stat-card stat-card--green">
          <div className="stat-card__icon"><Brain size={21} /></div>
          <div><span>Đã ghi nhớ</span><strong>{mastered}</strong><small>{totalWords ? Math.round(mastered / totalWords * 100) : 0}% tổng số từ</small></div>
        </article>
        <article className="stat-card stat-card--orange">
          <div className="stat-card__icon"><Flame size={21} /></div>
          <div><span>Chuỗi ngày học</span><strong>{streak}</strong><small>{streak ? 'Cứ tiếp tục nhé!' : 'Bắt đầu từ hôm nay'}</small></div>
        </article>
        <article className="stat-card stat-card--blue">
          <div className="stat-card__icon"><Target size={21} /></div>
          <div><span>Cần ôn hôm nay</span><strong>{due}</strong><small>{due ? 'Đang chờ bạn chinh phục' : 'Bạn đã hoàn thành!'}</small></div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--main">
        <article className="panel today-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">MỤC TIÊU HÔM NAY</span><h2>Nhịp học của bạn</h2></div>
            <div className="goal-number"><strong>{todayAnswered}</strong><span>/ {settings.dailyGoal} từ</span></div>
          </div>
          <ProgressBar value={todayAnswered} max={settings.dailyGoal} />
          <div className="goal-message">
            <span className={todayAnswered >= settings.dailyGoal ? 'completed' : ''}>
              {todayAnswered >= settings.dailyGoal ? <Check size={17} /> : <Sparkles size={17} />}
            </span>
            <p>{todayAnswered >= settings.dailyGoal
              ? 'Tuyệt vời! Bạn đã hoàn thành mục tiêu hôm nay.'
              : `Chỉ còn ${Math.max(0, settings.dailyGoal - todayAnswered)} từ nữa để hoàn thành mục tiêu.`}</p>
          </div>

          {recommended ? (
            <div className="recommended-card">
              <div className={`collection-icon collection-icon--${recommended.set.color || 'violet'}`}>{recommended.set.icon || '📚'}</div>
              <div className="recommended-card__content">
                <span>Gợi ý tiếp theo</span>
                <strong>{recommended.set.title}</strong>
                <small>{recommended.metrics.due} từ đang chờ ôn</small>
              </div>
              <Button size="sm" onClick={() => navigate(`study/${recommended.set.id}/flashcard`)}>Học ngay</Button>
            </div>
          ) : (
            <EmptyState title="Chưa có bộ từ" description="Tạo bộ từ đầu tiên để bắt đầu hành trình." action={<Button size="sm" onClick={() => navigate('import')}>Tạo ngay</Button>} />
          )}
        </article>

        <article className="panel activity-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">7 NGÀY GẦN ĐÂY</span><h2>Nhịp độ học tập</h2></div>
            <CalendarCheck size={21} />
          </div>
          <div className="week-chart">
            {week.map((day, index) => (
              <div className="chart-day" key={`${day.label}-${index}`}>
                <span className="chart-value">{day.count || ''}</span>
                <div className="chart-bar"><i style={{ height: `${Math.max(7, day.count / chartMax * 100)}%` }} /></div>
                <small className={day.today ? 'today' : ''}>{day.label}</small>
              </div>
            ))}
          </div>
          <div className="activity-summary">
            <Trophy size={18} />
            <span><strong>{week.reduce((sum, item) => sum + item.count, 0)} lượt ôn</strong> trong tuần này</span>
          </div>
        </article>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div><span className="eyebrow">BỘ TỪ GẦN ĐÂY</span><h2>Tiếp tục hành trình</h2></div>
          {sets.length > 0 && <button className="text-link" onClick={() => navigate('library')}>Xem tất cả <ArrowRight size={16} /></button>}
        </div>
        {sets.length ? (
          <div className="collection-grid collection-grid--compact">
            {sets.slice(0, 3).map((set) => {
              const item = getSetMetrics(set);
              return (
                <button className="collection-card" key={set.id} onClick={() => navigate(`set/${set.id}`)}>
                  <div className="collection-card__top">
                    <span className={`collection-icon collection-icon--${set.color || 'violet'}`}>{set.icon || '📚'}</span>
                    <small>{formatRelativeDate(set.stats?.lastStudiedAt)}</small>
                  </div>
                  <h3>{set.title}</h3>
                  <p>{set.description || 'Bộ từ vựng của bạn'}</p>
                  <ProgressBar value={item.mastered} max={item.total || 1} compact />
                  <footer><span>{item.mastered}/{item.total} đã thuộc</span><strong>{item.due} cần ôn</strong></footer>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
