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
- Nghe & viết nghĩa: tự phát âm từ hoặc nghĩa, chọn hướng Anh → Việt / Việt → Anh, chấm ngay và đưa câu sai vào lượt ôn lại.
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

## Luyện trắc nghiệm

- Dán nội dung hoặc tải file `.txt`, `.md`, `.csv`, `.tsv`, `.json` chứa câu hỏi trắc nghiệm.
- Gemini nhận diện linh hoạt câu có 3 hoặc 4 phương án, đáp án đúng và lời giải chi tiết.
- Màn hình kiểm duyệt cho phép sửa câu hỏi, thêm/xóa phương án, chọn lại đáp án đúng và chỉnh lời giải trước khi tạo.
- Khi làm bài, người dùng kiểm tra đáp án ngay từng câu và xem lời giải ngay sau khi trả lời.
- Kết quả được lưu theo từng lần làm; hỗ trợ làm lại toàn bộ hoặc chỉ làm lại các câu sai.
- Bộ câu hỏi và lịch sử làm bài được lưu trong IndexedDB và được đưa vào file sao lưu JSON.

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

## Deploy GitHub Pages

Dự án đã có workflow `.github/workflows/deploy.yml` và `base` trong Vite được đặt theo repository `EnglishPratice`. Website dự kiến chạy tại:

`https://manhcuong2005.github.io/EnglishPratice/`

1. Push mã nguồn lên nhánh `main` của repository `ManhCuong2005/EnglishPratice`.
2. Mở repository trên GitHub, vào **Settings → Pages**.
3. Trong **Build and deployment → Source**, chọn **GitHub Actions**. Không chọn “Deploy from a branch”, vì nhánh `main` chứa mã nguồn Vite chưa build.
4. Mở tab **Actions**, chọn workflow **Deploy Vite site to GitHub Pages** và chờ cả hai job `build` và `deploy` hoàn tất.

Để website có sẵn Gemini API key khi build:

1. Vào **Settings → Secrets and variables → Actions → Secrets**.
2. Tạo repository secret tên `VITE_GEMINI_API_KEY` và dán API key Gemini vào đó.
3. Không bắt buộc: trong tab **Variables**, tạo `VITE_GEMINI_MODEL` nếu muốn dùng model khác `gemini-2.5-flash`.
4. Chạy lại workflow hoặc push một commit mới.

Secret không xuất hiện trong mã nguồn GitHub, nhưng vì đây là website frontend thuần nên API key vẫn được đóng vào file JavaScript sau khi build và người truy cập có kiến thức kỹ thuật vẫn có thể xem được. Nếu không tạo secret, mỗi người dùng có thể nhập key riêng tại **Cài đặt → Kết nối Gemini**; key đó chỉ được lưu trong IndexedDB trên trình duyệt của họ.

Dữ liệu trên GitHub Pages có kho IndexedDB riêng, không tự chuyển từ localhost hoặc Vercel. Hãy dùng **Cài đặt → Xuất dữ liệu** ở địa chỉ cũ rồi **Nhập dữ liệu** tại website GitHub Pages nếu muốn mang theo tiến độ.
