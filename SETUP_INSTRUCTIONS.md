# Setup Instructions for Secure File Sharing System

## Quick Start (After Extracting ZIP)

### Step 1: Install Dependencies
Open terminal/PowerShell in the project root and run:

\`\`\`bash
npm install
npm run setup
\`\`\`

### Step 2: Set Environment Variables
Create a \`.env.local\` file in the root directory and add:

\`\`\`
PINATA_JWT=your_pinata_jwt_token_here
\`\`\`

### Step 3: Start Local Blockchain (Terminal 1)
\`\`\`bash
npm run backend:node
\`\`\`

Wait for it to show "Started HTTP and WebSocket JSON-RPC server"

### Step 4: Deploy Smart Contract (Terminal 2)
\`\`\`bash
npm run backend:deploy
\`\`\`

You should see:
- FileSharing deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
- This automatically updates \`public/deployment.json\`

### Step 5: Start Frontend (Terminal 3)
\`\`\`bash
npm run dev
\`\`\`

Open \`http://localhost:3000\`

## Troubleshooting

### Error: 'next' is not recognized
Run \`npm install\` first - dependencies are not installed.

### Error: deployer.getBalance is not a function
Run \`npm run setup\` to ensure backend dependencies are installed correctly.

### Files upload to IPFS but disappear from list
Contract interactions may have failed. Check browser console for errors.

### MetaMask doesn't show 10000 ETH
- Restart the local blockchain: \`npm run backend:node\`
- Redeploy the contract: \`npm run backend:deploy\`
- Refresh the webpage
- Make sure MetaMask is connected to localhost:8545 (Hardhat Network)
