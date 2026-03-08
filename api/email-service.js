/**
 * Brevo Email Service
 * Handles email sending via Brevo (formerly Sendinblue)
 */

const brevo = require('@getbrevo/brevo');

// Initialize Brevo API client
let apiInstance = null;

function initializeBrevo() {
  if (!apiInstance) {
    apiInstance = new brevo.TransactionalEmailsApi();
    
    // Set API key from environment variable
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY;
  }
  return apiInstance;
}

/**
 * Send verification code email
 */
async function sendVerificationEmail(to, firstName, verificationCode) {
  try {
    const api = initializeBrevo();
    
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.subject = '🔐 TAU Community - Email Verification Code';
    sendSmtpEmail.to = [{ email: to, name: firstName }];
    sendSmtpEmail.sender = { 
      name: 'TAU Community', 
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@tau-community.com' 
    };
    
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            background: linear-gradient(135deg, #00f0ff 0%, #b000ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .code-box {
            background: linear-gradient(135deg, rgba(0,240,255,0.1) 0%, rgba(176,0,255,0.1) 100%);
            border: 2px solid #00f0ff;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .code {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #00f0ff;
            font-family: 'Courier New', monospace;
          }
          .info {
            color: #666;
            font-size: 14px;
            margin-top: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">TAU Community</div>
            <h2 style="color: #333; margin-top: 10px;">Email Verification</h2>
          </div>
          
          <p>Dear ${firstName},</p>
          <p>Thank you for signing up for TAU Community!</p>
          <p>Your verification code is:</p>
          
          <div class="code-box">
            <div class="code">${verificationCode}</div>
          </div>
          
          <div class="info">
            <p><strong>⏰ This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email from TAU Community.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await api.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email sent successfully:', result);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Brevo email error:', error);
    throw error;
  }
}

/**
 * Send welcome email after verification
 */
async function sendWelcomeEmail(to, firstName) {
  try {
    const api = initializeBrevo();
    
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.subject = '🎉 Welcome to TAU Community!';
    sendSmtpEmail.to = [{ email: to, name: firstName }];
    sendSmtpEmail.sender = { 
      name: 'TAU Community', 
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@tau-community.com' 
    };
    
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            background: linear-gradient(135deg, #00f0ff 0%, #b000ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">TAU Community</div>
            <h2>Welcome Aboard! 🎉</h2>
          </div>
          
          <p>Dear ${firstName},</p>
          <p>Your email has been successfully verified!</p>
          <p>You can now log in and explore all the clubs and activities at TAU Community.</p>
          
          <p style="margin-top: 30px;">
            <a href="https://new-university-project.vercel.app/login" 
               style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #00f0ff 0%, #b000ff 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Log In Now
            </a>
          </p>
          
          <p style="margin-top: 30px; color: #666;">
            Best regards,<br>
            TAU Community Team
          </p>
        </div>
      </body>
      </html>
    `;
    
    await api.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Welcome email sent successfully');
    
  } catch (error) {
    console.error('❌ Welcome email error:', error);
    // Don't throw - welcome email is not critical
  }
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(to, firstName, resetToken) {
  try {
    const api = initializeBrevo();
    
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.subject = '🔒 TAU Community - Password Reset Request';
    sendSmtpEmail.to = [{ email: to, name: firstName }];
    sendSmtpEmail.sender = { 
      name: 'TAU Community', 
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@tau-community.com' 
    };
    
    const resetLink = `https://new-university-project.vercel.app/reset-password?token=${resetToken}`;
    
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .button {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
          }
          .info {
            background-color: #fef2f2;
            border-left: 4px solid #dc2626;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">TAU Community</div>
            <h2 style="color: #333; margin-top: 10px;">Password Reset Request</h2>
          </div>
          
          <p>Dear ${firstName},</p>
          <p>We received a request to reset your password for your TAU Community account.</p>
          <p>Click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>
          
          <div class="info">
            <p style="margin: 0;"><strong>⏰ This link will expire in 1 hour.</strong></p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color: #dc2626; word-break: break-all;">${resetLink}</a>
          </p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you didn't request a password reset, please ignore this email or contact support if you have concerns.
          </p>
          
          <div class="footer">
            <p>This is an automated email from TAU Community.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await api.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Password reset email sent successfully:', result);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Password reset email error:', error);
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
};
