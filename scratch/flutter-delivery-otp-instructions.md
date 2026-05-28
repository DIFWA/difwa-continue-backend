# Flutter Dev Instructions — Delivery OTP Flow

## What was built (backend is done, you only need to implement UI)

A delivery verification system using OTP. When a rider is about to complete an order, they request an OTP which is sent to the customer's active order screen. The customer tells the rider the OTP. The rider enters it → order is marked Delivered.

---

## New API Endpoints

### 1. Request OTP (Rider calls this when tapping "Complete Order")
```
POST /api/rider/request-otp
Authorization: Bearer <rider_token>

Body:
{
  "orderId": "#ABC12345"   // the display orderId string, not mongo _id
}

Success Response:
{
  "success": true,
  "message": "OTP sent to customer successfully",
  "otp": "4821"   // 4-digit string (kept for dev/debug — can remove from UI display on rider side)
}

Error cases:
- 404: Order not found or not assigned to this rider
- 400: Order status doesn't allow OTP (e.g. already Delivered)
```

### 2. Verify OTP (Rider submits OTP entered from customer)
```
POST /api/rider/verify-otp
Authorization: Bearer <rider_token>

Body:
{
  "orderId": "#ABC12345",
  "otp": "4821"
}

Success Response:
{
  "success": true,
  "message": "OTP verified. Order marked as Delivered.",
  "data": { ...full order object }
}

Error cases:
- 400: "Incorrect OTP. Please try again."
- 400: "OTP has expired. Please request a new one."
- 400: "No OTP has been requested for this order."
- 404: Order not found
```

---

## Socket Event (Customer receives OTP in real-time)

The customer app must listen for the `DELIVERY_OTP` socket event on their socket connection.

```
Event name: "DELIVERY_OTP"

Payload:
{
  "orderId": "#ABC12345",
  "otp": "4821",
  "expiresAt": "2026-05-28T14:30:00.000Z"   // ISO date string
}
```

**The customer is already in room `user_{userId}` via the existing socket join logic — no room change needed. Just add the event listener.**

---

## What to build — Customer App

### Active Orders Screen
When a `DELIVERY_OTP` socket event arrives for an order the customer is viewing (match by `orderId`):

1. Show a prominent OTP banner/card on that order's detail screen
2. Display the 4 digits large and clearly (like a PIN display)
3. Show expiry time: "Valid until HH:MM" (parse `expiresAt`)
4. Do NOT let the customer dismiss/hide it — it must stay visible so they can read it to the rider

**Example UI:**
```
┌─────────────────────────────────┐
│  🔐 Share this OTP with rider   │
│                                 │
│         4  8  2  1              │
│                                 │
│  Valid until 3:30 PM            │
└─────────────────────────────────┘
```

Also handle: if the customer refreshes/navigates away and comes back, the order object from `GET /api/orders/active` now includes `deliveryOtp` and `deliveryOtpExpiresAt` fields directly — so you can restore the OTP display from the API response without needing a socket event.

Order object now has:
```json
{
  "deliveryOtp": "4821",
  "deliveryOtpExpiresAt": "2026-05-28T14:30:00.000Z",
  ...rest of order
}
```
Show the OTP UI whenever `deliveryOtp` is not null and `deliveryOtpExpiresAt` is in the future.

---

## What to build — Rider App

### Active Delivery Screen
Replace (or rename) the current "Mark as Delivered" / "Complete" button flow:

**Step 1 — Rider taps "Complete Order"**
- Call `POST /api/rider/request-otp` with the orderId
- Show a loading state while calling
- On success: switch UI to OTP entry mode (Step 2)
- On error: show error message (toast)

**Step 2 — OTP Entry UI**
```
┌─────────────────────────────────────┐
│  Enter OTP from customer            │
│                                     │
│  [ _ ]  [ _ ]  [ _ ]  [ _ ]        │
│         (4-digit input)             │
│                                     │
│  [  Verify & Complete Order  ]      │
│                                     │
│  Didn't deliver OTP?                │
│  [ Resend OTP to customer ]         │
└─────────────────────────────────────┘
```

- 4-digit OTP input (can be 4 separate boxes or a single numeric input)
- "Verify & Complete Order" button → calls `POST /api/rider/verify-otp`
  - On success: order is done, show success screen, navigate away
  - On error "Incorrect OTP": shake animation + "Wrong OTP, try again"
  - On error "OTP expired": show "OTP expired" + offer resend button
- "Resend OTP" button → calls `POST /api/rider/request-otp` again (same endpoint, regenerates and re-pushes to customer)

---

## OTP Lifetime
- **1 hour** from when `request-otp` is called
- Calling `request-otp` again (resend) resets the timer to a fresh 1 hour
- OTP is automatically cleared from the order after successful `verify-otp`

---

## Edge Cases to Handle

| Scenario | What happens |
|---|---|
| Customer closes app before seeing OTP | Rider taps "Resend OTP" → new OTP pushed to customer via socket |
| OTP expires | Rider taps "Resend OTP" → new OTP generated |
| Customer never installed app | Admin has OTP in admin panel as backup (admin can relay verbally) |
| Rider accidentally navigates back | OTP entry state can be restored from the order's `deliveryOtp` field in `GET /api/rider/orders` |

---

## No SMS service needed
OTP is delivered via socket (real-time push to customer app). No Twilio/Firebase messaging needed for this feature. The existing socket infrastructure handles delivery.
