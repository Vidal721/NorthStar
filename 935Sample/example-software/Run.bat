@echo off
:: Start the development server in a new separate window
start npm run dev

:: Change folder to your server directory and run your backend
cd server
node index.js

pause
