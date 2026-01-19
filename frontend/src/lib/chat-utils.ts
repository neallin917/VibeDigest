import { UIMessage } from 'ai';

// Define a type for text content part
interface TextContentPart {
    type: 'text';
    text: string;
}

// Define a type for tool invocation content part (if needed, otherwise keep as object)
// For now, we'll keep it general as the structure isn't fully defined in the original code.
type OtherContentPart = {
    type: Exclude<string, 'text'>; // Any type other than 'text'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any; // Allow any other properties
};

// A content part can be a text part or another type of part
type ContentPart = TextContentPart | OtherContentPart;

export interface DBMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'data' | 'tool';
    // content can be a string, a single object (like a text part), or an array of content parts
    content: string | ContentPart | ContentPart[]; // JSONB
    created_at: string;
}

/**
 * Maps a database message (with JSONB content) to an AI SDK v6 UI Message.
 * AI SDK v6 uses `parts` for rich content, but `useChat` messages primarily use `content` string
 * or `parts` array. We ensure compatibility here.
 */
export function mapDBMessageToUIMessage(dbMsg: DBMessage): UIMessage {
    let content = '';
    let parts: ContentPart[] = []; // Initialize with specific type

    // Handle JSONB content
    if (Array.isArray(dbMsg.content)) {
        // It's already parts-like
        parts = dbMsg.content;

        // Construct text content for backward compatibility / easy display
        content = dbMsg.content
            .filter((p: ContentPart) => p.type === 'text') // Use ContentPart type
            .map((p: TextContentPart) => p.text) // Use TextContentPart type
            .join('');

        // Extract tool invocations if any (though usually stored separately in some schemas,
        // here we assume they might be in parts if we expand later)
        // For now, simple text mapping.
    } else if (typeof dbMsg.content === 'object' && dbMsg.content !== null) {
        // Single object content?
        if (dbMsg.content.type === 'text') {
            content = dbMsg.content.text;
            parts = [dbMsg.content];
        } else {
            content = JSON.stringify(dbMsg.content); // Fallback for non-text objects
            parts = [dbMsg.content as ContentPart]; // Treat as a single part
        }
    } else if (typeof dbMsg.content === 'string') {
        content = dbMsg.content;
        parts = [{ type: 'text', text: content }];
    }

    return {
        id: dbMsg.id,
        role: dbMsg.role,
        content: content,
        createdAt: new Date(dbMsg.created_at),
        // Attach parts if your UI component uses them directly.
        // Note: official 'Message' type in 'ai' doesn't always strictly enforce 'parts' in all versions
        // but v6 strongly encourages it. We'll attach it effectively.
        parts: parts, // 'parts' is already typed as ContentPart[]
    };
}
