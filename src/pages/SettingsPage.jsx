import {
  Bot, CheckCircle2, Database, Download, Eye, EyeOff, HardDrive, KeyRound, Moon, Palette, RefreshCw, Save, ShieldCheck, Sun, Trash2, Upload, Volume2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, ConfirmDialog } from '../components/Common.jsx';
import { db } from '../lib/db.js';
import { getGeminiConfig } from '../lib/gemini.js';

export default function SettingsPage({ settings, saveSettings, refreshData, toast }) {
  const [geminiDraft, setGeminiDraft] = useState({ apiKey: settings.geminiApiKey || '', model: settings.geminiModel });
  const [showKey, setShowKey] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const backupRef = useRef(null);
  const gemini = getGeminiConfig(settings);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const backup = await db.exportAll();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vocabloom-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast('Đã xuất bản sao lưu', 'File JSON đã được tải xuống thiết bị.');
    } catch (error) {
      toast('Không thể xuất dữ liệu', error.message, 'error');
    } finally { setBusy(false); }
  };

  const importBackup = async (file) => {
    setBusy(true);
    try {
      const backup = JSON.parse(await file.text());
      await db.importAll(backup, false);
      await refreshData();
      const quizCount = backup.data.quizSets?.length || 0;
      toast('Đã khôi phục dữ liệu', `${backup.data.sets.length} bộ từ và ${quizCount} bộ câu hỏi đã được nhập vào thiết bị.`);
    } catch (error) {
      toast('Không thể nhập bản sao lưu', error instanceof SyntaxError ? 'File JSON bị lỗi hoặc không hợp lệ.' : error.message, 'error', 7000);
    } finally {
      setBusy(false);
      if (backupRef.current) backupRef.current.value = '';
    }
  };

  const clearAll = async () => {
    setClearOpen(false);
    setBusy(true);
    try {
      await db.clearAll();
      await db.putSetting('initialized', true);
      await refreshData();
      toast('Đã xóa dữ liệu cục bộ', 'Tất cả bộ từ, bài nghe, bộ câu hỏi và tiến độ đã được xóa khỏi trình duyệt.', 'info');
    } catch (error) {
      toast('Không thể xóa dữ liệu', error.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="page settings-page">
      <header className="page-header"><div><span className="eyebrow">GÓC CÁ NHÂN</span><h1>Cài đặt</h1><p>Tùy chỉnh trải nghiệm và quản lý dữ liệu trên thiết bị.</p></div></header>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="settings-section panel">
            <div className="settings-section__heading"><span><Bot size={21} /></span><div><h2>Kết nối Gemini</h2><p>Dùng AI để chuẩn hóa và làm giàu bộ từ thô.</p></div><em className={gemini.apiKey ? 'ready' : ''}>{gemini.apiKey ? 'Đã kết nối' : 'Chưa có key'}</em></div>
            <div className="settings-fields">
              <label className="full"><span>Gemini API key lưu trên thiết bị</span><div className="password-field"><KeyRound size={17} /><input type={showKey ? 'text' : 'password'} value={geminiDraft.apiKey} onChange={(event) => setGeminiDraft({ ...geminiDraft, apiKey: event.target.value })} placeholder={gemini.hasEnvKey ? 'Đang sử dụng key từ .env.local' : 'AIza…'} autoComplete="off" /><button onClick={() => setShowKey((value) => !value)} aria-label={showKey ? 'Ẩn API key' : 'Hiện API key'}>{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small>{gemini.hasEnvKey ? 'Có API key từ biến môi trường. Key nhập tại đây sẽ được ưu tiên.' : 'Key này được lưu trong IndexedDB của trình duyệt hiện tại.'}</small></label>
              <label><span>Model Gemini</span><input value={geminiDraft.model} onChange={(event) => setGeminiDraft({ ...geminiDraft, model: event.target.value })} placeholder="gemini-2.5-flash" /></label>
              <div className="field-action"><Button icon={Save} onClick={() => saveSettings({ geminiApiKey: geminiDraft.apiKey.trim(), geminiModel: geminiDraft.model.trim() || 'gemini-2.5-flash' })}>Lưu cấu hình</Button></div>
            </div>
            <div className="security-callout"><ShieldCheck size={19} /><p><strong>Dành cho bản local/cá nhân.</strong> Vì Gemini được gọi trực tiếp từ frontend, API key vẫn có thể được xem trong mã website sau khi deploy.</p></div>
          </section>

          <section className="settings-section panel">
            <div className="settings-section__heading"><span><Palette size={21} /></span><div><h2>Trải nghiệm học</h2><p>Điều chỉnh giao diện, âm thanh và mục tiêu hằng ngày.</p></div></div>
            <div className="preference-list">
              <div className="preference-row"><div><span className="preference-icon"><Palette size={18} /></span><p><strong>Giao diện</strong><small>Chọn chế độ phù hợp với mắt của bạn.</small></p></div><div className="theme-options"><button className={settings.theme === 'light' ? 'active' : ''} onClick={() => saveSettings({ theme: 'light' })}><Sun size={17} /> Sáng</button><button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => saveSettings({ theme: 'dark' })}><Moon size={17} /> Tối</button></div></div>
              <div className="preference-row"><div><span className="preference-icon"><Volume2 size={18} /></span><p><strong>Tự phát âm khi mở thẻ</strong><small>Dùng giọng đọc tiếng Anh có sẵn trong trình duyệt.</small></p></div><button className={`switch ${settings.autoSpeak ? 'active' : ''}`} onClick={() => saveSettings({ autoSpeak: !settings.autoSpeak })}><i /></button></div>
              <div className="preference-row"><div><span className="preference-icon"><CheckCircle2 size={18} /></span><p><strong>Mục tiêu hằng ngày</strong><small>Số lượt ôn bạn muốn hoàn thành mỗi ngày.</small></p></div><select value={settings.dailyGoal} onChange={(event) => saveSettings({ dailyGoal: Number(event.target.value) })}><option value="5">5 từ</option><option value="10">10 từ</option><option value="15">15 từ</option><option value="20">20 từ</option><option value="30">30 từ</option><option value="50">50 từ</option></select></div>
            </div>
          </section>

          <section className="settings-section panel">
            <div className="settings-section__heading"><span><Database size={21} /></span><div><h2>Sao lưu và khôi phục</h2><p>Chuyển tiến độ giữa localhost, Vercel hoặc thiết bị khác.</p></div></div>
            <div className="backup-grid">
              <button onClick={exportBackup} disabled={busy}><span><Download size={21} /></span><div><strong>Xuất dữ liệu</strong><p>Tải bộ từ, bài nghe, bộ câu hỏi, tiến độ và lịch sử thành một file JSON.</p></div></button>
              <button onClick={() => backupRef.current?.click()} disabled={busy}><span><Upload size={21} /></span><div><strong>Nhập dữ liệu</strong><p>Khôi phục từ file Vocabloom JSON; bộ trùng sẽ được cập nhật.</p></div></button>
              <input type="file" accept="application/json,.json" hidden ref={backupRef} onChange={(event) => event.target.files[0] && importBackup(event.target.files[0])} />
            </div>
          </section>

          <section className="settings-section settings-section--danger panel">
            <div className="settings-section__heading"><span><Trash2 size={21} /></span><div><h2>Vùng nguy hiểm</h2><p>Thao tác này không thể hoàn tác nếu chưa xuất bản sao lưu.</p></div></div>
            <div className="danger-row"><div><strong>Xóa toàn bộ dữ liệu cục bộ</strong><p>Gỡ tất cả bộ từ, bài nghe, bộ câu hỏi, tiến độ, lịch sử và cấu hình khỏi trình duyệt này.</p></div><Button variant="danger" icon={Trash2} onClick={() => setClearOpen(true)} disabled={busy}>Xóa tất cả</Button></div>
          </section>
        </div>

        <aside className="storage-card panel">
          <span className="storage-card__icon"><HardDrive size={25} /></span><span className="eyebrow">LƯU TRỮ CỤC BỘ</span><h3>IndexedDB đang bảo vệ tiến độ</h3><p>Dữ liệu thuộc riêng địa chỉ website và trình duyệt này. Reload hoặc cập nhật code sẽ không làm mất dữ liệu.</p><ul><li><CheckCircle2 size={16} /> Không cần tài khoản</li><li><CheckCircle2 size={16} /> Hoạt động không cần backend</li><li><RefreshCw size={16} /> Dùng JSON để chuyển thiết bị</li></ul>
        </aside>
      </div>

      <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} onConfirm={clearAll} title="Xóa toàn bộ dữ liệu?" description="Tất cả bộ từ, bài nghe, bộ câu hỏi và tiến độ trên trình duyệt này sẽ bị xóa vĩnh viễn. Hãy xuất bản sao lưu trước nếu cần giữ lại." confirmLabel="Xóa vĩnh viễn" />
    </div>
  );
}
