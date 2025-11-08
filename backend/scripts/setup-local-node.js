const hre = require("hardhat")
const { ethers } = require("ethers")

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log("Setting up local blockchain node...")
  console.log("Deployer address:", deployer.address)
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString())

  // Compile contracts
  console.log("\nCompiling contracts...")
  await hre.run("compile")

  // Deploy FileSharing contract
  console.log("Deploying FileSharing contract...")
  const FileSharing = await ethers.getContractFactory("FileSharing")
  const fileSharing = await FileSharing.deploy()
  await fileSharing.waitForDeployment()

  const contractAddress = await fileSharing.getAddress()
  console.log("✓ FileSharing contract deployed at:", contractAddress)

  console.log("\n✓ Local blockchain setup complete!")
  console.log("Contract address:", contractAddress)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
