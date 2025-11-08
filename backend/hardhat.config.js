require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()

const DEFAULT_MNEMONIC = "test test test test test test test test test test test junk"

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic: process.env.HARDHAT_MNEMONIC || DEFAULT_MNEMONIC,
      },
    },
    localhost: {
      url: process.env.LOCAL_RPC_URL || "http://192.168.0.111:8545",
      accounts: {
        mnemonic: process.env.HARDHAT_MNEMONIC || DEFAULT_MNEMONIC,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    artifacts: "./artifacts",
    cache: "./cache",
  },
}
