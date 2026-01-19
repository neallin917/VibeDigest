import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // params is a Promise in Next.js 15+ (if using recent version), or direct object in older.
    // Assuming modern Next.js where params might be async. 
    // Safely await it.
    const { id } = await params;

    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Verify thread ownership
        const { data: thread, error: threadError } = await supabase
            .from('chat_threads')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (threadError || !thread) {
            return NextResponse.json({ error: 'Thread not found or access denied' }, { status: 404 });
        }

        // Fetch messages
        const { data: messages, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('thread_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
        }

        return NextResponse.json(messages);
    } catch (error) {
        console.error('Unexpected error fetching messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
