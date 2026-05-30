-- Allow admins to read all sellers' AI conversations (for chat history feature)
create policy "Admins can view all conversations" on public.ai_conversations
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
