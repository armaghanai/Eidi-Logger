# Eidi Logger ✨

A sleek, full-stack, end-to-end encrypted financial tracker designed to log Eidi (gifted money) with automated AI-driven financial insights.

Built with **Vanilla JS**, **Tailwind CSS**, **Node.js (Express)**, **Supabase**, and **Google Gemini AI**.

---

## 🌟 Features
- **Premium UI/UX:** Stunning dark/light mode glassmorphism interface powered by Tailwind CSS and Chart.js.
- **Secure Authentication:** Standard Email & Password authentication powered by Supabase Auth protocols.
- **Transaction History:** Instantly add or delete entries. Balance, total received, and total sent metrics recalculate on the fly.
- **AI Financial Insights:** Generates personalized financial tips based on your logged Eidi amounts utilizing the blazing fast **Gemini 2.0 Flash** model.
- **Serverless Ready:** Pre-configured `vercel.json` for instant 1-click deployment on Vercel's global edge network.

## 🚀 Quick Start (Local Development)

### 1. Configure Environment
Create a `.env` file in your root directory and populate it with your keys:
```env
SUPABASE_URL=https://your-project-url.supabase.co
SUPABASE_ANNON_KEY=your-anon-key
GEMINI_API_KEY=your-google-ai-studio-key
PORT=4000
```

### 2. Install Dependencies
```bash
npm install express cors dotenv @supabase/supabase-js
```

### 3. Run the Backend & Frontend
The backend Express app serves the frontend statically. Simply run:
```bash
node server.js
```
Open `http://localhost:4000` in your browser. You will be instantly routed to the secure authentication portal.

## 🌐 Deploying to Vercel
This project is configured out-of-the-box for Vercel. 
1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your terminal.
3. Once prompted, add your `.env` variables to your Vercel Project Settings online. 
4. Traffic is automatically routed natively: frontend static assets serve from Vercel Edge, while `/api/*` proxies into your serverless Node.js lambda functions.
