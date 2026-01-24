import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * DELETE /api/threads/[id]
 * Soft delete a thread
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id: threadId } = await params;

    const supabase = await createClient();

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify thread ownership and soft delete
    const { error } = await supabase
        .from('chat_threads')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', threadId)
        .eq('user_id', user.id);

    if (error) {
        console.error('[API /threads/[id] DELETE] Error:', error);
        return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
    }

    return new NextResponse(null, { status: 200 });
}
