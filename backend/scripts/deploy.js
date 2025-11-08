const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

async function main() {
  console.log("Deploying FileSharing contract...")

  const FileSharing = await hre.ethers.getContractFactory("FileSharing")
  const fileSharing = await FileSharing.deploy()

  await fileSharing.waitForDeployment()

  const contractAddress = await fileSharing.getAddress()
  console.log("FileSharing deployed to:", contractAddress)

  const [deployer] = await hre.ethers.getSigners()
  console.log("Deployer address:", deployer.address)

  try {
    const balance = await deployer.getBalance()
    console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH")
  } catch (e) {
    console.log("(Balance check skipped)")
  }

  const deploymentInfo = {
    contractAddress,
    deployerAddress: deployer.address,
    deployedAt: new Date().toISOString(),
    network: hre.network.name,
  }

  const backendOutputPath = path.join(__dirname, "../deployment.json")
  const frontendOutputPath = path.join(__dirname, "../../public/deployment.json")

  fs.writeFileSync(backendOutputPath, JSON.stringify(deploymentInfo, null, 2))
  console.log("Deployment info saved to backend:", backendOutputPath)

  // Ensure public directory exists
  const publicDir = path.dirname(frontendOutputPath)
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  fs.writeFileSync(frontendOutputPath, JSON.stringify(deploymentInfo, null, 2))
  console.log("Deployment info saved to frontend:", frontendOutputPath)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
