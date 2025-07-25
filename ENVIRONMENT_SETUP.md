# Environment Variables Setup

## 📋 Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# Skip Gemini API for development (set to true to use demo lessons)
SKIP_GEMINI=false
```

## 🔧 Quick Setup

### Option 1: Manual Creation

1. Copy the template above
2. Create `.env` file in project root
3. Replace `your_gemini_api_key_here` with your actual API key

### Option 2: Command Line (Windows)

```powershell
echo "# Gemini AI Configuration
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# Skip Gemini API for development
SKIP_GEMINI=false" > .env
```

### Option 3: Command Line (Linux/Mac)

```bash
cat > .env << 'EOF'
# Gemini AI Configuration
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# Skip Gemini API for development
SKIP_GEMINI=false
EOF
```

## 🔑 Getting Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and paste it in your `.env` file

## ⚙️ Configuration Options

| Variable         | Description              | Default               | Required |
| ---------------- | ------------------------ | --------------------- | -------- |
| `GEMINI_API_KEY` | Google Gemini API key    | -                     | ✅       |
| `GEMINI_MODEL`   | Model to use             | `gemini-1.5-flash`    | ❌       |
| `GEMINI_API_URL` | Base API URL             | Google's official URL | ❌       |
| `SKIP_GEMINI`    | Use demo lessons instead | `false`               | ❌       |

## 🧪 Testing Configuration

After setting up `.env`, test your configuration:

```bash
# Start the server
npm start

# Test Gemini connection (admin only)
GET /api/marxist-economics/test-connection
```

## 🚨 Important Notes

- **Never commit** `.env` file to git (already in `.gitignore`)
- **Keep your API key secure** - don't share it publicly
- **Use `SKIP_GEMINI=true`** for development without API costs
- **Restart server** after changing `.env` variables

## 🔄 Available Models

| Model                  | Speed   | Quality   | Cost        |
| ---------------------- | ------- | --------- | ----------- |
| `gemini-1.5-flash`     | ⚡ Fast | 🟢 Good   | 💰 Low      |
| `gemini-1.5-pro`       | 🐌 Slow | 🟡 Better | 💰💰 Medium |
| `gemini-2.0-flash-exp` | ⚡ Fast | 🟢 Good   | 💰 Low      |

## 🛠️ Troubleshooting

### Error: "GEMINI_API_KEY is missing"

- Check if `.env` file exists in project root
- Verify `GEMINI_API_KEY` is set correctly
- Restart the server after changes

### Error: "403 Forbidden"

- API key might be invalid or expired
- Check Google Cloud Console for billing/quota
- Try generating a new API key

### Error: "404 Not Found"

- Check `GEMINI_MODEL` is correct
- Verify `GEMINI_API_URL` format

For more help, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
