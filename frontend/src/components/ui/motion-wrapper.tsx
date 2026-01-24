"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MotionWrapperProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}

export function MotionWrapper({
    children,
    className,
    delay = 0,
}: MotionWrapperProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
                duration: 0.8,
                delay: delay,
                ease: [0.19, 1, 0.22, 1], // ease-out-expo
            }}
            className={cn(className)}
        >
            {children}
        </motion.div>
    );
}
