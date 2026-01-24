-- 14_fix_chat_messages_id.sql
-- 修复：AI SDK 生成的消息 ID 是字符串（如 nanoid），不是 UUID。
-- 我们需要将 id 列的类型从 UUID 更改为 TEXT，否则插入操作会失败。

-- 1. 修改列类型
ALTER TABLE public.chat_messages 
  ALTER COLUMN id TYPE TEXT;

-- 2. 移除默认值（因为我们会提供客户端生成的 ID）
ALTER TABLE public.chat_messages 
  ALTER COLUMN id DROP DEFAULT;
