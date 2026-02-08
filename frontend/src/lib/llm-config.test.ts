import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProviderConfig } from './llm-config';

describe('getProviderConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns OpenRouter config when provider is openrouter', () => {
        process.env.OPENROUTER_BASE_URL = 'https://openrouter.mock/api/v1';
        process.env.OPENROUTER_API_KEY = 'sk-or-mock';
        
        // Ensure OpenAI vars don't interfere
        process.env.OPENAI_BASE_URL = 'https://openai.mock/v1';
        process.env.OPENAI_API_KEY = 'sk-openai-mock';

        const config = getProviderConfig('openrouter');

        expect(config.baseURL).toBe('https://openrouter.mock/api/v1');
        expect(config.apiKey).toBe('sk-or-mock');
    });

    it('returns OpenAI config when provider is openai', () => {
        process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
        process.env.OPENAI_API_KEY = 'sk-openai-mock';

        const config = getProviderConfig('openai');

        expect(config.baseURL).toBe('https://api.openai.com/v1');
        expect(config.apiKey).toBe('sk-openai-mock');
    });

    it('returns OpenAI config when provider is custom', () => {
        process.env.OPENAI_BASE_URL = 'http://localhost:1234/v1';
        process.env.OPENAI_API_KEY = 'sk-custom-mock';

        const config = getProviderConfig('custom');

        expect(config.baseURL).toBe('http://localhost:1234/v1');
        expect(config.apiKey).toBe('sk-custom-mock');
    });

    it('defaults to OpenRouter public URL if OPENROUTER_BASE_URL is missing', () => {
        delete process.env.OPENROUTER_BASE_URL;
        const config = getProviderConfig('openrouter');
        expect(config.baseURL).toBe('https://openrouter.ai/api/v1');
    });

    it('defaults to OpenAI public URL if OPENAI_BASE_URL is missing', () => {
        delete process.env.OPENAI_BASE_URL;
        const config = getProviderConfig('openai');
        expect(config.baseURL).toBe('https://api.openai.com/v1');
    });
});
