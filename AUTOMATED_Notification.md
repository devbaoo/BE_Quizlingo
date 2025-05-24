# Hệ Thống Thông Báo Tự Động - Automated Notifications

Hệ thống thông báo tự động để nhắc nhở users học tập đều đặn khi họ không hoạt động trên ứng dụng.

## Tính Năng

### 🔄 Automated Notifications

- **Tự động kiểm tra**: Hệ thống tự động kiểm tra users không hoạt động mỗi ngày
- **Thông báo thông minh**: Nội dung thông báo thay đổi theo số ngày không hoạt động
- **Không spam**: Chỉ gửi 1 thông báo mỗi ngày cho mỗi user
- **Tôn trọng cài đặt**: Tuân thủ cài đặt thông báo của từng user

### 📅 Lịch Chạy Tự Động

- **10:00 AM** (GMT+7): Kiểm tra sáng
- **6:00 PM** (GMT+7): Kiểm tra tối
- **Development**: Thêm kiểm tra thống kê mỗi giờ

### 💬 Nội Dung Thông Báo Theo Ngày

- **1 ngày**: "📚 Bạn đã quên học hôm nay rồi!"
- **2-3 ngày**: "⏰ Nhớ học tiếng Anh đều đặn nhé!"
- **4-7 ngày**: "🎯 Hãy quay lại học tập!"
- **8-14 ngày**: "💔 Quizlingo nhớ bạn!"
- **14+ ngày**: "🌟 Chúng mình đang chờ bạn!"

## Cài Đặt

### 1. Cài Đặt Dependencies

```bash
npm install node-cron
```

### 2. Biến Môi Trường

Thêm vào file `.env`:

```env
# Node Environment
NODE_ENV=development

# Email Configuration (cho notifications)
NOTIFICATION_SMTP_HOST=smtp.gmail.com
NOTIFICATION_SMTP_PORT=587
NOTIFICATION_SMTP_SECURE=false
NOTIFICATION_SMTP_USER=your-email@gmail.com
NOTIFICATION_SMTP_PASS=your-app-password
NOTIFICATION_SMTP_FROM="Quizlingo <your-email@gmail.com>"
```

### 3. Files Đã Được Thêm

```
src/
├── services/
│   └── automatedNotificationService.js    # Service chính
├── controllers/
│   └── automatedNotificationController.js # Controller cho admin
├── config/
│   └── scheduler.js                       # Cấu hình cron jobs
└── route/
    └── web.js                            # Routes (đã cập nhật)
```

### 4. Khởi Động

Scheduler sẽ tự động khởi động khi server start:

```bash
npm start
```

## API Endpoints (Admin Only)

### 📊 Thống Kê Users Không Hoạt Động

```http
GET /api/admin/automated-notifications/stats
Authorization: Bearer {admin_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "inactive1Day": 5,
    "inactive3Days": 3,
    "inactive1Week": 2,
    "inactive2Weeks": 1
  }
}
```

### 🚀 Chạy Kiểm Tra Thủ Công

```http
POST /api/admin/automated-notifications/run-check
Authorization: Bearer {admin_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalInactiveUsers": 10,
    "notificationsSent": 8,
    "emailOnlyNotifications": 2,
    "processedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### ⚙️ Thông Tin Scheduler

```http
GET /api/admin/automated-notifications/scheduler-info
Authorization: Bearer {admin_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isActive": true,
    "schedules": [
      {
        "name": "Daily Morning Check",
        "time": "10:00 AM",
        "cron": "0 10 * * *",
        "timezone": "Asia/Ho_Chi_Minh"
      }
    ],
    "environment": "development"
  }
}
```

## Hoạt Động Của Hệ Thống

### 🔍 Logic Kiểm Tra

1. **Tìm users không hoạt động**: `lastLoginDate < 1 ngày trước` HOẶC `lastLoginDate = null`
2. **Kiểm tra đã gửi thông báo hôm nay chưa**: Tránh spam
3. **Tính số ngày không hoạt động**: Từ `lastLoginDate` hoặc `createdAt`
4. **Tạo nội dung phù hợp**: Theo số ngày không hoạt động
5. **Gửi thông báo**: Tuân thủ cài đặt của user

### 📱 Cài Đặt Thông Báo User

Users có thể tắt/bật thông báo:

- **Push Notifications**: Thông báo trong ứng dụng
- **Email Notifications**: Thông báo qua email

### 🎯 Notification Types

- `inactive_reminder`: Thông báo nhắc nhở học tập
- `system`: Thông báo hệ thống khác
- `level_up`: Thông báo lên cấp

## Monitoring & Logs

### 📋 Console Logs

```bash
[SCHEDULER] Starting automated notification scheduler...
[CRON] Starting inactive users check...
[CRON] Found 5 inactive users
[CRON] Sent notification to user: user@email.com (2 days inactive)
[CRON] Inactive users check completed: {...}
```

### 🔍 Debug Mode

Đặt `NODE_ENV=development` để bật:

- Kiểm tra thống kê mỗi giờ
- Chi tiết logs hơn
- Thêm debug information

## Customization

### ⏰ Thay Đổi Lịch Chạy

Chỉnh sửa trong `src/config/scheduler.js`:

```javascript
// Chạy mỗi 30 phút
cron.schedule("*/30 * * * *", async () => {
  // ...
});

// Chạy lúc 8:00 AM và 8:00 PM
cron.schedule("0 8,20 * * *", async () => {
  // ...
});
```

### 💬 Thay Đổi Nội Dung Thông Báo

Chỉnh sửa `getNotificationContent()` trong `automatedNotificationService.js`:

```javascript
static getNotificationContent(daysInactive, firstName) {
  // Thêm logic và nội dung mới
}
```

### 🎯 Thay Đổi Điều Kiện Inactive

Chỉnh sửa query trong `checkAndNotifyInactiveUsers()`:

```javascript
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
// Thay vì 1 ngày, check users inactive 2 ngày
```

## Troubleshooting

### ❌ Common Issues

**1. Scheduler không chạy:**

- Kiểm tra `Scheduler.start()` trong `server.js`
- Xem logs khi server khởi động

**2. Email không gửi được:**

- Kiểm tra cấu hình SMTP trong `.env`
- Kiểm tra logs email service

**3. Thông báo gửi nhiều lần:**

- Kiểm tra logic check notification hôm nay
- Xem MongoDB collection `notifications`

**4. Timezone không đúng:**

- Kiểm tra cấu hình `timezone: "Asia/Ho_Chi_Minh"`
- Server timezone setting

### 🔧 Manual Testing

```bash
# Chạy manual check
curl -X POST http://localhost:8080/api/admin/automated-notifications/run-check \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Xem stats
curl http://localhost:8080/api/admin/automated-notifications/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Production Considerations

### 🚀 Deploy

- Đặt `NODE_ENV=production`
- Tắt hourly stats check
- Monitor logs và performance
- Backup notification data

### 📊 Metrics

Track các metrics:

- Số thông báo gửi mỗi ngày
- Tỷ lệ users quay lại sau thông báo
- Email delivery rate
- Error rates

### 🔒 Security

- Chỉ admin mới access được management APIs
- Rate limiting cho manual check
- Validate input parameters
- Monitor abuse

---

**Lưu ý**: Hệ thống sẽ tự động chạy sau khi cài đặt. Không cần thao tác thêm từ admin.
