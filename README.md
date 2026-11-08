# ThinTreé — The Birthday Collection

Website wishlist sinh nhật cho **Thiên Trí** (03/12/2007), gồm Family, High School và University Friend, mỗi nhóm có cổng truy cập riêng.

## Cài đặt nhanh

**Yêu cầu chạy local:** Node.js **22.16+** (cần `node:sqlite`, Node TypeScript stripping). Local mặc định dùng SQLite; bản deploy dùng Neon PostgreSQL.

```bash
# Trong thư mục ThinTreee
npm install
npm run build:client
npm run setup
npm start
```

Truy cập **http://localhost:3000**. Lần đầu chạy `npm run setup`, nhập **ba đáp án đã thống nhất trong yêu cầu thiết kế riêng**. Không ghi đáp án thực vào README hoặc source code vì repository có thể được công khai khi triển khai. Với cổng University, nhập các cách gọi tên được chấp nhận ngăn cách bởi ký tự `|`.

Đặt thêm **mật khẩu quản trị mới ít nhất 12 ký tự**. Đừng dùng chung với mật khẩu một trong ba cổng. Câu trả lời và mật khẩu quản trị được xử lý thành **scrypt hash có salt riêng**, chỉ lưu hash trong cơ sở dữ liệu. Nếu chưa setup, các cổng sẽ thông báo chưa cấu hình.

**Lưu ý:** Không phát tán database `data/thintree.sqlite`, file `.env` hoặc mật khẩu quản trị. Database thật được `.gitignore` loại trừ và không nằm trong tệp ZIP phát hành.

## Cách dùng

- `/` — trang chào, đồng hồ đếm ngược, nhạc bật/tắt.
- `/worlds` — chọn Family, High School hoặc University Friend.
- `/about` — giới thiệu, ảnh cá nhân, các môn thể thao, game, phim và âm nhạc.
- `/portal/family`, `/portal/high-school`, `/portal/university` — cổng giải câu hỏi (server xác thực).
- `/collection/family`, `/collection/high-school`, `/collection/university` — trang riêng, chỉ mở được sau khi xác thực.
- `/admin` — quản trị; đăng nhập bằng mật khẩu thiết lập lúc setup.

Tại mỗi trang riêng tư: nhấn vào **phong bì / sổ lưu bút / lá bài Tarot** để mở wishlist; nhấn vào quà để xem chi tiết và **đánh dấu đã chọn**. Mỗi quà được gắn `canonical_key`: boardgame, camera mini, ChatGPT Plus… có trạng thái dùng chung qua các nhóm, để không bị đặt trùng. Chỉ admin mới có thể hoàn tác hoặc chuyển thành `purchased`.

Lời chúc ẩn danh được lưu dưới dạng **riêng tư**, chỉ admin nhìn thấy trước; admin có thể phê duyệt công khai lên tường lời chúc của từng nhóm.

Trong Admin có thể chỉnh: lời thư và câu hỏi, nội dung About/Home, danh sách và tình trạng quà, album ảnh, lời chúc, timeline, đáp án cổng, mật khẩu admin. Cập nhật lưu vào database; không cần sửa code cho các thay đổi thường ngày.

## Thêm ảnh thật

Từ `/admin` → **Photos** → chọn nhóm, loại ảnh, caption → tải ảnh **JPEG, PNG hoặc WebP** (dưới 5 MB). Với ảnh chân dung, chọn **About / Public** và **Portrait**. Có thể chọn một placeholder để thay trực tiếp. Ảnh riêng tư nằm trong database và truy cập qua `/api/media/:id` sau kiểm tra phiên; ảnh About được công khai.

Ảnh minh họa sản phẩm mặc định là icon. Có thể nhập URL ảnh HTTPS cho từng món quà trong tab **Gifts**. Không có ảnh người thật giả lập.

## Âm nhạc

`public/audio/*.wav` chứa những đoạn nhạc nền **được tạo riêng bằng code cho dự án**, không sử dụng bài hát thương mại. Người dùng phải tương tác mới có thể bắt đầu phát. Có bật/tắt và âm lượng. Trong Admin → Content có thể thay đường dẫn nhạc theo nhóm bằng file đã host trên server. Các file trong `/public/audio` được server hỗ trợ trực tiếp.

## Kiến trúc

```text
ThinTreee/
├── server/
│   ├── index.ts         # HTTP API, static assets, route guard, uploads
│   ├── auth.ts          # scrypt, rate-limit, cookie sessions
│   ├── db.ts            # SQLite (local) / PostgreSQL (hosting), schema và content seed
│   └── content.ts       # wishlist, thư gốc, profile (KHÔNG có đáp án)
├── src/client.ts        # giao diện TypeScript + animation + admin tương tác
├── public/
│   ├── client.js        # built client
│   ├── index.html
│   ├── styles.css
│   ├── favicon.svg
│   └── audio/
├── scripts/setup.ts     # cấu hình đáp án qua terminal, hash rồi lưu DB
├── tests/site.test.mjs  # kiểm thử end-to-end HTTP/API
├── .env.example
└── package.json
```

**Vì sao không React / Next.js / Supabase?** Dự án này dùng **TypeScript toàn stack, Node HTTP, SQLite cho local và PostgreSQL cho cloud, CSS/JS thuần**. Node xử lý xác thực server-side; database ở Neon Free. Đây là một lựa chọn khác với stack *ưu tiên* trong brief, không phải React hoặc Next.js. UI chạy bằng HTML/CSS, TypeScript compile ra JS, transition CSS và transform 3D (không dùng Framer Motion). Backend thực sự xác thực và lưu dữ liệu; không dùng localStorage làm bảo mật.

## Kiểm tra

```bash
npm install     # Chỉ cần khi build TypeScript / chạy kiểm thử
npm run check
```

Chạy `tsc` và test Node: kiểm tra nội dung seed, chống lộ mật khẩu qua tài nguyên public, route guard, login riêng, phân quyền admin, gift reservation, gửi lời chúc, upload ảnh, logout, khóa tạm sau 5 lần nhập sai. Chức năng responsive có breakpoint CSS; nên nghiệm thu thủ công trên Chrome/Safari và điện thoại thật trước khi đưa cho khách truy cập.

## Triển khai MIỄN PHÍ: Render Free + Neon Free

Bản này chỉ dùng các gói miễn phí: **Render Web Service Free** + **Neon PostgreSQL Free**; không dùng Render Starter, persistent disk hay Postgres Render có thời hạn 30 ngày.

Cơ sở dữ liệu Neon đã được tạo cho dự án trong account được kết nối: **`thintreee-birthday`** (`sweet-boat-74396529`), database **`thintreee`**, Singapore. Schema của 13 bảng đã được khởi tạo. **Không bao giờ đưa Neon connection string lên GitHub.**

### Tại sao không dùng SQLite trên Render Free?

Render Free có bộ nhớ tệp tạm thời; dữ liệu file SQLite biến mất sau sleep/restart/redeploy. Sử dụng `DATABASE_URL` từ Neon giải quyết vấn đề này. Nếu `DATABASE_URL` không được cấu hình, server mặc định SQLite để chạy trên máy tính cá nhân; **đừng deploy bản production khi chưa cài `DATABASE_URL`**.

### Các bước để có URL công khai (0đ)

1. Trên GitHub tạo repository **Private** riêng, ví dụ `thintreee-birthday`. Đẩy toàn bộ nội dung thư mục này lên. Chắc chắn file `render.yaml` nằm ở thư mục gốc repository; **không tải file `.env`, `*.sqlite`, khóa bí mật, ảnh riêng tư lên GitHub**.
2. Trên Render (workspace được bạn chọn), chọn **New → Blueprint**, chọn repo này và xác nhận cấu hình `render.yaml` chỉ tạo **1 Free Web Service**. **Nếu giao diện đề nghị gói trả phí, dừng lại**. Không chấp thuận bất kỳ khoản phí nào.
3. Trong Dashboard Render, thêm các env var bí mật:
   - `DATABASE_URL`: lấy từ Neon → dự án `thintreee-birthday` → Connect, dùng PostgreSQL connection URL có `sslmode=require`.
   - `INIT_FAMILY_ANSWER`: đáp án Family đã đưa trong brief.
   - `INIT_SCHOOL_ANSWER`: đáp án High School trong brief.
   - `INIT_UNIVERSITY_ANSWERS`: cả hai đáp án University, cách nhau bằng `|`.
   - `INIT_ADMIN_PASSWORD`: một mật khẩu quản trị **mới, dài từ 12 ký tự**, chỉ chủ website biết.
4. Khởi chạy dịch vụ. Khi `GET /api/health` trả về `{"ok":true,"ready":true}`, mở ba cổng để kiểm tra đăng nhập và trang `/admin`.
5. **Xóa bốn biến `INIT_*`** khỏi Render sau khi hệ thống đã bootstrap. Dữ liệu đã hash và lưu ở Neon nên lần chạy sau không cần thiết lập lại.
6. Render cấp một URL miễn phí dạng `https://thintreee-birthday.onrender.com` (URL cuối cùng phải lấy từ Dashboard khi deploy thành công; không đoán link).

### Tránh phát sinh phí

- **Không thêm phương thức thanh toán vào Render**. Theo tài liệu Render, nếu vượt băng thông / số phút build trong free tier và không có phương thức thanh toán, dịch vụ bị tạm ngưng thay vì bị tính phí. Nếu đã có phương thức thanh toán, hãy kiểm tra hạn mức thanh toán ở Dashboard trước khi triển khai.
- Neon account này đang ở gói Free. Chỉ sử dụng database Free và theo dõi quota; khi chạm giới hạn, website có thể bị hạn chế thay vì tiếp tục hoạt động vô hạn.
- Render Free ngủ sau **15 phút** không có truy cập, lượt vào đầu có thể đợi **khoảng một phút**; không phù hợp dịch vụ yêu cầu uptime cao. Không sử dụng ping tự động để cố né chính sách miễn phí.
- Ảnh upload được lưu trong PostgreSQL (`media.bytes`); giới hạn ảnh 5 MB mỗi tệp. Neon Free có giới hạn lưu trữ và băng thông; nên sử dụng ảnh nén WebP và theo dõi dung lượng.

### Khả năng kiểm thử

`npm test` chạy các bài kiểm thử E2E ở chế độ SQLite local. Các đường xử lý API vẫn dùng chung cho PostgreSQL; **chưa thể coi production PostgreSQL đã được nghiệm thu cho đến khi kiểm tra trên Render với DATABASE_URL thật**. Kiểm thử thêm việc đăng nhập, đặt quà, gửi lời chúc, upload ảnh, đăng xuất, đăng nhập Admin và trạng thái sau khi restart dịch vụ.

### Nguồn tham khảo

- https://render.com/docs/free
- https://render.com/docs/your-first-deploy
- https://neon.com/docs/introduction/pro-plan
