# Deploy to Render - Step by Step Guide

## Prerequisites

1. ✅ Your code is pushed to GitHub
2. ✅ You have a Render account (sign up at render.com)
3. ✅ Your Supabase project is set up with the required tables

## Step 1: Create the Web Service

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +"** → **"Web Service"**
3. **Connect Repository**: Choose your GitHub repository
4. **Configure Service**:
   - **Name**: `suzalink-email-sync`
   - **Root Directory**: `email-sync-service`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

## Step 2: Environment Variables

Add these environment variables in Render:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DEFAULT_IMAP_HOST=mail.titan.email
DEFAULT_IMAP_PORT=993
DEFAULT_IMAP_SECURE=true
SYNC_INTERVAL_MINUTES=5
MAX_EMAILS_PER_SYNC=50
PORT=10000
```

### How to get Supabase keys:

1. Go to your Supabase project dashboard
2. **Settings** → **API**
3. Copy the **URL** and **anon public** key
4. Copy the **service_role** key (keep this secret!)

## Step 3: Deploy

1. **Click "Create Web Service"**
2. Render will automatically deploy your service
3. Wait for the build to complete (usually 2-3 minutes)

## Step 4: Verify Deployment

Once deployed, you'll get a URL like: `https://suzalink-email-sync.onrender.com`

Test the endpoints:

1. **Health Check**: `GET https://your-app.onrender.com/health`
2. **Manual Sync**: `POST https://your-app.onrender.com/sync`

## Step 5: Update Your Frontend

Update your frontend to use the database instead of direct IMAP calls.

### Current Code (in email page):
```javascript
// This fetches directly from IMAP
const response = await fetch('/api/email/fetch', {
  method: 'POST',
  // ...
});
```

### New Code (fetch from database):
```javascript
// This fetches from database (synced by Render service)
const response = await fetch('/api/email/list', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: userProfile.id,
    limit: 50
  })
});
```

## Step 6: Enable RLS and Run Schema

1. **Go to Supabase SQL Editor**
2. **Run the schema.sql file** from the email-sync-service folder
3. This will create the required tables and security policies

## Step 7: Add User Email Credentials

Users need to have their email credentials in the database:

```sql
-- Example: Add email credentials for a user
INSERT INTO user_email_credentials (
  user_id,
  imap_username,
  imap_password,
  smtp_username,
  smtp_password
) VALUES (
  'user-uuid-here',
  'user@domain.com',
  'their-email-password',
  'user@domain.com',
  'their-email-password'
);
```

## Monitoring

### Check Service Status
- Visit: `https://your-app.onrender.com/health`
- Should return: `{"status":"healthy","timestamp":"...","service":"email-sync-service"}`

### Check Logs
1. Go to Render Dashboard
2. Click on your service
3. Go to **"Logs"** tab
4. You'll see sync activity every 5 minutes

### Manual Sync
You can trigger a manual sync by making a POST request to:
`https://your-app.onrender.com/sync`

## Troubleshooting

### Common Issues:

1. **Build Fails**: Check that `package.json` is in the `email-sync-service` folder
2. **Environment Variables**: Make sure all required env vars are set in Render
3. **Database Connection**: Verify Supabase credentials are correct
4. **IMAP Errors**: Check that user email credentials are valid

### Debugging:

1. **Check Render Logs**: Look for error messages in the logs
2. **Test Health Endpoint**: Make sure the service is running
3. **Verify Database**: Check that emails are being inserted in Supabase

## Success! 🎉

Your email sync service is now:
- ✅ Running on Render
- ✅ Syncing emails every 5 minutes
- ✅ Storing emails in Supabase
- ✅ Ready for your frontend to consume

Your frontend will now get emails much faster since they're pre-synced in the database!
