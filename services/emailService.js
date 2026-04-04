import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendWelcomeEmail = async (email, name) => {
    const mailOptions = {
        from: `"Difwa Water" <${process.env.EMAIL_USER}>`,
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
        from: `"Difwa Admin" <${process.env.EMAIL_USER}>`,
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
        from: `"Difwa" <${process.env.EMAIL_USER}>`,
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
        from: `"Difwa Marketing 🚀" <${process.env.EMAIL_USER}>`,
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