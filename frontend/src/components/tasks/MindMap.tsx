"use client"

import { useMemo } from 'react'
import {
    ReactFlow,
    Node,
    Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    NodeProps,
    Handle,
    Position,
    BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './mindmap.css'

// ============================================================================
// Types
// ============================================================================

export interface MindMapNode {
    content: string
    children: MindMapNode[]
}

interface MindMapProps {
    data: MindMapNode
}

// ============================================================================
// Layout Configuration
// ============================================================================

// Visual styling per level - using distinct left border colors instead of labels
const LEVEL_CONFIG = [
    // Level 0: Overview (root) - with label badge
    {
        width: 360,
        bg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-600/5',
        border: 'border border-emerald-500/40',
        accent: 'border-l-4 border-l-emerald-500',
        text: 'text-sm leading-relaxed',
        showLabel: true,
        label: 'Overview',
    },
    // Level 1: Keypoints - amber accent, no label
    {
        width: 280,
        bg: 'bg-white/[0.04]',
        border: 'border border-white/10',
        accent: 'border-l-4 border-l-amber-500',
        text: 'text-sm',
        showLabel: false,
    },
    // Level 2: Evidence - gray accent, no label
    {
        width: 220,
        bg: 'bg-white/[0.02]',
        border: 'border border-white/5',
        accent: 'border-l-3 border-l-slate-500',
        text: 'text-xs text-white/70 italic',
        showLabel: false,
    },
]

const LINE_HEIGHT = 22
const NODE_PADDING_Y = 28
const VERTICAL_GAP = 24
const HORIZONTAL_GAP = 50

function getConfig(level: number) {
    return LEVEL_CONFIG[Math.min(level, LEVEL_CONFIG.length - 1)]
}

// ============================================================================
// Layout Helpers
// ============================================================================

function estimateNodeHeight(content: string, level: number): number {
    const width = getConfig(level).width
    const charsPerLine = Math.floor((width - 40) / 14)
    const lines = Math.ceil(content.length / Math.max(1, charsPerLine))
    const extraPadding = getConfig(level).showLabel ? 12 : 0
    return Math.max(50, lines * LINE_HEIGHT + NODE_PADDING_Y + extraPadding)
}

function getSubtreeHeight(node: MindMapNode, level: number): number {
    const selfHeight = estimateNodeHeight(node.content, level)
    if (node.children.length === 0) return selfHeight

    const childrenHeight = node.children.reduce(
        (sum, child) => sum + getSubtreeHeight(child, level + 1), 0
    ) + (node.children.length - 1) * VERTICAL_GAP

    return Math.max(selfHeight, childrenHeight)
}

// ============================================================================
// Graph Builder
// ============================================================================

function buildGraph(root: MindMapNode): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = []
    const edges: Edge[] = []
    let nodeId = 0

    function layout(node: MindMapNode, level: number, x: number, yStart: number, parentId: string | null) {
        const id = `n${nodeId++}`
        const config = getConfig(level)
        const selfHeight = estimateNodeHeight(node.content, level)
        const subtreeHeight = getSubtreeHeight(node, level)
        const y = yStart + (subtreeHeight - selfHeight) / 2

        nodes.push({
            id,
            type: 'mindMapNode',
            position: { x, y },
            data: { label: node.content, level },
        })

        if (parentId) {
            edges.push({
                id: `e-${parentId}-${id}`,
                source: parentId,
                target: id,
                type: 'smoothstep',
                style: { stroke: '#4ade80', strokeWidth: 2, opacity: 0.35 },
            })
        }

        if (node.children.length > 0) {
            let childY = yStart
            for (const child of node.children) {
                layout(child, level + 1, x + config.width + HORIZONTAL_GAP, childY, id)
                childY += getSubtreeHeight(child, level + 1) + VERTICAL_GAP
            }
        }
    }

    layout(root, 0, 0, 0, null)
    return { nodes, edges }
}

// ============================================================================
// Components
// ============================================================================

function MindMapNodeComponent({ data }: NodeProps) {
    const { label, level = 0 } = data as { label: string; level: number }
    const config = getConfig(level)

    return (
        <>
            <Handle type="target" position={Position.Left} className="!opacity-0" />
            <div
                className={`relative rounded-lg ${config.bg} ${config.border} ${config.accent}`}
                style={{ width: config.width }}
            >
                {/* Label badge centered on the border */}
                {config.showLabel && (
                    <div className="absolute top-0 left-3 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-medium text-white bg-emerald-500">
                        {config.label}
                    </div>
                )}
                {/* Content with extra top padding when label exists */}
                <div className={`px-4 pb-3 break-words text-white ${config.text} ${config.showLabel ? 'pt-6' : 'pt-3'}`}>
                    {label}
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="!opacity-0" />
        </>
    )
}

const nodeTypes = { mindMapNode: MindMapNodeComponent }

// ============================================================================
// Main Component
// ============================================================================

export function MindMap({ data }: MindMapProps) {
    const graph = useMemo(() => {
        if (!data) return { nodes: [] as Node[], edges: [] as Edge[] }
        return buildGraph(data)
    }, [data])

    const [nodes, , onNodesChange] = useNodesState(graph.nodes)
    const [edges, , onEdgesChange] = useEdgesState(graph.edges)

    if (!data) return null

    return (
        <div
            className="mindmap-container w-full h-[600px] rounded-2xl overflow-hidden"
            style={{ background: '#0a0a0a', border: '1px solid rgba(74, 222, 128, 0.2)' }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                fitView
                fitViewOptions={{ padding: 0.1, minZoom: 0.15, maxZoom: 0.8 }}
                minZoom={0.05}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="rgba(255,255,255,0.02)" />
                <Controls className="mindmap-controls" showInteractive={false} />
            </ReactFlow>
        </div>
    )
}
