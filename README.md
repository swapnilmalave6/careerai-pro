# AstraMind AI Working MVP

This folder contains a working all-in-one AI assistant MVP.

## What Is Ready

- Node.js backend
- Login and register
- Local JSON database: `data/db.json`
- ChatGPT-style AI chat
- AI modes for general help, code, study, career, business, content, translation, email and prompts
- Resume Analyzer
- Career DNA Generator
- Job role dropdown
- Education stream dropdown
- Cover Letter Generator
- Interview Questions
- Resume Builder with PDF print/download
- Plans: Free, Pro INR 199/month, Premium INR 499/month
- Demo payment flow with method, mobile number and coupon fields
- Optional Gemini API integration

## How To Run

1. Open this folder:

```text
C:\Users\ADMIN\OneDrive\Documents\payton development\careerai_working_app
```

2. Double-click:

```text
START_CAREERAI.bat
```

3. Open the app in your browser:

```text
http://localhost:3000
```

## Connect Real Gemini AI

Get an API key from Google AI Studio, then run:

```powershell
$env:GEMINI_API_KEY="YOUR_API_KEY_HERE"
npm start
```

Without an API key, the app still works in smart demo mode.

## Production Work Still Needed

- Add real PDF/DOCX text extraction
- Connect PostgreSQL or Supabase
- Add live Razorpay order creation, payment verification and webhooks
- Deploy the website on Render, Railway, Vercel or another hosting platform
- Build an Android WebView app and upload it to Google Play

## Play Store Requirements

- Privacy Policy URL
- App icon
- Screenshots
- Android App Bundle `.aab`
- Data Safety form
- App access details
- Payment or subscription declaration
