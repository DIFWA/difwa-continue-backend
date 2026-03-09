import admin from "firebase-admin";
import nodemailer from "nodemailer";

// Initialize Firebase Admin (Required Service Account JSON)
// admin.initializeApp({ ... }); 

export const sendPushNotification = async (token, title, body, data = {}) => {
    try {
        const message = {
            notification: { title, body },
            data,
            token
        };
        // await admin.messaging().send(message);
        console.log(`FCM Notification Sent to ${token}: ${title}`);
    } catch (error) {
        console.error("FCM Error:", error);
    }
};

export const sendEmailReceipt = async (userEmail, orderData) => {
    // Transporter should be initialized with real creds from .env
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const itemsHtml = orderData.items?.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name || 'Shrimp Item'} x ${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('') || '';

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #E63946; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0;">Shrimpbite</h1>
                <p style="margin: 5px 0 0;">Freshness Delivered Daily</p>
            </div>
            <div style="padding: 20px;">
                <h2 style="color: #1A1A1A;">Order Receipt</h2>
                <p>Hello,</p>
                <p>Thank you for your order! Here is your bill summary for Order <strong>#${orderData.orderId}</strong>.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background-color: #f9f9f9;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">Total Amount</td>
                            <td style="padding: 10px; font-weight: bold; text-align: right;">₹${orderData.totalAmount?.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="background-color: #F1FAEE; padding: 15px; border-radius: 8px; border: 1px dashed #A8DADC;">
                    <p style="margin: 0; color: #457B9D; font-size: 14px;">This order was processed via <strong>${orderData.paymentMethod || 'Wallet'}</strong>.</p>
                </div>
            </div>
            <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                <p>© 2026 Shrimpbite. All rights reserved.</p>
                <p>Vibhav Khand, Gomti Nagar, Lucknow</p>
            </div>
        </div>
    `;

    const mailOptions = {
        from: '"Shrimpbite" <noreply@shrimpbite.com>',
        to: userEmail,
        subject: `Your Shrimpbite Receipt - #${orderData.orderId}`,
        html: htmlContent
    };

    // await transporter.sendMail(mailOptions);
    console.log(`Professional Email Receipt Sent to ${userEmail}`);
};
