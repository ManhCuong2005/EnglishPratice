# Vocabloom

Ứng dụng học từ vựng Anh–Việt chạy hoàn toàn trên frontend. Vocabloom có thể đọc danh sách từ thô bằng Gemini, cho phép kiểm duyệt trước khi tạo bộ từ, sau đó luyện tập bằng flashcard và mini-game. Bộ từ và tiến độ được lưu trong IndexedDB của trình duyệt.

## Chạy trên máy

Yêu cầu Node.js 20.19 trở lên.

```bash
npm install
npm run dev
```

Mở [http://localhost:9999](http://localhost:9999). Cổng `9999` đã được cố định trong cấu hình Vite.

## Thêm Gemini API key

1. Sao chép `.env.example` thành `.env.local`.
2. Thay giá trị mẫu bằng API key thật:

```env
VITE_GEMINI_API_KEY=AIza_your_real_key
VITE_GEMINI_MODEL=gemini-2.5-flash
```

3. Dừng rồi chạy lại `npm run dev` sau khi thay đổi file môi trường.

Bạn cũng có thể nhập key tại **Cài đặt → Kết nối Gemini**. Key nhập ở giao diện chỉ nằm trong IndexedDB và được ưu tiên hơn key từ `.env.local`.

> Đây là ứng dụng frontend thuần. Biến bắt đầu bằng `VITE_` sẽ được đóng vào JavaScript khi build và có thể được người dùng xem. Cách này phù hợp với nhu cầu local/cá nhân đã thống nhất, không phù hợp để bảo mật API key trên website công khai.

## Dữ liệu hỗ trợ

- Dán văn bản trực tiếp hoặc tải file `.txt`, `.md`, `.csv`, `.tsv`, `.json` tối đa 3 MB.
- Gemini trả về dữ liệu có cấu trúc: từ, nghĩa, IPA, loại từ, CEFR, ví dụ, bản dịch và ghi chú.
- “Tách nhanh không AI” đọc các dòng dạng `English | Tiếng Việt`, `English - Tiếng Việt`, tab, dấu hai chấm hoặc CSV.
- Màn hình kiểm duyệt cho phép sửa hoặc xóa từng mục trước khi tạo bộ từ.

## Chế độ học

- Flashcard với 4 mức tự đánh giá.
- Trắc nghiệm chọn nghĩa.
- Gõ lại từ tiếng Anh.
- Ghép cặp Anh–Việt.
- Ôn lặp lại ngắt quãng, tự tính ngày cần ôn và mức độ ghi nhớ.
- Phát âm bằng Web Speech API của trình duyệt.

## Luyện nghe

- Tạo transcript bằng Gemini theo General, TOEIC hoặc IELTS và mức điểm lựa chọn.
- Có thể dán đoạn tiếng Anh của riêng bạn mà không cần gọi AI.
- Chọn độ dài, tỷ lệ đục lỗ 5–40% và cách chọn từ: ngẫu nhiên, từ nội dung, từ khó hoặc cụm từ.
- Trình phát chia nội dung thành từng câu, hỗ trợ nghe toàn bài, nghe từ câu hiện tại, nghe lại, đổi voice và tốc độ.
- Luồng “chỉ nghe” trước khi mở transcript, điền từ bị thiếu và trả lời câu hỏi hiểu nội dung.
- Chấm đúng/sai, hiện transcript, nghe lại câu sai và chuyển từ nghe sai thành một bộ flashcard.
- Bài nghe, lịch sử làm bài và điểm số được lưu trong IndexedDB và đi kèm file backup JSON.

## IndexedDB và sao lưu

Dữ liệu, gồm bộ từ và bài luyện nghe, được lưu riêng cho từng origin. Vì vậy `http://localhost:9999` và domain Vercel có hai kho khác nhau. Dùng **Cài đặt → Xuất dữ liệu** để tải file JSON, sau đó nhập file này trên domain hoặc thiết bị mới.

## Build và deploy Vercel

```bash
npm run build
npm run preview
```

Khi deploy Vercel:

1. Import repository hoặc chạy Vercel CLI.
2. Build command: `npm run build`.
3. Output directory: `dist`.
4. Thêm `VITE_GEMINI_API_KEY` và `VITE_GEMINI_MODEL` trong Project Settings → Environment Variables.
5. Redeploy sau khi thêm biến môi trường.

Luôn gửi domain production cố định cho người dùng. Preview URL hoặc custom domain khác sẽ có IndexedDB riêng.
