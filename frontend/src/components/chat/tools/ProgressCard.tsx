"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallStatus = any;

type TaskStatus = "pending" | "processing" | "completed" | "error";

type ProgressState = {
    status: TaskStatus;
    progress: number;
    steps: {
        download: TaskStatus;
        transcribe: TaskStatus;
        summarize: TaskStatus;
    };
    error?: string;
};

export type ProgressTaskResult = {
    task_id: string;
    status: string;
}

export type ProgressTaskArgs = {
    url: string;
};

interface ProgressCardProps {
    args: ProgressTaskArgs;
    result?: ProgressTaskResult;
    status: ToolCallStatus;
}

export function ProgressCard({ result }: ProgressCardProps) {
    const taskId = result?.task_id;

    const [state, setState] = useState<ProgressState>({
        status: "pending",
        progress: 0,
        steps: {
            download: "pending",
            transcribe: "pending",
            summarize: "pending"
        }
    });

    const supabase = createClient();

    useEffect(() => {
        if (!taskId) return;

        // Initial Fetch
        const fetchState = async () => {
            const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
            const { data: outputs } = await supabase.from("task_outputs").select("*").eq("task_id", taskId);

            if (task && outputs) updateLocalState(task, outputs);
        };

        fetchState();

        // Subscribe to changes
        const channel = supabase
            .channel(`task-${taskId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `id=eq.${taskId}` }, (payload: any) => {
                // Handle task update
                fetchState(); // Re-fetch to consistenly get outputs too
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "task_outputs", filter: `task_id=eq.${taskId}` }, (payload: any) => {
                // Handle output update
                fetchState();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [taskId]);

    const updateLocalState = (task: any, outputs: any[]) => {
        // Map outputs to steps
        // script_raw / audio -> Download
        // script -> Transcribe
        // summary / summary_source -> Summarize

        // Logic is approximate based on backend flow
        const downloadOut = outputs.find(o => o.kind === 'audio' || o.kind === 'script_raw');
        const transcribeOut = outputs.find(o => o.kind === 'script');
        const summaryOut = outputs.find(o => o.kind === 'summary');

        setState({
            status: task.status,
            progress: task.progress || 0,
            steps: {
                download: mapStepStatus(downloadOut?.status || (task.progress > 10 ? 'completed' : 'pending')),
                transcribe: mapStepStatus(transcribeOut?.status),
                summarize: mapStepStatus(summaryOut?.status),
            },
            error: task.error_message
        });
    };

    const mapStepStatus = (status?: string): TaskStatus => {
        if (!status) return "pending";
        if (status === "error") return "error";
        if (status === "completed") return "completed";
        if (status === "processing") return "processing";
        return "pending";
    };

    if (!taskId) return <div className="p-4 text-sm text-muted-foreground">Initializing task...</div>;

    return (
        <Card className="w-full max-w-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Processing Video</span>
                    <span className="text-xs text-muted-foreground">{state.progress}%</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Progress value={state.progress} className="h-2" />

                <div className="space-y-2">
                    <StepRow label="Downloading & Pre-processing" status={state.steps.download} />
                    <StepRow label="Transcribing Audio" status={state.steps.transcribe} />
                    <StepRow label="Generating Summary" status={state.steps.summarize} />
                </div>

                {state.status === "completed" && (
                    <div className="p-2 bg-green-50 text-green-700 text-xs rounded flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Processing complete! Ask me questions below.
                    </div>
                )}
                {state.status === "error" && (
                    <div className="p-2 bg-destructive/10 text-destructive text-xs rounded">
                        Error: {state.error || "Unknown error occurred"}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StepRow({ label, status }: { label: string, status: TaskStatus }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            {status === "completed" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            {status === "processing" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
            {status === "pending" && <Circle className="w-4 h-4 text-muted-foreground" />}
            {status === "error" && <Circle className="w-4 h-4 text-destructive" />}
            <span className={cn(
                status === "pending" ? "text-muted-foreground" : "text-foreground",
                status === "processing" && "font-medium"
            )}>
                {label}
            </span>
        </div >
    );
}
