# QuizLingo Authentication System

Hệ thống xác thực JWT với bcrypt và xác thực email cho ứng dụng QuizLingo.

## Tính năng

- Đăng ký người dùng với mã hóa mật khẩu
- Đăng nhập an toàn với JWT
- Xác thực role-based (admin/user)
- Middleware bảo vệ route
- Mã hóa mật khẩu an toàn với bcrypt
- Xác thực email (tùy chọn, không bắt buộc để đăng nhập)
- Kiến trúc Controller-Service cho tổ chức code tốt hơn

## Kiến trúc dự án

Ứng dụng sử dụng kiến trúc Controller-Service:

- **Controllers**: Xử lý HTTP requests và responses
- **Services**: Chứa business logic và xử lý dữ liệu
- **Middlewares**: Xử lý xác thực và authorization
- **Models**: Định nghĩa schema dữ liệu

Mô hình này giúp code dễ bảo trì, kiểm thử và mở rộng.

## API Endpoints

### Xác thực

- **POST /api/auth/register** - Đăng ký người dùng mới

  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```

- **POST /api/auth/login** - Đăng nhập để lấy JWT token

  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```

- **GET /api/auth/verify-email/:token?returnUrl=https://your-frontend.com/verified** - Xác thực email (với chuyển hướng đến frontend)

- **POST /api/auth/resend-verification** - Gửi lại email xác thực
  ```json
  {
    "email": "john@example.com"
  }
  ```

### Quản lý người dùng

- **GET /api/users/profile** - Lấy thông tin profile (cần xác thực)
- **PUT /api/users/profile** - Cập nhật profile (cần xác thực)
  ```json
  {
    "firstName": "Updated",
    "lastName": "Name",
    "email": "updated@example.com"
  }
  ```
- **GET /api/users** - Lấy tất cả người dùng (cần role admin)

### Routes mẫu

- **GET /api/profile** - Route có bảo vệ (cần xác thực)
- **GET /api/admin** - Route dành cho admin (cần role admin)

## Luồng xác thực email

1. **Đăng ký**:

   - Người dùng đăng ký bình thường và đăng nhập được ngay (isVerify = false)
   - Backend gửi email xác thực đến email người dùng

2. **Đăng nhập**:

   - Cho phép đăng nhập ngay cả khi chưa xác thực email
   - Trả về trường `needVerification: true` để frontend hiển thị thông báo cho người dùng xác thực

3. **Xác thực email**:

   - Người dùng click vào link trong email
   - Có thể thêm parameter `returnUrl` để chuyển hướng đến trang frontend
   - Ví dụ: `/api/auth/verify-email/TOKEN?returnUrl=https://your-app.com/verified`

4. **Gửi lại email xác thực**:
   - Frontend có thể yêu cầu gửi lại email xác thực bất cứ lúc nào

## Cách sử dụng xác thực

1. **Đăng ký người dùng**:

   ```javascript
   fetch("/api/auth/register", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       firstName: "John",
       lastName: "Doe",
       email: "john@example.com",
       password: "password123",
     }),
   })
     .then((res) => res.json())
     .then((data) => {
       // Lưu token vào localStorage
       localStorage.setItem("token", data.token);
     });
   ```

2. **Đăng nhập**:

   ```javascript
   fetch("/api/auth/login", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       email: "john@example.com",
       password: "password123",
     }),
   })
     .then((res) => res.json())
     .then((data) => {
       // Lưu token vào localStorage
       localStorage.setItem("token", data.token);

       // Kiểm tra nếu cần xác thực email
       if (data.needVerification) {
         // Hiển thị UI nhắc người dùng xác thực email
       }
     });
   ```

3. **Truy cập route có bảo vệ**:

   ```javascript
   fetch("/api/users/profile", {
     method: "GET",
     headers: {
       Authorization: `Bearer ${localStorage.getItem("token")}`,
     },
   })
     .then((res) => res.json())
     .then((data) => console.log(data));
   ```

4. **Gửi lại email xác thực**:
   ```javascript
   fetch("/api/auth/resend-verification", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       email: "john@example.com",
     }),
   })
     .then((res) => res.json())
     .then((data) => console.log(data));
   ```

## Cấu hình gửi email

Xem chi tiết trong file EMAIL_SETUP.md

## Security Considerations

- The JWT secret should be kept secure and never exposed to the client
- In production, set strong JWT_SECRET in your environment variables
- Tokens expire after 1 day for security
- Passwords are securely hashed using bcrypt with salt
