# WhatsApp Cloud API Integration — Vendor Order Notification

## When to implement
Implement once Meta provides: **Phone Number ID**, **WhatsApp Business Account ID**, and a **permanent access token**.

---

## What we need from Meta (ask them to provide)
| Credential | Where to find | Env var name |
|---|---|---|
| Permanent Access Token | Meta Business Suite → System User → Token | `WHATSAPP_ACCESS_TOKEN` |
| Phone Number ID | Meta Developer Console → WhatsApp → API Setup | `WHATSAPP_PHONE_NUMBER_ID` |

No npm package needed — it's a plain HTTPS POST to Meta's Graph API.

---

## Message template to create in Meta Business Manager
Before going live, create a **message template** (must be approved by Meta, takes ~24h).

**Template name:** `new_order_vendor_notification`  
**Category:** `UTILITY`  
**Language:** English

**Body text:**
```
Hi {{1}}, you have a new order! 🛒

Customer: {{2}} ({{3}})
Items: {{4}}
Total: ₹{{5}}

Login to your Difwa portal to accept the order.
— Team Difwa
```

Variables:
1. Business name
2. Customer name
3. Customer phone
4. Items summary (e.g. "Water Bottle x2, Water Bottle 20L x1")
5. Total amount

---

## Implementation plan (all in one place)

### 1. Add env vars to `.env`
```
WHATSAPP_ACCESS_TOKEN=your_permanent_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
```

### 2. Create `services/whatsappService.js`
```js
const GRAPH_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export const sendVendorOrderNotification = async ({ toPhone, businessName, customerName, customerPhone, itemsSummary, totalAmount }) => {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        console.warn("[WhatsApp] Credentials not configured, skipping.");
        return;
    }

    // Normalize phone: must be E.164 format, e.g. 919876543210
    const normalized = toPhone.startsWith('+') ? toPhone.slice(1) : toPhone.startsWith('91') ? toPhone : `91${toPhone}`;

    const payload = {
        messaging_product: "whatsapp",
        to: normalized,
        type: "template",
        template: {
            name: "new_order_vendor_notification",
            language: { code: "en" },
            components: [{
                type: "body",
                parameters: [
                    { type: "text", text: businessName },
                    { type: "text", text: customerName },
                    { type: "text", text: customerPhone },
                    { type: "text", text: itemsSummary },
                    { type: "text", text: String(totalAmount) }
                ]
            }]
        }
    };

    const res = await fetch(GRAPH_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
        console.error("[WhatsApp] Send failed:", data);
    } else {
        console.log("[WhatsApp] Message sent to", normalized);
    }
    return data;
};
```

### 3. Hook into `orderController.js` → `placeOrder` (after order commit, in background)
```js
import { sendVendorOrderNotification } from "../services/whatsappService.js";

// After the order is created and populatedOrder is fetched:
const retailerDoc = await User.findById(identifiedRetailer).select("whatsappNumber businessDetails.businessName");
const buyer = await AppUser.findById(userId).select("fullName phoneNumber");

if (retailerDoc?.whatsappNumber) {
    const itemsSummary = orderItems.map(i => `${i.product?.name || "Item"} x${i.quantity}`).join(", ");
    sendVendorOrderNotification({
        toPhone: retailerDoc.whatsappNumber,
        businessName: retailerDoc.businessDetails?.businessName || retailerDoc.name,
        customerName: buyer?.fullName || "Customer",
        customerPhone: buyer?.phoneNumber || "N/A",
        itemsSummary,
        totalAmount
    }).catch(e => console.error("[WhatsApp] Background send failed:", e));
}
```

> Fire and forget — wrap in `.catch()` so a WhatsApp failure never breaks the order placement.

---

## Notes
- Free tier: **1000 conversations/month** (a conversation = 24h window)
- Template messages are the only way to initiate contact (business-initiated)
- Test with Meta's test phone number first before going live
- If vendor has no `whatsappNumber` set during onboarding, the message is silently skipped
- Do NOT use the temp dev tokens from the API setup page — they expire in 24h. Always use a **System User permanent token** from Meta Business Suite.
