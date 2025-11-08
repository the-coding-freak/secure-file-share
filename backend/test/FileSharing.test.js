const { expect } = require("chai")
const { ethers } = require("hardhat") // Import ethers from hardhat

describe("FileSharing", () => {
  let fileSharing
  let owner
  let recipient

  beforeEach(async () => {
    ;[owner, recipient] = await ethers.getSigners()
    const FileSharing = await ethers.getContractFactory("FileSharing")
    fileSharing = await FileSharing.deploy()
  })

  it("Should upload a file", async () => {
    const ipfsHash = "QmTest123"
    const encryptionKey = "secret-key"

    const tx = await fileSharing.uploadFile(ipfsHash, encryptionKey, false)
    const receipt = await tx.wait()

    const event = receipt.logs[0]
    expect(event.fragment.name).to.equal("FileUploaded")
  })

  it("Should share a file with another user", async () => {
    const ipfsHash = "QmTest123"
    const encryptionKey = "secret-key"

    const uploadTx = await fileSharing.uploadFile(ipfsHash, encryptionKey, false)
    const uploadReceipt = await uploadTx.wait()

    const fileId = uploadReceipt.logs[0].fragment.inputs[0].value

    await expect(fileSharing.shareFile(fileId, recipient.address)).to.emit(fileSharing, "FileShared")
  })
})
