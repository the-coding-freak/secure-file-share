// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FileSharing {
    struct FileRecord {
        string cid;
        address owner;
        uint256 registeredAt;
    }

    mapping(bytes32 => FileRecord) private files;
    mapping(address => bytes32[]) private ownerFiles;
    mapping(bytes32 => mapping(address => string)) private encryptedKeys;
    mapping(bytes32 => mapping(address => bool)) private hasAccess;

    event FileRegistered(bytes32 indexed fileId, address indexed owner, string cid);
    event AccessGranted(bytes32 indexed fileId, address indexed owner, address indexed recipient);
    event AccessRevoked(bytes32 indexed fileId, address indexed owner, address indexed recipient);

    error FileAlreadyRegistered();
    error FileNotFound();
    error NotFileOwner();
    error AccessDenied();
    error InvalidRecipient();
    error InvalidFileData();
    error InvalidKey();
    error AccessAlreadyGranted();
    error AccessNotGranted();

    function registerFile(bytes32 fileId, string calldata cid, string calldata ownerEncryptedKey) external {
        if (fileId == bytes32(0) || bytes(cid).length == 0 || bytes(ownerEncryptedKey).length == 0) {
            revert InvalidFileData();
        }

        FileRecord storage record = files[fileId];
        if (record.owner != address(0)) {
            revert FileAlreadyRegistered();
        }

        files[fileId] = FileRecord({ cid: cid, owner: msg.sender, registeredAt: block.timestamp });
        ownerFiles[msg.sender].push(fileId);

        encryptedKeys[fileId][msg.sender] = ownerEncryptedKey;
        hasAccess[fileId][msg.sender] = true;

        emit FileRegistered(fileId, msg.sender, cid);
    }

    function grantAccess(bytes32 fileId, address recipient, string calldata wrappedKey) external {
        FileRecord storage record = files[fileId];
        if (record.owner == address(0)) {
            revert FileNotFound();
        }
        if (record.owner != msg.sender) {
            revert NotFileOwner();
        }
        if (recipient == address(0) || recipient == msg.sender) {
            revert InvalidRecipient();
        }
        if (bytes(wrappedKey).length == 0) {
            revert InvalidKey();
        }
        if (hasAccess[fileId][recipient]) {
            revert AccessAlreadyGranted();
        }

        encryptedKeys[fileId][recipient] = wrappedKey;
        hasAccess[fileId][recipient] = true;

        emit AccessGranted(fileId, msg.sender, recipient);
    }

    function revokeAccess(bytes32 fileId, address recipient) external {
        FileRecord storage record = files[fileId];
        if (record.owner == address(0)) {
            revert FileNotFound();
        }
        if (record.owner != msg.sender) {
            revert NotFileOwner();
        }
        if (!hasAccess[fileId][recipient]) {
            revert AccessNotGranted();
        }

        hasAccess[fileId][recipient] = false;
        delete encryptedKeys[fileId][recipient];

        emit AccessRevoked(fileId, msg.sender, recipient);
    }

    function getCid(bytes32 fileId) external view returns (string memory) {
        FileRecord storage record = files[fileId];
        if (record.owner == address(0)) {
            revert FileNotFound();
        }
        if (!hasAccess[fileId][msg.sender]) {
            revert AccessDenied();
        }
        return record.cid;
    }

    function getEncryptedKey(bytes32 fileId, address user) external view returns (string memory) {
        FileRecord storage record = files[fileId];
        if (record.owner == address(0)) {
            revert FileNotFound();
        }
        if (msg.sender != user && msg.sender != record.owner) {
            revert AccessDenied();
        }
        if (!hasAccess[fileId][user]) {
            revert AccessNotGranted();
        }
        return encryptedKeys[fileId][user];
    }

    function getOwnerFiles(address owner) external view returns (bytes32[] memory) {
        return ownerFiles[owner];
    }

    function hasFileAccess(bytes32 fileId, address user) external view returns (bool) {
        return hasAccess[fileId][user];
    }
}
