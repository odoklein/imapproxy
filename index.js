const express = require('express');
const cron = require('node-cron');
const { syncAllUsersEmails } = require('./sync-emails');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'email-sync-service'
  });
});

// Manual sync endpoint
app.post('/sync', async (req, res) => {
  try {
    console.log('Manual sync triggered at:', new Date().toISOString());
    await syncAllUsersEmails();
    res.json({ success: true, message: 'Sync completed' });
  } catch (error) {
    console.error('Manual sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Email sync service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Manual sync: POST http://localhost:${PORT}/sync`);
});

// Setup cron job for automatic email synchronization
const syncIntervalMinutes = process.env.SYNC_INTERVAL_MINUTES || 5;
const cronExpression = `*/${syncIntervalMinutes} * * * *`; // Every X minutes

console.log(`Setting up cron job to run every ${syncIntervalMinutes} minutes`);

cron.schedule(cronExpression, async () => {
  try {
    console.log('🔄 Starting scheduled email sync at:', new Date().toISOString());
    await syncAllUsersEmails();
    console.log('✅ Scheduled email sync completed successfully');
  } catch (error) {
    console.error('❌ Scheduled email sync failed:', error);
  }
});

console.log('Email sync service started successfully');
