import type { ToolContext } from '../types';
import { createGetTaskStatusTool } from './get-task-status';
import { createGetTaskOutputsTool } from './get-task-outputs';
import { createCreateTaskTool } from './create-task';
import { createPreviewVideoTool } from './preview-video';

export { taskStatusSchema } from './get-task-status';
export { taskOutputsSchema } from './get-task-outputs';
export { createTaskSchema } from './create-task';
export { previewVideoSchema } from './preview-video';

/**
 * Build the tools object for streamText based on whether video tools are allowed.
 */
export function buildTools(
    ctx: ToolContext,
    allowVideoTools: boolean
): Record<string, unknown> {
    const tools: Record<string, unknown> = {
        get_task_status: createGetTaskStatusTool(ctx),
        get_task_outputs: createGetTaskOutputsTool(ctx),
    };

    if (allowVideoTools) {
        tools.create_task = createCreateTaskTool(ctx);
        tools.preview_video = createPreviewVideoTool(ctx);
    }

    return tools;
}
