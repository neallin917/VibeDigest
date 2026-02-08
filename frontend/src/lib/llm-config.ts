import { createOpenAI } from '@ai-sdk/openai';

// Define debug fetch once
const AI_SDK_DEBUG = process.env.AI_SDK_DEBUG === '1';

const debugFetch: typeof fetch = async (input, init) => {
    if (AI_SDK_DEBUG) {
        try {
            const url = typeof input === 'string' ? input : input.toString();
            console.log('[AI SDK] Request URL:', url);
            if (init?.body) {
                console.log('[AI SDK] Request body:', init.body.toString());
            }
        } catch (e) {
            console.warn('[AI SDK] Failed to log request:', e);
        }
    }
    const response = await fetch(input, init);
    if (AI_SDK_DEBUG && !response.ok) {
        try {
            const text = await response.clone().text();
            console.log('[AI SDK] Response status:', response.status);
            console.log('[AI SDK] Response body:', text);
        } catch (e) {
            console.warn('[AI SDK] Failed to log response:', e);
        }
    }
    return response;
};

export type ProviderConfig = {
    baseURL?: string;
    apiKey?: string;
    fetch?: typeof fetch;
}

export function getProviderConfig(providerName: string): ProviderConfig {
    // Default to OpenAI/Custom env vars
    let baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    let apiKey = process.env.OPENAI_API_KEY || '';

    // Override for OpenRouter
    if (providerName === 'openrouter') {
        baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
        apiKey = process.env.OPENROUTER_API_KEY || '';
    }

    return {
        baseURL,
        apiKey,
        fetch: AI_SDK_DEBUG ? debugFetch : undefined
    };
}

export function createProviderClient(providerName: string) {
    const config = getProviderConfig(providerName);
    return createOpenAI(config);
}
