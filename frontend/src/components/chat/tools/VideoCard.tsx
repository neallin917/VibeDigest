"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle } from "lucide-react";
import Image from "next/image";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCallStatus = any;

export type VideoPreviewArgs = {
    url: string;
};

export type VideoPreviewResult = {
    title: string;
    thumbnail: string;
    duration: number;
    author: string;
    url: string;
    error?: string;
};

interface VideoCardProps {
    args: VideoPreviewArgs;
    result?: VideoPreviewResult;
    status: ToolCallStatus;
}

export function VideoCard({ args, result, status }: VideoCardProps) {
    const isExecuting = status.type === "running";

    if (!result && isExecuting) {
        return (
            <Card className="w-full max-w-sm animate-pulse">
                <CardContent className="p-0 aspect-video bg-muted rounded-t-lg" />
                <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
            </Card>
        );
    }

    if (result?.error) {
        return (
            <Card className="w-full max-w-sm border-destructive">
                <CardContent className="p-4 text-destructive">
                    Error: {result.error}
                </CardContent>
            </Card>
        );
    }

    if (!result) return null;

    return (
        <Card className="w-full max-w-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="relative aspect-video bg-muted">
                {result.thumbnail ? (
                    <Image
                        src={result.thumbnail}
                        alt={result.title}
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <PlayCircle className="w-12 h-12" />
                    </div>
                )}
                <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="opacity-90">
                        {formatDuration(result.duration)}
                    </Badge>
                </div>
            </div>
            <CardContent className="p-3">
                <h3 className="font-semibold line-clamp-2 text-sm mb-1" title={result.title}>
                    {result.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                    {result.author}
                </p>
            </CardContent>
        </Card>
    );
}

function formatDuration(seconds: number): string {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}
