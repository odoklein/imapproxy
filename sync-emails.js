const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get all users who have email credentials configured
 */
async function getUsersWithEmailCredentials() {
  try {
    const { data: users, error } = await supabase
      .from('user_email_credentials')
      .select(`
        *,
        users (
          id,
          email,
          name
        )
      `);

    if (error) {
      console.error('Error fetching users with email credentials:', error);
      return [];
    }

    return users || [];
  } catch (error) {
    console.error('Error in getUsersWithEmailCredentials:', error);
    return [];
  }
}

/**
 * Connect to IMAP server for a user
 */
async function connectToIMAP(credentials) {
  const client = new ImapFlow({
    host: process.env.DEFAULT_IMAP_HOST || 'mail.titan.email',
    port: parseInt(process.env.DEFAULT_IMAP_PORT) || 993,
    secure: process.env.DEFAULT_IMAP_SECURE !== 'false',
    auth: {
      user: credentials.imap_username,
      pass: credentials.imap_password
    },
    logger: false // Set to console for debugging
  });

  await client.connect();
  return client;
}

/**
 * Check if email already exists in database
 */
async function emailExists(messageId, userId) {
  if (!messageId) return false;
  
  const { data, error } = await supabase
    .from('emails02')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .single();

  return !error && data;
}

/**
 * Save email to database
 */
async function saveEmailToDatabase(email, userId) {
  try {
    // First insert the email
    const { data: emailData, error: emailError } = await supabase
      .from('emails02')
      .insert({
        user_id: userId,
        message_id: email.messageId,
        subject: email.subject || '',
        from: email.from?.text || '',
        to: email.to?.text || '',
        date: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
        html_content: email.html || '',
        text_content: email.text || '',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (emailError) {
      console.error('Error saving email:', emailError);
      return false;
    }

    // Then save attachments if any
    if (email.attachments && email.attachments.length > 0) {
      const attachments = email.attachments.map(attachment => ({
        email_id: emailData.id,
        filename: attachment.filename || 'unnamed',
        content_type: attachment.contentType || 'application/octet-stream',
        size: attachment.size || 0,
        content_id: attachment.cid || null,
        is_inline: attachment.contentDisposition === 'inline',
        created_at: new Date().toISOString()
      }));

      const { error: attachmentError } = await supabase
        .from('email_attachments')
        .insert(attachments);

      if (attachmentError) {
        console.error('Error saving attachments:', attachmentError);
      }
    }

    return true;
  } catch (error) {
    console.error('Error in saveEmailToDatabase:', error);
    return false;
  }
}

/**
 * Sync emails for a specific user
 */
async function syncUserEmails(userCredentials) {
  const userId = userCredentials.user_id;
  const userEmail = userCredentials.users?.email || userCredentials.imap_username;
  
  console.log(`📧 Starting email sync for user: ${userEmail}`);

  let client;
  try {
    // Connect to IMAP
    client = await connectToIMAP(userCredentials);
    
    // Select INBOX
    const mailbox = await client.getMailboxLock('INBOX');
    
    try {
      // Get recent emails (last 50 to avoid overwhelming)
      const maxEmails = parseInt(process.env.MAX_EMAILS_PER_SYNC) || 50;
      
      // Search for recent emails (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const searchCriteria = {
        since: thirtyDaysAgo
      };
      
      const messages = client.search(searchCriteria, { uid: true });
      
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      // Process messages in batches
      const messageArray = [];
      for await (const msg of messages) {
        messageArray.push(msg);
        if (messageArray.length >= maxEmails) break;
      }
      
      console.log(`📨 Found ${messageArray.length} recent messages for ${userEmail}`);
      
      for (const msg of messageArray.reverse()) { // Process newest first
        try {
          // Download the message
          const emailSource = await client.download(msg.uid, 'full', { uid: true });
          
          // Parse the email
          const parsed = await simpleParser(emailSource);
          
          // Check if email already exists
          if (await emailExists(parsed.messageId, userId)) {
            skippedCount++;
            continue;
          }
          
          // Save to database
          const saved = await saveEmailToDatabase(parsed, userId);
          if (saved) {
            syncedCount++;
            console.log(`✅ Saved email: ${parsed.subject || '(No subject)'}`);
          } else {
            errorCount++;
          }
          
        } catch (error) {
          console.error(`❌ Error processing message ${msg.uid}:`, error.message);
          errorCount++;
        }
      }
      
      console.log(`📊 Sync completed for ${userEmail}: ${syncedCount} new, ${skippedCount} skipped, ${errorCount} errors`);
      
    } finally {
      mailbox.release();
    }
    
  } catch (error) {
    console.error(`❌ Error syncing emails for ${userEmail}:`, error.message);
  } finally {
    if (client) {
      await client.logout();
    }
  }
}

/**
 * Sync emails for all users
 */
async function syncAllUsersEmails() {
  console.log('🚀 Starting email sync for all users...');
  
  try {
    const users = await getUsersWithEmailCredentials();
    console.log(`👥 Found ${users.length} users with email credentials`);
    
    if (users.length === 0) {
      console.log('ℹ️ No users with email credentials found');
      return;
    }
    
    // Process users sequentially to avoid overwhelming IMAP servers
    for (const user of users) {
      await syncUserEmails(user);
      
      // Small delay between users to be nice to servers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('🎉 Email sync completed for all users');
    
  } catch (error) {
    console.error('❌ Error in syncAllUsersEmails:', error);
    throw error;
  }
}

module.exports = {
  syncAllUsersEmails,
  syncUserEmails
};

// If called directly, run the sync
if (require.main === module) {
  syncAllUsersEmails()
    .then(() => {
      console.log('Sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}
