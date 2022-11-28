// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "base64-sol/base64.sol";

// ---------------------------------------
// █▀▀ █░█ █▀█ █▀█ █▄█ ▀█▀ █▀█ ▄▀█ █▀▀ █▄▀
// █▀░ █▄█ █▀▄ █▀▄ ░█░ ░█░ █▀▄ █▀█ █▄▄ █░█
// ---------------------------------------
// Demo Version v0.1.0    author: carawang
// ---------------------------------------

contract FurryTrack is ERC721, ERC721Burnable, Ownable {
    using Strings for uint256;
    using Counters for Counters.Counter;

    constructor() ERC721("FurryTrack", "FURRY") {}

    struct TokenMetadata {
        bool isDog;
        uint256 father;
        uint256 monther;
        string name;
        string image;
        string healthStatus;
    }

    uint WRITE_BLOCKS_FROM_NOW = 128;

    mapping(uint256 => address) private _writePermissionLists;
    mapping(uint256 => uint) private _writePermissionBlock;
    mapping(uint256 => TokenMetadata) private _tokenMetadata;

    Counters.Counter private _tokenIdCounter;

    event GrantWritePermission(uint256 indexed tokenId, address indexed signer, uint blockLimit);
    event StatusChanged(uint256 indexed tokenId, string healthStatus);

    function safeMint(bool isDog, string memory name, uint256 father, uint256 monther, string memory image, string memory healthStatus) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(msg.sender, tokenId);
        _tokenMetadata[tokenId] = TokenMetadata({
            name: name,
            isDog: isDog,
            father: father,
            monther: monther,
            image: image,
            healthStatus: healthStatus
        });
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        TokenMetadata storage tokenMetadata = _tokenMetadata[tokenId];
        string memory metadata = string(
            abi.encodePacked(
                '{"name":"',
                tokenMetadata.name,
                '", "image": "',
                tokenMetadata.image,
                '", "attributes":[{"trait_type":"father","value":',
                tokenMetadata.father.toString(),
                '},{"trait_type":"monther","value":',
                tokenMetadata.monther.toString(),
                '},{"trait_type":"health","value":"',
                tokenMetadata.healthStatus,
                '"},{"trait_type":"type", "value":"',
                tokenMetadata.isDog ? "Dog" : "Cat",
                '"}]',
                '}'
        )
        );

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(metadata))
        ));
    }

    function grantWritePermission(uint256 tokenId, address signer, bytes32 hash, bytes memory signature) public onlyTokenOwner(tokenId) {
        require(signer != ownerOf(tokenId), "not allow to grant permission to the token owner");
        require(recoverSigner(hash, signature) == signer, "invalid signature");

        _writePermissionLists[tokenId] = signer;
        _writePermissionBlock[tokenId] = block.number + WRITE_BLOCKS_FROM_NOW;

        emit GrantWritePermission(tokenId, _writePermissionLists[tokenId], _writePermissionBlock[tokenId]);
    }

    function isAddressCanWrite(address operator, uint256 tokenId) public view returns (bool) {
        return _writePermissionLists[tokenId] == operator &&
            _writePermissionBlock[tokenId] >= block.number + WRITE_BLOCKS_FROM_NOW;
    }

    function updateHealthStatus(uint256 tokenId, string memory status) public canWrite(tokenId) {
        _tokenMetadata[tokenId].healthStatus = status;

        emit StatusChanged(tokenId, status);
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(msg.sender == ownerOf(tokenId), "invalid sender who is not the token owner");
        _;
    }

    modifier canWrite(uint256 tokenId) {
        require(msg.sender == _writePermissionLists[tokenId], "invalid sender who has no permission to write");
        require(block.number <= _writePermissionBlock[tokenId], "the time of write permission expired");
        _;
    }

    function recoverSigner(bytes32 hash, bytes memory signature) public pure returns (address) {
        bytes32 messageDigest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32", 
                hash
            )
        );
        return ECDSA.recover(messageDigest, signature);
    }
}
