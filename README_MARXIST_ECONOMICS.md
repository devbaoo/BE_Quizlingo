# Hệ Thống Kinh Tế Chính Trị Mác-Lê-Nin

## Tổng Quan

Hệ thống này được tích hợp vào BE_Quizlingo để tạo và quản lý bộ câu hỏi về kinh tế chính trị Mác-Lê-Nin sử dụng Google Gemini AI. Hệ thống tự động tạo ra 30 câu hỏi trắc nghiệm cho mỗi bài học và điều chỉnh độ khó dựa trên kết quả học tập của người dùng.

## Tính Năng Chính

### 🤖 AI-Generated Lessons

- Tự động tạo bài học với 30 câu hỏi trắc nghiệm
- Sử dụng Google Gemini API
- Điều chỉnh độ khó dựa trên kết quả trước đó (1-5 cấp độ)

### 📚 10 Chủ Đề Marxist

1. **Chủ nghĩa tư bản** - Lý thuyết về chế độ tư bản chủ nghĩa
2. **Giá trị thặng dư** - Nguồn gốc lợi nhuận của nhà tư bản
3. **Đấu tranh giai cấp** - Lý thuyết về đấu tranh giai cấp
4. **Cộng hòa xã hội chủ nghĩa** - Lý thuyết về nhà nước
5. **Đảng cộng sản** - Vai trò của Đảng trong cách mạng
6. **Cách mạng vô sản** - Lý thuyết về cách mạng xã hội chủ nghĩa
7. **Kinh tế chính trị** - Quy luật kinh tế cơ bản
8. **Chủ nghĩa xã hội** - Lý thuyết về xã hội xã hội chủ nghĩa
9. **Duy vật biện chứng** - Phương pháp luận Mác-xít
10. **Duy vật lịch sử** - Quan niệm về phát triển xã hội

### 🎯 Adaptive Learning

- AI phân tích kết quả 3 bài gần nhất
- Tự động điều chỉnh độ khó (1-5)
- Đề xuất chủ đề tiếp theo dựa trên điểm yếu
- Tạo bài học mới sau khi hoàn thành (điểm ≥ 70)

## API Endpoints

### POST `/api/marxist-economics/generate-lesson`

**Tạo bài học mới**

```json
{
  "topic": "chu_nghia_tu_ban", // optional
  "difficulty": 2 // optional (1-5)
}
```

### GET `/api/marxist-economics/learning-path`

**Lấy lộ trình học tập**

```
?page=1&limit=10
```

### POST `/api/marxist-economics/complete-lesson`

**Hoàn thành bài học**

```json
{
  "lessonId": "lesson_id",
  "score": 85
}
```

### GET `/api/marxist-economics/stats`

**Thống kê học tập**

### GET `/api/marxist-economics/topics`

**Danh sách chủ đề** (public)

### GET `/api/marxist-economics/analyze-progress`

**Phân tích tiến độ và đề xuất**

### GET `/api/marxist-economics/test-gemini`

**Test kết nối Gemini** (admin only)

## Database Models

### MarxistLearningPath

```javascript
{
  userId: ObjectId,
  lessonId: ObjectId,
  marxistTopic: String,      // chu_nghia_tu_ban, gia_tri_thang_du...
  difficultyLevel: Number,   // 1-5
  previousScore: Number,     // Điểm TB 3 bài trước
  recommendedReason: String, // Lý do AI tạo bài này
  order: Number,            // Thứ tự trong lộ trình
  completed: Boolean,
  achievedScore: Number,
  completedAt: Date
}
```

## Cấu Trúc Files

```
src/
├── services/
│   ├── geminiService.js              # Google Gemini API integration
│   └── marxistEconomicsService.js    # Core business logic
├── controllers/
│   ├── marxistEconomicsController.js # API handlers
│   └── marxistTopicController.js     # Topic management
├── models/
│   ├── marxistLearningPath.js        # Learning path tracking
│   └── marxistTopic.js               # Dynamic topics
├── scripts/
│   └── seedMarxistTopics.js          # Seed default topics
└── route/
    └── web.js                        # API routes (updated)
```

## Cách Sử Dụng

### 1. Khởi Tạo Học Tập

```bash
GET /api/marxist-economics/learning-path
# Tự động tạo bài đầu tiên nếu chưa có
```

### 2. Tạo Bài Học Thủ Công

```bash
POST /api/marxist-economics/generate-lesson
Content-Type: application/json

{
  "topic": "dau_tranh_giai_cap",
  "difficulty": 3
}
```

### 3. Hoàn Thành Bài Học

```bash
POST /api/marxist-economics/complete-lesson
Content-Type: application/json

{
  "lessonId": "64a...",
  "score": 85
}
# Tự động tạo bài tiếp theo nếu điểm ≥ 70
```

## Logic AI

### Phân Tích Tiến Độ

1. Lấy 3 bài gần nhất
2. Tính điểm trung bình
3. Điều chỉnh độ khó:
   - Điểm ≥ 90: Tăng 1 cấp độ
   - Điểm ≥ 80: Giữ nguyên
   - Điểm ≥ 70: Giảm 1 cấp độ
   - Điểm < 70: Giảm 2 cấp độ

### Chọn Chủ Đề

1. Ưu tiên chủ đề chưa học
2. Nếu đã học hết → Ôn lại chủ đề yếu nhất

### Prompt Engineering

- 30 câu hỏi trắc nghiệm chính xác
- Nội dung dựa trên lý thuyết Mác-Lê-Nin
- Độ khó phù hợp với cấp độ
- 4 đáp án mỗi câu (A, B, C, D)
- Thời gian 45s/câu

## Gemini API Configuration

```javascript
// API Key (đã config trong code)
const GEMINI_API_KEY = "AIzaSyC-f4u4ZvfIOi1WReflo_aoQanP_Ilg6tM";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
```

## Authentication

Tất cả endpoints (trừ `/topics`) yêu cầu JWT token trong header:

```
Authorization: Bearer <jwt_token>
```

Endpoint `/test-gemini` chỉ admin mới được truy cập.

## Notifications

Hệ thống tự động gửi thông báo khi:

- Tạo bài học mới thành công
- Có bài học AI-generated sẵn sàng

## Error Handling

- Validation input parameters
- Gemini API error handling
- Database transaction safety
- Proper HTTP status codes
- Detailed error messages

## Testing

Test kết nối Gemini:

```bash
GET /api/marxist-economics/test-gemini
Authorization: Bearer <admin_token>
```

## Performance

- Timeout 30s cho Gemini API calls
- Index database cho optimal queries
- Pagination cho learning path
- Efficient aggregation cho stats
