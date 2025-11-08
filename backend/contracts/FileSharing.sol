// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FileSharing {
    struct FileMetadata {
        string ipfsHash;
        address owner;
        uint256 timestamp;
        string encryptionKey;
        bool isPublic;
    }

    struct AccessGrant {
        address grantee;
        uint256 grantedAt;
        bool revoked;
    }

    mapping(bytes32 => FileMetadata) public files;
    mapping(bytes32 => AccessGrant[]) public fileAccess;
    mapping(address => bytes32[]) public userFiles;

    event FileUploaded(bytes32 indexed fileId, address indexed owner, string ipfsHash);
    event FileShared(bytes32 indexed fileId, address indexed from, address indexed to);
    event FileRevoked(bytes32 indexed fileId, address indexed from, address indexed to);
    event FileDeleted(bytes32 indexed fileId, address indexed owner);

    function uploadFile(
        string memory ipfsHash,
        string memory encryptionKey,
        bool isPublic
    ) external returns (bytes32) {
        bytes32 fileId = keccak256(abi.encodePacked(msg.sender, ipfsHash, block.timestamp));
        
        files[fileId] = FileMetadata({
            ipfsHash: ipfsHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            encryptionKey: encryptionKey,
            isPublic: isPublic
        });

        userFiles[msg.sender].push(fileId);
        emit FileUploaded(fileId, msg.sender, ipfsHash);
        return fileId;
    }

    function shareFile(bytes32 fileId, address recipient) external {
        require(files[fileId].owner == msg.sender, "Only owner can share");
        require(recipient != address(0), "Invalid recipient");

        fileAccess[fileId].push(AccessGrant({
            grantee: recipient,
            grantedAt: block.timestamp,
            revoked: false
        }));

        emit FileShared(fileId, msg.sender, recipient);
    }

    function revokeAccess(bytes32 fileId, address recipient) external {
        require(files[fileId].owner == msg.sender, "Only owner can revoke");

        for (uint256 i = 0; i < fileAccess[fileId].length; i++) {
            if (fileAccess[fileId][i].grantee == recipient && !fileAccess[fileId][i].revoked) {
                fileAccess[fileId][i].revoked = true;
                emit FileRevoked(fileId, msg.sender, recipient);
                break;
            }
        }
    }

    function getFileMetadata(bytes32 fileId) external view returns (FileMetadata memory) {
        return files[fileId];
    }

    function getUserFiles(address user) external view returns (bytes32[] memory) {
        return userFiles[user];
    }

    function getFileAccess(bytes32 fileId) external view returns (AccessGrant[] memory) {
        return fileAccess[fileId];
    }
}
