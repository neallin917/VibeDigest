
import { Client } from "@langchain/langgraph-sdk";

async function main() {
    const client = new Client({
        apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:8123",
    });

    const thread = await client.threads.create();
    const threadId = thread.thread_id;
    console.log("Thread ID:", threadId);

    const modes = ["events", "messages"];

    for (const mode of modes) {
        console.log(`\n--- Testing streamMode: ${mode} ---`);
        try {
            const stream = client.runs.stream(
                threadId,
                "agent",
                {
                    input: { messages: [{ role: "user", content: "hello" }] },
                    streamMode: mode as any,
                }
            );

            for await (const chunk of stream) {
                console.log(`[${mode}] Chunk:`, JSON.stringify(chunk, null, 2));
            }
        } catch (e: any) {
            console.error(`[${mode}] Error:`, e.message);
        }
    }
}

main();
