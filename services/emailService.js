import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export const sendWelcomeEmail = async (email, name) => {
    const mailOptions = {
        from: `"Difwa Water" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Welcome to Difwa Water",
        html: `
      <div style="font-family: Arial; padding:20px;">
        <h2>Welcome to Difwa Water, ${name}!</h2>
        
        <p>We're excited to have you join our premium water distribution network.</p>
        
        <p>
          Discover high-quality water suppliers, explore reliable retailers,
          and enjoy a seamless ordering experience.
        </p>
 
        <br/>
 
        <p>Stay hydrated!</p>
        <p><strong>The Difwa Water Team</strong></p>
      </div>
    `
    };

    await transporter.sendMail(mailOptions);
};

export const sendInviteEmail = async (email, password, roleName) => {
    const mailOptions = {
        from: `"Difwa Admin" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Invitation to Join Difwa Admin Panel",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #3b82f6;">Welcome to Difwa!</h2>
                <p>You have been invited to join the Difwa Admin Panel as a <strong>${roleName}</strong>.</p>
                <p>Below are your login credentials:</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Temporary Password:</strong> ${password}</p>
                </div>
                <p>Please login and change your password upon your first login.</p>
                <p style="color: #6b7280; font-size: 0.875rem; margin-top: 30px;">If you did not expect this invitation, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="text-align: center; color: #9ca3af; font-size: 0.75rem;">© 2026 Difwa. All rights reserved.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending invitation email:", error);
        return false;
    }
};

export const sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: `"Difwa" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your One-Time Password (OTP) for Difwa",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #3b82f6;">Verification Required</h2>
                <p>Your OTP for verification is:</p>
                <div style="text-align: center; font-size: 2rem; font-weight: bold; letter-spacing: 5px; color: #3b82f6; margin: 30px 0;">
                    ${otp}
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p style="color: #6b7280; font-size: 0.875rem; margin-top: 30px;">If you did not request this OTP, please ignore this email.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending OTP email:", error);
        return false;
    }
};

export const sendMarketingEmail = async (emails, subject, htmlContent) => {
    // Send to bulk emails in one go (comma-separated 'to' or 'bcc' for privacy)
    // Using BCC is better for bulk marketing to prevent recipients from seeing each other's emails
    const mailOptions = {
        from: `"Difwa Marketing 🚀" <${process.env.SMTP_USER}>`,
        bcc: emails, // Use BCC for bulk
        subject: subject,
        html: htmlContent,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending bulk marketing email:", error);
        return false;
    }
};

export const sendLowStockEmail = async (email, productName, stockCount) => {
    const mailOptions = {
        from: `"Difwa Alert" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Low Stock Alert: ${productName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #ef4444;">🚨 Low Stock Alert</h2>
                <p>Your product <strong>${productName}</strong> is running low on stock.</p>
                <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #fee2e2;">
                    <p style="color: #b91c1c; font-size: 1.2rem; margin: 0;"><strong>Current Stock: ${stockCount}</strong> ${stockCount <= 0 ? '(OUT OF STOCK)' : ''}</p>
                </div>
                <p>Please update your inventory as soon as possible to continue receiving orders.</p>
                <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="text-align: center; color: #9ca3af; font-size: 0.75rem;">© 2026 Difwa.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending low stock email:", error);
        return false;
    }
};

export const sendSupportNotificationEmail = async (emails, subject, message, appUser, ticketId) => {
    const name = appUser?.fullName || "N/A";
    const email = appUser?.email || "N/A";
    const phone = appUser?.phoneNumber || "N/A";
    const userId = appUser?._id?.toString() || "N/A";
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" });

    const adminPanelUrl = `https://difwa-admin-vendor-web.vercel.app/admin/support-requests`;
    const userProfileUrl = `https://difwa-admin-vendor-web.vercel.app/admin/users`;

    const mailOptions = {
        from: `"Difwa Notification System 💧" <${process.env.SMTP_USER}>`,
        bcc: emails,
        subject: `[Support Alert] New Request: ${subject}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Support Request</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 36px;text-align:center;">
              <p style="margin:0;color:#90caf9;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Difwa Help Center</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:700;">New Support Request</h1>
              <p style="margin:8px 0 0;color:#bbdefb;font-size:14px;">A user has submitted a help request via the Difwa App</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <!-- Customer Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding-bottom:10px;border-bottom:2px solid #e3f2fd;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#1a73e8;letter-spacing:2px;text-transform:uppercase;">👤 Customer Details</p>
                  </td>
                </tr>
                <tr><td style="padding-top:14px;">
                  <table width="100%" cellpadding="6" cellspacing="0">
                    <tr style="background:#f8faff;">
                      <td style="width:30%;font-size:13px;color:#5f6368;font-weight:600;border-radius:4px 0 0 4px;padding:10px 14px;">Name</td>
                      <td style="font-size:14px;color:#1a1a2e;font-weight:500;padding:10px 14px;">${name}</td>
                    </tr>
                    <tr>
                      <td style="width:30%;font-size:13px;color:#5f6368;font-weight:600;padding:10px 14px;">Email</td>
                      <td style="font-size:14px;color:#1a1a2e;padding:10px 14px;">${email}</td>
                    </tr>
                    <tr style="background:#f8faff;">
                      <td style="width:30%;font-size:13px;color:#5f6368;font-weight:600;padding:10px 14px;">Phone</td>
                      <td style="font-size:14px;color:#1a1a2e;padding:10px 14px;">${phone}</td>
                    </tr>
                    <tr>
                      <td style="width:30%;font-size:13px;color:#5f6368;font-weight:600;padding:10px 14px;">User ID</td>
                      <td style="font-size:13px;color:#888;font-family:monospace;padding:10px 14px;">${userId}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- Request Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding-bottom:10px;border-bottom:2px solid #e3f2fd;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#1a73e8;letter-spacing:2px;text-transform:uppercase;">📩 Request Details</p>
                  </td>
                </tr>
                <tr><td style="padding-top:14px;">
                  <table width="100%" cellpadding="6" cellspacing="0">
                    <tr style="background:#f8faff;">
                      <td style="width:30%;font-size:13px;color:#5f6368;font-weight:600;padding:10px 14px;">Ticket ID</td>
                      <td style="font-size:13px;color:#888;font-family:monospace;padding:10px 14px;">${ticketId}</td>
                    </tr>
                    <tr>
                      <td style="width:30%;font-size:13px;color:#5f6368;font-weight:600;padding:10px 14px;">Subject</td>
                      <td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:10px 14px;">${subject}</td>
                    </tr>
                    <tr style="background:#f8faff;">
                      <td style="width:30%;font-size:13px;color:#5f6368;font-weight:600;padding:10px 14px;">Submitted At</td>
                      <td style="font-size:13px;color:#444;padding:10px 14px;">${timestamp} IST</td>
                    </tr>
                  </table>
                  <!-- Message Box -->
                  <div style="margin-top:16px;background:#f0f4ff;border-left:4px solid #1a73e8;border-radius:6px;padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#1a73e8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Message</p>
                    <p style="margin:0;font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap;">"${message}"</p>
                  </div>
                </td></tr>
              </table>

              <!-- Quick Actions -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding-bottom:10px;border-bottom:2px solid #e3f2fd;">
                    <p style="margin:0;font-size:11px;font-weight:700;color:#1a73e8;letter-spacing:2px;text-transform:uppercase;">⚡ Quick Actions</p>
                  </td>
                </tr>
                <tr><td style="padding-top:16px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;">
                        <a href="${adminPanelUrl}" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;margin-right:10px;">👉 Open Help Requests</a>
                        <a href="${userProfileUrl}" style="display:inline-block;background:#f1f3f4;color:#333;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">👤 View Users</a>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8faff;border-top:1px solid #e8eaf6;padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9e9e9e;">This is an automated alert from <strong>Difwa System</strong>. Do not reply directly to this email.</p>
              <p style="margin:6px 0 0;font-size:13px;color:#1a73e8;font-weight:600;">— Difwa Notification System 💧</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending support notification email:", error);
        return false;
    }
};

export const sendEmailUpdateNotification = async (email, name) => {
    const mailOptions = {
        from: `"Difwa Water" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your Difwa Account Email has been Updated",
        html: `
            <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #eef2f6; border-radius: 20px; overflow: hidden; background-color: #ffffff; color: #374151; line-height: 1.6;">
                <!-- Header -->
                <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                    <div style="font-size: 28px; font-weight: 900; color: #1e40af; margin-bottom: 5px; letter-spacing: -1px;">DIFWA WATER</div>
                    <div style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Account Security Alert</div>
                </div>

                <div style="padding: 40px 30px;">
                    <h2 style="color: #111827; margin-top: 0; font-size: 20px;">Hi ${name},</h2>
                    
                    <p style="font-size: 16px; color: #4b5563;">Your email address has been successfully updated on your Difwa account.</p>
                    
                    <p style="color: #4b5563;">Thank you for trusting <strong>Difwa</strong> for your essential water services.</p>
                    
                    <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 20px; margin: 30px 0; border-radius: 12px;">
                        <p style="margin: 0; font-size: 14px; color: #9f1239; font-weight: 500;">
                            <strong>🔒 Security Notice:</strong> If you did not authorize this change, please contact our support team immediately to secure your account.
                        </p>
                    </div>

                    <div style="background-color: #f0f9ff; border-radius: 16px; padding: 25px; margin-top: 30px;">
                        <p style="font-weight: 700; color: #0369a1; margin-top: 0; margin-bottom: 15px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Maximize your experience:</p>
                        <div style="margin-bottom: 5px;">
                            <p style="margin: 12px 0; font-size: 15px;">🚀 <strong>Get the App:</strong> <a href="https://play.google.com/store/apps/details?id=com.difmo.difwa" style="color: #0284c7; text-decoration: none; font-weight: 600;">Download on Play Store</a></p>
                            <p style="margin: 12px 0; font-size: 15px;">🌐 <strong>Our Website:</strong> <a href="https://www.difwa.com/" style="color: #0284c7; text-decoration: none; font-weight: 600;">www.difwa.com</a></p>
                        </div>
                    </div>

                    <p style="margin-top: 35px; color: #64748b; font-size: 14px;">We are committed to providing a safe, reliable, and seamless experience for all your water delivery needs.</p>
                    
                    <div style="margin-top: 40px; border-top: 2px solid #f1f5f9; padding-top: 30px;">
                        <p style="margin: 0; color: #94a3b8; font-size: 13px; font-weight: 700; text-transform: uppercase;">Stay hydrated,</p>
                        <p style="margin: 5px 0; color: #1d4ed8; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">Team Difwa</p>
                        <p style="margin: 10px 0 0;"><a href="mailto:difwaservices@gmail.com" style="color: #3b82f6; text-decoration: none; font-weight: 500; font-size: 14px;">difwaservices@gmail.com</a></p>
                    </div>
                </div>

                <!-- Subtle Footer -->
                <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
                    © 2026 Difwa Water Services. All rights reserved.
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending email update notification:", error);
        return false;
    }
};