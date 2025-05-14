# Hướng dẫn cấu hình email cho xác thực tài khoản

Hệ thống xác thực email sử dụng dịch vụ email để gửi thông báo xác thực đến người dùng. Dưới đây là hướng dẫn cài đặt đơn giản.

## Quy trình xác thực email

1. Người dùng đăng ký và có thể đăng nhập ngay lập tức
2. Email xác thực được gửi đến địa chỉ email của người dùng
3. Frontend có thể kiểm tra `needVerification` trong response đăng nhập để hiển thị nhắc nhở
4. Người dùng click vào link xác thực trong email
5. Server xử lý xác thực và chuyển hướng người dùng đến URL do frontend cung cấp (returnUrl)

## Cấu hình email đơn giản

### Bước 1: Tạo file .env

Tạo hoặc cập nhật file `.env` trong thư mục gốc dự án:

```
# Thông tin cơ bản
PORT=8080
MONGO_URI=mongodb://localhost:27017/quizlingo
JWT_SECRET=quizlingo_jwt_secret_key_for_secure_authentication

# Cấu hình email (sử dụng Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Bước 2: Tạo Google App Password

1. Đăng nhập vào tài khoản Google của bạn
2. Truy cập: https://myaccount.google.com/security
3. Bật xác thực 2 lớp (2-Step Verification) nếu chưa bật
4. Sau khi bật xác thực 2 lớp, truy cập: https://myaccount.google.com/apppasswords
5. Chọn "App" là "Mail" và "Device" là "Other" (đặt tên là "QuizLingo")
6. Nhấn "Generate"
7. Copy mật khẩu 16 ký tự được tạo ra và dán vào `EMAIL_PASSWORD` trong file `.env`

## Kiểm tra cấu hình

Để kiểm tra cấu hình đang hoạt động:

1. Đăng ký một tài khoản mới: `POST /api/auth/register`
2. Kiểm tra log trên console để xem thông tin gửi email
3. Email sẽ được gửi đến địa chỉ email người dùng đã đăng ký
4. Kiểm tra quy trình xác thực bằng cách sử dụng endpoint:
   `GET /api/auth/verify-email/:token?returnUrl=https://your-frontend.com/verification-success`

## Hướng dẫn frontend

### Thiết lập trang xác thực thành công

1. Tạo trang verification-success trên frontend của bạn
2. Đảm bảo rằng URL frontend của bạn được truyền trong parameter `returnUrl` khi người dùng click vào link xác thực
3. Ví dụ: Link xác thực nên có dạng `/api/auth/verify-email/TOKEN?returnUrl=https://your-app.com/verification-success`

### Hiển thị thông báo xác thực

Frontend nên kiểm tra trường `needVerification` trong response đăng nhập:

```javascript
fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@example.com", password: "password" }),
})
  .then((res) => res.json())
  .then((data) => {
    if (data.needVerification) {
      // Hiển thị thông báo xác thực
      showVerificationBanner();
    }
  });
```

### Gửi lại email xác thực

Thêm tùy chọn cho người dùng gửi lại email xác thực:

```javascript
function resendVerificationEmail(email) {
  return fetch("/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).then((res) => res.json());
}
```

## Xử lý sự cố

Nếu gặp lỗi khi gửi email:

1. Kiểm tra log để xem chi tiết lỗi
2. Đảm bảo thông tin đăng nhập email chính xác
3. Kiểm tra cài đặt bảo mật của tài khoản Gmail
4. Đảm bảo App Password đã được tạo đúng cách

### Một số lỗi phổ biến:

- **"Invalid login"**: Kiểm tra lại email và app password
- **"Username and Password not accepted"**: Gmail có thể chặn truy cập, kiểm tra:
  - Bật "Less secure app access" tại https://myaccount.google.com/lesssecureapps
  - Kiểm tra email của bạn, có thể có thông báo bảo mật từ Google

### Dịch vụ email thay thế:

Nếu không muốn sử dụng Gmail, bạn có thể thay đổi cấu hình để sử dụng:

- **SendGrid**: Đăng ký tại [SendGrid](https://sendgrid.com/)
- **Mailgun**: Đăng ký tại [Mailgun](https://www.mailgun.com/)
- **Mailjet**: Đăng ký tại [Mailjet](https://www.mailjet.com/)

Các dịch vụ này thường có gói miễn phí và cung cấp hướng dẫn cấu hình chi tiết.
