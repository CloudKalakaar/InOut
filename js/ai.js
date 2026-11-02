// ── InOut · ai.js ─────────────────────────────────────────────────────────────
// AI integration for calorie estimation from food photos or text descriptions.
// Supports Groq Cloud (free, fast) and xAI (Grok) via OpenAI-compatible endpoints.
// API key is stored safely in the user's browser localStorage (via Settings).

const AI = (() => {

  // ── System prompt ──────────────────────────────────────────────────────────
  const SYSTEM = `You are a precise nutritionist AI.
When asked about food calories, always respond with ONLY a valid JSON object.
No markdown codeblocks, no explanation, just raw valid JSON.
Format: {"items":[{"name":"food name","calories":123}],"total_calories":456,"notes":"optional brief portion note"}
Be realistic with portion sizes. If unsure, provide a reasonable conservative estimate.`;

  // ── Key & Provider resolution ──────────────────────────────────────────────
  function getCredentials() {
    const settings = (typeof Store !== 'undefined' && Store.getSettings) ? Store.getSettings() : {};
    const key = (settings.apiKey || '').trim();

    if (!key) {
      throw new Error('Please add your AI API key in Settings ⚙️ (Groq or xAI supported).');
    }

    if (key.startsWith('gsk_')) {
      // Groq Cloud endpoint — qwen/qwen3.8-27b handles both text and vision, gpt-oss-120b fallback
      return {
        key,
        provider: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        modelVision: 'qwen/qwen3.8-27b',
        modelText: 'qwen/qwen3.8-27b',
        modelTextFallback: 'openai/gpt-oss-120b'
      };
    }

    // Default to xAI Grok endpoint
    return {
      key,
      provider: 'xai',
      baseUrl: 'https://api.x.ai/v1/chat/completions',
      modelVision: 'grok-4',
      modelText: 'grok-4',
      modelVisionFallback: 'grok-2-vision-1212',
      modelTextFallback: 'grok-2-1212'
    };
  }

  // ── Shared fetch wrapper ───────────────────────────────────────────────────
  async function callAPI(messages, overrideModel = null) {
    const creds = getCredentials();
    const primaryModel = overrideModel || creds.modelText;

    async function executeRequest(modelName) {
      const payload = {
        model: modelName,
        messages,
        max_tokens: 600,
        temperature: 0.2
      };

      if (creds.provider === 'groq') {
        payload.response_format = { type: 'json_object' };
      }

      const resp = await fetch(creds.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creds.key}`
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        let msg = `API error ${resp.status}`;
        try {
          const j = JSON.parse(errText);
          msg = j.error?.message || errText;
        } catch {
          msg = errText;
        }
        throw new Error(msg);
      }

      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content || '';

      // Strip markdown code fences if model wraps response
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

      try {
        return JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error('Could not parse AI response: ' + cleaned);
      }
    }

    try {
      return await executeRequest(primaryModel);
    } catch (err) {
      // If primary model failed and we have a text fallback, try it
      if (!overrideModel && creds.modelTextFallback && creds.modelTextFallback !== primaryModel) {
        console.warn(`Primary model ${primaryModel} failed (${err.message}), trying fallback ${creds.modelTextFallback}...`);
        return await executeRequest(creds.modelTextFallback);
      }
      throw err;
    }
  }

  // ── Photo analysis ─────────────────────────────────────────────────────────
  async function analyzePhoto(base64Data, mimeType = 'image/jpeg') {
    const creds = getCredentials();
    const messages = [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this food photo. List each identified food item and its estimated calories. Return ONLY valid JSON format: {"items":[{"name":"item","calories":100}],"total_calories":100}'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`
            }
          }
        ]
      }
    ];

    try {
      return await callAPI(messages, creds.modelVision);
    } catch (e) {
      if (creds.modelVisionFallback) {
        console.warn('Vision primary failed, trying fallback:', e.message);
        try {
          return await callAPI(messages, creds.modelVisionFallback);
        } catch (e2) {
          console.warn('Vision fallback also failed:', e2.message);
        }
      }
      throw e;
    }
  }

  // ── Text analysis ──────────────────────────────────────────────────────────
  async function analyzeText(text) {
    const creds = getCredentials();
    const messages = [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Estimate calories for this food/drink: "${text}". Return ONLY valid JSON: {"items":[{"name":"item","calories":100}],"total_calories":100}`
      }
    ];
    return await callAPI(messages, creds.modelText);
  }

  // ── Availability check ─────────────────────────────────────────────────────
  async function checkAvailability() {
    try {
      const creds = getCredentials();
      await callAPI([
        { role: 'user', content: 'Respond with valid JSON: {"status":"ready"}' }
      ], creds.modelText);
      return { ok: true, message: 'AI connection active ✓' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  return { analyzePhoto, analyzeText, checkAvailability, getCredentials };
})();
