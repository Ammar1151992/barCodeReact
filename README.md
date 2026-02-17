# Barcode & IMEI Scanner for Telegram

React app with camera barcode/IMEI scanner that sends results to your Telegram bot after 1 second.

## Features

- **Green line overlay** – Scan only what’s under the green line
- **Line-only focus** – Decodes barcodes/IMEI only in the line area
- **1 second delay** – Sends to bot 1 second after a successful scan
- **Telegram Web App** – Uses `window.Telegram.WebApp.sendData()` when opened in Telegram

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Telegram Integration

1. Host the app on HTTPS (required for camera access).

2. Add the Telegram Web App script in your HTML (already added in `index.html`):
   ```html
   <script src="https://telegram.org/js/telegram-web-app.js"></script>
   ```

3. Set your Web App URL in the Telegram Bot API (when creating/editing the Web App).

4. When opened inside Telegram, the app uses `sendData()` to send the scanned value to your bot. Your bot should handle this in its message handler.

5. Data format: the app sends the raw string (barcode or IMEI) via `sendData(data)`.

## Notes

- Camera access must be allowed. On some devices (e.g. iOS in Telegram’s in-app browser), `getUserMedia` may be limited. Test in a normal browser first.
- Supports common formats: Code 128, Code 39, EAN, UPC, QR Code, etc.
- IMEI is read when it’s encoded as a barcode (e.g. Code 128).
