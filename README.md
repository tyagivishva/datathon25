Return&Reward: Lost and Found Item Tracker
Return&Reward is a modern, real-time lost and found application designed to connect item owners with finders quickly and securely using unique QR codes and in-app chat. This application is built using React, Tailwind CSS, and Google Firebase for authentication and real-time data persistence.

🚀 Features

Google Authentication: Secure user sign-in using Firebase Authentication with the Google provider.

User Profiles: Capture user name and photo after initial sign-in.
Item Registration: Owners can register items (e.g., water bottles, keys) and generate a unique QR code.
QR Code Linkage: Each QR code encodes a unique Item ID, allowing a finder to locate the owner's profile by scanning it (simulated via manual ID entry in the app).
In-App Chat: Finders can initiate a private chat with the item owner to arrange the item's return.
Real-time Status: Items can be marked as missing or returned in real-time.
Clean UI: Fully responsive, modern UI built with Tailwind CSS.

⚙️ Local Setup Guide

This application requires Node.js, npm, and a Google Firebase project for data storage and authentication.
1. Prerequisites
Node.js (v18+) and npm/Yarn
A created and configured Google Firebase Project with:
Firestore Database enabled.
Authentication enabled with the Google Sign-in Provider.

3. Project Installation
   
Navigate to your project folder (ReturnAndReward) and install the necessary packages:
# Install Node dependencies (React, Vite)
npm install

# Install Firebase and Lucide icons (used in App.jsx)
npm install firebase lucide-react
