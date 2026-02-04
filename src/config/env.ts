// Environment variables helper
export const env = {
  DEEPSEEK_API_KEY: (import.meta as any).env?.VITE_DEEPSEEK_API_KEY || "",
  GROQ_API_KEY: (import.meta as any).env?.VITE_GROQ_API_KEY || "",
  GEMINI_API_KEY: (import.meta as any).env?.VITE_GEMINI_API_KEY || "",
};

// Check if API keys are configured
export const isConfigured = {
  deepseek: !!env.DEEPSEEK_API_KEY,
  groq: !!env.GROQ_API_KEY,
  gemini: !!env.GEMINI_API_KEY,
};