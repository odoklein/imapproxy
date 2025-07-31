-- Email Sync Service Database Schema
-- Run this in your Supabase SQL editor if the tables don't exist

-- Create emails02 table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS emails02 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  message_id text,
  subject text,
  "from" text,
  "to" text,
  date timestamp with time zone,
  html_content text,
  text_content text,
  created_at timestamp with time zone DEFAULT timezone('utc', now()),
  updated_at timestamp with time zone DEFAULT timezone('utc', now())
);

-- Create email_attachments table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails02(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text,
  size integer,
  content_id text,
  is_inline boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc', now())
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emails02_user_id ON emails02(user_id);
CREATE INDEX IF NOT EXISTS idx_emails02_message_id ON emails02(message_id);
CREATE INDEX IF NOT EXISTS idx_emails02_date ON emails02(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails02_created_at ON emails02(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);

-- Create unique constraint to prevent duplicate emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_emails02_unique_message_user 
ON emails02(message_id, user_id) 
WHERE message_id IS NOT NULL;

-- Row Level Security (RLS) policies
ALTER TABLE emails02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

-- Policies: Drop existing policies first, then create new ones
DROP POLICY IF EXISTS "Users can view own emails" ON emails02;
CREATE POLICY "Users can view own emails" ON emails02
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage emails" ON emails02;
CREATE POLICY "Service role can manage emails" ON emails02
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Users can view own email attachments" ON email_attachments;
CREATE POLICY "Users can view own email attachments" ON email_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM emails02 
      WHERE emails02.id = email_attachments.email_id 
      AND emails02.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can manage attachments" ON email_attachments;
CREATE POLICY "Service role can manage attachments" ON email_attachments
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add some helpful comments
COMMENT ON TABLE emails02 IS 'Stores synchronized emails from IMAP servers';
COMMENT ON TABLE email_attachments IS 'Stores metadata for email attachments';
COMMENT ON COLUMN emails02.message_id IS 'Unique message ID from email headers';
COMMENT ON COLUMN emails02.user_id IS 'References the user who owns this email';
