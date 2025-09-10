# 🔧 Troubleshooting Guide

## 🚨 **Gemini API Issues**

### **Vấn đề: Tất cả Gemini models bị lỗi (503/429)**

#### **Triệu chứng:**

```
❌ gemini-1.5-flash Error: Request failed with status code 503
❌ gemini-2.0-flash-exp Error: Request failed with status code 503
❌ gemini-1.5-pro Error: Request failed with status code 429
❌ All Gemini models failed
```

#### **Nguyên nhân:**

- Google Gemini API bị overload nặng
- Rate limiting do quá nhiều requests
- Network timeout issues

#### **Giải pháp:**

### **1. Sử dụng Demo Mode (Khuyên dùng)**

Thêm vào `.env`:

```bash
SKIP_GEMINI=true
```

Hệ thống sẽ tạo demo lessons với 10 câu hỏi thay vì gọi Gemini.

### **2. Đợi và thử lại sau**

Google Gemini thường phục hồi trong 5-15 phút:

```bash
# Test kết nối
GET /api/marxist-philosophy/test-gemini
```

### **3. Thay đổi API Key**

Nếu bị rate limit, thử API key khác:

```bash
GEMINI_API_KEY=your_new_api_key_here
```

---

## 📊 **Database Issues**

### **Vấn đề: Không có Marxist topics**

```
Không có chủ đề Marxist nào trong database
```

#### **Giải pháp:**

```bash
# Seed topics mặc định
npm run seed:marxist

# Hoặc qua API
POST /api/marxist-topics/seed
Authorization: Bearer <admin_token>
```

---

## 🔄 **Development Workflow**

### **Setup môi trường development:**

1. **Copy và cấu hình .env:**

```bash
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn
```

2. **Bật demo mode để tránh Gemini issues:**

```bash
SKIP_GEMINI=true
```

3. **Seed dữ liệu:**

```bash
npm run seed:marxist
```

4. **Test system:**

```bash
GET /api/marxist-philosophy/learning-path
# Sẽ tạo demo lesson tự động
```

---

## 📝 **Logs Debugging**

### **Healthy logs:**

```
🤖 Trying model: gemini-1.5-flash
✅ gemini-1.5-flash success on attempt 1
📝 Created lesson với 10 câu hỏi
```

### **Fallback logs:**

```
⚠️ Gemini API failed, creating demo lesson...
📝 Creating demo lesson với 10 câu hỏi
✅ Demo lesson created successfully
```

### **Error logs cần chú ý:**

```
❌ All Gemini models failed → OK, sẽ dùng demo
❌ Không có topic nào trong database → Cần seed
❌ Lesson validation failed → Check data structure
```

---

## ⚡ **Performance Tips**

1. **Development**: Luôn dùng `SKIP_GEMINI=true`
2. **Production**: Monitor Gemini API status
3. **Rate limiting**: Tránh tạo quá nhiều lesson cùng lúc
4. **Database**: Index đã được tối ưu sẵn

---

## 🆘 **Emergency Fallbacks**

### **Khi tất cả fail:**

1. Set `SKIP_GEMINI=true`
2. Seed topics: `npm run seed:marxist`
3. Test: `GET /api/marxist-philosophy/learning-path`
4. Demo lessons sẽ hoạt động 100%

### **Contact Support:**

- Check GitHub issues
- API documentation: Google Gemini docs
- Rate limits: Kiểm tra quota
