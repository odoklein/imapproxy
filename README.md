# Email Sync Service

A Node.js service that automatically syncs emails from IMAP servers to your Supabase database.

## Features

- 🔄 Automatic email synchronization every 5 minutes (configurable)
- 📧 Supports multiple users with individual email credentials
- 💾 Stores emails in Supabase `emails02` table
- 📎 Handles email attachments
- 🏥 Health check endpoint for monitoring
- 🔧 Manual sync endpoint for testing
- 🛡️ Duplicate email prevention
- 📊 Detailed logging and error handling

## Setup

### 1. Install Dependencies

```bash
cd email-sync-service
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# IMAP Configuration
DEFAULT_IMAP_HOST=mail.titan.email
DEFAULT_IMAP_PORT=993
DEFAULT_IMAP_SECURE=true

# Sync Configuration
SYNC_INTERVAL_MINUTES=5
MAX_EMAILS_PER_SYNC=50
LOG_LEVEL=info

# Port for health check
PORT=3000
```

### 3. Database Requirements

Ensure your Supabase database has these tables:

- `user_email_credentials` - Stores IMAP/SMTP credentials per user
- `emails02` - Main email storage table
- `email_attachments` - Email attachment storage

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Manual Sync

```bash
npm run sync
```

## API Endpoints

### Health Check
```
GET /health
```

Returns service status and timestamp.

### Manual Sync
```
POST /sync
```

Triggers immediate email synchronization for all users.

## How It Works

1. **Cron Job**: Runs every 5 minutes (configurable)
2. **User Discovery**: Fetches all users with email credentials from `user_email_credentials` table
3. **IMAP Connection**: Connects to each user's IMAP server using their credentials
4. **Email Fetching**: Downloads recent emails (last 30 days)
5. **Duplicate Check**: Verifies if email already exists using `message_id`
6. **Database Storage**: Saves new emails to `emails02` table
7. **Attachment Handling**: Stores attachment metadata in `email_attachments` table

## Database Schema

### emails02 table
```sql
CREATE TABLE emails02 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  message_id text,
  subject text,
  from text,
  to text,
  date timestamp with time zone,
  html_content text,
  text_content text,
  created_at timestamp with time zone DEFAULT now()
);
```

### email_attachments table
```sql
CREATE TABLE email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails02(id),
  filename text,
  content_type text,
  size integer,
  content_id text,
  is_inline boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
```

## Deploy to Render

1. **Create a new Web Service** on Render
2. **Connect your repository**
3. **Set build command**: `cd email-sync-service && npm install`
4. **Set start command**: `cd email-sync-service && npm start`
5. **Add environment variables** from your `.env` file
6. **Deploy**

### Render Environment Variables

Add these in your Render dashboard:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEFAULT_IMAP_HOST`
- `DEFAULT_IMAP_PORT`
- `DEFAULT_IMAP_SECURE`
- `SYNC_INTERVAL_MINUTES`
- `MAX_EMAILS_PER_SYNC`
- `PORT`

## Monitoring

- Check `/health` endpoint for service status
- Monitor logs for sync activity and errors
- Use Render's built-in monitoring tools

## Troubleshooting

### Common Issues

1. **IMAP Connection Errors**: Check credentials and server settings
2. **Database Errors**: Verify Supabase configuration and table schemas
3. **Memory Issues**: Reduce `MAX_EMAILS_PER_SYNC` if processing too many emails

### Debugging

Enable detailed logging by setting `logger: console` in the ImapFlow configuration.

## Security Notes

- Store IMAP passwords encrypted in production
- Use service role key with minimal required permissions
- Consider implementing rate limiting for manual sync endpoint
- Monitor for failed login attempts to email servers
