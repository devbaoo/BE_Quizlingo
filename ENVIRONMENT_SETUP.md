# Environment Variables Setup

## 📋 Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Grok4 AI Configuration (Primary AI - 70%)
OPENROUTER_API_KEY=your_openrouter_api_key_here
SITE_URL=https://marx-edu.netlify.app
SITE_NAME=Marx-Edu - Marxist Philosophy Learning

# Gemini AI Configuration (Backup AI - 30%)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# Skip AI for development (set to true to use demo lessons)
SKIP_GEMINI=false
```

## 🔧 Quick Setup

### Option 1: Manual Creation

1. Copy the template above
2. Create `.env` file in project root
3. Replace `your_gemini_api_key_here` with your actual API key

### Option 2: Command Line (Windows)

```powershell
echo "# Grok4 AI Configuration (Primary AI - 70%)
OPENROUTER_API_KEY=your_openrouter_api_key_here
SITE_URL=https://marx-edu.netlify.app
SITE_NAME=Marx-Edu - Marxist Philosophy Learning

# Gemini AI Configuration (Backup AI - 30%)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# Skip AI for development
SKIP_GEMINI=false" > .env
```

### Option 3: Command Line (Linux/Mac)

```bash
cat > .env << 'EOF'
# Grok4 AI Configuration (Primary AI - 70%)
OPENROUTER_API_KEY=your_openrouter_api_key_here
SITE_URL=https://marx-edu.netlify.app
SITE_NAME=Marx-Edu - Marxist Philosophy Learning

# Gemini AI Configuration (Backup AI - 30%)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models

# Skip AI for development
SKIP_GEMINI=false
EOF
```

## 🔑 Getting API Keys

### Grok4 API Key (Primary - Required)

1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Create a new API key
3. Copy the key and paste it as `OPENROUTER_API_KEY` in your `.env` file

### Gemini API Key (Backup - Required)

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and paste it as `GEMINI_API_KEY` in your `.env` file

## ⚙️ Configuration Options

| Variable             | Description                   | Default                        | Required |
| -------------------- | ----------------------------- | ------------------------------ | -------- |
| `OPENROUTER_API_KEY` | OpenRouter API key for Grok4  | -                              | ✅       |
| `SITE_URL`           | Your site URL for OpenRouter  | `https://marx-edu.netlify.app` | ❌       |
| `SITE_NAME`          | Your site name for OpenRouter | `Marx-Edu`                     | ❌       |
| `GEMINI_API_KEY`     | Google Gemini API key         | -                              | ✅       |
| `GEMINI_MODEL`       | Gemini model to use           | `gemini-1.5-flash`             | ❌       |
| `GEMINI_API_URL`     | Gemini base API URL           | Google's official URL          | ❌       |
| `SKIP_GEMINI`        | Use demo lessons instead      | `false`                        | ❌       |

## 🧪 Testing Configuration

After setting up `.env`, test your configuration:

```bash
# Start the server
npm start

# Test AI connections (admin only)
GET /api/marxist-philosophy/test-all-ai
GET /api/marxist-philosophy/multi-ai-stats
```

## 🚨 Important Notes

- **Never commit** `.env` file to git (already in `.gitignore`)
- **Keep your API key secure** - don't share it publicly
- **Use `SKIP_GEMINI=true`** for development without API costs
- **Restart server** after changing `.env` variables

## 🔄 Available AI Models

### Grok4 Models (Primary AI)

| Model                   | Speed        | Quality | Cost      |
| ----------------------- | ------------ | ------- | --------- |
| `x-ai/grok-4-fast:free` | ⚡ Very Fast | 🟢 Good | 💰 Free   |
| `x-ai/grok-4-fast`      | ⚡ Very Fast | 🟢 Good | 💰💰 Paid |

### Gemini Models (Backup AI)

| Model                  | Speed   | Quality   | Cost        |
| ---------------------- | ------- | --------- | ----------- |
| `gemini-1.5-flash`     | ⚡ Fast | 🟢 Good   | 💰 Low      |
| `gemini-1.5-pro`       | 🐌 Slow | 🟡 Better | 💰💰 Medium |
| `gemini-2.0-flash-exp` | ⚡ Fast | 🟢 Good   | 💰 Low      |

## 🛠️ Troubleshooting

### Error: "OPENROUTER_API_KEY is missing"

- Check if `.env` file exists in project root
- Verify `OPENROUTER_API_KEY` is set correctly
- Visit [OpenRouter](https://openrouter.ai/keys) to get API key
- Restart the server after changes

### Error: "GEMINI_API_KEY is missing"

- Check if `.env` file exists in project root
- Verify `GEMINI_API_KEY` is set correctly
- Visit [Google AI Studio](https://makersuite.google.com/app/apikey) to get API key
- Restart the server after changes

### Error: "403 Forbidden"

- API key might be invalid or expired
- For Grok4: Check OpenRouter account credits/limits
- For Gemini: Check Google Cloud Console for billing/quota
- Try generating a new API key

### Error: "404 Not Found" or "Invalid model ID"

- Check model names are correct (`x-ai/grok-4-fast:free`, `gemini-1.5-flash`)
- Verify API URLs format
- For Grok4: Ensure using OpenRouter endpoint

For more help, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
