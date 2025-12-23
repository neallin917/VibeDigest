"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description?: string
    confirmText?: string
    cancelText?: string
    isLoading?: boolean
    variant?: "destructive" | "default"
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isLoading = false,
    variant = "destructive"
}: ConfirmationModalProps) {
    if (!isOpen) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-50 w-full max-w-md rounded-xl border border-white/10 bg-[#0A0A0A]/90 p-6 shadow-2xl backdrop-blur-md"
                    >
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2 text-center sm:text-left">
                                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                    {variant === "destructive" && <AlertCircle className="h-5 w-5 text-red-500" />}
                                    {title}
                                </h2>
                                {description && (
                                    <p className="text-sm text-muted-foreground">
                                        {description}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-2">
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="bg-transparent hover:bg-white/5"
                                >
                                    {cancelText}
                                </Button>
                                <Button
                                    variant={variant}
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className="min-w-[80px]"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        confirmText
                                    )}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
