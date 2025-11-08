# Secure File Sharing - Deployment Guide

## Quick Start (5 minutes)

### Step 1: Install Backend Dependencies
\`\`\`bash
npm run setup
\`\`\`

### Step 2: Start Local Blockchain (Terminal 1)
\`\`\`bash
npm run backend:node
\`\`\`
This starts the Hardhat local blockchain on `http://127.0.0.1:8545`

Wait for output showing:
\`\`\`
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
\`\`\`

### Step 3: Deploy Smart Contract (Terminal 2)
\`\`\`bash
npm run backend:deploy
\`\`\`

You should see:
\`\`\`
Deploying FileSharing contract...
FileSharing deployed to: 0x5FbDB2315678afccb333f8a9c36a1a19bDfdb29b
Deployment info saved to frontend: public/deployment.json
\`\`\`

### Step 4: Start Frontend (Terminal 3)
\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:3000 in your browser.

### Step 5: Connect Wallet
1. Click "Connect Wallet" button
2. MetaMask will prompt you to switch to localhost network
3. Click "Switch Network" 
4. You're connected!

### Step 6: Upload & Share Files
1. Your wallet is now connected
2. Upload files - they'll be encrypted and stored on IPFS
3. Share file access with other wallet addresses
4. Download shared files and decrypt them automatically

## Troubleshooting

### "Contract not deployed" error
- Make sure you ran `npm run backend:node` first
- Make sure you ran `npm run backend:deploy` after
- Check that `public/deployment.json` has a valid address (not 0x000...)
- Refresh the browser page

### MetaMask won't connect
- Make sure you have MetaMask installed
- Click the wallet button and select MetaMask
- Accept the connection request

### Files not uploading
- Check browser console for errors
- Make sure your PINATA_JWT is set in environment variables
- Make sure Hardhat node is still running

## Network Details
- Network: Hardhat Local (localhost:8545)
- Chain ID: 31337
- Account 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- Initial Balance: 10000 ETH (test funds)

## Stopping

To stop the services:
1. Terminal 1 (Hardhat): Press Ctrl+C
2. Terminal 2 (Next.js): Press Ctrl+C

Next time you start, just repeat Steps 2, 3, and 4.
