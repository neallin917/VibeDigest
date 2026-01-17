import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/threads/[id]/messages
 * Fetch all messages for a thread
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id: threadId } = await params;

    const supabase = await createClient();

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify thread ownership
    const { data: thread, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();

    if (threadError || !thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Fetch messages
    const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[API /threads/[id]/messages GET] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json(messages);
}
