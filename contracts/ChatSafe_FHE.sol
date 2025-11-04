pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract ChatSafeFHE is ZamaEthereumConfig {
    struct EncryptedMessage {
        address sender;
        address receiver;
        euint32 encryptedContent;
        uint256 timestamp;
        bool isFiltered;
        uint32 filterResult;
    }

    struct FilterRule {
        string keyword;
        euint32 encryptedPattern;
        bool isActive;
    }

    mapping(uint256 => EncryptedMessage) public messages;
    mapping(uint256 => FilterRule) public filterRules;
    mapping(address => uint256[]) public userMessages;
    mapping(address => uint256[]) public userFilters;

    uint256 public messageCount = 0;
    uint256 public filterCount = 0;

    event MessageSent(uint256 indexed messageId, address indexed sender, address indexed receiver);
    event FilterApplied(uint256 indexed messageId, uint256 indexed filterId, uint32 result);
    event FilterCreated(uint256 indexed filterId, address indexed creator);

    constructor() ZamaEthereumConfig() {}

    function sendMessage(
        address receiver,
        externalEuint32 encryptedContent,
        bytes calldata inputProof
    ) external {
        require(FHE.isInitialized(FHE.fromExternal(encryptedContent, inputProof)), "Invalid encrypted content");

        euint32 content = FHE.fromExternal(encryptedContent, inputProof);
        FHE.allowThis(content);
        FHE.makePubliclyDecryptable(content);

        messages[messageCount] = EncryptedMessage({
            sender: msg.sender,
            receiver: receiver,
            encryptedContent: content,
            timestamp: block.timestamp,
            isFiltered: false,
            filterResult: 0
        });

        userMessages[msg.sender].push(messageCount);
        userMessages[receiver].push(messageCount);

        emit MessageSent(messageCount, msg.sender, receiver);
        messageCount++;
    }

    function createFilter(
        string calldata keyword,
        externalEuint32 encryptedPattern,
        bytes calldata inputProof
    ) external {
        require(FHE.isInitialized(FHE.fromExternal(encryptedPattern, inputProof)), "Invalid encrypted pattern");

        euint32 pattern = FHE.fromExternal(encryptedPattern, inputProof);
        FHE.allowThis(pattern);
        FHE.makePubliclyDecryptable(pattern);

        filterRules[filterCount] = FilterRule({
            keyword: keyword,
            encryptedPattern: pattern,
            isActive: true
        });

        userFilters[msg.sender].push(filterCount);
        emit FilterCreated(filterCount, msg.sender);
        filterCount++;
    }

    function applyFilter(uint256 messageId, uint256 filterId) external {
        require(messageCount > messageId, "Invalid message ID");
        require(filterCount > filterId, "Invalid filter ID");
        require(filterRules[filterId].isActive, "Filter inactive");

        EncryptedMessage storage msg = messages[messageId];
        require(!msg.isFiltered, "Message already filtered");

        euint32 content = msg.encryptedContent;
        euint32 pattern = filterRules[filterId].encryptedPattern;

        // Homomorphic keyword filtering
        euint32 result = FHE.eq(content, pattern);
        FHE.allowThis(result);
        FHE.makePubliclyDecryptable(result);

        msg.isFiltered = true;
        msg.filterResult = FHE.decrypt(result);

        emit FilterApplied(messageId, filterId, msg.filterResult);
    }

    function getMessage(uint256 messageId) external view returns (
        address sender,
        address receiver,
        euint32 encryptedContent,
        uint256 timestamp,
        bool isFiltered,
        uint32 filterResult
    ) {
        require(messageCount > messageId, "Invalid message ID");
        EncryptedMessage storage msg = messages[messageId];
        return (
            msg.sender,
            msg.receiver,
            msg.encryptedContent,
            msg.timestamp,
            msg.isFiltered,
            msg.filterResult
        );
    }

    function getFilter(uint256 filterId) external view returns (
        string memory keyword,
        euint32 encryptedPattern,
        bool isActive
    ) {
        require(filterCount > filterId, "Invalid filter ID");
        FilterRule storage rule = filterRules[filterId];
        return (
            rule.keyword,
            rule.encryptedPattern,
            rule.isActive
        );
    }

    function getUserMessages(address user) external view returns (uint256[] memory) {
        return userMessages[user];
    }

    function getUserFilters(address user) external view returns (uint256[] memory) {
        return userFilters[user];
    }

    function toggleFilterStatus(uint256 filterId) external {
        require(filterCount > filterId, "Invalid filter ID");
        filterRules[filterId].isActive = !filterRules[filterId].isActive;
    }

    function getMessageCount() external view returns (uint256) {
        return messageCount;
    }

    function getFilterCount() external view returns (uint256) {
        return filterCount;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}

