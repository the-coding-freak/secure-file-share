const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("FileSharing", () => {
  let contract
  let owner
  let recipient
  let thirdParty
  const cid = "ipfs://example-cid"
  const ownerKey = "owner-wrapped-key"

  function createFileId(label) {
    return ethers.keccak256(ethers.toUtf8Bytes(label))
  }

  beforeEach(async () => {
    ;[owner, recipient, thirdParty] = await ethers.getSigners()
    const FileSharing = await ethers.getContractFactory("FileSharing")
    contract = await FileSharing.deploy()
  })

  it("registers a file and stores the owner's encrypted key", async () => {
    const fileId = createFileId("file-1")

    await expect(contract.registerFile(fileId, cid, ownerKey))
      .to.emit(contract, "FileRegistered")
      .withArgs(fileId, owner.address, cid)

    const storedCid = await contract.connect(owner).getCid(fileId)
    expect(storedCid).to.equal(cid)

    const storedKey = await contract.getEncryptedKey(fileId, owner.address)
    expect(storedKey).to.equal(ownerKey)

    const ownerFiles = await contract.getOwnerFiles(owner.address)
    expect(ownerFiles).to.deep.equal([fileId])
  })

  it("prevents unauthorized users from reading file data", async () => {
    const fileId = createFileId("file-unauthorized")
    await contract.registerFile(fileId, cid, ownerKey)

    await expect(contract.connect(recipient).getCid(fileId)).to.be.revertedWithCustomError(contract, "AccessDenied")
  })

  it("grants and revokes access correctly", async () => {
    const fileId = createFileId("file-share")
    await contract.registerFile(fileId, cid, ownerKey)

    const recipientKey = "recipient-wrapped-key"
    await expect(contract.grantAccess(fileId, recipient.address, recipientKey))
      .to.emit(contract, "AccessGranted")
      .withArgs(fileId, owner.address, recipient.address)

    expect(await contract.hasFileAccess(fileId, recipient.address)).to.equal(true)

    const cidForRecipient = await contract.connect(recipient).getCid(fileId)
    expect(cidForRecipient).to.equal(cid)

    const retrievedKey = await contract.connect(recipient).getEncryptedKey(fileId, recipient.address)
    expect(retrievedKey).to.equal(recipientKey)

    await expect(contract.revokeAccess(fileId, recipient.address))
      .to.emit(contract, "AccessRevoked")
      .withArgs(fileId, owner.address, recipient.address)

    expect(await contract.hasFileAccess(fileId, recipient.address)).to.equal(false)

    await expect(contract.connect(recipient).getCid(fileId)).to.be.revertedWithCustomError(contract, "AccessDenied")
    await expect(contract.getEncryptedKey(fileId, recipient.address)).to.be.revertedWithCustomError(
      contract,
      "AccessNotGranted",
    )

    await expect(contract.connect(thirdParty).grantAccess(fileId, recipient.address, "foo"))
      .to.be.revertedWithCustomError(contract, "NotFileOwner")
  })
})
