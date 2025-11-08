const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

console.log("[v0] Starting contract deployment...\n")

try {
  // Step 1: Check if Hardhat node is running
  console.log("Step 1: Checking for local Hardhat node...")
  console.log("Make sure you have run: npm run backend:node")
  console.log("(in a separate terminal)\n")

  // Step 2: Run deployment
  console.log("Step 2: Deploying contract...")
  execSync("cd backend && npm run deploy", { stdio: "inherit" })

  // Step 3: Verify deployment file
  console.log("\nStep 3: Verifying deployment...")
  const deploymentPath = path.join(__dirname, "../public/deployment.json")

  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"))

    if (deployment.contractAddress && deployment.contractAddress !== "0x0000000000000000000000000000000000000000") {
      console.log("✓ Contract deployed successfully!")
      console.log("✓ Address:", deployment.contractAddress)
      console.log("✓ Network:", deployment.network)
      console.log("\n✓ Deployment file saved to: public/deployment.json")
      console.log("\nNow refresh your browser to load the contract!")
    } else {
      console.error("✗ Deployment file exists but contract address is invalid")
      process.exit(1)
    }
  } else {
    console.error("✗ Deployment file not created. Make sure Hardhat node is running.")
    process.exit(1)
  }
} catch (error) {
  console.error("✗ Deployment failed:", error.message)
  console.log("\nTroubleshooting:")
  console.log("1. Make sure you ran: npm run backend:node")
  console.log("2. Make sure backend dependencies are installed: cd backend && npm install")
  console.log("3. Try again: npm run deploy-contract")
  process.exit(1)
}
