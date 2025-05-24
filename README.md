# BE_Quizlingo

## Overview | Tổng quan

BE_Quizlingo is a backend service for a language learning application that provides quiz and learning features.

BE_Quizlingo là một dịch vụ backend cho ứng dụng học ngôn ngữ cung cấp các tính năng học tập và kiểm tra.

## Project Structure | Cấu trúc dự án

```
src/
├── config/         # Configuration files | Các file cấu hình
├── controllers/    # Request handlers | Xử lý các request
├── middleware/     # Custom middleware | Middleware tùy chỉnh
├── models/         # Database models | Các model database
├── plugins/        # Application plugins | Các plugin của ứng dụng
├── route/          # API routes | Các route API
├── services/       # Business logic | Logic nghiệp vụ
└── server.js       # Main application file | File chính của ứng dụng
```

## Prerequisites | Yêu cầu

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation | Cài đặt

1. Clone the repository | Clone repository:

```bash
git clone <repository-url>
cd BE_Quizlingo
```

2. Install dependencies | Cài đặt các dependency:

```bash
npm install
# or
yarn install
```

3. Set up environment variables | Cấu hình biến môi trường:
   Create a `.env` file in the root directory with the following variables:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/quizlingo
JWT_SECRET=your_jwt_secret
```

## Running the Application | Chạy ứng dụng

### Development | Môi trường phát triển

```bash
npm run dev
# or
yarn dev
```

### Production | Môi trường production

```bash
npm start
# or
yarn start
```

## License | Giấy phép

This project is licensed under the MIT License - see the LICENSE file for details.
Dự án này được cấp phép theo Giấy phép MIT - xem file LICENSE để biết thêm chi tiết.

## Coding Conventions & Guidelines | Quy ước và hướng dẫn lập trình

### Code Style | Phong cách code

- Use ESLint and Prettier for code formatting
- 2 spaces for indentation
- Semicolons at the end of statements
- Single quotes for strings
- Camel case for variables and functions (e.g., `getUserById`)
- Pascal case for class names (e.g., `UserController`)
- Use meaningful and descriptive names for variables, functions, and classes

### File Naming | Đặt tên file

- Controllers: `*.controller.js`
- Models: `*.model.js`
- Routes: `*.route.js`
- Services: `*.service.js`
- Middleware: `*.middleware.js`

### Project Guidelines | Hướng dẫn dự án

1. **Error Handling | Xử lý lỗi**

   - Use try-catch blocks for async operations
   - Implement global error handling middleware
   - Return appropriate HTTP status codes
   - Include meaningful error messages

2. **API Structure | Cấu trúc API**

   ```javascript
   // Controller structure
   const controllerMethod = async (req, res, next) => {
     try {
       // Input validation
       // Business logic
       // Response
     } catch (error) {
       next(error);
     }
   };
   ```

3. **Comments & Documentation | Comment và tài liệu**

   - Use JSDoc for function documentation
   - Comment complex business logic
   - Keep inline comments minimal and meaningful

4. **Testing | Kiểm thử**
   - Write unit tests for services
   - Write integration tests for APIs
   - Maintain test coverage above 80%

## Docker Setup | Cài đặt Docker

### Prerequisites | Yêu cầu

- Docker
- Docker Compose

### Docker Compose Configuration | Cấu hình Docker Compose

Create a `docker-compose.yml` file in the root directory:

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/quizlingo
      - JWT_SECRET=your_jwt_secret
    depends_on:
      - mongodb
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules
    networks:
      - quizlingo-network

  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - quizlingo-network

networks:
  quizlingo-network:
    driver: bridge

volumes:
  mongodb_data:
```

Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### Running with Docker Compose | Chạy với Docker Compose

1. Build and start containers | Xây dựng và khởi động containers:

```bash
docker-compose up --build
```

2. Run in detached mode | Chạy ở chế độ nền:

```bash
docker-compose up -d
```

3. Stop containers | Dừng containers:

```bash
docker-compose down
```

4. View logs | Xem logs:

```bash
docker-compose logs -f
```

### Development with Docker | Phát triển với Docker

For development, you can use the following command:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Create a `docker-compose.dev.yml`:

```yaml
version: "3.8"

services:
  app:
    build:
      target: development
    command: npm run dev
    environment:
      - NODE_ENV=development
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules
```
